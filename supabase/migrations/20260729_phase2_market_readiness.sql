-- TubeTV Phase 2: trusted identity, entitlements, payments, and viewer state.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

grant execute on function public.is_admin() to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone_e164, display_name)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.phone)
  )
  on conflict (id) do update
    set phone_e164 = excluded.phone_e164,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of phone, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, phone_e164, display_name)
select id, phone, coalesce(raw_user_meta_data ->> 'display_name', phone)
from auth.users
on conflict (id) do nothing;

alter table public.videos add column if not exists creator_id uuid references auth.users(id) on delete set null;
update public.videos v
set creator_id = p.id
from public.profiles p
where v.creator_id is null
  and v.creator_phone is not null
  and regexp_replace(coalesce(v.creator_phone, ''), '\D', '', 'g')
      = regexp_replace(coalesce(p.phone_e164, ''), '\D', '', 'g');

drop policy if exists "Creators can insert their own videos" on public.videos;
drop policy if exists "Creators can update their own videos" on public.videos;
drop policy if exists "Creators can delete their own videos" on public.videos;
create policy "Creators can insert owned videos" on public.videos
  for insert to authenticated
  with check (creator_id = auth.uid() or public.is_admin());
create policy "Creators can update owned videos" on public.videos
  for update to authenticated
  using (creator_id = auth.uid() or public.is_admin())
  with check (creator_id = auth.uid() or public.is_admin());
create policy "Creators can delete owned videos" on public.videos
  for delete to authenticated
  using (creator_id = auth.uid() or public.is_admin());
create index if not exists videos_creator_id_idx on public.videos (creator_id);

drop policy if exists "Creators can read their own video stats" on public.daily_video_stats;
drop policy if exists "Creators can manage their own video stats" on public.daily_video_stats;
create policy "Creators can read owned video stats" on public.daily_video_stats
  for select to authenticated using (
    exists (
      select 1 from public.videos
      where videos.id = daily_video_stats.video_id
        and (videos.creator_id = auth.uid() or public.is_admin())
    )
  );

alter table public.subscriptions drop constraint if exists subscriptions_tier_check;
alter table public.subscriptions
  add constraint subscriptions_tier_check
  check (tier in ('free', 'msingi', 'ndovu', 'daily', 'weekly', 'monthly'));
alter table public.subscriptions add column if not exists updated_at timestamptz not null default now();

with ranked_active_subscriptions as (
  select id, row_number() over (
    partition by user_id
    order by end_date desc nulls first, created_at desc
  ) as row_number
  from public.subscriptions
  where is_active = true
)
update public.subscriptions set is_active = false
where id in (select id from ranked_active_subscriptions where row_number > 1);

create unique index if not exists one_active_subscription_per_user
  on public.subscriptions (user_id) where is_active = true;

drop policy if exists "Service role can write subscriptions" on public.subscriptions;
drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their subscriptions" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  plan_code text not null check (plan_code in ('daily', 'weekly', 'monthly')),
  amount_kes integer not null check (amount_kes > 0),
  idempotency_key text not null,
  merchant_request_id text,
  checkout_request_id text unique,
  mpesa_receipt text unique,
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'succeeded', 'failed', 'cancelled')),
  result_code integer,
  result_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

alter table public.payment_transactions enable row level security;
create policy "Users can read their payment transactions" on public.payment_transactions
  for select to authenticated using (auth.uid() = user_id);
create index if not exists payment_transactions_user_idx
  on public.payment_transactions (user_id, created_at desc);

create table if not exists public.watch_later (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table public.watch_later enable row level security;
create policy "Users manage their watch list" on public.watch_later
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.watch_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  position_seconds numeric not null default 0 check (position_seconds >= 0),
  duration_seconds numeric not null default 0 check (duration_seconds >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table public.watch_progress enable row level security;
create policy "Users manage their watch progress" on public.watch_progress
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create index if not exists watch_progress_recent_idx
  on public.watch_progress (user_id, updated_at desc);

create table if not exists public.viewer_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  autoplay boolean not null default true,
  captions boolean not null default false,
  quality text not null default 'auto'
    check (quality in ('auto', '1080p', '720p', '480p', '360p')),
  data_saver boolean not null default false,
  maximum_rating text not null default 'PG'
    check (maximum_rating in ('GE', 'PG', '16')),
  updated_at timestamptz not null default now()
);

alter table public.viewer_preferences enable row level security;
create policy "Users manage their viewer preferences" on public.viewer_preferences
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();
drop trigger if exists set_payment_transactions_updated_at on public.payment_transactions;
create trigger set_payment_transactions_updated_at before update on public.payment_transactions
  for each row execute function public.update_updated_at();
drop trigger if exists set_viewer_preferences_updated_at on public.viewer_preferences;
create trigger set_viewer_preferences_updated_at before update on public.viewer_preferences
  for each row execute function public.update_updated_at();
