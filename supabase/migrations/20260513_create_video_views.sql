-- Track individual play events for analytics
create table if not exists public.video_views (
  id           uuid primary key default gen_random_uuid(),
  video_id     text not null,
  viewer_id    uuid references auth.users(id) on delete set null,
  viewed_at    timestamptz not null default now(),
  watch_seconds integer not null default 0  -- updated on unload / pause
);

-- Fast lookups per video and per time window
create index if not exists video_views_video_id_idx  on public.video_views (video_id);
create index if not exists video_views_viewed_at_idx on public.video_views (viewed_at desc);

-- RLS: anyone can insert (anonymous viewers tracked by null viewer_id)
alter table public.video_views enable row level security;

create policy "Anyone can record a view"
  on public.video_views for insert with check (true);

create policy "Authenticated users can read views"
  on public.video_views for select
  using (auth.role() = 'authenticated');

-- Helper view: daily view counts for last 30 days
create or replace view public.daily_view_counts as
select
  date_trunc('day', viewed_at at time zone 'Africa/Nairobi') as day,
  video_id,
  count(*)::int as views
from public.video_views
where viewed_at > now() - interval '30 days'
group by 1, 2;
