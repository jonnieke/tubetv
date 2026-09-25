-- Keep historical event rows valid while recording real playback milestones.
alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check
  check (event_name in (
    'catalogue_view', 'playback_start', 'playback_error',
    'playback_first_frame', 'playback_complete', 'playback_buffer', 'episode_next',
    'paywall_view', 'checkout_start', 'checkout_submitted', 'subscription_activated', 'checkout_failed'
  ));

create index if not exists analytics_events_occurred_name_idx
  on public.analytics_events (occurred_at desc, event_name);

-- This table has no Data API policies. Only the service role may call the
-- atomic quota function from the authenticated admin Edge Function.
create table if not exists public.admin_ai_daily_usage (
  admin_id uuid not null,
  usage_day date not null,
  uses integer not null default 0 check (uses >= 0),
  primary key (admin_id, usage_day)
);
alter table public.admin_ai_daily_usage enable row level security;

create or replace function public.consume_admin_ai_quota(p_admin_id uuid, p_limit integer default 20)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare current_uses integer;
begin
  insert into public.admin_ai_daily_usage (admin_id, usage_day, uses)
  values (p_admin_id, current_date, 1)
  on conflict (admin_id, usage_day) do update
    set uses = public.admin_ai_daily_usage.uses + 1
    where public.admin_ai_daily_usage.uses < least(greatest(p_limit, 1), 100)
  returning uses into current_uses;
  return current_uses is not null;
end;
$$;
revoke all on function public.consume_admin_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_admin_ai_quota(uuid, integer) to service_role;

create table if not exists public.admin_audit_events (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  action text not null,
  resource_id text,
  succeeded boolean not null,
  occurred_at timestamptz not null default now()
);
alter table public.admin_audit_events enable row level security;
create index if not exists admin_audit_events_admin_time_idx on public.admin_audit_events (admin_id, occurred_at desc);
