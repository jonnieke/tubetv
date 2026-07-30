create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'catalogue_view',
    'playback_start',
    'playback_error',
    'paywall_view',
    'checkout_start',
    'checkout_submitted',
    'subscription_activated',
    'checkout_failed'
  )),
  properties jsonb not null default '{}'::jsonb,
  page_path text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, received_at desc);

comment on table public.analytics_events is
  'Anonymous, bounded product events. Do not add account, phone, IP-derived, or free-form personal identifiers.';
