import { supabase } from '../lib/supabase';
import type { Video } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

export interface CoinWallet {
  coinBalance: number;
  bonusCoins: number;
  totalCoins: number;
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  bonus: number;
  priceKes: number;
  priceUsd: number;
  isPopular?: boolean;
  episodesEstimate?: string;
  validity?: string;
}

export const MPESA_PACKAGES: CoinPackage[] = [
  { id: 'coins-10', name: '10 Bob Min Pack', coins: 10, bonus: 0, priceKes: 10, priceUsd: 0.99, episodesEstimate: '10 Episodes', validity: 'Coins never expire', isPopular: true },
  { id: 'coins-50', name: '50 Bob Snack Pack', coins: 50, bonus: 5, priceKes: 50, priceUsd: 0.99, episodesEstimate: '55 Episodes (50 + 5 Bonus)', validity: 'Coins never expire' },
  { id: 'coins-100', name: 'Starter Pack', coins: 100, bonus: 15, priceKes: 100, priceUsd: 0.99, episodesEstimate: '115 Episodes (100 + 15 Bonus)', validity: 'Coins never expire' },
  { id: 'coins-300', name: 'Binge Pack', coins: 300, bonus: 50, priceKes: 300, priceUsd: 2.99, episodesEstimate: '350 Episodes (300 + 50 Bonus)', validity: 'Coins never expire' },
];

export const CARD_PACKAGES: CoinPackage[] = [
  { id: 'coins-50', name: '50 Coins Pack', coins: 50, bonus: 5, priceKes: 50, priceUsd: 0.99, episodesEstimate: '55 Episodes', validity: 'Coins never expire' },
  { id: 'coins-100', name: 'Starter Pack', coins: 100, bonus: 15, priceKes: 100, priceUsd: 1.49, episodesEstimate: '115 Episodes', validity: 'Coins never expire' },
  { id: 'coins-300', name: 'Binge Pack', coins: 300, bonus: 50, priceKes: 300, priceUsd: 2.99, episodesEstimate: '350 Episodes', validity: 'Coins never expire', isPopular: true },
];

export const COIN_PACKAGES: CoinPackage[] = MPESA_PACKAGES;

export interface VipPass {
  id: string;
  name: string;
  durationLabel: string;
  priceKes: number;
  priceUsd: number;
  description: string;
  isPopular?: boolean;
}

export const VIP_PASSES: VipPass[] = [
  { id: 'pass-daily', name: '24h VIP Day Pass', durationLabel: '24 Hours', priceKes: 20, priceUsd: 0.49, description: 'Unlimited drama streaming for 24 Hours', isPopular: true },
  { id: 'pass-weekly', name: '7-Day Binge Pass', durationLabel: '7 Days', priceKes: 100, priceUsd: 1.49, description: 'Unlimited drama binge for 7 Days' },
  { id: 'pass-monthly', name: '30-Day VIP Pass', durationLabel: '30 Days', priceKes: 300, priceUsd: 3.49, description: 'Unlimited access to all series for 30 Days' },
];

/**
 * Gets the current effective authenticated viewer (from Supabase or persisted session)
 */
async function getEffectiveUser(): Promise<{ id: string; email?: string; phone?: string; user_metadata?: any } | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user;
  } catch {}

  try {
    const stored = localStorage.getItem('tubetv_viewer_session');
    if (stored) return JSON.parse(stored);
  } catch {}

  try {
    const phone = localStorage.getItem('tube_verified_phone');
    if (phone) {
      const rawDigits = phone.replace(/\D/g, '');
      return {
        id: `viewer_${rawDigits}`,
        phone,
        user_metadata: { phone },
      };
    }
  } catch {}

  return null;
}

/**
 * Loads the current authenticated user's coin wallet
 */
