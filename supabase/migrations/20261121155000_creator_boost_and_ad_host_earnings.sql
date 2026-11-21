-- Creator Self-Serve Boost Campaigns + 60/40 Host-Creator Ad Completion Ledger

ALTER TABLE public.sponsor_ads
  ADD COLUMN IF NOT EXISTS creator_code text,
  ADD COLUMN IF NOT EXISTS target_series_key text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending_review', 'approved', 'rejected', 'completed')),
  ADD COLUMN IF NOT EXISTS package_code text,
  ADD COLUMN IF NOT EXISTS budget_kes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_completions integer,
  ADD COLUMN IF NOT EXISTS cpv_kes numeric(10, 2) NOT NULL DEFAULT 1.50;

CREATE INDEX IF NOT EXISTS idx_sponsor_ads_creator_code ON public.sponsor_ads (creator_code);

-- Allow creators to submit pending_review boost campaigns and read their own submissions
DROP POLICY IF EXISTS "Public read active sponsor ads" ON public.sponsor_ads;
CREATE POLICY "Public read active sponsor ads"
  ON public.sponsor_ads
  FOR SELECT
  USING (
    (is_active = true AND approval_status = 'approved')
    OR creator_code IS NOT NULL
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Creators submit pending boost ads" ON public.sponsor_ads;
CREATE POLICY "Creators submit pending boost ads"
  ON public.sponsor_ads
  FOR INSERT
  WITH CHECK (
    creator_code IS NOT NULL
    AND char_length(creator_code) BETWEEN 4 AND 40
    AND is_active = false
    AND approval_status = 'pending_review'
  );

-- Ledger of 30s ad completions crediting the Host Creator (60%) and Platform (40%)
CREATE TABLE IF NOT EXISTS public.sponsor_ad_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.sponsor_ads(id) ON DELETE CASCADE,
  host_video_id text,
  host_creator text,
  gross_cpv_kes numeric(10, 2) NOT NULL DEFAULT 1.50,
  creator_share_kes numeric(10, 2) NOT NULL DEFAULT 0.90,
  platform_share_kes numeric(10, 2) NOT NULL DEFAULT 0.60,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_ad_completions_host_creator
  ON public.sponsor_ad_completions (host_creator, created_at DESC);

ALTER TABLE public.sponsor_ad_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read ad host completions" ON public.sponsor_ad_completions;
CREATE POLICY "Public read ad host completions"
  ON public.sponsor_ad_completions
  FOR SELECT
  USING (true);

-- Upgrade metric RPC to credit host creator (60/40) and auto-complete campaigns at target_completions
CREATE OR REPLACE FUNCTION public.increment_sponsor_ad_metric(
  p_ad_id uuid,
  p_metric text,
  p_host_video_id text DEFAULT NULL,
  p_host_creator text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ad record;
  v_cpv numeric(10, 2);
  v_creator_share numeric(10, 2);
  v_platform_share numeric(10, 2);
BEGIN
  IF p_metric = 'impressions' THEN
    UPDATE public.sponsor_ads
      SET impressions = impressions + 1
      WHERE id = p_ad_id;
  ELSIF p_metric = 'completions' THEN
    UPDATE public.sponsor_ads
      SET completions = completions + 1
      WHERE id = p_ad_id
      RETURNING * INTO v_ad;

    IF FOUND THEN
      v_cpv := GREATEST(0, COALESCE(v_ad.cpv_kes, 1.50));
      v_creator_share := ROUND(v_cpv * 0.60, 2);
      v_platform_share := ROUND(v_cpv - v_creator_share, 2);

      IF p_host_creator IS NOT NULL AND char_length(trim(p_host_creator)) > 0 THEN
        INSERT INTO public.sponsor_ad_completions (
          ad_id, host_video_id, host_creator, gross_cpv_kes, creator_share_kes, platform_share_kes
        ) VALUES (
          p_ad_id, p_host_video_id, trim(p_host_creator), v_cpv, v_creator_share, v_platform_share
        );
      END IF;

      -- Auto-pause campaign once guaranteed completions target is reached
      IF v_ad.target_completions IS NOT NULL AND v_ad.completions >= v_ad.target_completions THEN
        UPDATE public.sponsor_ads
          SET is_active = false, approval_status = 'completed'
          WHERE id = p_ad_id;
      END IF;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_sponsor_ad_metric(uuid, text, text, text) TO anon, authenticated;
