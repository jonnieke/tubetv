-- ============================================================
-- Tube Kenya — Supabase Migration 001
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bbwtdnsgojztxckmkhpz/sql
-- ============================================================

-- Videos table: stores every uploaded video
CREATE TABLE IF NOT EXISTS public.videos (
    id              TEXT PRIMARY KEY,           -- Bunny.net GUID (also used as video id)
    bunny_guid      TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT DEFAULT '',
    thumbnail_url   TEXT DEFAULT '',
    stream_url      TEXT DEFAULT '',
    duration        TEXT DEFAULT '0:00',
    category        TEXT DEFAULT 'Originals',
    creator_phone   TEXT,                       -- Uploader's phone number (0712XXXXXX)
    is_premium      BOOLEAN DEFAULT FALSE,
    views           BIGINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Row-level security: anyone can read, only creator can update/delete
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read videos" ON public.videos;
CREATE POLICY "Public can read videos"
    ON public.videos FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Creators can insert their own videos" ON public.videos;
CREATE POLICY "Creators can insert their own videos"
    ON public.videos FOR INSERT
    WITH CHECK (AUTH.ROLE() = 'authenticated');

DROP POLICY IF EXISTS "Creators can update their own videos" ON public.videos;
CREATE POLICY "Creators can update their own videos"
    ON public.videos FOR UPDATE
    USING (creator_phone = (auth.jwt() ->> 'phone'));

DROP POLICY IF EXISTS "Creators can delete their own videos" ON public.videos;
CREATE POLICY "Creators can delete their own videos"
    ON public.videos FOR DELETE
    USING (creator_phone = (auth.jwt() ->> 'phone'));

-- Index for fast category filtering
CREATE INDEX IF NOT EXISTS videos_category_idx ON public.videos (category);
CREATE INDEX IF NOT EXISTS videos_creator_idx ON public.videos (creator_phone);
CREATE INDEX IF NOT EXISTS videos_created_idx ON public.videos (created_at DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.videos;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- Subscriptions table: tracks M-Pesa subscription status
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone           TEXT NOT NULL,
    tier            TEXT NOT NULL CHECK (tier IN ('free', 'msingi', 'ndovu')),
    mpesa_ref       TEXT,                       -- M-Pesa transaction reference
    pesapal_ref     TEXT,                       -- PesaPal order ID
    start_date      TIMESTAMPTZ DEFAULT NOW(),
    end_date        TIMESTAMPTZ,               -- NULL = lifetime, else expiry date
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own subscription" ON public.subscriptions;
CREATE POLICY "Users can read their own subscription"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can write subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can write subscriptions"
    ON public.subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS subs_phone_idx ON public.subscriptions (phone);
CREATE INDEX IF NOT EXISTS subs_user_idx ON public.subscriptions (user_id);


-- ============================================================
-- Tips table: live stream tips via M-Pesa
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tips (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id       TEXT NOT NULL,
    tipper_phone    TEXT,
    tipper_name     TEXT DEFAULT 'Anonymous',
    amount_kes      INTEGER NOT NULL,
    tier_name       TEXT,                       -- e.g. 'Simba', 'Tembo'
    mpesa_ref       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read tips" ON public.tips;
CREATE POLICY "Everyone can read tips"
    ON public.tips FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Service role can insert tips" ON public.tips;
CREATE POLICY "Service role can insert tips"
    ON public.tips FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS tips_stream_idx ON public.tips (stream_id);
CREATE INDEX IF NOT EXISTS tips_created_idx ON public.tips (created_at DESC);
