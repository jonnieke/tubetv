-- Interactive in-episode cliffhanger polls for Micro Dramas
-- Safe to run idempotently.

CREATE TABLE IF NOT EXISTS public.episode_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  device_id text NOT NULL,
  choice text NOT NULL CHECK (choice IN ('yes', 'no')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT episode_poll_votes_video_device_unique UNIQUE (video_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_episode_poll_votes_video_id
  ON public.episode_poll_votes (video_id);

ALTER TABLE public.episode_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read episode poll votes" ON public.episode_poll_votes;
CREATE POLICY "Public read episode poll votes"
  ON public.episode_poll_votes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public insert episode poll votes" ON public.episode_poll_votes;
CREATE POLICY "Public insert episode poll votes"
  ON public.episode_poll_votes
  FOR INSERT
  WITH CHECK (
    char_length(video_id) BETWEEN 4 AND 128
    AND char_length(device_id) BETWEEN 6 AND 128
    AND choice IN ('yes', 'no')
  );

DROP POLICY IF EXISTS "Public update episode poll votes" ON public.episode_poll_votes;
CREATE POLICY "Public update episode poll votes"
  ON public.episode_poll_votes
  FOR UPDATE
  USING (true)
  WITH CHECK (choice IN ('yes', 'no'));
