import { supabase, isSupabaseConfigured } from './supabase';
import { isLocalAuthUserId } from './localAuth';

export const SUBSCRIPTION_PLANS = {
  daily: { code: 'daily', label: '24-Hour Pass', amountKes: 10, description: '24 hours of unlimited premium access' },
  weekly: { code: 'weekly', label: 'Weekly Pass', amountKes: 50, description: '7 days of unlimited premium access' },
  monthly: { code: 'monthly', label: 'Monthly Pass', amountKes: 149, description: '30 days of unlimited premium access' },
} as const;

export type SubscriptionPlanCode = keyof typeof SUBSCRIPTION_PLANS;

export type RegionCode = 'KE' | 'TZ' | 'UG' | 'NG' | 'ZA' | 'GH' | 'US' | 'GB' | 'EU';

export interface RegionalPriceConfig {
  code: RegionCode;
  label: string;
  flag: string;
  currency: string;
  symbol: string;
  dialPrefix: string;
  supportsMpesaStk: boolean;
  paymentMethodsLabel: string;
  prices: Record<SubscriptionPlanCode, string>;
}

export const REGIONAL_PRICING: Record<RegionCode, RegionalPriceConfig> = {
  KE: {
    code: 'KE',
    label: 'Kenya (KES)',
    flag: '🇰🇪',
    currency: 'KES',
    symbol: 'KSh',
    dialPrefix: '+254',
    supportsMpesaStk: true,
    paymentMethodsLabel: 'Card, Apple Pay, M-Pesa',
    prices: { daily: 'KSh 10', weekly: 'KSh 50', monthly: 'KSh 149' },
  },
  TZ: {
    code: 'TZ',
    label: 'Tanzania (TZS)',
    flag: '🇹🇿',
    currency: 'TZS',
    symbol: 'TSh',
    dialPrefix: '+255',
    supportsMpesaStk: false,
    paymentMethodsLabel: 'Card, Apple Pay, M-Pesa Global',
    prices: { daily: 'TSh 250', weekly: 'TSh 1,000', monthly: 'TSh 2,900' },
  },
  UG: {
    code: 'UG',
    label: 'Uganda (UGX)',
    flag: '🇺🇬',
    currency: 'UGX',
    symbol: 'USh',
    dialPrefix: '+256',
    supportsMpesaStk: false,
    paymentMethodsLabel: 'Card, Apple Pay, Mobile Money',
    prices: { daily: 'USh 350', weekly: 'USh 1,500', monthly: 'USh 4,500' },
  },
  NG: {
    code: 'NG',
    label: 'Nigeria (NGN)',
    flag: '🇳🇬',
    currency: 'NGN',
    symbol: '₦',
    dialPrefix: '+234',
    supportsMpesaStk: false,
    paymentMethodsLabel: 'Card, Bank Transfer, Apple Pay',
    prices: { daily: '₦150', weekly: '₦650', monthly: '₦1,800' },
  },
  ZA: {
    code: 'ZA',
    label: 'South Africa (ZAR)',
    flag: '🇿🇦',
    currency: 'ZAR',
    symbol: 'R',
    dialPrefix: '+27',
    supportsMpesaStk: false,
    paymentMethodsLabel: 'Card, Apple Pay, Instant EFT',
    prices: { daily: 'R3', weekly: 'R10', monthly: 'R29' },
  },
  GH: {
    code: 'GH',
    label: 'Ghana (GHS)',
    flag: '🇬🇭',
    currency: 'GHS',
    symbol: 'GH₵',
    dialPrefix: '+233',
    supportsMpesaStk: false,
    paymentMethodsLabel: 'Card, MTN MoMo, Apple Pay',
    prices: { daily: 'GH₵2', weekly: 'GH₵8', monthly: 'GH₵22' },
  },
  US: {
    code: 'US',
    label: 'Diaspora — US / Global (USD)',
    flag: '🌍',
    currency: 'USD',
    symbol: '$',
    dialPrefix: '+1',
    supportsMpesaStk: false,
    paymentMethodsLabel: 'Apple Pay, Google Pay, Visa / Mastercard',
    prices: { daily: '$0.99', weekly: '$1.99', monthly: '$2.99' },
  },
  GB: {
    code: 'GB',
    label: 'Diaspora — UK (GBP)',
    flag: '🇬🇧',
    currency: 'GBP',
    symbol: '£',
    dialPrefix: '+44',
    supportsMpesaStk: false,
    paymentMethodsLabel: 'Apple Pay, Google Pay, UK Debit/Credit Card',
    prices: { daily: '£0.79', weekly: '£1.49', monthly: '£2.49' },
  },
  EU: {
    code: 'EU',
    label: 'Diaspora — Europe (EUR)',
    flag: '🇪🇺',
    currency: 'EUR',
    symbol: '€',
    dialPrefix: '+33',
    supportsMpesaStk: false,
    paymentMethodsLabel: 'Apple Pay, Google Pay, Card',
    prices: { daily: '€0.89', weekly: '€1.79', monthly: '€2.79' },
  },
};

