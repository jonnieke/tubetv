-- ==============================================================================
-- Migration: Daily Analytics & Royalty Rollup Tables for High-Scale Dashboards
-- Keeps analytics-summary fast (<100ms) even at millions of raw analytics_events.
-- ==============================================================================

-- 1. Composite index on analytics_events for fast range + event_name scans
create index if not exists idx_analytics_events_occurred_event
  on public.analytics_events (occurred_at desc, event_name);

-- 2. Daily per-video playback & qualified view stats
create table if not exists public.analytics_daily_video_stats (
  stat_date date not null,
  video_id text not null,
  playback_starts integer not null default 0,
  qualified_views integer not null default 0,
  playback_completes integer not null default 0,
  shares integer not null default 0,
  total_watch_seconds bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (stat_date, video_id)
);

alter table public.analytics_daily_video_stats enable row level security;

drop policy if exists "Verified admins read daily video stats" on public.analytics_daily_video_stats;
create policy "Verified admins read daily video stats"
  on public.analytics_daily_video_stats
  for select to authenticated
  using (public.is_admin());

create index if not exists idx_daily_video_stats_date
  on public.analytics_daily_video_stats (stat_date desc);

-- 3. Daily per-payer, per-video best capped watch duration (1-play-per-day anti-farming)
create table if not exists public.analytics_daily_payer_plays (
  stat_date date not null,
  payer_key text not null,
  video_id text not null,
  max_watch_seconds integer not null default 30,
  updated_at timestamptz not null default now(),
  primary key (stat_date, payer_key, video_id)
);

alter table public.analytics_daily_payer_plays enable row level security;

drop policy if exists "Verified admins read daily payer plays" on public.analytics_daily_payer_plays;
create policy "Verified admins read daily payer plays"
  on public.analytics_daily_payer_plays
  for select to authenticated
  using (public.is_admin());

create index if not exists idx_daily_payer_plays_date
  on public.analytics_daily_payer_plays (stat_date desc);

