-- Create daily_video_stats table for time-series charts
CREATE TABLE IF NOT EXISTS public.daily_video_stats (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id    TEXT NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    views       INTEGER DEFAULT 0,
    revenue_kes INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, date) -- Allows for easy upserts
);

-- Enable RLS
ALTER TABLE public.daily_video_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Creators can read their own video stats
DROP POLICY IF EXISTS "Creators can read their own video stats" ON public.daily_video_stats;
CREATE POLICY "Creators can read their own video stats"
    ON public.daily_video_stats FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.videos 
            WHERE videos.id = daily_video_stats.video_id 
            AND videos.creator_phone = (auth.jwt() ->> 'phone')
        )
    );

-- Policy: Service role or authorized roles can insert/update stats
-- For testing purposes, we'll allow authenticated users to insert/update their own stats (useful for the auto-seed script)
DROP POLICY IF EXISTS "Creators can manage their own video stats" ON public.daily_video_stats;
CREATE POLICY "Creators can manage their own video stats"
    ON public.daily_video_stats FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.videos 
            WHERE videos.id = daily_video_stats.video_id 
            AND videos.creator_phone = (auth.jwt() ->> 'phone')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.videos 
            WHERE videos.id = daily_video_stats.video_id 
            AND videos.creator_phone = (auth.jwt() ->> 'phone')
        )
    );

-- Index for fast lookup by date range
CREATE INDEX IF NOT EXISTS stats_date_idx ON public.daily_video_stats (date DESC);
CREATE INDEX IF NOT EXISTS stats_video_idx ON public.daily_video_stats (video_id);
