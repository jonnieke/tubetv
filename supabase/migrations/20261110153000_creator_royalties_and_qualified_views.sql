-- ==============================================================================
-- Migration: 30s Qualified Views & Creator Payout Settlements (KSh 1,000 Threshold)
-- ==============================================================================

-- 1. Extend analytics_events check constraint with 'qualified_view'
alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check
  check (event_name in (
    'catalogue_view', 'playback_start', 'playback_error',
    'playback_first_frame', 'playback_complete', 'playback_buffer', 'episode_next',
    'paywall_view', 'paywall_initiated', 'paywall_completed', 'paywall_failed',
    'pass_restored', 'checkout_start', 'checkout_submitted', 'subscription_activated', 'checkout_failed',
    'qualified_view'
  ));

-- 2. Creator Payout Settlements table
create table if not exists public.creator_payout_settlements (
  id uuid primary key default gen_random_uuid(),
  creator_name text not null,
  period_label text not null, -- e.g. "2026-11"
  qualified_views integer not null default 0,
  share_of_play_percent numeric(7, 4) not null default 0,
  gross_pool_kes numeric(10, 2) not null default 0,
  net_payout_kes numeric(10, 2) not null default 0,
  carried_forward_kes numeric(10, 2) not null default 0,
  total_accrued_kes numeric(10, 2) not null default 0,
  threshold_kes numeric(10, 2) not null default 1000.00,
  status text not null default 'carried_forward' check (status in ('carried_forward', 'eligible', 'processing', 'paid')),
  mpesa_phone text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_name, period_label)
);

alter table public.creator_payout_settlements enable row level security;

-- Policy: Admin full access
drop policy if exists "Verified admins manage creator payouts" on public.creator_payout_settlements;
create policy "Verified admins manage creator payouts"
  on public.creator_payout_settlements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists idx_payout_creator_period on public.creator_payout_settlements (creator_name, period_label);
create index if not exists idx_payout_status on public.creator_payout_settlements (status);
