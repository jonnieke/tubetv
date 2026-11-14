-- ============================================================================
-- TubeTV Go-To-Market Security, Monetization & Compliance Hardening Migration
-- ============================================================================

-- 1. Enforce MFA (aal2) inside SQL admin helper and lock search_path
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and (auth.jwt() ->> 'aal') = 'aal2',
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Lock down PII leaks (creator_phone, tipper_phone, mpesa_ref) & write escalation
drop policy if exists "Public can read videos" on public.videos;
drop policy if exists "Creators can insert their own videos" on public.videos;
drop policy if exists "Creators can update their own videos" on public.videos;
drop policy if exists "Creators can delete their own videos" on public.videos;
drop policy if exists "Creators can insert owned videos" on public.videos;
drop policy if exists "Creators can update owned videos" on public.videos;
drop policy if exists "Creators can delete owned videos" on public.videos;
drop policy if exists "Verified admins manage videos" on public.videos;

create policy "Verified admins manage videos" on public.videos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Everyone can read tips" on public.tips;
drop policy if exists "Verified admins read tips" on public.tips;

create policy "Verified admins read tips" on public.tips
  for select to authenticated
  using (public.is_admin());

drop policy if exists "Creators can read owned video stats" on public.daily_video_stats;
drop policy if exists "Creators can manage their own video stats" on public.daily_video_stats;
drop policy if exists "Verified admins read video stats" on public.daily_video_stats;

create policy "Verified admins read video stats" on public.daily_video_stats
  for select to authenticated
  using (public.is_admin());

-- 3. Prevent authenticated users from spoofing profiles.phone_e164 via PostgREST
create or replace function public.prevent_profile_phone_tamper()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated'
     and new.phone_e164 is distinct from old.phone_e164 then
    raise exception 'Phone numbers can only be updated via verified authentication.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_phone_update on public.profiles;
create trigger guard_profile_phone_update
  before update on public.profiles
  for each row execute function public.prevent_profile_phone_tamper();

-- 4. Support frictionless guest M-Pesa passes & retain KRA financial ledgers on account deletion
alter table public.payment_transactions
  alter column user_id drop not null;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_user_id_fkey;

alter table public.payment_transactions
  add constraint payment_transactions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.payment_transactions
  add column if not exists checkout_token_hash text;

create unique index if not exists payment_transactions_idempotency_uidx
  on public.payment_transactions (idempotency_key);

create unique index if not exists payment_transactions_checkout_token_uidx
  on public.payment_transactions (checkout_token_hash)
  where checkout_token_hash is not null;

create index if not exists payment_transactions_phone_recent_idx
  on public.payment_transactions (phone_e164, created_at desc);

alter table public.subscriptions
  drop constraint if exists subscriptions_user_id_fkey;

alter table public.subscriptions
  add constraint subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

drop index if exists public.one_active_subscription_per_user;
create unique index if not exists one_active_subscription_per_user
  on public.subscriptions (user_id)
  where is_active = true and user_id is not null;

create unique index if not exists subscriptions_mpesa_ref_uidx
  on public.subscriptions (upper(mpesa_ref))
  where mpesa_ref is not null;

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at();

drop trigger if exists set_watch_progress_updated_at on public.watch_progress;
create trigger set_watch_progress_updated_at
  before update on public.watch_progress
  for each row execute function public.update_updated_at();

