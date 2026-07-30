alter table if exists public.videos
  add column if not exists content_rating text not null default 'UNRATED',
  add column if not exists classification_number text,
  add column if not exists transcript_text text,
  add column if not exists transcript_url text,
  add column if not exists published_at timestamptz;

alter table if exists public.videos drop constraint if exists videos_content_rating_check;
alter table if exists public.videos
  add constraint videos_content_rating_check
  check (content_rating in ('GE', 'PG', '16', '18', 'UNRATED'));

alter table if exists public.viewer_preferences
  add column if not exists maximum_rating text not null default 'PG';

alter table if exists public.viewer_preferences drop constraint if exists viewer_preferences_maximum_rating_check;
alter table if exists public.viewer_preferences
  add constraint viewer_preferences_maximum_rating_check
  check (maximum_rating in ('GE', 'PG', '16'));

comment on column public.videos.content_rating is
  'KFCB audience classification. UNRATED and 18 are blocked by the consumer player until defensible age controls exist.';

