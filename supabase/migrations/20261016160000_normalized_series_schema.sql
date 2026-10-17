-- ==============================================================================
-- TubeTV: Normalized Series, Seasons & Episodes Schema
-- Replaces fragile Bunny metaTags with ACID transactional relational tables.
-- ==============================================================================

-- 1. Series Table
create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  format text not null default 'micro-drama' check (format in ('micro-drama', 'standard')),
  synopsis text not null,
  portrait_poster_url text,
  landscape_poster_url text,
  creator_id uuid references auth.users(id) on delete set null,
  creator_name text not null default 'TubeTV Creator',
  genre text default 'Drama',
  content_rating text not null default 'PG' check (content_rating in ('GE', 'PG', '16', '18')),
  release_schedule text default 'Daily',
  is_published boolean not null default true,
  total_views bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.series enable row level security;

-- Public can view published series; Admins can view all
drop policy if exists "Public can view published series" on public.series;
create policy "Public can view published series" on public.series
  for select using (is_published = true or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

drop policy if exists "Admins can manage series" on public.series;
create policy "Admins can manage series" on public.series
  for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

create index if not exists series_format_published_idx on public.series (format, is_published, total_views desc);
create index if not exists series_slug_idx on public.series (slug);

-- 2. Seasons Table
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  season_number integer not null check (season_number >= 1),
  title text,
  synopsis text,
  poster_url text,
  created_at timestamptz not null default now(),
  unique (series_id, season_number)
);

alter table public.seasons enable row level security;

drop policy if exists "Public can view seasons" on public.seasons;
create policy "Public can view seasons" on public.seasons
  for select using (true);

drop policy if exists "Admins can manage seasons" on public.seasons;
create policy "Admins can manage seasons" on public.seasons
  for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

-- 3. Episodes Table
create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  season_number integer not null default 1 check (season_number >= 1),
  episode_number integer not null check (episode_number >= 1),
  title text not null,
  synopsis text,
  bunny_guid text not null unique,
  duration_seconds integer not null default 0,
  intro_end_seconds integer check (intro_end_seconds >= 0),
  outro_start_seconds integer check (outro_start_seconds >= 0),
  thumbnail_url text,
  captions_url text,
  transcript text,
  is_free boolean not null default false,
  price_coins integer not null default 10 check (price_coins >= 0),
  is_published boolean not null default true,
  release_at timestamptz not null default now(),
  views bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, season_number, episode_number)
);

alter table public.episodes enable row level security;

drop policy if exists "Public can view published episodes" on public.episodes;
create policy "Public can view published episodes" on public.episodes
  for select using (
    (is_published = true and release_at <= now())
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
  );

drop policy if exists "Admins can manage episodes" on public.episodes;
create policy "Admins can manage episodes" on public.episodes
  for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

create index if not exists episodes_series_order_idx
  on public.episodes (series_id, season_number, episode_number);
create index if not exists episodes_bunny_guid_idx
  on public.episodes (bunny_guid);

-- 4. High-Performance Query RPC: Fetch Series with Episodes and Caller Unlock Status
create or replace function public.get_series_details(p_series_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_has_vip boolean := false;
  v_series record;
  v_episodes json;
begin
  v_user_id := auth.uid();

  -- Check VIP Pass
  if v_user_id is not null then
    select exists (
      select 1 from public.subscriptions
      where user_id = v_user_id and is_active = true and (end_date is null or end_date > now())
    ) into v_has_vip;
  end if;

  -- Get series
  select * into v_series
  from public.series
  where slug = p_series_slug
    and (is_published = true or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

  if not found then
    return null;
  end if;

  -- Get sorted episodes with caller unlock flags
  select json_agg(
    json_build_object(
      'id', e.id,
      'bunnyGuid', e.bunny_guid,
      'season', e.season_number,
      'episode', e.episode_number,
      'title', e.title,
      'synopsis', e.synopsis,
      'durationSeconds', e.duration_seconds,
      'thumbnailUrl', e.thumbnail_url,
      'introEndSeconds', e.intro_end_seconds,
      'outroStartSeconds', e.outro_start_seconds,
      'isFree', e.is_free or e.episode_number <= 3,
      'priceCoins', e.price_coins,
      'isUnlocked', (
        e.is_free
        or e.episode_number <= 3
        or v_has_vip
        or exists (
          select 1 from public.episode_unlocks u
          where u.user_id = v_user_id and u.video_id = e.bunny_guid
        )
      )
    ) order by e.season_number asc, e.episode_number asc
  ) into v_episodes
  from public.episodes e
  where e.series_id = v_series.id
    and (e.is_published = true and e.release_at <= now() or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));

  return json_build_object(
    'id', v_series.id,
    'slug', v_series.slug,
    'title', v_series.title,
    'format', v_series.format,
    'synopsis', v_series.synopsis,
    'portraitPosterUrl', v_series.portrait_poster_url,
    'landscapePosterUrl', v_series.landscape_poster_url,
    'genre', v_series.genre,
    'contentRating', v_series.content_rating,
    'episodes', coalesce(v_episodes, '[]'::json)
  );
end;
$$;

grant execute on function public.get_series_details(text) to public, anon, authenticated;

-- 5. Seed Initial Microdrama ("Nairobi Secrets")
insert into public.series (slug, title, format, synopsis, portrait_poster_url, genre, content_rating)
values (
  'nairobi-secrets',
  'Nairobi Secrets',
  'micro-drama',
  'When a junior accountant at a Kilimani tech firm discovers an offshore fraud scheme, she becomes the target of a high-stakes corporate syndicate.',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  'Thriller',
  'PG'
) on conflict (slug) do nothing;

insert into public.episodes (series_id, season_number, episode_number, title, synopsis, bunny_guid, duration_seconds, thumbnail_url, is_free, price_coins, intro_end_seconds, outro_start_seconds)
select
  s.id,
  1,
  1,
  'The Stolen Ledger',
  'Wanjiku stumbles upon an encrypted flash drive after her boss mysteriously vanishes from his penthouse.',
  'micro-ns-1',
  105,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  true,
  0,
  5,
  95
from public.series s where s.slug = 'nairobi-secrets'
on conflict (series_id, season_number, episode_number) do nothing;

insert into public.episodes (series_id, season_number, episode_number, title, synopsis, bunny_guid, duration_seconds, thumbnail_url, is_free, price_coins, intro_end_seconds, outro_start_seconds)
select
  s.id,
  1,
  2,
  'Midnight Call',
  'An unknown caller gives Wanjiku 30 minutes to drop the drive at Westlands roundabout or her family faces the consequences.',
  'micro-ns-2',
  130,
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  true,
  0,
  4,
  120
from public.series s where s.slug = 'nairobi-secrets'
on conflict (series_id, season_number, episode_number) do nothing;

insert into public.episodes (series_id, season_number, episode_number, title, synopsis, bunny_guid, duration_seconds, thumbnail_url, is_free, price_coins, intro_end_seconds, outro_start_seconds)
select
  s.id,
  1,
  3,
  'The Trap in Westlands',
  'Wanjiku arrives at the drop point with an undercover DCI detective, only to find the caller was waiting for someone else.',
  'micro-ns-3',
  125,
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
  true,
  0,
  5,
  115
from public.series s where s.slug = 'nairobi-secrets'
on conflict (series_id, season_number, episode_number) do nothing;
