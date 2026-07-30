import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PLANS = {
  daily: { amount: 10, label: "TubeTV Daily" },
  weekly: { amount: 50, label: "TubeTV Weekly" },
  monthly: { amount: 249, label: "TubeTV Monthly" },
} as const;

function responseHeaders(req: Request) {
  const origins = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim());
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = origins.includes(origin) ? origin : origins[0] || "";
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, idempotency-key, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const idempotencyKey = req.headers.get("Idempotency-Key") || "";

  if (!token || !idempotencyKey || idempotencyKey.length > 100) {
    return json(req, { error: "Authentication and an idempotency key are required." }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData.user;
  if (authError || !user?.phone || !user.phone_confirmed_at) {
    return json(req, { error: "A verified phone account is required." }, 403);
  }

  const requestBody = await req.json().catch(() => ({}));
  const planCode = String(requestBody.planCode || "") as keyof typeof PLANS;
  const plan = PLANS[planCode];
  if (!plan) return json(req, { error: "Unknown subscription plan." }, 400);

  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
  const shortcode = Deno.env.get("MPESA_SHORTCODE");
  const passkey = Deno.env.get("MPESA_PASSKEY");
  const callbackBaseUrl = Deno.env.get("MPESA_CALLBACK_URL");
  const callbackSecret = Deno.env.get("MPESA_CALLBACK_SECRET");
  const environment = Deno.env.get("MPESA_ENV") === "production" ? "production" : "sandbox";
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackBaseUrl || !callbackSecret) {
    return json(req, { error: "M-Pesa is not configured." }, 503);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existing } = await service
    .from("payment_transactions")
    .select("id, status, checkout_request_id, result_description")
    .eq("user_id", user.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) return json(req, { transaction: existing, reused: true });

  const { data: transaction, error: insertError } = await service
    .from("payment_transactions")
    .insert({
      user_id: user.id,
      phone_e164: user.phone,
      plan_code: planCode,
      amount_kes: plan.amount,
      idempotency_key: idempotencyKey,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError) return json(req, { error: "Unable to create payment request." }, 409);

  const host = environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const basicAuth = btoa(`${consumerKey}:${consumerSecret}`);
  const tokenResponse = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!tokenResponse.ok) {
    await service.from("payment_transactions").update({ status: "failed", result_description: "M-Pesa authentication failed." }).eq("id", transaction.id);
    return json(req, { error: "M-Pesa is temporarily unavailable." }, 502);
  }
  const accessToken = (await tokenResponse.json()).access_token;
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const password = btoa(`${shortcode}${passkey}${timestamp}`);
  const phoneDigits = user.phone.replace(/\D/g, "");
  const callbackUrl = new URL(callbackBaseUrl);
  callbackUrl.searchParams.set("secret", callbackSecret);

  const stkResponse = await fetch(`${host}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: plan.amount,
      PartyA: phoneDigits,
      PartyB: shortcode,
      PhoneNumber: phoneDigits,
      CallBackURL: callbackUrl.toString(),
      AccountReference: plan.label,
      TransactionDesc: `${plan.label} subscription`,
    }),
  });

  const stkData = await stkResponse.json().catch(() => ({}));
  const accepted = stkResponse.ok && stkData.ResponseCode === "0" && stkData.CheckoutRequestID;
  await service.from("payment_transactions").update({
    status: accepted ? "submitted" : "failed",
    merchant_request_id: stkData.MerchantRequestID || null,
    checkout_request_id: stkData.CheckoutRequestID || null,
    result_description: stkData.CustomerMessage || stkData.errorMessage || "M-Pesa request rejected.",
  }).eq("id", transaction.id);

  if (!accepted) return json(req, { error: "M-Pesa did not accept the payment request." }, 502);
  return json(req, {
    transaction: {
      id: transaction.id,
      status: "submitted",
      checkoutRequestId: stkData.CheckoutRequestID,
      message: stkData.CustomerMessage,
    },
  });
});