const REGION_STORAGE_KEY = 'tubetv_region_code';

export function detectDefaultRegion(): RegionCode {
  if (typeof window === 'undefined') return 'KE';
  try {
    const saved = localStorage.getItem(REGION_STORAGE_KEY) as RegionCode | null;
    if (saved && saved in REGIONAL_PRICING) return saved;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Dar_es_Salaam')) return 'TZ';
    if (tz.includes('Kampala')) return 'UG';
    if (tz.includes('Lagos')) return 'NG';
    if (tz.includes('Johannesburg')) return 'ZA';
    if (tz.includes('Accra')) return 'GH';
    if (tz.includes('London')) return 'GB';
    if (tz.startsWith('America/')) return 'US';
    if (tz.startsWith('Europe/')) return 'EU';
  } catch {
    // Default to Kenya
  }
  return 'KE';
}

export function savePreferredRegion(region: RegionCode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REGION_STORAGE_KEY, region);
  } catch {}
}

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
  phone?: string;
  deviceId?: string;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const STORAGE_KEY = 'tubetv_device_id';
  try {
    let deviceId = localStorage.getItem(STORAGE_KEY);
    if (!deviceId || deviceId.length < 10) {
      deviceId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return 'fallback_device';
  }
}

const SAVED_PHONE_KEY = 'tubetv_saved_phone';

