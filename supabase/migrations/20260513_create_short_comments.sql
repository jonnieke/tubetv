-- Short comments table for Shorts player
create table if not exists public.short_comments (
  id          uuid primary key default gen_random_uuid(),
  short_id    text not null,
  author      text not null default '@viewer',
  text        text not null check (char_length(text) <= 300),
  likes       integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Index for fast per-short lookups
create index if not exists short_comments_short_id_idx on public.short_comments (short_id, created_at desc);

-- Allow anyone to read; only authenticated users can insert
alter table public.short_comments enable row level security;

create policy "Anyone can read comments"
  on public.short_comments for select using (true);

create policy "Authenticated users can post comments"
  on public.short_comments for insert
  with check (auth.role() = 'authenticated');

create policy "Users can like any comment"
  on public.short_comments for update
  using (true)
  with check (true);
