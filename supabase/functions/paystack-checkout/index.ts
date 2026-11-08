import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { isVerifiedPaymentIdentity } from '../_shared/episodeAccess.ts';

const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
const mode = Deno.env.get('PAYSTACK_MODE');
const callback = new URL('/?payment=return', Deno.env.get('PAYSTACK_SITE_URL') || 'https://www.tube.co.ke');
const allowedOrigins = new Set([
  callback.origin,
  ...(Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((origin) => origin.trim()),
]);

// Prices are in minor units. The browser selects a package and payment method.
const packages = new Map<string, {
  kes: number; usd?: number; coins: number; bonus: number; pass?: string;
}>([
  ['coins-10', { kes: 1000, coins: 10, bonus: 0 }],
  ['coins-50', { kes: 5000, usd: 99, coins: 50, bonus: 5 }],
  ['coins-100', { kes: 10000, usd: 149, coins: 100, bonus: 15 }],
  ['coins-300', { kes: 30000, usd: 299, coins: 300, bonus: 50 }],
  ['pass-daily', { kes: 2000, usd: 49, coins: 0, bonus: 0, pass: 'daily' }],
  ['pass-weekly', { kes: 10000, usd: 149, coins: 0, bonus: 0, pass: 'weekly' }],
  ['pass-monthly', { kes: 30000, usd: 349, coins: 0, bonus: 0, pass: 'monthly' }],
]);

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { headers, status });

  if (origin && !allowedOrigins.has(origin)) return respond({ error: 'Origin not allowed' }, 403);
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  if ((mode !== 'live' && mode !== 'test') || !secret?.startsWith(`sk_${mode}_`) ||
      Deno.env.get('PAYSTACK_CHECKOUT_ENABLED') !== 'true') {
    return respond({ error: 'Checkout is temporarily unavailable' }, 503);
  }

  const token = req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return respond({ error: 'Sign in to purchase' }, 401);

  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user || !isVerifiedPaymentIdentity(user)) {
      return respond({ error: 'Sign in with a verified phone number or email to purchase.' }, 401);
    }

    const body = await req.json().catch(() => null);
    const sku = packages.get(body?.packageId);
    const method = body?.paymentMethod;
    const amount = method === 'mpesa' ? sku?.kes : method === 'card' ? sku?.usd : undefined;
    if (!sku || !amount) return respond({ error: 'Invalid package or payment method' }, 400);

    const currency = method === 'mpesa' ? 'KES' : 'USD';
    const reference = `tube-order-${crypto.randomUUID()}`;
    const returnUrl = new URL(callback);
    if (typeof body?.videoId === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.videoId)) {
      returnUrl.pathname = `/watch/${body.videoId}`;
    }
    const { error } = await db.from('paystack_orders').insert({
      reference, user_id: user.id, package_id: body.packageId, amount_minor: amount,
      currency, coins: sku.coins, bonus_coins: sku.bonus, pass_tier: sku.pass ?? null,
    });
    if (error) throw error;

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        reference, amount, currency,
        email: user.email || `${user.id}@tube.co.ke`,
        callback_url: returnUrl.toString(),
        channels: method === 'mpesa' ? ['mobile_money'] : ['card', 'apple_pay'],
      }),
    });
    const result = await response.json();
    if (!response.ok || result.status !== true || result.data?.reference !== reference) {
      console.error('Paystack initialize failed', reference, response.status);
      return respond({ error: 'Unable to start payment. Please try again.' }, 502);
    }

    const url = new URL(result.data.authorization_url);
    if (url.origin !== 'https://checkout.paystack.com') throw new Error('Invalid checkout URL');
    return respond({ authorizationUrl: url.href, reference });
  } catch (error) {
    console.error('Paystack checkout failed', error);
    return respond({ error: 'Checkout is temporarily unavailable' }, 503);
  }
});
