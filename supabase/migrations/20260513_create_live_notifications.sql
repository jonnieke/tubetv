-- Stores user notification preferences for upcoming live schedule events
create table if not exists public.live_notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  schedule_id  integer not null,
  created_at   timestamptz not null default now(),
  -- Upsert constraint: one row per (user, schedule)
  unique (user_id, schedule_id)
);

-- Fast lookup: all notifications for a schedule, or all schedules a user subscribed to
create index if not exists live_notifications_user_idx     on public.live_notifications (user_id);
create index if not exists live_notifications_schedule_idx on public.live_notifications (schedule_id);

-- RLS: users can only see and manage their own rows
alter table public.live_notifications enable row level security;

create policy "Users can manage their own live notifications"
  on public.live_notifications
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
