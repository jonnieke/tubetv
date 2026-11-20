-- Queue of newly uploaded main titles for the daily 6:00 PM EAT (15:00 UTC) push digest.
-- Prevents notification fatigue by batching all episodes/titles uploaded that day into one message.

create table if not exists public.new_show_digest_queue (
  id uuid primary key default gen_random_uuid(),
  video_id text not null,
  main_title text not null,
  is_series boolean not null default false,
  created_at timestamptz not null default now(),
  notified_at timestamptz null
);

create index if not exists idx_new_show_digest_queue_pending
  on public.new_show_digest_queue (created_at)
  where notified_at is null;

alter table public.new_show_digest_queue enable row level security;

-- Only service_role (Edge Functions) may read/write this queue.
revoke all on table public.new_show_digest_queue from anon, authenticated;
grant select, insert, update, delete on table public.new_show_digest_queue to service_role;
