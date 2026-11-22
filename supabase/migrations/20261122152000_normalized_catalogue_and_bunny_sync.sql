-- ============================================================================
-- Migration: Normalized Postgres Catalogue (Series + Episodes) & Bunny Sync
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.catalogue_series (
  id text PRIMARY KEY,
  title text NOT NULL,
  slug text,
  series_format text NOT NULL DEFAULT 'series',
  synopsis text,
  poster_url text,
  category text,
  author text,
  total_episodes integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalogue_series_slug ON public.catalogue_series (slug);
CREATE INDEX IF NOT EXISTS idx_catalogue_series_published ON public.catalogue_series (is_published, category);

ALTER TABLE public.catalogue_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published series" ON public.catalogue_series;
CREATE POLICY "Public read published series"
  ON public.catalogue_series
  FOR SELECT
  USING (is_published = true OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins manage catalogue series" ON public.catalogue_series;
CREATE POLICY "Admins manage catalogue series"
  ON public.catalogue_series
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE TABLE IF NOT EXISTS public.catalogue_episodes (
  guid uuid PRIMARY KEY,
  series_id text REFERENCES public.catalogue_series(id) ON DELETE SET NULL,
  series_title text,
  title text NOT NULL,
  season_number integer,
  episode_number integer,
  category text,
  author text,
  access_tier text,
  free_episodes integer,
  duration_seconds integer NOT NULL DEFAULT 0,
  thumbnail_file_name text,
  encoding_status integer NOT NULL DEFAULT 4,
  is_published boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  meta_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_public_item jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalogue_episodes_series_order
  ON public.catalogue_episodes (series_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_catalogue_episodes_published_cat
  ON public.catalogue_episodes (is_published, category, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalogue_episodes_search
  ON public.catalogue_episodes
  USING gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(series_title, '') || ' ' || coalesce(author, '')));

ALTER TABLE public.catalogue_episodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published episodes" ON public.catalogue_episodes;
CREATE POLICY "Public read published episodes"
  ON public.catalogue_episodes
  FOR SELECT
  USING (is_published = true OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins manage catalogue episodes" ON public.catalogue_episodes;
CREATE POLICY "Admins manage catalogue episodes"
  ON public.catalogue_episodes
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