-- 5. Atomic, row-locked M-Pesa callback fulfillment RPC (service_role only)
create or replace function public.fulfill_mpesa_payment(
  p_checkout_request_id text,
  p_amount_kes integer,
  p_receipt text,
  p_phone_digits text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_clean_receipt text := upper(trim(coalesce(p_receipt, '')));
  v_supplied_sub9 text := right(regexp_replace(coalesce(p_phone_digits, ''), '\D', '', 'g'), 9);
  v_expected_sub9 text;
  v_existing_sub public.subscriptions%rowtype;
  v_active_sub public.subscriptions%rowtype;
  v_now timestamptz := now();
  v_base timestamptz;
  v_days integer;
  v_new_sub public.subscriptions%rowtype;
begin
  select * into v_tx
  from public.payment_transactions
  where checkout_request_id = p_checkout_request_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_expected_sub9 := right(regexp_replace(coalesce(v_tx.phone_e164, ''), '\D', '', 'g'), 9);

  if v_clean_receipt = ''
     or p_amount_kes is distinct from v_tx.amount_kes
     or length(v_supplied_sub9) <> 9
     or v_supplied_sub9 is distinct from v_expected_sub9 then
    if v_tx.status <> 'succeeded' then
      update public.payment_transactions
      set status = 'failed',
          result_code = -1,
          result_description = 'Callback details did not match the payment request.'
      where id = v_tx.id;
    end if;
    return jsonb_build_object('ok', false, 'reason', 'mismatch');
  end if;

  select * into v_existing_sub
  from public.subscriptions
  where upper(mpesa_ref) = v_clean_receipt
  limit 1;

  if found then
    update public.payment_transactions
    set status = 'succeeded',
        mpesa_receipt = v_clean_receipt,
        result_code = 0,
        result_description = 'Payment received.'
    where id = v_tx.id and status <> 'succeeded';

    return jsonb_build_object(
      'ok', true,
      'reused', true,
      'subscription_id', v_existing_sub.id,
      'tier', v_existing_sub.tier,
      'end_date', v_existing_sub.end_date,
      'mpesa_receipt', v_existing_sub.mpesa_ref
    );
  end if;

  update public.payment_transactions
  set status = 'succeeded',
      mpesa_receipt = v_clean_receipt,
      result_code = 0,
      result_description = 'Payment received.'
  where id = v_tx.id;

  if v_tx.user_id is not null then
    select * into v_active_sub
    from public.subscriptions
    where user_id = v_tx.user_id
      and is_active = true
    order by end_date desc nulls last
    limit 1
    for update;
  else
    select * into v_active_sub
    from public.subscriptions
    where user_id is null
      and is_active = true
      and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = v_expected_sub9
    order by end_date desc nulls last
    limit 1
    for update;
  end if;

  v_days := case v_tx.plan_code
    when 'monthly' then 30
    when 'weekly' then 7
    else 1
  end;

  v_base := case
    when v_active_sub.id is not null and v_active_sub.end_date is not null and v_active_sub.end_date > v_now
      then v_active_sub.end_date
    else v_now
  end;

  if v_tx.user_id is not null then
    update public.subscriptions
    set is_active = false
    where user_id = v_tx.user_id and is_active = true;
  elsif v_active_sub.id is not null then
    update public.subscriptions
    set is_active = false
    where id = v_active_sub.id;
  end if;

  insert into public.subscriptions (
    user_id,
    phone,
    tier,
    mpesa_ref,
    start_date,
    end_date,
    is_active
  ) values (
    v_tx.user_id,
    v_tx.phone_e164,
    v_tx.plan_code,
    v_clean_receipt,
    v_now,
    v_base + make_interval(days => v_days),
    true
  )
  returning * into v_new_sub;

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'subscription_id', v_new_sub.id,
    'tier', v_new_sub.tier,
    'end_date', v_new_sub.end_date,
    'mpesa_receipt', v_new_sub.mpesa_ref
  );
end;
$$;

revoke all on function public.fulfill_mpesa_payment(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.fulfill_mpesa_payment(text, integer, text, text) to service_role;

-- 6. Prevent Web Push Blind SSRF & index user_id
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_endpoint_https_check;

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_https_check
  check (
    endpoint ~* '^https://([a-z0-9-]+\.)*(googleapis\.com|google\.com|mozilla\.com|mozaws\.net|apple\.com|windows\.com)/'
  );

-- 7. Align analytics_events allowlist across playback and paywall funnels
alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events
  add constraint analytics_events_event_name_check
  check (event_name in (
    'catalogue_view',
    'playback_start',
    'playback_error',
    'playback_first_frame',
    'playback_complete',
    'playback_buffer',
    'episode_next',
    'paywall_view',
    'paywall_initiated',
    'paywall_completed',
    'paywall_failed',
    'pass_restored',
    'checkout_start',
    'checkout_submitted',
    'subscription_activated',
    'checkout_failed',
    'qualified_view',
    'video_shared'
  ));

-- 8. Default viewer maximum_rating to '16' for general profiles
alter table public.viewer_preferences
  alter column maximum_rating set default '16';

-- 9. Allow MFA-verified admins to delete orphaned series posters
drop policy if exists "Verified admins delete series posters" on storage.objects;
create policy "Verified admins delete series posters"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'series-posters'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