export function getRememberedPhone(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(SAVED_PHONE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveRememberedPhone(phone: string) {
  if (typeof window === 'undefined') return;
  const clean = phone.trim();
  if (!clean) return;
  try {
    localStorage.setItem(SAVED_PHONE_KEY, clean);
  } catch {
    // Best-effort local storage
  }
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

export function mergeRemotePassViewerState(viewerState: unknown) {
  if (typeof window === 'undefined' || !viewerState || typeof viewerState !== 'object') return;
  const state = viewerState as {
    progress?: Record<string, { positionSeconds: number; durationSeconds: number; completed: boolean }>;
    watchLater?: string[];
    lastWatchedVideoId?: string;
  };
  try {
    let changed = false;
    if (state.progress && typeof state.progress === 'object' && Object.keys(state.progress).length > 0) {
      const localRaw = localStorage.getItem('tube_watch_progress_guest');
      const localProg = localRaw ? JSON.parse(localRaw) : {};
      const mergedProg = { ...state.progress, ...localProg };
      localStorage.setItem('tube_watch_progress_guest', JSON.stringify(mergedProg));
      changed = true;
    }
    if (Array.isArray(state.watchLater) && state.watchLater.length > 0) {
      const localRaw = localStorage.getItem('tube_watch_later_guest');
      const localWl: string[] = localRaw ? JSON.parse(localRaw) : [];
      const mergedWl = Array.from(new Set([...state.watchLater, ...localWl]));
      localStorage.setItem('tube_watch_later_guest', JSON.stringify(mergedWl));
      changed = true;
    }
    if (typeof state.lastWatchedVideoId === 'string' && state.lastWatchedVideoId) {
      if (!localStorage.getItem('tubetv_last_watched_video_id')) {
        localStorage.setItem('tubetv_last_watched_video_id', state.lastWatchedVideoId);
      }
    }
    if (changed) {
      window.dispatchEvent(new CustomEvent('tubetv:viewer-state-synced'));
    }
  } catch {
    // Ignore storage errors
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

  const deviceId = getOrCreateDeviceId();

  try {
    const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
      body: { action: 'verify', passToken: stored.token, deviceId },
      headers: { 'X-Pass-Token': stored.token },
    });

    if (!error && data && data.valid === false) {
      const switched = data.reason === 'device_switched';
      const previousPhone = stored.phone || getRememberedPhone();
      clearStoredPass();
      if (switched && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tubetv:device-switched', {
            detail: { phone: previousPhone, tier: stored.tier },
          }),
        );
      }
      return null;
    }

    if (!error && data?.valid && data.pass) {
      const updated: StoredPass = {
        token: stored.token,
        tier: data.pass.tier || stored.tier,
        expiresAt: Number(data.pass.expiresAt) || stored.expiresAt,
        mpesaReceipt: data.pass.mpesaReceipt || stored.mpesaReceipt,
        phone: stored.phone,
        deviceId: data.pass.deviceId || stored.deviceId || deviceId,
      };
      try {
        localStorage.setItem(SIGNED_PASS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage error
      }
      if (data.viewerState) {
        mergeRemotePassViewerState(data.viewerState);
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

async function unwrapFunctionPayload(data: any, error: any): Promise<any> {
  if (data && typeof data === 'object') return data;
  if (error && typeof error === 'object' && 'context' in error && error.context) {
    try {
      const ctx = error.context as Response;
      if (typeof ctx.clone === 'function') {
        const parsed = await ctx.clone().json();
        if (parsed && typeof parsed === 'object') return parsed;
      } else if (typeof ctx.json === 'function') {
        const parsed = await ctx.json();
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore JSON parse errors on error context
    }
  }
  return data;
}

function cleanFunctionErrorMessage(error: any, payload: any, fallback: string): string {
  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  if (payload && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }
  const rawMsg = typeof error?.message === 'string' ? error.message.trim() : '';
  if (rawMsg && !rawMsg.includes('non-2xx status code')) {
    return rawMsg;
  }
  return fallback;
}

export async function startPaystackPayment(
  planCode: SubscriptionPlanCode,
  options: { email?: string; phone?: string; regionCode?: RegionCode; currency?: string } = {},
): Promise<PaystackInitiateResponse> {
  if (!isSupabaseConfigured) {
    throw new Error('Paystack payments are not configured in this environment.');
  }
  const idempotencyKey = crypto.randomUUID();
  const { data: rawData, error } = await supabase.functions.invoke('paystack-checkout', {
    body: {
      action: 'initiate',
      planCode,
      email: options.email,
      phone: options.phone,
      regionCode: options.regionCode || detectDefaultRegion(),
      currency: options.currency || 'KES',
    },
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  const data = await unwrapFunctionPayload(rawData, error);

  if (error && !data?.transaction) {
    throw new Error(cleanFunctionErrorMessage(error, data, 'Could not initiate Paystack checkout.'));
  }
  if (data?.error) throw new Error(data.error);

  return data.transaction as PaystackInitiateResponse;
}

export async function fetchPaystackStatus(reference: string, checkoutToken: string, transactionId?: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Payment status verification is unavailable.');
  }
  const deviceId = getOrCreateDeviceId();
  const { data: rawData, error } = await supabase.functions.invoke('paystack-checkout', {
    body: { action: 'status', reference, checkoutToken, transactionId, deviceId },
  });
  const data = await unwrapFunctionPayload(rawData, error);

  if (error && !data?.transaction) {
    throw new Error(cleanFunctionErrorMessage(error, data, 'Unable to verify payment status.'));
  }
  if (data?.error) throw new Error(data.error);

  if (data?.pass?.token) {
    saveStoredPass({
      token: data.pass.token,
      tier: data.pass.tier,
      expiresAt: Number(data.pass.expiresAt),
      mpesaReceipt: data.pass.reference,
      deviceId: data.pass.deviceId || deviceId,
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
  const deviceId = getOrCreateDeviceId();
  const { data: rawData, error } = await supabase.functions.invoke('paystack-checkout', {
    body: {
      action: 'restore',
      reference: reference.trim().toUpperCase(),
      emailOrPhone: emailOrPhone?.trim(),
      deviceId,
      forceSwitch: true,
    },
  });
  const data = await unwrapFunctionPayload(rawData, error);

  if ((error && !data?.pass?.token) || data?.error || !data?.pass?.token) {
    throw new Error(cleanFunctionErrorMessage(error, data, 'No active pass matched that reference.'));
  }

  const stored: StoredPass = {
    token: data.pass.token,
    tier: data.pass.tier,
    expiresAt: Number(data.pass.expiresAt),
    mpesaReceipt: data.pass.reference,
    deviceId: data.pass.deviceId || deviceId,
  };
  saveStoredPass(stored);
  return stored;
}

export async function startMpesaPayment(
  planCode: SubscriptionPlanCode,
  phone: string,
  options?: { autoRenew?: boolean },
) {
  if (!isSupabaseConfigured) {
    throw new Error('M-Pesa payments are not configured in this environment.');
  }
  const idempotencyKey = crypto.randomUUID();

  // If autoRenew is requested for the monthly pass, invoke mpesa-ratiba (Standing Order)
  if (options?.autoRenew && planCode === 'monthly') {
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-ratiba', {
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
          isRatiba?: boolean;
        };
      }
      if (data?.error) {
        console.warn('mpesa_ratiba_returned_error_falling_back', data.error);
      }
    } catch (err) {
      console.warn('mpesa_ratiba_invoke_fallback', err);
    }
  }

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

  const deviceId = getOrCreateDeviceId();
  let data: any;
  let error: any;

  try {
    const res = await supabase.functions.invoke('mpesa-stk-push', {
      body: { action: 'status', transactionId, checkoutToken, deviceId },
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
        body: { action: 'status', transactionId, checkoutToken, deviceId },
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
      deviceId: data.pass.deviceId || deviceId,
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

export async function getRatibaMandateStatus(phone: string) {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.functions.invoke('mpesa-ratiba', {
      body: { action: 'status', phone },
    });
    if (!error && data?.mandate) {
      return data.mandate;
    }
  } catch (e) {
    console.warn('get_ratiba_status_error', e);
  }
  return null;
}

export async function cancelRatibaMandate(phone: string) {
  if (!isSupabaseConfigured) return false;
  try {
    const { data, error } = await supabase.functions.invoke('mpesa-ratiba', {
      body: { action: 'cancel', phone },
    });
    return Boolean(!error && data?.ok);
  } catch (e) {
    console.warn('cancel_ratiba_error', e);
    return false;
  }
}

export interface RestorePassOptions {
  phone: string;
  forceSwitch?: boolean;
  mpesaReceipt?: string;
  reference?: string;
}

export interface RestorePassResult {
  success: boolean;
  pass?: StoredPass;
  conflict?: boolean;
  expired?: boolean;
  expiredAt?: number;
  phone?: string;
  message?: string;
  tier?: string;
  switched?: boolean;
}

export async function restorePassByPhone(options: RestorePassOptions): Promise<RestorePassResult> {
  if (!isSupabaseConfigured) {
    throw new Error('Pass restoration requires a live payment connection.');
  }

  const cleanPhone = options.phone.trim();
  const deviceId = getOrCreateDeviceId();

  try {
    const { data: rawData, error } = await supabase.functions.invoke('mpesa-stk-push', {
      body: {
        action: 'restore',
        phone: cleanPhone,
        deviceId,
        forceSwitch: Boolean(options.forceSwitch),
        mpesaReceipt: options.mpesaReceipt?.trim() || options.reference?.trim() || '',
      },
    });
    const data = await unwrapFunctionPayload(rawData, error);

    if (data?.conflict) {
      return {
        success: false,
        conflict: true,
        message:
          data.message ||
          'Your pass is currently active on another device. Would you like to log out the other device and watch here?',
        tier: data.tier,
      };
    }

    if (data?.expired) {
      return {
        success: false,
        expired: true,
        tier: data.tier,
        expiredAt: data.expiredAt ? Number(data.expiredAt) : undefined,
        phone: data.phone || cleanPhone,
        message: data.message || 'Your TubeTV pass for this number has expired. Renew your pass to extend watching.',
      };
    }

    if ((error && !data?.pass?.token) || data?.error) {
      if (options.reference?.startsWith('TUBE_')) {
        const paystackPass = await restorePaystackPass(options.reference, cleanPhone);
        return { success: true, pass: paystackPass };
      }
      return {
        success: false,
        message: cleanFunctionErrorMessage(
          error,
          data,
          'No active pass found for this phone number. Choose a pass below to start watching.',
        ),
      };
    }

    if (data?.pass?.token) {
      const stored: StoredPass = {
        token: data.pass.token,
        tier: data.pass.tier,
        expiresAt: Number(data.pass.expiresAt),
        mpesaReceipt: data.pass.mpesaReceipt,
        phone: cleanPhone,
        deviceId,
      };
      saveStoredPass(stored);
      if (data.viewerState) {
        mergeRemotePassViewerState(data.viewerState);
      }
      return {
        success: true,
        pass: stored,
        switched: Boolean(data.switched),
      };
    }

    return {
      success: false,
      message: 'Unable to restore pass with those details.',
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unable to restore pass.',
    };
  }
}

export async function restoreMpesaPass(mpesaReceipt: string, phone: string): Promise<StoredPass> {
  if (!isSupabaseConfigured) {
    throw new Error('Pass restoration requires a live payment connection.');
  }
  const result = await restorePassByPhone({ phone, mpesaReceipt, forceSwitch: true });
  if (result.success && result.pass) {
    return result.pass;
  }
  throw new Error(result.message || 'Could not restore pass with those details.');
}

export async function resolveAuthorizedPlaybackUrl(
  videoId: string,
  fallbackUrl?: string,
  requiresEntitlement = false,
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

  const storedPass = getStoredPass();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${session?.access_token || ANON_KEY}`,
    };
    if (storedPass?.token) {
      headers['X-Pass-Token'] = storedPass.token;
    }

    const deviceId = getOrCreateDeviceId();
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/playback-access?id=${encodeURIComponent(videoId)}&deviceId=${encodeURIComponent(deviceId)}`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(5000) },
    );

    if (res.status === 402 || res.status === 403) {
      if (storedPass) {
        const previousPhone = storedPass.phone || getRememberedPhone();
        clearStoredPass();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('tubetv:device-switched', {
              detail: { phone: previousPhone, tier: storedPass.tier },
            }),
          );
        }
      }
      return { locked: true, url: '' };
    }

    if (res.ok) {
      const payload = await res.json();
      if (payload?.locked) return { locked: true, url: '' };
      if (typeof payload?.playbackUrl === 'string' && payload.playbackUrl) {
        return { locked: false, url: payload.playbackUrl };
      }
    }

    // Security hardening: if the episode requires a pass and the user has no verified pass, never fall back to an unsigned URL
    if (requiresEntitlement && !storedPass && !session?.access_token) {
      return { locked: true, url: '' };
    }

    return { locked: false, url: safeFallback };
  } catch {
    if (requiresEntitlement && !storedPass) {
      return { locked: true, url: '' };
    }
    return { locked: false, url: safeFallback };
  }
}
