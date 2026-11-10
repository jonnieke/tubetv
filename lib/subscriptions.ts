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
  mpesa_ref?: string | null;
}

export interface StoredPass {
  token: string;
  tier: string;
  expiresAt: number;
  mpesaReceipt?: string;
}

const SIGNED_PASS_KEY = 'tube_pass_token';
const LEGACY_GUEST_PASS_KEY = 'tube_guest_pass';
const LEGACY_UNLOCKED_KEY = 'tube_unlocked_episodes';
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

function purgeLegacyUnsignedKeys() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_GUEST_PASS_KEY);
    localStorage.removeItem(LEGACY_UNLOCKED_KEY);
  } catch {
    // Ignore storage restriction
  }
}

function isPlausibleSignedToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2 || parts[0].length < 16 || parts[1].length < 32) return false;
  try {
    const padded = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const parsed = JSON.parse(json) as { subId?: string; exp?: number };
    return Boolean(parsed.subId && typeof parsed.exp === 'number' && parsed.exp > Date.now());
  } catch {
    return false;
  }
}

export function getStoredPass(): StoredPass | null {
  if (typeof window === 'undefined') return null;
  purgeLegacyUnsignedKeys();
  try {
    const raw = localStorage.getItem(SIGNED_PASS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPass>;
    if (
      !isPlausibleSignedToken(parsed.token) ||
      typeof parsed.tier !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= Date.now()
    ) {
      localStorage.removeItem(SIGNED_PASS_KEY);
      return null;
    }
    return {
      token: parsed.token,
      tier: parsed.tier,
      expiresAt: parsed.expiresAt,
      mpesaReceipt: typeof parsed.mpesaReceipt === 'string' ? parsed.mpesaReceipt : undefined,
    };
  } catch {
    return null;
  }
}

export function saveStoredPass(pass: StoredPass) {
  if (typeof window === 'undefined' || !isPlausibleSignedToken(pass.token)) return;
  purgeLegacyUnsignedKeys();
  try {
    localStorage.setItem(SIGNED_PASS_KEY, JSON.stringify(pass));
    window.dispatchEvent(new CustomEvent('tubetv:pass-updated', { detail: pass }));
  } catch {
    // Best-effort local storage
  }
}

export function clearStoredPass() {
  if (typeof window === 'undefined') return;
  purgeLegacyUnsignedKeys();
  try {
    localStorage.removeItem(SIGNED_PASS_KEY);
    window.dispatchEvent(new CustomEvent('tubetv:pass-updated', { detail: null }));
  } catch {
    // Best-effort local storage
  }
}

/**
 * Verifies the locally stored HMAC-signed pass token against the server ledger.
 * Immediately clears forged, revoked, or expired tokens.
 */
export async function verifyStoredPass(): Promise<ActiveSubscription | null> {
  const stored = getStoredPass();
  if (!stored) return null;

  if (!isSupabaseConfigured) {
    return {
      id: 'signed-pass',
      tier: stored.tier,
      end_date: new Date(stored.expiresAt).toISOString(),
      is_active: true,
      mpesa_ref: stored.mpesaReceipt || null,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
      body: { action: 'verify', passToken: stored.token },
      headers: { 'X-Pass-Token': stored.token },
    });

    if (!error && data && data.valid === false) {
      clearStoredPass();
      return null;
    }

    if (!error && data?.valid && data.pass) {
      const updated: StoredPass = {
        token: stored.token,
        tier: data.pass.tier || stored.tier,
        expiresAt: Number(data.pass.expiresAt) || stored.expiresAt,
        mpesaReceipt: data.pass.mpesaReceipt || stored.mpesaReceipt,
      };
      try {
        localStorage.setItem(SIGNED_PASS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage error
      }
      return {
        id: 'signed-pass',
        tier: updated.tier,
        end_date: new Date(updated.expiresAt).toISOString(),
        is_active: true,
        mpesa_ref: updated.mpesaReceipt || null,
      };
    }

    // Transient network error while offline: keep signed token until expiry or next online check
    return {
      id: 'signed-pass',
      tier: stored.tier,
      end_date: new Date(stored.expiresAt).toISOString(),
      is_active: true,
      mpesa_ref: stored.mpesaReceipt || null,
    };
  } catch {
    return {
      id: 'signed-pass',
      tier: stored.tier,
      end_date: new Date(stored.expiresAt).toISOString(),
      is_active: true,
      mpesa_ref: stored.mpesaReceipt || null,
    };
  }
}

export async function fetchActiveSubscription(userId?: string | null): Promise<ActiveSubscription | null> {
  const verifiedPass = await verifyStoredPass();
  if (verifiedPass) return verifiedPass;

  if (!userId || isLocalAuthUserId(userId) || !isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, tier, end_date, is_active, mpesa_ref')
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

export interface PaystackInitiateResponse {
  id: string;
  status: string;
  reference: string;
  accessCode: string;
  authorizationUrl: string;
  checkoutToken: string;
  publicKey?: string;
}

export async function startPaystackPayment(
  planCode: SubscriptionPlanCode,
  options: { email?: string; phone?: string } = {},
): Promise<PaystackInitiateResponse> {
  if (!isSupabaseConfigured) {
    throw new Error('Paystack payments are not configured in this environment.');
  }
  const idempotencyKey = crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke('paystack-checkout', {
    body: { action: 'initiate', planCode, email: options.email, phone: options.phone },
    headers: { 'Idempotency-Key': idempotencyKey },
  });

  if (error) {
    throw new Error(data?.error || error.message || 'Could not initiate Paystack checkout.');
  }
  if (data?.error) throw new Error(data.error);

  return data.transaction as PaystackInitiateResponse;
}

export async function fetchPaystackStatus(reference: string, checkoutToken: string, transactionId?: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Payment status verification is unavailable.');
  }
  const { data, error } = await supabase.functions.invoke('paystack-checkout', {
    body: { action: 'status', reference, checkoutToken, transactionId },
  });

  if (error) {
    throw new Error(data?.error || error.message || 'Unable to verify payment status.');
  }
  if (data?.error) throw new Error(data.error);

  if (data?.pass?.token) {
    saveStoredPass({
      token: data.pass.token,
      tier: data.pass.tier,
      expiresAt: Number(data.pass.expiresAt),
      mpesaReceipt: data.pass.reference,
    });
  }

  return data as {
    transaction: {
      id: string;
      status: 'pending' | 'submitted' | 'succeeded' | 'failed' | string;
      reference: string;
      result_description?: string;
    };
    pass?: StoredPass;
  };
}

export async function restorePaystackPass(reference: string, emailOrPhone?: string): Promise<StoredPass> {
  if (!isSupabaseConfigured) {
    throw new Error('Pass restoration requires a live payment connection.');
  }
  const { data, error } = await supabase.functions.invoke('paystack-checkout', {
    body: { action: 'restore', reference: reference.trim().toUpperCase(), emailOrPhone: emailOrPhone?.trim() },
  });

  if (error) {
    throw new Error(data?.error || error.message || 'Could not restore pass with those details.');
  }
  if (data?.error || !data?.pass?.token) {
    throw new Error(data?.error || 'No active pass matched that reference.');
  }

  const stored: StoredPass = {
    token: data.pass.token,
    tier: data.pass.tier,
    expiresAt: Number(data.pass.expiresAt),
    mpesaReceipt: data.pass.reference,
  };
  saveStoredPass(stored);
  return stored;
}

export async function startMpesaPayment(planCode: SubscriptionPlanCode, phone: string) {
  if (!isSupabaseConfigured) {
    throw new Error('M-Pesa payments are not configured in this environment.');
  }
  const idempotencyKey = crypto.randomUUID();

  // Primary: call mpesa-stk-push
  try {
    const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
      body: { action: 'initiate', planCode, phone },
      headers: { 'Idempotency-Key': idempotencyKey },
    });

    if (!error && data?.transaction?.id && !data?.error) {
      return data.transaction as {
        id: string;
        status: string;
        checkoutToken: string;
        checkoutRequestId?: string;
        reference?: string;
        authorizationUrl?: string;
        message?: string;
      };
    }
  } catch (err) {
    console.warn('mpesa_stk_invoke_fallback_to_paystack', err);
  }

  // Resilient fallback: initialize mobile money directly via paystack-checkout
  const { data: pData, error: pError } = await supabase.functions.invoke('paystack-checkout', {
    body: { action: 'initiate', planCode, phone, channel: 'mobile_money' },
    headers: { 'Idempotency-Key': idempotencyKey },
  });

  if (pError || !pData?.transaction?.id) {
    throw new Error(pData?.error || pError?.message || 'Could not initiate M-Pesa payment right now.');
  }

  const pTx = pData.transaction;
  return {
    id: pTx.id,
    status: pTx.status,
    checkoutToken: pTx.checkoutToken,
    checkoutRequestId: pTx.reference,
    reference: pTx.reference,
    authorizationUrl: pTx.authorizationUrl,
    message: pTx.displayText || 'M-Pesa payment initiated.',
  };
}