-- Helper: Normalize Kenyan phone numbers to 254XXXXXXXXX so pass & play keys align
create or replace function public.normalize_payer_phone(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if raw_phone is null or btrim(raw_phone) = '' then
    return '';
  end if;
  digits := regexp_replace(raw_phone, '\D', '', 'g');
  if length(digits) = 10 and left(digits, 1) = '0' then
    return '254' || substring(digits from 2);
  end if;
  if length(digits) = 9 and left(digits, 1) in ('7', '1') then
    return '254' || digits;
  end if;
  return digits;
end;
$$;

-- 4. Incremental O(1) trigger on analytics_events inserts
create or replace function public.rollup_analytics_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_video_id text;
  v_watch integer;
  v_is_paid text;
  v_payer_key text;
  v_clamped integer;
begin
  if new.event_name not in ('playback_start', 'qualified_view', 'playback_complete', 'video_shared') then
    return new;
  end if;

  v_video_id := btrim(coalesce(new.properties->>'videoId', ''));
  if v_video_id = '' then
    return new;
  end if;

  v_date := (coalesce(new.occurred_at, now()) at time zone 'UTC')::date;
  v_watch := greatest(0, coalesce((nullif(new.properties->>'watchSeconds', ''))::numeric::integer, 0));

  insert into public.analytics_daily_video_stats (
    stat_date, video_id, playback_starts, qualified_views, playback_completes, shares, total_watch_seconds, updated_at
  ) values (
    v_date,
    v_video_id,
    case when new.event_name = 'playback_start' then 1 else 0 end,
    case when new.event_name = 'qualified_view' then 1 else 0 end,
    case when new.event_name = 'playback_complete' then 1 else 0 end,
    case when new.event_name = 'video_shared' then 1 else 0 end,
    v_watch,
    now()
  )
  on conflict (stat_date, video_id) do update set
    playback_starts = public.analytics_daily_video_stats.playback_starts + excluded.playback_starts,
    qualified_views = public.analytics_daily_video_stats.qualified_views + excluded.qualified_views,
    playback_completes = public.analytics_daily_video_stats.playback_completes + excluded.playback_completes,
    shares = public.analytics_daily_video_stats.shares + excluded.shares,
    total_watch_seconds = public.analytics_daily_video_stats.total_watch_seconds + excluded.total_watch_seconds,
    updated_at = now();

  if new.event_name in ('qualified_view', 'playback_complete') then
    v_is_paid := lower(coalesce(new.properties->>'isPaid', ''));
    if v_is_paid <> 'false' then
      v_payer_key := btrim(coalesce(
        nullif(btrim(coalesce(new.properties->>'userId', '')), ''),
        nullif(public.normalize_payer_phone(new.properties->>'phone'), ''),
        nullif(btrim(coalesce(new.properties->>'passRef', '')), ''),
        nullif(btrim(coalesce(new.properties->>'viewerId', '')), ''),
        ''
      ));
      if v_payer_key <> '' and v_payer_key <> 'Guest' then
        v_clamped := greatest(30, least(5400, case when v_watch > 0 then v_watch else 30 end));
        insert into public.analytics_daily_payer_plays (
          stat_date, payer_key, video_id, max_watch_seconds, updated_at
        ) values (
          v_date, v_payer_key, v_video_id, v_clamped, now()
        )
        on conflict (stat_date, payer_key, video_id) do update set
          max_watch_seconds = greatest(public.analytics_daily_payer_plays.max_watch_seconds, excluded.max_watch_seconds),
          updated_at = now();
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rollup_analytics_event on public.analytics_events;
create trigger trg_rollup_analytics_event
  after insert on public.analytics_events
  for each row
  execute function public.rollup_analytics_event();

-- 5. Backfill existing historical analytics_events into rollup tables
insert into public.analytics_daily_video_stats (
  stat_date, video_id, playback_starts, qualified_views, playback_completes, shares, total_watch_seconds, updated_at
)
select
  (occurred_at at time zone 'UTC')::date as stat_date,
  btrim(properties->>'videoId') as video_id,
  count(*) filter (where event_name = 'playback_start')::integer as playback_starts,
  count(*) filter (where event_name = 'qualified_view')::integer as qualified_views,
  count(*) filter (where event_name = 'playback_complete')::integer as playback_completes,
  count(*) filter (where event_name = 'video_shared')::integer as shares,
  coalesce(sum(greatest(0, coalesce((nullif(properties->>'watchSeconds', ''))::numeric::integer, 0))), 0)::bigint as total_watch_seconds,
  now()
from public.analytics_events
where event_name in ('playback_start', 'qualified_view', 'playback_complete', 'video_shared')
  and btrim(coalesce(properties->>'videoId', '')) <> ''
group by 1, 2
on conflict (stat_date, video_id) do update set
  playback_starts = excluded.playback_starts,
  qualified_views = excluded.qualified_views,
  playback_completes = excluded.playback_completes,
  shares = excluded.shares,
  total_watch_seconds = excluded.total_watch_seconds,
  updated_at = now();

insert into public.analytics_daily_payer_plays (
  stat_date, payer_key, video_id, max_watch_seconds, updated_at
)
select
  (occurred_at at time zone 'UTC')::date as stat_date,
  payer_key,
  video_id,
  max(greatest(30, least(5400, case when watch_sec > 0 then watch_sec else 30 end)))::integer as max_watch_seconds,
  now()
from (
  select
    occurred_at,
    btrim(properties->>'videoId') as video_id,
    greatest(0, coalesce((nullif(properties->>'watchSeconds', ''))::numeric::integer, 0)) as watch_sec,
    btrim(coalesce(
      nullif(btrim(coalesce(properties->>'userId', '')), ''),
      nullif(public.normalize_payer_phone(properties->>'phone'), ''),
      nullif(btrim(coalesce(properties->>'passRef', '')), ''),
      nullif(btrim(coalesce(properties->>'viewerId', '')), ''),
      ''
    )) as payer_key
  from public.analytics_events
  where event_name in ('qualified_view', 'playback_complete')
    and lower(coalesce(properties->>'isPaid', '')) <> 'false'
    and btrim(coalesce(properties->>'videoId', '')) <> ''
) sub
where payer_key <> '' and payer_key <> 'Guest'
group by 1, 2, 3
on conflict (stat_date, payer_key, video_id) do update set
  max_watch_seconds = greatest(public.analytics_daily_payer_plays.max_watch_seconds, excluded.max_watch_seconds),
  updated_at = now();
