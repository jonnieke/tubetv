-- ============================================================================
-- Migration: Cross-Device Phone-Pass Continuity (Continue Watching & Watch List Sync)
-- ============================================================================

alter table public.subscriptions
  add column if not exists viewer_state jsonb not null default '{}'::jsonb;