export async function fetchPaymentStatus(transactionId: string, checkoutToken: string) {
  if (!isSupabaseConfigured) {
    throw new Error('M-Pesa payments are not configured in this environment.');
  }

  let data: any;
  let error: any;

  try {
    const res = await supabase.functions.invoke('mpesa-stk-push', {
      body: { action: 'status', transactionId, checkoutToken },
    });
    data = res.data;
    error = res.error;
  } catch (err) {
    error = err;
  }

  // Fallback to paystack-checkout if mpesa-stk-push returned error
  if (error || !data?.transaction) {
    try {
      const pRes = await supabase.functions.invoke('paystack-checkout', {
        body: { action: 'status', transactionId, checkoutToken },
      });
      if (!pRes.error && pRes.data?.transaction) {
        data = pRes.data;
        error = null;
      }
    } catch {
      // keep original error
    }
  }

  if (error) {
    throw new Error(data?.error || error.message || 'Unable to verify payment status.');
  }
  if (data?.error) throw new Error(data.error);

  if (data?.pass?.token) {
    saveStoredPass({
      token: data.pass.token,
      tier: data.pass.tier,
      expiresAt: Number(data.pass.expiresAt),
      mpesaReceipt: data.pass.mpesaReceipt || data.pass.reference,
    });
  }

  return data as {
    transaction: {
      id: string;
      status: 'pending' | 'submitted' | 'succeeded' | 'failed' | 'cancelled' | string;
      result_description: string | null;
      mpesa_receipt?: string | null;
    };
    pass?: StoredPass;
  };
}

