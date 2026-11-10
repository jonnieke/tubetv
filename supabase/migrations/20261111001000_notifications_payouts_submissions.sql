-- Phase 3: SMS/WhatsApp pass notifications, Paystack Transfers creator payouts,
-- filmmaker submission queue, and payout-profile RLS hardening.

-- ─── 1. Pass notification tracking ───────────────────────────────────────────
alter table public.subscriptions
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists receipt_notified_at timestamptz,
  add column if not exists expiry_notified_at timestamptz;

-- Never text existing pass holders a retroactive "receipt" on first deploy.
update public.subscriptions
   set receipt_notified_at = now()
 where receipt_notified_at is null;

create index if not exists subscriptions_notify_idx
  on public.subscriptions (end_date)
  where is_active = true and expiry_notified_at is null;

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid,
  kind text not null check (kind in ('receipt', 'expiry_reminder', 'test')),
  channel text not null check (channel in ('sms', 'whatsapp', 'none')),
  recipient_hint text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists notification_log_created_idx on public.notification_log (created_at desc);
alter table public.notification_log enable row level security;
-- No policies: service role only.

-- ─── 2. Creator payouts via Paystack Transfers ───────────────────────────────
drop table if exists public.creator_payouts cascade;
create table public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  period_label text not null,
  creator_name text not null,
  payout_rail text not null,
  destination_hint text,
  gross_kes numeric not null check (gross_kes > 0),
  withholding_kes numeric not null default 0 check (withholding_kes >= 0),
  amount_kes numeric not null check (amount_kes > 0),
  reference text not null unique,
  recipient_code text,
  transfer_code text,
  status text not null default 'pending'
    check (status in ('pending', 'otp', 'success', 'failed', 'reversed')),
  failure_reason text,
  initiated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A creator can only have ONE live or completed payout per period. Failed/reversed ones may be retried.
create unique index if not exists uq_creator_payouts_live
  on public.creator_payouts (period_label, creator_name)
  where status in ('pending', 'otp', 'success');

create index if not exists creator_payouts_period_idx on public.creator_payouts (period_label, created_at desc);
alter table public.creator_payouts enable row level security;
-- No policies: only the admin-verified creator-payouts Edge Function (service role) can read/write.

-- ─── 3. Filmmaker submissions ────────────────────────────────────────────────
create table if not exists public.filmmaker_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200),
  phone text check (phone is null or char_length(phone) <= 40),
  country text check (country is null or char_length(country) <= 80),
  studio_name text check (studio_name is null or char_length(studio_name) <= 160),
  film_title text not null check (char_length(film_title) between 1 and 200),
  format text not null check (format in ('feature', 'series', 'micro-drama', 'documentary', 'short', 'other')),
  synopsis text not null check (char_length(synopsis) between 20 and 2000),
  trailer_url text not null check (char_length(trailer_url) <= 500),
  screener_url text check (screener_url is null or char_length(screener_url) <= 500),
  rights_confirmed boolean not null default false,
  status text not null default 'new' check (status in ('new', 'reviewing', 'accepted', 'declined')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000),
  reviewed_by uuid,
  reviewed_at timestamptz,
  ip_hash text
);
create index if not exists filmmaker_submissions_status_idx on public.filmmaker_submissions (status, created_at desc);
create index if not exists filmmaker_submissions_ip_idx on public.filmmaker_submissions (ip_hash, created_at desc);
alter table public.filmmaker_submissions enable row level security;
-- No policies: public submissions go through the rate-limited Edge Function; review is admin-only.

-- ─── 4. Harden creator_payout_profiles (previously readable/writable by ANY signed-in user) ──
drop policy if exists "Admins manage creator_payout_profiles" on public.creator_payout_profiles;
create policy "Admins manage creator_payout_profiles"
  on public.creator_payout_profiles
  for all
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
