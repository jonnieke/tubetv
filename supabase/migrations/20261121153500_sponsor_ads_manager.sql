-- Sponsor Video Ads table + Storage bucket for non-skippable 30s Ad-to-Unlock slots

CREATE TABLE IF NOT EXISTS public.sponsor_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  advertiser_name text NOT NULL CHECK (char_length(advertiser_name) BETWEEN 1 AND 80),
  video_url text NOT NULL CHECK (char_length(video_url) BETWEEN 4 AND 1000),
  click_url text,
  duration_seconds integer NOT NULL DEFAULT 30 CHECK (duration_seconds BETWEEN 10 AND 90),
  is_active boolean NOT NULL DEFAULT true,
  impressions integer NOT NULL DEFAULT 0,
  completions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_ads_active ON public.sponsor_ads (is_active, created_at DESC);

ALTER TABLE public.sponsor_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active sponsor ads" ON public.sponsor_ads;
CREATE POLICY "Public read active sponsor ads"
  ON public.sponsor_ads
  FOR SELECT
  USING (is_active = true OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin manage sponsor ads" ON public.sponsor_ads;
CREATE POLICY "Admin manage sponsor ads"
  ON public.sponsor_ads
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Safe counter RPC so anonymous viewers can record impressions & 30s completions
CREATE OR REPLACE FUNCTION public.increment_sponsor_ad_metric(p_ad_id uuid, p_metric text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_metric = 'impressions' THEN
    UPDATE public.sponsor_ads SET impressions = impressions + 1 WHERE id = p_ad_id;
  ELSIF p_metric = 'completions' THEN
    UPDATE public.sponsor_ads SET completions = completions + 1 WHERE id = p_ad_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_sponsor_ad_metric(uuid, text) TO anon, authenticated;

-- Public storage bucket for direct 30s MP4/WebM sponsor ad uploads from Admin
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sponsor-ads',
  'sponsor-ads',
  true,
  52428800,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read sponsor ad files" ON storage.objects;
CREATE POLICY "Public read sponsor ad files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'sponsor-ads');

DROP POLICY IF EXISTS "Admin upload sponsor ad files" ON storage.objects;
CREATE POLICY "Admin upload sponsor ad files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'sponsor-ads' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin delete sponsor ad files" ON storage.objects;
CREATE POLICY "Admin delete sponsor ad files"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'sponsor-ads' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