export async function restoreMpesaPass(mpesaReceipt: string, phone: string): Promise<StoredPass> {
  if (!isSupabaseConfigured) {
    throw new Error('Pass restoration requires a live payment connection.');
  }
  const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
    body: { action: 'restore', mpesaReceipt: mpesaReceipt.trim().toUpperCase(), phone: phone.trim() },
  });

  if (error) {
    throw new Error(data?.error || error.message || 'Could not restore pass with those details.');
  }
  if (data?.error || !data?.pass?.token) {
    throw new Error(data?.error || 'No active pass matched that M-Pesa receipt and phone number.');
  }

  const stored: StoredPass = {
    token: data.pass.token,
    tier: data.pass.tier,
    expiresAt: Number(data.pass.expiresAt),
    mpesaReceipt: data.pass.mpesaReceipt,
  };
  saveStoredPass(stored);
  return stored;
}

export async function resolveAuthorizedPlaybackUrl(
  videoId: string,
  fallbackUrl?: string,
): Promise<{ locked: boolean; url: string }> {
  const safeFallback = fallbackUrl || '';
  if (
    !isSupabaseConfigured ||
    !SUPABASE_URL ||
    !ANON_KEY ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)
  ) {
    return { locked: false, url: safeFallback };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const storedPass = getStoredPass();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${session?.access_token || ANON_KEY}`,
    };
    if (storedPass?.token) {
      headers['X-Pass-Token'] = storedPass.token;
    }

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/playback-access?id=${encodeURIComponent(videoId)}`,
      { headers, cache: 'no-store' },
    );

    if (res.status === 402) {
      if (storedPass) clearStoredPass();
      return { locked: true, url: '' };
    }

    if (res.ok) {
      const payload = await res.json();
      if (payload?.locked) return { locked: true, url: '' };
      if (typeof payload?.playbackUrl === 'string' && payload.playbackUrl) {
        return { locked: false, url: payload.playbackUrl };
      }
    }

    return { locked: false, url: safeFallback };
  } catch {
    return { locked: false, url: safeFallback };
  }
}
