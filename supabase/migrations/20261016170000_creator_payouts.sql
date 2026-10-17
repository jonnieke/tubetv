-- ==============================================================================
-- Migration: Creator Economics & M-Pesa B2C Payouts Engine
-- Target: Supabase Postgres
-- Description:
--   1. creator_profiles: Stores creator credentials, M-Pesa phone, Paystack transfer recipient code.
--   2. Links series(creator_id) -> creator_profiles(id).
--   3. creator_earnings_ledger: Tracks revenue share whenever coins are burned on an episode.
--   4. payout_requests: Tracks creator withdrawal requests and M-Pesa transfer status.
--   5. Trigger: Automatically allocates creator revenue on episode unlock.
-- ==============================================================================

-- 1. CREATOR PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.creator_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT NOT NULL, -- Format: 2547XXXXXXXX for Safaricom M-Pesa
    country TEXT NOT NULL DEFAULT 'KE',
    revenue_share_percentage NUMERIC(5, 2) NOT NULL DEFAULT 65.00 CHECK (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100),
    paystack_recipient_code TEXT, -- Created via Paystack Transfer Recipient API (type: 'mobile_money')
    currency TEXT NOT NULL DEFAULT 'KES' CHECK (currency IN ('KES', 'USD')),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure series references creator_profiles if creator_id exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'series' AND column_name = 'creator_id'
    ) THEN
        ALTER TABLE public.series ADD COLUMN creator_id UUID REFERENCES public.creator_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_series_creator_id ON public.series(creator_id);

-- 2. CREATOR EARNINGS LEDGER
-- Every coin unlocked creates an entry here with the calculated fiat revenue
CREATE TABLE IF NOT EXISTS public.creator_earnings_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
    series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE RESTRICT,
    episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE RESTRICT,
    unlock_id UUID REFERENCES public.episode_unlocks(id) ON DELETE SET NULL,
    coins_spent INTEGER NOT NULL CHECK (coins_spent > 0),
    gross_amount_fiat NUMERIC(10, 2) NOT NULL, -- e.g. 10 coins = 20.00 KES
    creator_net_fiat NUMERIC(10, 2) NOT NULL,  -- e.g. 65% of 20 = 13.00 KES
    platform_fee_fiat NUMERIC(10, 2) NOT NULL, -- e.g. 35% of 20 = 7.00 KES
    currency TEXT NOT NULL DEFAULT 'KES',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator_id ON public.creator_earnings_ledger(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_created_at ON public.creator_earnings_ledger(created_at DESC);

-- 3. PAYOUT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 500.00), -- Minimum withdrawal: KES 500
    currency TEXT NOT NULL DEFAULT 'KES',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'rejected', 'failed')),
    payout_method TEXT NOT NULL DEFAULT 'mpesa' CHECK (payout_method IN ('mpesa', 'bank_transfer')),
    payout_destination TEXT NOT NULL, -- Safaricom Phone Number or Bank Account
    paystack_transfer_code TEXT, -- Populated once Paystack B2C transfer is initiated
    paystack_reference TEXT,
    failure_reason TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_creator_id ON public.payout_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests(status);

-- 4. FUNCTION TO ALLOCATE REVENUE ON EPISODE UNLOCK
-- Conversion benchmark: 1 Coin = 2.00 KES (Standard Bundle: 50 coins for KES 100)
CREATE OR REPLACE FUNCTION public.fn_allocate_creator_earnings()
RETURNS TRIGGER AS $$
DECLARE
    v_series_id UUID;
    v_creator_id UUID;
    v_rev_split NUMERIC(5, 2);
    v_gross_kes NUMERIC(10, 2);
    v_creator_kes NUMERIC(10, 2);
    v_platform_kes NUMERIC(10, 2);
