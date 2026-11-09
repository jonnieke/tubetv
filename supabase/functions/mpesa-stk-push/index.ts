import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { issuePassToken, sha256Hex, verifyPassToken } from "../_shared/passToken.ts";

const PLANS = {
  daily: { amount: 10, label: "TubeTV Daily", hours: 24 },
  weekly: { amount: 50, label: "TubeTV Weekly", hours: 168 },
  monthly: { amount: 249, label: "TubeTV Monthly", hours: 720 },
} as const;

const METHODS = "POST, OPTIONS";

const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function checkIpRateLimit(ip: string, maxPerMinute: number): boolean {
  const now = Date.now();
  if (ipAttempts.size > 5000) {
    for (const [key, entry] of ipAttempts.entries()) {
      if (now > entry.resetAt) ipAttempts.delete(key);
    }
  }
  const current = ipAttempts.get(ip);
  if (!current || now > current.resetAt) {
    ipAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= maxPerMinute;
}

function normalizeKenyanPhone(raw: unknown): { digits: string; e164: string; sub9: string } | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[\s()-]/g, "").replace(/^\+/, "");
  let sub9 = "";
  if (/^254([17]\d{8})$/.test(cleaned)) {
    sub9 = cleaned.slice(3);
  } else if (/^0([17]\d{8})$/.test(cleaned)) {
    sub9 = cleaned.slice(1);
  } else if (/^([17]\d{8})$/.test(cleaned)) {
    sub9 = cleaned;
  } else {
    return null;
  }
  return {
    digits: `254${sub9}`,
    e164: `+254${sub9}`,
    sub9,
  };
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) });
  }
  if (req.method !== "POST") {
    return jsonReply(req, { error: "Method not allowed." }, 405, METHODS);
  }
  if (!isOriginAllowed(req)) {
    return jsonReply(req, { error: "Origin not allowed." }, 403, METHODS);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return jsonReply(req, { error: "Payment service is not configured." }, 503, METHODS);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const requestBody = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(requestBody.action || "initiate");
  const clientIp = getClientIp(req);

  // ─── Action: Verify an existing signed pass token ───────────────────────────
  if (action === "verify") {
    const token = String(req.headers.get("X-Pass-Token") || requestBody.passToken || "").trim();
    const verified = await verifyPassToken(token);
    if (!verified) {
      return jsonReply(req, { valid: false }, 200, METHODS, { "Cache-Control": "no-store" });
    }
    const { data: sub } = await service
      .from("subscriptions")
      .select("id, tier, end_date, is_active, mpesa_ref")
      .eq("id", verified.subId)
      .maybeSingle();

    const expiresAt = sub?.end_date ? Date.parse(sub.end_date) : verified.exp;
    if (!sub || !sub.is_active || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return jsonReply(req, { valid: false }, 200, METHODS, { "Cache-Control": "no-store" });
    }

    return jsonReply(
      req,
      {
        valid: true,
        pass: {
          tier: sub.tier,
          expiresAt,
          mpesaReceipt: sub.mpesa_ref,
        },
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  // ─── Action: Poll payment status using checkoutToken ────────────────────────
  if (action === "status") {
    const transactionId = String(requestBody.transactionId || "").trim();
    const checkoutToken = String(requestBody.checkoutToken || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(transactionId) || checkoutToken.length < 16) {
      return jsonReply(req, { error: "Valid transaction credentials are required." }, 400, METHODS);
    }

    const tokenHash = await sha256Hex(checkoutToken);
    const { data: tx } = await service
      .from("payment_transactions")
      .select("id, status, plan_code, mpesa_receipt, result_description, checkout_token_hash")
      .eq("id", transactionId)
      .maybeSingle();

    if (!tx || tx.checkout_token_hash !== tokenHash) {
      return jsonReply(req, { error: "Transaction not found." }, 404, METHODS);
    }

    if (tx.status === "succeeded" && tx.mpesa_receipt) {
      const { data: sub } = await service
        .from("subscriptions")
        .select("id, tier, end_date, is_active, mpesa_ref")
        .ilike("mpesa_ref", tx.mpesa_receipt)
        .maybeSingle();

      if (sub && sub.is_active && sub.end_date && Date.parse(sub.end_date) > Date.now()) {
        const expiresAt = Date.parse(sub.end_date);
        const passToken = await issuePassToken({
          subId: sub.id,
          tier: sub.tier,
          exp: expiresAt,
          ref: sub.mpesa_ref || tx.mpesa_receipt,
        });
        return jsonReply(
          req,
          {
            transaction: {
              id: tx.id,
              status: "succeeded",
              result_description: tx.result_description,
              mpesa_receipt: tx.mpesa_receipt,
            },
            pass: {
              token: passToken,
              tier: sub.tier,
              expiresAt,
              mpesaReceipt: sub.mpesa_ref || tx.mpesa_receipt,
            },
          },
          200,
          METHODS,
          { "Cache-Control": "no-store" },
        );
      }
    }

    return jsonReply(
      req,
      {
        transaction: {
          id: tx.id,
          status: tx.status,
          result_description: tx.result_description,
        },
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  // ─── Action: Cross-device M-Pesa receipt recovery ──────────────────────────
  if (action === "restore") {
    if (!checkIpRateLimit(`restore:${clientIp}`, 8)) {
      return jsonReply(req, { error: "Too many restore attempts. Please wait a minute and try again." }, 429, METHODS);
    }

    const receipt = String(requestBody.mpesaReceipt || "").trim().toUpperCase();
    const parsedPhone = normalizeKenyanPhone(requestBody.phone);
    if (!/^[A-Z0-9]{8,16}$/.test(receipt) || !parsedPhone) {
      return jsonReply(req, { error: "Enter a valid M-Pesa receipt code and Safaricom phone number." }, 400, METHODS);
    }

    const { data: sub } = await service
      .from("subscriptions")
      .select("id, phone, tier, end_date, is_active, mpesa_ref")
      .ilike("mpesa_ref", receipt)
      .maybeSingle();

    const storedSub9 = String(sub?.phone || "").replace(/\D/g, "").slice(-9);
    if (!sub || storedSub9 !== parsedPhone.sub9) {
      return jsonReply(req, { error: "No pass matched that M-Pesa receipt and phone number." }, 404, METHODS);
    }

    const expiresAt = sub.end_date ? Date.parse(sub.end_date) : 0;
    if (!sub.is_active || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return jsonReply(req, { error: "That M-Pesa pass has expired. Choose a new pass to continue watching." }, 410, METHODS);
    }

    const passToken = await issuePassToken({
      subId: sub.id,
      tier: sub.tier,
      exp: expiresAt,
      ref: sub.mpesa_ref || receipt,
    });

    return jsonReply(
      req,
      {
        pass: {
          token: passToken,
          tier: sub.tier,
          expiresAt,
          mpesaReceipt: sub.mpesa_ref || receipt,
        },
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  // ─── Action: Initiate frictionless M-Pesa STK Push ──────────────────────────
  if (action !== "initiate") {
    return jsonReply(req, { error: "Unknown payment action." }, 400, METHODS);
  }

  if (!checkIpRateLimit(`stk:${clientIp}`, 6)) {
    return jsonReply(req, { error: "Too many payment requests. Please wait a moment and try again." }, 429, METHODS);
  }

  const idempotencyKey = (req.headers.get("Idempotency-Key") || "").trim();
  if (!idempotencyKey || idempotencyKey.length > 100) {
    return jsonReply(req, { error: "A valid Idempotency-Key header is required." }, 400, METHODS);
  }

  const planCode = String(requestBody.planCode || "") as keyof typeof PLANS;
  const plan = PLANS[planCode];
  if (!plan) {
    return jsonReply(req, { error: "Unknown subscription plan." }, 400, METHODS);
  }

  // Optionally associate authenticated Supabase user if a valid session JWT is sent
  let authenticatedUserId: string | null = null;
  let authenticatedPhone: string | null = null;
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ") && anonKey) {
    const jwt = authHeader.slice(7).trim();
    if (jwt && jwt !== anonKey) {
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData } = await authClient.auth.getUser(jwt);
      if (authData?.user) {
        authenticatedUserId = authData.user.id;
        authenticatedPhone = authData.user.phone || null;
      }
    }
  }

  const parsedPhone = normalizeKenyanPhone(requestBody.phone || authenticatedPhone);
  if (!parsedPhone) {
    return jsonReply(
      req,
      { error: "Enter a valid Kenyan Safaricom M-Pesa phone number (e.g. 0712 345 678)." },
      400,
      METHODS,
    );
  }

  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
  const shortcode = Deno.env.get("MPESA_SHORTCODE");
  const passkey = Deno.env.get("MPESA_PASSKEY");
  const callbackBaseUrl = Deno.env.get("MPESA_CALLBACK_URL");
  const callbackSecret = Deno.env.get("MPESA_CALLBACK_SECRET");
  const environment = Deno.env.get("MPESA_ENV") === "production" ? "production" : "sandbox";
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackBaseUrl || !callbackSecret) {
    return jsonReply(req, { error: "M-Pesa payments are temporarily unavailable." }, 503, METHODS);
  }

  const { data: existing } = await service
    .from("payment_transactions")
    .select("id, status, checkout_request_id, result_description")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    return jsonReply(req, { transaction: existing, reused: true }, 200, METHODS);
  }

  // Prevent STK push spam to the same phone number within 45 seconds
  const recentCutoff = new Date(Date.now() - 45_000).toISOString();
  const { data: recentPending } = await service
    .from("payment_transactions")
    .select("id, status")
    .eq("phone_e164", parsedPhone.e164)
    .in("status", ["pending", "submitted"])
    .gte("created_at", recentCutoff)
    .limit(1)
    .maybeSingle();

  if (recentPending) {
    return jsonReply(
      req,
      { error: "An M-Pesa prompt was just sent to this phone. Check your handset or wait 45 seconds before retrying." },
      429,
      METHODS,
    );
  }

  const checkoutToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const checkoutTokenHash = await sha256Hex(checkoutToken);

  const { data: transaction, error: insertError } = await service
    .from("payment_transactions")
    .insert({
      user_id: authenticatedUserId,
      phone_e164: parsedPhone.e164,
      plan_code: planCode,
      amount_kes: plan.amount,
      idempotency_key: idempotencyKey,
      checkout_token_hash: checkoutTokenHash,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !transaction) {
    return jsonReply(req, { error: "Unable to create payment request." }, 409, METHODS);
  }

  const host = environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const basicAuth = btoa(`${consumerKey}:${consumerSecret}`);

  try {
    const tokenResponse = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${basicAuth}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenResponse.ok) {
      await service
        .from("payment_transactions")
        .update({ status: "failed", result_description: "M-Pesa authentication failed." })
        .eq("id", transaction.id);
      return jsonReply(req, { error: "M-Pesa is temporarily unavailable. Please try again." }, 502, METHODS);
    }

    const accessToken = (await tokenResponse.json()).access_token;
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
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
        PartyA: parsedPhone.digits,
        PartyB: shortcode,
        PhoneNumber: parsedPhone.digits,
        CallBackURL: callbackUrl.toString(),
        AccountReference: plan.label,
        TransactionDesc: `${plan.label} pass`,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const stkData = await stkResponse.json().catch(() => ({}));
    const accepted = stkResponse.ok && stkData.ResponseCode === "0" && Boolean(stkData.CheckoutRequestID);

    await service
      .from("payment_transactions")
      .update({
        status: accepted ? "submitted" : "failed",
        merchant_request_id: stkData.MerchantRequestID || null,
        checkout_request_id: stkData.CheckoutRequestID || null,
        result_description:
          stkData.CustomerMessage || stkData.errorMessage || (accepted ? "Prompt sent." : "M-Pesa request rejected."),
      })
      .eq("id", transaction.id);

    if (!accepted) {
      return jsonReply(
        req,
        { error: stkData.CustomerMessage || "M-Pesa did not accept the payment request." },
        502,
        METHODS,
      );
    }

    return jsonReply(
      req,
      {
        transaction: {
          id: transaction.id,
          status: "submitted",
          checkoutToken,
          checkoutRequestId: stkData.CheckoutRequestID,
          message: stkData.CustomerMessage,
        },
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  } catch (error) {
    console.error("mpesa_stk_push_error", error);
    await service
      .from("payment_transactions")
      .update({ status: "failed", result_description: "Upstream M-Pesa network timeout." })
      .eq("id", transaction.id);
    return jsonReply(req, { error: "Could not reach M-Pesa. Check your connection and try again." }, 502, METHODS);
  }
});
