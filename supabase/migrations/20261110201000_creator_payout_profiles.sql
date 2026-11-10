-- Creator Payout Directory & Self-Service Portal Profiles
CREATE TABLE IF NOT EXISTS public.creator_payout_profiles (
  creator_name TEXT PRIMARY KEY,
  payout_rail TEXT NOT NULL DEFAULT 'M-Pesa B2C (Kenya)',
  payout_account TEXT NOT NULL DEFAULT '',
  tax_id_or_pin TEXT DEFAULT '',
  withholding_tax_percent NUMERIC NOT NULL DEFAULT 0,
  contact_email TEXT DEFAULT '',
  portal_access_code TEXT UNIQUE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_payout_profiles_code
  ON public.creator_payout_profiles (portal_access_code);

ALTER TABLE public.creator_payout_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins to read and manage creator payout profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'creator_payout_profiles'
      AND policyname = 'Admins manage creator_payout_profiles'
  ) THEN
    CREATE POLICY "Admins manage creator_payout_profiles"
      ON public.creator_payout_profiles
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Secure RPC so a creative can look up their own profile using their read-only portal_access_code
CREATE OR REPLACE FUNCTION public.get_creator_profile_by_code(p_access_code TEXT)
RETURNS TABLE (
  creator_name TEXT,
  payout_rail TEXT,
  masked_payout_account TEXT,
  withholding_tax_percent NUMERIC,
  portal_access_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := upper(trim(coalesce(p_access_code, '')));
BEGIN
  IF length(v_clean) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cpp.creator_name,
    cpp.payout_rail,
    CASE
      WHEN length(cpp.payout_account) > 4
        THEN repeat('*', greatest(2, length(cpp.payout_account) - 4)) || right(cpp.payout_account, 4)
      ELSE cpp.payout_account
    END AS masked_payout_account,
    cpp.withholding_tax_percent,
    cpp.portal_access_code
  FROM public.creator_payout_profiles cpp
  WHERE upper(cpp.portal_access_code) = v_clean
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_creator_profile_by_code(TEXT) TO anon, authenticated, service_role;
