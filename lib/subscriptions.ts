import { supabase, isSupabaseConfigured } from './supabase';
import { isLocalAuthUserId } from './localAuth';

export const SUBSCRIPTION_PLANS = {
  daily: { code: 'daily', label: '24-Hour Pass', amountKes: 10, description: '24 hours of unlimited premium access' },
  weekly: { code: 'weekly', label: 'Weekly Pass', amountKes: 50, description: '7 days of unlimited premium access' },
  monthly: { code: 'monthly', label: 'Monthly Pass', amountKes: 249, description: '30 days of unlimited premium access' },
} as const;

export type SubscriptionPlanCode = keyof typeof SUBSCRIPTION_PLANS;

export interface ActiveSubscription {
  id: string;
  tier: string;
  end_date: string | null;
  is_active: boolean;
}

const GUEST_PASS_KEY = 'tube_guest_pass';
const GUEST_UNLOCKED_KEY = 'tube_unlocked_episodes';

export function getLocalUnlockedVideoIds(): string[] {
  try {
    const raw = localStorage.getItem(GUEST_UNLOCKED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalUnlockedVideoId(videoId: string) {
  try {
    const current = getLocalUnlockedVideoIds();
    if (!current.includes(videoId)) {
      localStorage.setItem(GUEST_UNLOCKED_KEY, JSON.stringify([...current, videoId]));
    }
  } catch {
    // Best-effort local storage
  }
}

export function getLocalGuestPass(): { tier: string; expiresAt: number } | null {
  try {
    const raw = localStorage.getItem(GUEST_PASS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
      return parsed;
    }
    localStorage.removeItem(GUEST_PASS_KEY);
    return null;
  } catch {
    return null;
  }
}

export function saveLocalGuestPass(tier: string, durationHours = 24) {
  try {
    const pass = {
      tier,
      expiresAt: Date.now() + durationHours * 3600 * 1000,
    };
    localStorage.setItem(GUEST_PASS_KEY, JSON.stringify(pass));
  } catch {
    // Best effort
  }
}

export async function fetchActiveSubscription(userId?: string | null): Promise<ActiveSubscription | null> {
  // Check guest pass first
  const guestPass = getLocalGuestPass();
  if (guestPass) {
    return {
      id: 'guest-pass',
      tier: guestPass.tier,
      end_date: new Date(guestPass.expiresAt).toISOString(),
      is_active: true,
    };
  }

  if (!userId || isLocalAuthUserId(userId) || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, tier, end_date, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`end_date.is.null,end_date.gt.${new Date().toISOString()}`)
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Subscription fetch warning:', error.message);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function startMpesaPayment(planCode: SubscriptionPlanCode, phone: string) {
  const idempotencyKey = crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
    body: { planCode, phone },
    headers: { 'Idempotency-Key': idempotencyKey },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data.transaction as {
    id: string;
    status: string;
    checkoutRequestId?: string;
    message?: string;
  };
}

export async function fetchPaymentStatus(transactionId: string) {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('id, status, result_description')
    .eq('id', transactionId)
    .single();

  if (error) throw error;
  return data as { id: string; status: string; result_description: string | null };
}
