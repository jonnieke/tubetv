import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
const encoder = new TextEncoder();

async function verifySignature(signature: string, body: Uint8Array, keyText: string) {
  if (!/^[0-9a-f]{128}$/i.test(signature)) return false;
  const bytes = Uint8Array.from(signature.match(/../g)!, (pair) => parseInt(pair, 16));
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(keyText), { name: 'HMAC', hash: 'SHA-512' }, false, ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, bytes, body);
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!secret) return new Response('Unavailable', { status: 503 });

  try {
    const raw = new Uint8Array(await req.arrayBuffer());
    if (!await verifySignature(req.headers.get('x-paystack-signature') || '', raw, secret)) {
      return new Response('Invalid signature', { status: 401 });
    }
    const event = JSON.parse(new TextDecoder().decode(raw));
    if (event?.event !== 'charge.success') return new Response('Ignored');

    const reference = event.data?.reference;
    if (typeof reference !== 'string' || !/^tube-order-[a-f0-9-]{36}$/.test(reference)) {
      // Legacy checkouts lack a server-owned order. Reconcile them separately.
      console.warn('Paystack charge has no managed order', reference);
      return new Response('Unmanaged charge');
    }

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: lookupError } = await db.from('paystack_orders')
      .select('amount_minor, currency, fulfilled_at').eq('reference', reference).maybeSingle();
    if (lookupError) throw lookupError;
    if (!order) throw new Error(`Missing order ${reference}`);
    if (order.fulfilled_at) return new Response('Already fulfilled');

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10000),
    });
    const verified = await response.json();
    const payment = verified.data;
    if (!response.ok || verified.status !== true || payment?.status !== 'success') {
      throw new Error(`Paystack verification unavailable for ${reference}`);
    }
    if (payment.reference !== reference || payment.amount !== order.amount_minor ||
        payment.currency !== order.currency) {
      console.error('Paystack payment does not match order', reference);
      return new Response('Payment does not match order', { status: 422 });
    }

    const { data, error } = await db.rpc('fulfill_paystack_order', {
      p_reference: reference, p_amount_minor: payment.amount, p_currency: payment.currency,
    });
    if (error || data !== true) throw error || new Error(`Fulfillment rejected for ${reference}`);
    return new Response('Fulfilled');
  } catch (error) {
    console.error('Paystack webhook processing failed', error);
    return new Response('Unable to process payment', { status: 503 });
  }
});