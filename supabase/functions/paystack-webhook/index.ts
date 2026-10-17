import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') || '';

function hexToUint8Array(hexString: string): Uint8Array {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function verifyPaystackSignature(signature: string, payload: string): Promise<boolean> {
  if (!signature || !PAYSTACK_SECRET) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(PAYSTACK_SECRET),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['verify']
    );
    return await crypto.subtle.verify('HMAC', key, hexToUint8Array(signature), encoder.encode(payload));
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('x-paystack-signature') || '';
  const rawBody = await req.text();

  const isValid = await verifyPaystackSignature(signature, rawBody);
  if (!isValid) {
    console.error('Invalid Paystack webhook signature');
    return new Response('Invalid signature', { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Handle successful charges
  if (event.event === 'charge.success') {
    const data = event.data;
    const metadata = data.metadata || {};
    const userId = metadata.user_id;
    const reference = data.reference;

    if (!userId) {
      console.warn('Webhook received without user_id in metadata');
      return new Response('Awaiting user_id', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const packageType = metadata.package_type || 'coins';

    try {
      // 1. If Coins: Credit to User Wallet
      if (packageType === 'coins') {
        const coins = Number(metadata.coins) || 0;
        const bonus = Number(metadata.bonus_coins) || 0;

        const { error: creditError } = await supabase.rpc('credit_user_coins', {
          p_user_id: userId,
          p_regular_coins: coins,
          p_bonus_coins: bonus,
          p_reference_id: reference,
        });

        if (creditError) {
          console.error('Error crediting coins:', creditError);
        }
      }

      // 2. If Pass / VIP Subscription: Activate Subscription
      if (packageType === 'pass') {
        const plan = metadata.plan_code || 'daily';
        const hours = plan === 'monthly' ? 24 * 30 : 24;
        const endDate = new Date(Date.now() + hours * 3600 * 1000).toISOString();

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          tier: plan,
          is_active: true,
          end_date: endDate,
          updated_at: new Date().toISOString(),
        });
      }

      // 3. Record Audit Payment Transaction
      const amountKes = Math.round(Number(data.amount || 0) / 100);
      const mpesaReceipt = data.authorization?.channel === 'mobile_money' ? reference : null;

      await supabase.from('payment_transactions').upsert(
        {
          user_id: userId,
          phone_e164: metadata.phone || data.customer?.phone || '',
          plan_code: metadata.plan_code || 'coins',
          amount_kes: amountKes,
          idempotency_key: reference,
          checkout_request_id: reference,
          mpesa_receipt: mpesaReceipt,
          status: 'succeeded',
          result_code: 0,
          result_description: 'Payment verified via Paystack webhook',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'checkout_request_id' }
      );

      console.log(`Payment confirmed for user ${userId}: Ref ${reference}`);
    } catch (err) {
      console.error('Error processing charge.success webhook:', err);
    }
  }

  return new Response('Webhook received', { status: 200 });
});
