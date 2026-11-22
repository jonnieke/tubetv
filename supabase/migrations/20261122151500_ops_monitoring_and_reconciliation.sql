-- ============================================================================
-- Migration: Production Error Monitoring & Payment Reconciliation Audit Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  source text NOT NULL DEFAULT 'error_boundary',
  message text NOT NULL,
  stack text,
  page_path text,
  user_agent text,
  client_ip text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_error_logs_created
  ON public.client_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_error_logs_fingerprint
  ON public.client_error_logs (fingerprint, created_at DESC);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read client error logs" ON public.client_error_logs;
CREATE POLICY "Admins read client error logs"
  ON public.client_error_logs
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE TABLE IF NOT EXISTS public.payment_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_count integer NOT NULL DEFAULT 0,
  recovered_count integer NOT NULL DEFAULT 0,
  still_stuck_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_runs_created
  ON public.payment_reconciliation_runs (created_at DESC);

ALTER TABLE public.payment_reconciliation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read reconciliation runs" ON public.payment_reconciliation_runs;
CREATE POLICY "Admins read reconciliation runs"
  ON public.payment_reconciliation_runs
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
