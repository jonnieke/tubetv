import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { verifyPaystackWebhook } from '../_shared/paystackSignature.ts';

const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
const mode = Deno.env.get('PAYSTACK_MODE');
const signingSecret = Deno.env.get('PAYSTACK_WEBHOOK_SIGNING_SECRET');

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!secret) return new Response('Unavailable', { status: 503 });

  try {
    const raw = new Uint8Array(await req.arrayBuffer());
    if (!await verifyPaystackWebhook(req.headers, raw, secret, signingSecret)) {
      return new Response('Invalid signature', { status: 401 });
    }
    const event = JSON.parse(new TextDecoder().decode(raw));
    if (event?.event !== 'charge.success') return new Response('Ignored');

    const reference = event.data?.reference;
    if (typeof reference !== 'string' || !/^[a-z0-9.=\-]{1,150}$/i.test(reference)) {
      return new Response('Invalid reference', { status: 400 });
    }

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (!/^tube-order-[a-f0-9-]{36}$/.test(reference)) {
      const { error } = await db.from('paystack_legacy_receipts').upsert(
        { reference }, { onConflict: 'reference', ignoreDuplicates: true },
      );
      if (error) throw error;
      return new Response('Recorded for reconciliation');
    }
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
    if ((mode !== 'live' && mode !== 'test') || payment.domain !== mode ||
        payment.reference !== reference || payment.amount !== order.amount_minor ||
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
