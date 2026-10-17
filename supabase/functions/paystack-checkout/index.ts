import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((o) => o.trim()).filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders(req) });
  }

  // 1. Verify authenticated user
  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders(req) });
  }

  try {
    const body = await req.json();
    const { packageId, amount, currency = 'KES', paymentMethod = 'mpesa', phone } = body;

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: corsHeaders(req) });
    }

    // Packages Definition
    const PACKAGES: Record<string, { coins: number; bonus: number; type: string; plan?: string }> = {
      'coins-daily-10': { coins: 10, bonus: 0, type: 'coins' },
      'coins-100': { coins: 100, bonus: 0, type: 'coins' },
      'coins-300': { coins: 300, bonus: 50, type: 'coins' },
      'coins-600': { coins: 600, bonus: 150, type: 'coins' },
      'pass-daily': { coins: 0, bonus: 0, type: 'pass', plan: 'daily' },
      'pass-monthly': { coins: 0, bonus: 0, type: 'pass', plan: 'monthly' },
    };

    const pkg = PACKAGES[packageId] || { coins: Math.floor(amount), bonus: 0, type: 'coins' };

    // Format phone to 254XXXXXXXXX for Kenyan M-Pesa
    let formattedPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) formattedPhone = '254' + formattedPhone;

    // Convert amount to minor currency unit (cents/kobo) required by Paystack
    const amountInSubunits = Math.round(amount * 100);

    const email = user.email || `${user.id.slice(0, 8)}@tube.co.ke`;

    // 2. Initialize transaction with Paystack
    const paystackPayload: Record<string, any> = {
      email,
      amount: amountInSubunits,
      currency: currency.toUpperCase(),
      callback_url: `${req.headers.get('Origin') || 'https://www.tube.co.ke'}/?payment=success`,
      metadata: {
        user_id: user.id,
        package_id: packageId,
        package_type: pkg.type,
        plan_code: pkg.plan || null,
        coins: pkg.coins,
        bonus_coins: pkg.bonus,
        phone: formattedPhone || user.phone || null,
        custom_fields: [
          { display_name: 'Platform', variable_name: 'platform', value: 'TubeTV Microdramas' },
          { display_name: 'User ID', variable_name: 'user_id', value: user.id },
        ],
      },
    };

    if (paymentMethod === 'mpesa') {
      paystackPayload.channels = ['mobile_money'];
      if (formattedPhone) {
        paystackPayload.mobile_money = {
          phone: formattedPhone,
          provider: 'mpesa',
        };
      }
    } else {
      paystackPayload.channels = ['card', 'apple_pay'];
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const result = await paystackRes.json();
    if (!result.status) {
      console.error('Paystack initialization error:', result);
      return new Response(JSON.stringify({ error: result.message || 'Payment initialization failed' }), {
        status: 400,
        headers: corsHeaders(req),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        authorizationUrl: result.data.authorization_url,
        accessCode: result.data.access_code,
        reference: result.data.reference,
      }),
      { status: 200, headers: corsHeaders(req) }
    );
  } catch (err: any) {
    console.error('Paystack checkout error:', err);
    return new Response(JSON.stringify({ error: 'Internal checkout error' }), {
      status: 500,
      headers: corsHeaders(req),
    });
  }
});
