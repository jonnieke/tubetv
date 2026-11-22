-- ============================================================================
-- Migration: Anti-Farming Hardening for Sponsor Ad Metrics & Reward Unlocks
-- ============================================================================
-- 1. Revoke public/anon/authenticated direct execution of increment_sponsor_ad_metric
--    so scripts cannot farm creator ad-host payouts or drain sponsor budgets.
-- 2. Add server-verified ad_watch_sessions (enforces wall-clock duration) and
--    persistent reward_unlock_grants (survives Deno isolate cold starts).

-- Lock down both overloads of increment_sponsor_ad_metric to service_role only
DROP FUNCTION IF EXISTS public.increment_sponsor_ad_metric(uuid, text);

REVOKE ALL ON FUNCTION public.increment_sponsor_ad_metric(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_sponsor_ad_metric(uuid, text, text, text)
  TO service_role;

-- Server-tracked ad watch sessions (only service_role reads/writes)
CREATE TABLE IF NOT EXISTS public.ad_watch_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid REFERENCES public.sponsor_ads(id) ON DELETE CASCADE,
  host_video_id text NOT NULL,
  host_creator text,
  device_id text NOT NULL,
  client_ip text NOT NULL,
  required_seconds integer NOT NULL DEFAULT 25 CHECK (required_seconds BETWEEN 5 AND 120),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_ad_watch_sessions_device_started
  ON public.ad_watch_sessions (device_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_watch_sessions_ip_started
  ON public.ad_watch_sessions (client_ip, started_at DESC);

ALTER TABLE public.ad_watch_sessions ENABLE ROW LEVEL SECURITY;

-- Persistent server-verified reward unlock grants (only service_role reads/writes)
CREATE TABLE IF NOT EXISTS public.reward_unlock_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('ad', 'share', 'streak')),
  device_id text NOT NULL,
  client_ip text NOT NULL,
  ad_session_id uuid REFERENCES public.ad_watch_sessions(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_reward_unlock_grants_device_time
  ON public.reward_unlock_grants (device_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_unlock_grants_ip_time
  ON public.reward_unlock_grants (client_ip, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_unlock_grants_lookup
  ON public.reward_unlock_grants (id, video_id, device_id);

ALTER TABLE public.reward_unlock_grants ENABLE ROW LEVEL SECURITY;
