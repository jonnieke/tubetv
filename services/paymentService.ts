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
}

export const MPESA_PACKAGES: CoinPackage[] = [
  { id: 'coins-daily-10', name: 'Daily 10 Bob', coins: 10, bonus: 0, priceKes: 10, priceUsd: 0.99, isPopular: true },
  { id: 'coins-100', name: 'Starter Pack', coins: 100, bonus: 10, priceKes: 100, priceUsd: 0.99 },
  { id: 'coins-300', name: 'Binge Pack', coins: 300, bonus: 50, priceKes: 300, priceUsd: 2.99 },
  { id: 'coins-600', name: 'Marathon Pack', coins: 600, bonus: 150, priceKes: 500, priceUsd: 4.99 },
];

export const CARD_PACKAGES: CoinPackage[] = [
  { id: 'coins-100', name: 'Starter Pack', coins: 100, bonus: 0, priceKes: 130, priceUsd: 0.99 },
  { id: 'coins-300', name: 'Binge Pack', coins: 300, bonus: 50, priceKes: 390, priceUsd: 2.99, isPopular: true },
  { id: 'coins-600', name: 'Marathon Pack', coins: 600, bonus: 150, priceKes: 650, priceUsd: 4.99 },
];

export const COIN_PACKAGES: CoinPackage[] = MPESA_PACKAGES;

export const VIP_PASSES = [
  { id: 'pass-daily', name: '24h VIP Day Pass', priceKes: 50, priceUsd: 1.49, description: 'Unlimited drama streaming for 24 hours' },
  { id: 'pass-monthly', name: '30-Day VIP Pass', priceKes: 499, priceUsd: 4.99, description: 'Unlimited access to all microdramas and originals' },
];

/**
 * Loads the current authenticated user's coin wallet
 */
export async function fetchWalletBalance(): Promise<CoinWallet | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_wallets')
    .select('coin_balance, bonus_coins')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return { coinBalance: 20, bonusCoins: 10, totalCoins: 30 }; // Local/Welcome fallback
  }

  return {
    coinBalance: data.coin_balance || 0,
    bonusCoins: data.bonus_coins || 0,
    totalCoins: (data.coin_balance || 0) + (data.bonus_coins || 0),
  };
}

/**
 * Claims or provisions 30 welcome bonus coins for a new viewer
 */
export async function claimWelcomeBonus(userId: string): Promise<CoinWallet> {
  try {
    const { data } = await supabase
      .from('user_wallets')
      .upsert({ user_id: userId, coin_balance: 20, bonus_coins: 10 }, { onConflict: 'user_id' })
      .select('coin_balance, bonus_coins')
      .maybeSingle();

    if (data) {
      return {
        coinBalance: data.coin_balance || 20,
        bonusCoins: data.bonus_coins || 10,
        totalCoins: (data.coin_balance || 20) + (data.bonus_coins || 10),
      };
    }
  } catch {}

  return { coinBalance: 20, bonusCoins: 10, totalCoins: 30 };
}

/**
 * Checks if a specific episode has been unlocked by the viewer
 */
export async function checkEpisodeUnlocked(videoId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

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
  cost: number = 10
): Promise<{ success: boolean; error?: string; remainingBalance?: number }> {
  const { data, error } = await supabase.rpc('unlock_episode_with_coins', {
    p_video_id: videoId,
    p_series_id: seriesId || null,
    p_cost: cost,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: data?.success ?? false,
    error: data?.error,
    remainingBalance: data?.remaining_balance,
  };
}

/**
 * Initializes Paystack checkout via Supabase Edge Function
 */
export async function initializePayment(params: {
  packageId: string;
  amount: number;
  currency: 'KES' | 'USD';
  paymentMethod: 'mpesa' | 'card';
  phone?: string;
}): Promise<{ authorizationUrl?: string; reference?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { error: 'Please log in to complete your purchase' };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/paystack-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params),
    });

    const result = await res.json();
    if (!res.ok || result.error) {
      return { error: result.error || 'Payment initialization failed' };
    }

    return {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    };
  } catch (err: any) {
    return { error: err.message || 'Network error during checkout' };
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