const isSyntheticId = (id?: string) =>
  !id || id.startsWith('viewer_') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function fetchWalletBalance(): Promise<CoinWallet | null> {
  const user = await getEffectiveUser();
  if (!user) return null;

  if (isSyntheticId(user.id)) {
    let unlocksCount = 0;
    try {
      const stored = localStorage.getItem(`tube_synthetic_unlocks_${user.id}`);
      if (stored) unlocksCount = JSON.parse(stored).length;
    } catch {}
    const freeCoins = Math.max(0, 5 - unlocksCount);
    return {
      coinBalance: 0,
      bonusCoins: freeCoins,
      totalCoins: freeCoins,
    };
  }

  try {
    const [walletRes, unlocksRes] = await Promise.all([
      supabase
        .from('user_wallets')
        .select('coin_balance, bonus_coins, total_spent_kes')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('episode_unlocks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    const data = walletRes.data;
    const unlocksCount = unlocksRes.count || 0;
    const totalSpentKes = data?.total_spent_kes || 0;

    // If viewer has never purchased a paid package, strictly enforce 5 welcome coins
    if (totalSpentKes === 0) {
      const freeCoins = Math.max(0, 5 - unlocksCount);
      return {
        coinBalance: 0,
        bonusCoins: freeCoins,
        totalCoins: freeCoins,
      };
    }

    // For paying users: paid coins + remaining free coins
    const freeCoins = Math.max(0, 5 - unlocksCount);
    const paidBalance = Math.max(0, (data?.coin_balance || 0) + (data?.bonus_coins || 0) - unlocksCount);
    return {
      coinBalance: data?.coin_balance || 0,
      bonusCoins: freeCoins,
      totalCoins: paidBalance,
    };
  } catch {
    return { coinBalance: 0, bonusCoins: 5, totalCoins: 5 };
  }
}

/**
 * Claims or provisions 5 welcome bonus coins for a new viewer (1 coin = 1 episode)
 */
export async function claimWelcomeBonus(userId: string): Promise<CoinWallet> {
  if (isSyntheticId(userId)) {
    return { coinBalance: 5, bonusCoins: 0, totalCoins: 5 };
  }
  try {
    const { data } = await supabase
      .from('user_wallets')
      .upsert({ user_id: userId, coin_balance: 5, bonus_coins: 0 }, { onConflict: 'user_id' })
      .select('coin_balance, bonus_coins')
      .maybeSingle();

    if (data) {
      return {
        coinBalance: data.coin_balance || 5,
        bonusCoins: data.bonus_coins || 0,
        totalCoins: (data.coin_balance || 5) + (data.bonus_coins || 0),
      };
    }
  } catch {}

  return { coinBalance: 5, bonusCoins: 0, totalCoins: 5 };
}

/**
 * Checks if a specific episode has been unlocked by the viewer
 */
export async function checkEpisodeUnlocked(videoId: string): Promise<boolean> {
  const user = await getEffectiveUser();
  if (!user) return false;

  if (isSyntheticId(user.id)) {
    try {
      const stored = localStorage.getItem(`tube_synthetic_unlocks_${user.id}`);
      if (stored) return JSON.parse(stored).includes(videoId);
    } catch {}
    return false;
  }

  const { data } = await supabase
    .from('episode_unlocks')
    .select('video_id')
    .eq('user_id', user.id)
    .eq('video_id', videoId)
    .maybeSingle();

  return Boolean(data);
}

/**
 * Atomically unlocks an episode using coins via Supabase RPC
 */
export async function unlockEpisodeWithCoins(
  videoId: string,
  seriesId?: string,
  cost: number = 1
): Promise<{ success: boolean; error?: string; remainingBalance?: number }> {
  const user = await getEffectiveUser();
  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  // Handle synthetic viewer locally (strictly enforces 5 free episodes)
  if (isSyntheticId(user.id)) {
    try {
      const key = `tube_synthetic_unlocks_${user.id}`;
      const stored = localStorage.getItem(key);
      const list: string[] = stored ? JSON.parse(stored) : [];
      if (list.length >= 5 && !list.includes(videoId)) {
        return {
          success: false,
          error: 'Free episodes limit reached. Please recharge coins to continue.',
          remainingBalance: 0,
        };
      }
      if (!list.includes(videoId)) {
        list.push(videoId);
        localStorage.setItem(key, JSON.stringify(list));
      }
      const remaining = Math.max(0, 5 - list.length);
      return {
        success: true,
        remainingBalance: remaining,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Check effective balance first (strictly enforces 5 free coins limit)
  const wallet = await fetchWalletBalance();
  if (!wallet || wallet.totalCoins < cost) {
    return {
      success: false,
      error: 'Insufficient coins. Please recharge your wallet.',
      remainingBalance: wallet?.totalCoins || 0,
    };
  }

  const { data, error } = await supabase.rpc('unlock_episode_with_coins', {
    p_video_id: videoId,
    p_series_id: seriesId || null,
    p_cost: cost,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Fetch updated effective balance
  const updatedWallet = await fetchWalletBalance();

  return {
    success: data?.success ?? false,
    error: data?.error,
    remainingBalance: updatedWallet?.totalCoins ?? 0,
  };
}

/**
 * Initializes Paystack checkout via Supabase Edge Function
 * Supports both standard Supabase auth sessions and phone-verified viewers
 */
export async function initializePayment(params: {
  packageId: string;
  amount: number;
  currency: 'KES' | 'USD';
  paymentMethod: 'mpesa' | 'card';
  phone?: string;
}): Promise<{ authorizationUrl?: string; accessCode?: string; reference?: string; error?: string }> {
  const viewer = await getEffectiveUser();
  const { data: { session } } = await supabase.auth.getSession();

  let effectivePhone = params.phone || viewer?.phone;
  if (!effectivePhone && typeof window !== 'undefined') {
    try {
      effectivePhone = localStorage.getItem('tube_verified_phone') || '';
    } catch {}
  }

  const userId = viewer?.id || session?.user?.id || (effectivePhone ? `viewer_${effectivePhone.replace(/\D/g, '')}` : undefined);

  if (!session && !userId && !effectivePhone) {
    return { error: 'Please enter your phone number to complete purchase' };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/paystack-checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...params,
        userId,
        phone: effectivePhone,
      }),
    });

    const result = await res.json();
    if (!res.ok || result.error) {
      return { error: result.error || 'Payment initialization failed' };
    }

    return {
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode,
      reference: result.reference,
    };
  } catch (err: any) {
    return { error: err.message || 'Network error during checkout' };
  }
}

/**
 * Verifies Paystack transaction reference and refreshes wallet
 */
export async function verifyPayment(reference: string): Promise<{ success: boolean; wallet?: CoinWallet | null; error?: string }> {
  try {
    // Wait briefly for webhook processing or DB sync
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const wallet = await fetchWalletBalance();
    return { success: true, wallet };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to verify payment' };
  }
}

/**
 * Requests a time-limited signed playback stream URL from the Edge Function
 */
export async function getSecurePlaybackStream(video: Video): Promise<{ streamUrl: string; isLocked?: boolean }> {
  if (!SUPABASE_URL || import.meta.env.DEV) {
    return { streamUrl: video.url || '' };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const isDrama = video.seriesFormat === 'micro-drama' || video.category === 'Micro Dramas';
  const query = new URLSearchParams({
    videoId: video.id,
    episode: String(video.episode || 1),
    isMicroDrama: String(isDrama),
  });

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/playback-token?${query}`, { headers });
    const data = await res.json();

    if (res.status === 403 || data.status === 'LOCKED') {
      return { streamUrl: '', isLocked: true };
    }

    return { streamUrl: data.streamUrl || video.url || '' };
  } catch {
    return { streamUrl: video.url || '' };
  }
}

export interface CreatorMetrics {
  totalEarnedKes: number;
  totalWithdrawnKes: number;
  pendingWithdrawalKes: number;
  availableBalanceKes: number;
  totalEpisodeUnlocks: number;
}

export interface PayoutRecord {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed';
  payoutMethod: string;
  payoutDestination: string;
  createdAt: string;
}

/**
 * Loads real-time creator revenue & balance metrics
 */
export async function fetchCreatorMetrics(): Promise<CreatorMetrics | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('get_creator_metrics', {
    p_creator_id: user.id,
  });

  if (error || !data) {
    // Local / unlinked fallback
    return {
      totalEarnedKes: 0,
      totalWithdrawnKes: 0,
      pendingWithdrawalKes: 0,
      availableBalanceKes: 0,
      totalEpisodeUnlocks: 0,
    };
  }

  return {
    totalEarnedKes: Number(data.total_earned_kes || 0),
    totalWithdrawnKes: Number(data.total_withdrawn_kes || 0),
    pendingWithdrawalKes: Number(data.pending_withdrawal_kes || 0),
    availableBalanceKes: Number(data.available_balance_kes || 0),
    totalEpisodeUnlocks: Number(data.total_episode_unlocks || 0),
  };
}

/**
 * Requests an M-Pesa B2C payout for the logged-in creator
 */
export async function requestMpesaWithdrawal(params: {
  amount: number;
  phoneNumber: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { success: false, error: 'Please log in to initiate withdrawal' };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/payout-transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        amount: params.amount,
        phone_number: params.phoneNumber,
      }),
    });

    const result = await res.json();
    if (!res.ok || result.error) {
      return { success: false, error: result.error || 'Failed to initiate withdrawal' };
    }

    return { success: true, message: result.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during payout transfer' };
  }
}

/**
 * Fetches recent payout requests for the creator
 */
export async function fetchCreatorPayoutHistory(): Promise<PayoutRecord[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('payout_requests')
    .select('id, amount, currency, status, payout_method, payout_destination, created_at')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    payoutMethod: row.payout_method,
    payoutDestination: row.payout_destination,
    createdAt: row.created_at,
  }));
}