BEGIN
    -- Only process coin purchases (skip VIP passes or promotional zero-coin grants)
    IF NEW.coins_spent <= 0 THEN
        RETURN NEW;
    END IF;

    -- Lookup series & creator from episode
    SELECT s.id, s.creator_id, COALESCE(cp.revenue_share_percentage, 65.00)
    INTO v_series_id, v_creator_id, v_rev_split
    FROM public.episodes ep
    JOIN public.series s ON s.id = ep.series_id
    LEFT JOIN public.creator_profiles cp ON cp.id = s.creator_id
    WHERE ep.id = NEW.episode_id;

    -- If no creator assigned, platform retains 100% (no creator ledger row needed)
    IF v_creator_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calculate Gross: 1 Coin = 2.00 KES
    v_gross_kes := NEW.coins_spent * 2.00;
    v_creator_kes := ROUND(v_gross_kes * (v_rev_split / 100.0), 2);
    v_platform_kes := v_gross_kes - v_creator_kes;

    INSERT INTO public.creator_earnings_ledger (
        creator_id,
        series_id,
        episode_id,
        unlock_id,
        coins_spent,
        gross_amount_fiat,
        creator_net_fiat,
        platform_fee_fiat,
        currency
    ) VALUES (
        v_creator_id,
        v_series_id,
        NEW.episode_id,
        NEW.id,
        NEW.coins_spent,
        v_gross_kes,
        v_creator_kes,
        v_platform_kes,
        'KES'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after successful episode unlock
DROP TRIGGER IF EXISTS trg_allocate_creator_earnings ON public.episode_unlocks;
CREATE TRIGGER trg_allocate_creator_earnings
    AFTER INSERT ON public.episode_unlocks
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_allocate_creator_earnings();

-- 5. RPC TO GET CREATOR BALANCE & METRICS
CREATE OR REPLACE FUNCTION public.get_creator_metrics(p_creator_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total_earned NUMERIC(10, 2) := 0;
    v_total_withdrawn NUMERIC(10, 2) := 0;
    v_pending_withdrawal NUMERIC(10, 2) := 0;
    v_available_balance NUMERIC(10, 2) := 0;
    v_total_unlocks INTEGER := 0;
BEGIN
    -- Verify caller is creator or admin
    IF auth.uid() <> p_creator_id AND NOT (auth.jwt() ->> 'role' = 'service_role') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Total Earned
    SELECT COALESCE(SUM(creator_net_fiat), 0), COUNT(id)
    INTO v_total_earned, v_total_unlocks
    FROM public.creator_earnings_ledger
    WHERE creator_id = p_creator_id;

    -- Total Withdrawn (Paid)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_withdrawn
    FROM public.payout_requests
    WHERE creator_id = p_creator_id AND status = 'paid';

    -- Pending Withdrawals (pending, approved, processing)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_pending_withdrawal
    FROM public.payout_requests
    WHERE creator_id = p_creator_id AND status IN ('pending', 'approved', 'processing');

    v_available_balance := v_total_earned - v_total_withdrawn - v_pending_withdrawal;
    IF v_available_balance < 0 THEN
        v_available_balance := 0;
    END IF;

    RETURN jsonb_build_object(
        'total_earned_kes', v_total_earned,
        'total_withdrawn_kes', v_total_withdrawn,
        'pending_withdrawal_kes', v_pending_withdrawal,
        'available_balance_kes', v_available_balance,
        'total_episode_unlocks', v_total_unlocks
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_earnings_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- Creator Profiles: Read own profile, update own phone/display_name
CREATE POLICY "Creators can view own profile"
    ON public.creator_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Creators can update own profile"
    ON public.creator_profiles FOR UPDATE
    USING (auth.uid() = id);

-- Creator Earnings Ledger: Read-only for the creator
CREATE POLICY "Creators can view their earnings"
    ON public.creator_earnings_ledger FOR SELECT
    USING (auth.uid() = creator_id);

-- Payout Requests: Creators can view their requests and submit new ones
CREATE POLICY "Creators can view own payouts"
    ON public.payout_requests FOR SELECT
    USING (auth.uid() = creator_id);

CREATE POLICY "Creators can insert payout request"
    ON public.payout_requests FOR INSERT
    WITH CHECK (auth.uid() = creator_id);
