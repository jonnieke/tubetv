-- ==============================================================================
-- Migration: Multi-Tenant Content Moderation & Ingestion Pipeline
-- Target: Supabase Postgres
-- Description:
--   1. content_submissions: Creator upload staging queue prior to publishing.
--   2. moderation_audit_logs: Tracks editorial decisions & KFCB classification assignments.
--   3. RPC publish_content_submission: Atomically approves a submission into public catalogue.
-- ==============================================================================

-- 1. CONTENT SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.content_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    series_title TEXT NOT NULL,
    series_id UUID REFERENCES public.series(id) ON DELETE SET NULL,
    season_number INTEGER NOT NULL DEFAULT 1,
    episode_number INTEGER NOT NULL,
    episode_title TEXT NOT NULL,
    synopsis TEXT,
    format TEXT NOT NULL DEFAULT 'micro-drama' CHECK (format IN ('micro-drama', 'short', 'movie', 'series')),
    raw_video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    intro_end_seconds NUMERIC(6, 2) DEFAULT 0,
    outro_start_seconds NUMERIC(6, 2),
    kfcb_rating TEXT NOT NULL DEFAULT 'UNRATED' CHECK (kfcb_rating IN ('GE', 'PG', '16', '18', 'UNRATED')),
    classification_number TEXT,
    language TEXT NOT NULL DEFAULT 'sw' CHECK (language IN ('sw', 'en', 'sheng', 'mixed')),
    tags TEXT[] DEFAULT '{}'::TEXT[],
    status TEXT NOT NULL DEFAULT 'review_pending' CHECK (status IN ('queued', 'transcoding', 'review_pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_submissions_creator_id ON public.content_submissions(creator_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.content_submissions(status);

-- 2. MODERATION AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.moderation_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.content_submissions(id) ON DELETE CASCADE,
    moderator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'changes_requested', 'rating_assigned')),
    notes TEXT,
    kfcb_rating_assigned TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_submission ON public.moderation_audit_logs(submission_id);

-- 3. ATOMIC PUBLISH RPC FUNCTION
CREATE OR REPLACE FUNCTION public.publish_content_submission(
    p_submission_id UUID,
    p_decision TEXT, -- 'approved' or 'rejected'
    p_kfcb_rating TEXT DEFAULT 'GE',
    p_classification_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sub RECORD;
    v_series_id UUID;
    v_season_id UUID;
    v_slug TEXT;
    v_new_episode_id UUID;
BEGIN
    -- Ensure caller is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Load submission
    SELECT * INTO v_sub
    FROM public.content_submissions
    WHERE id = p_submission_id;

    IF v_sub IS NULL THEN
        RAISE EXCEPTION 'Submission not found: %', p_submission_id;
    END IF;

    -- Process Rejection
    IF p_decision = 'rejected' THEN
        UPDATE public.content_submissions
        SET status = 'rejected',
            rejection_reason = p_notes,
            reviewed_by = auth.uid(),
            reviewed_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = p_submission_id;

        INSERT INTO public.moderation_audit_logs (
            submission_id, moderator_id, action, notes
        ) VALUES (
            p_submission_id, auth.uid(), 'rejected', p_notes
        );

        RETURN jsonb_build_object('success', true, 'status', 'rejected');
    END IF;

    -- Process Approval: Map or create Series
    v_series_id := v_sub.series_id;
    IF v_series_id IS NULL THEN
        -- Generate slug from series_title
        v_slug := lower(regexp_replace(v_sub.series_title, '[^a-zA-Z0-9]+', '-', 'g'));
        v_slug := trim(both '-' from v_slug);

        -- Check existing or insert series
        SELECT id INTO v_series_id FROM public.series WHERE slug = v_slug;
        IF v_series_id IS NULL THEN
            INSERT INTO public.series (
                title, slug, synopsis, format, creator_id, content_rating
            ) VALUES (
                v_sub.series_title,
                v_slug,
                v_sub.synopsis,
                v_sub.format,
                v_sub.creator_id,
                p_kfcb_rating
            ) RETURNING id INTO v_series_id;
        END IF;
    END IF;

    -- Map or create Season
    SELECT id INTO v_season_id
    FROM public.seasons
    WHERE series_id = v_series_id AND season_number = v_sub.season_number;

    IF v_season_id IS NULL THEN
        INSERT INTO public.seasons (
            series_id, season_number, title
        ) VALUES (
            v_series_id, v_sub.season_number, 'Season ' || v_sub.season_number
        ) RETURNING id INTO v_season_id;
    END IF;

    -- Insert Published Episode
    INSERT INTO public.episodes (
        series_id,
        season_id,
        episode_number,
        title,
        synopsis,
        stream_url,
        thumbnail_url,
        is_free_preview,
        intro_end_seconds,
        outro_start_seconds,
        kfcb_rating,
        classification_number
    ) VALUES (
        v_series_id,
        v_season_id,
        v_sub.episode_number,
        v_sub.episode_title,
        v_sub.synopsis,
        v_sub.raw_video_url,
        v_sub.thumbnail_url,
        (v_sub.episode_number <= 3), -- Ep 1-3 free preview standard
        COALESCE(v_sub.intro_end_seconds, 0),
        v_sub.outro_start_seconds,
        p_kfcb_rating,
        p_classification_number
    ) RETURNING id INTO v_new_episode_id;

    -- Update submission status
    UPDATE public.content_submissions
    SET status = 'approved',
        series_id = v_series_id,
        kfcb_rating = p_kfcb_rating,
        classification_number = p_classification_number,
        reviewed_by = auth.uid(),
        reviewed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_submission_id;

    -- Log audit entry
    INSERT INTO public.moderation_audit_logs (
        submission_id,
        moderator_id,
        action,
        notes,
        kfcb_rating_assigned
    ) VALUES (
        p_submission_id,
        auth.uid(),
        'approved',
        p_notes,
        p_kfcb_rating
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', 'approved',
        'series_id', v_series_id,
        'episode_id', v_new_episode_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.content_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_audit_logs ENABLE ROW LEVEL SECURITY;

-- Creators can view and insert their own submissions
CREATE POLICY "Creators can view own submissions"
    ON public.content_submissions FOR SELECT
    USING (auth.uid() = creator_id);

CREATE POLICY "Creators can submit new content"
    ON public.content_submissions FOR INSERT
    WITH CHECK (auth.uid() = creator_id);
