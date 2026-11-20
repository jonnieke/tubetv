-- Micro Drama real engagement tables: episode_likes & episode_comments
-- Safe to run idempotently in Supabase SQL editor or CLI migrations.

CREATE TABLE IF NOT EXISTS public.episode_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT episode_likes_video_device_unique UNIQUE (video_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_episode_likes_video_id ON public.episode_likes (video_id);

ALTER TABLE public.episode_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read episode likes" ON public.episode_likes;
CREATE POLICY "Public read episode likes"
  ON public.episode_likes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public insert episode likes" ON public.episode_likes;
CREATE POLICY "Public insert episode likes"
  ON public.episode_likes
  FOR INSERT
  WITH CHECK (char_length(video_id) BETWEEN 4 AND 128 AND char_length(device_id) BETWEEN 6 AND 128);

DROP POLICY IF EXISTS "Public delete own episode likes" ON public.episode_likes;
CREATE POLICY "Public delete own episode likes"
  ON public.episode_likes
  FOR DELETE
  USING (true);

CREATE TABLE IF NOT EXISTS public.episode_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  series_id text,
  device_id text NOT NULL,
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 32),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  reaction text CHECK (reaction IS NULL OR reaction IN ('fire', 'shock', 'cry', 'heart')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_episode_comments_video_created
  ON public.episode_comments (video_id, created_at DESC);

ALTER TABLE public.episode_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read episode comments" ON public.episode_comments;
CREATE POLICY "Public read episode comments"
  ON public.episode_comments
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public insert episode comments" ON public.episode_comments;
CREATE POLICY "Public insert episode comments"
  ON public.episode_comments
  FOR INSERT
  WITH CHECK (
    char_length(video_id) BETWEEN 4 AND 128
    AND char_length(device_id) BETWEEN 6 AND 128
    AND char_length(author_name) BETWEEN 1 AND 32
    AND char_length(body) BETWEEN 1 AND 280
  );
