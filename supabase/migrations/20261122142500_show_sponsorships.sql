-- ============================================================================
-- Migration: Per-Show B2B Sponsorships & Brand-Funded Free Season Unlocks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.show_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_key text NOT NULL CHECK (char_length(series_key) BETWEEN 1 AND 120),
  series_title text,
  sponsor_name text NOT NULL CHECK (char_length(sponsor_name) BETWEEN 1 AND 100),
  tagline text NOT NULL DEFAULT 'Proudly supporting Kenyan creators and free episodes on TubeTV.',
  badge text NOT NULL DEFAULT 'Presented by',
  logo_url text,
  click_url text NOT NULL CHECK (click_url ~* '^https://'),
  package_tier text NOT NULL DEFAULT 'presented_by'
    CHECK (package_tier IN ('presented_by', 'free_season_unlock', 'exclusive_preroll')),
  unlocks_free_viewing boolean NOT NULL DEFAULT false,
  campaign_budget_kes integer NOT NULL DEFAULT 0 CHECK (campaign_budget_kes >= 0),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_show_sponsorships_lookup
  ON public.show_sponsorships (series_key, is_active, starts_at, ends_at);

ALTER TABLE public.show_sponsorships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active show sponsorships" ON public.show_sponsorships;
CREATE POLICY "Public read active show sponsorships"
  ON public.show_sponsorships
  FOR SELECT
  USING (
    (
      is_active = true
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at > now())
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admins manage show sponsorships" ON public.show_sponsorships;
CREATE POLICY "Admins manage show sponsorships"
  ON public.show_sponsorships
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
