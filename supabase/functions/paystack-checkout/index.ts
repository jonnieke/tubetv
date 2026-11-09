import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { issuePassToken, sha256Hex, verifyPassToken } from "../_shared/passToken.ts";

const PLANS = {
  daily: { amount: 10, label: "TubeTV 24-Hour Pass", hours: 24 },
  weekly: { amount: 50, label: "TubeTV Weekly Pass", hours: 168 },
  monthly: { amount: 249, label: "TubeTV Monthly Pass", hours: 720 },
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

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

function normalizeKenyanPhone(raw: unknown): { digits: string; e164: string } | null {
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
  };
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
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
  const paystackPublicKey = Deno.env.get("PAYSTACK_PUBLIC_KEY") || "";
  const siteUrl = (Deno.env.get("SITE_URL") || "https://www.tube.co.ke").replace(/\/$/, "");

  if (!supabaseUrl || !serviceKey) {
    return jsonReply(req, { error: "Payment backend service is not configured." }, 503, METHODS);
  }
  if (!paystackSecretKey) {
    return jsonReply(req, { error: "Paystack live secret key is not configured." }, 503, METHODS);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const requestBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(requestBody.action || "initiate");
  const clientIp = getClientIp(req);

  // ─── Action: Initiate Paystack Transaction ───────────────────────────────────
  if (action === "initiate") {
    if (!checkIpRateLimit(`paystack:init:${clientIp}`, 15)) {
      return jsonReply(req, { error: "Too many payment requests. Please wait a moment." }, 429, METHODS);
    }

    const idempotencyKey = (req.headers.get("Idempotency-Key") || String(requestBody.idempotencyKey || "")).trim();
    if (!idempotencyKey || idempotencyKey.length > 100) {
      return jsonReply(req, { error: "A valid Idempotency-Key header is required." }, 400, METHODS);
    }

    const planCode = String(requestBody.planCode || "") as keyof typeof PLANS;
    const plan = PLANS[planCode];
    if (!plan) {
      return jsonReply(req, { error: "Invalid subscription plan selected." }, 400, METHODS);
    }

    // Optional user authentication check
    let authenticatedUserId: string | null = null;
    let authenticatedEmail: string | null = null;
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
          authenticatedEmail = authData.user.email || null;
          authenticatedPhone = authData.user.phone || null;
        }
      }
    }

    const rawPhone = String(requestBody.phone || authenticatedPhone || "").trim();
    const parsedPhone = rawPhone ? normalizeKenyanPhone(rawPhone) : null;
    const suppliedEmail = String(requestBody.email || authenticatedEmail || "").trim();
    const email = suppliedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedEmail)
      ? suppliedEmail
      : parsedPhone
        ? `${parsedPhone.digits}@tube.co.ke`
        : `guest_${crypto.randomUUID().slice(0, 8)}@tube.co.ke`;

    // Check existing idempotent request
    const { data: existing } = await service
      .from("payment_transactions")
      .select("id, status, paystack_reference, paystack_access_code, result_description")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing && existing.paystack_reference) {
      return jsonReply(
        req,
        {
          transaction: {
            id: existing.id,
            status: existing.status,
            reference: existing.paystack_reference,
            accessCode: existing.paystack_access_code,
            publicKey: paystackPublicKey,
          },
          reused: true,
        },
        200,
        METHODS,
      );
    }

    const reference = `TUBE_${Date.now()}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const checkoutToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const checkoutTokenHash = await sha256Hex(checkoutToken);

    const { data: tx, error: insertError } = await service
      .from("payment_transactions")
      .insert({
        user_id: authenticatedUserId,
        phone_e164: parsedPhone?.e164 || null,
        customer_email: email,
        plan_code: planCode,
        amount_kes: plan.amount,
        idempotency_key: idempotencyKey,
        checkout_token_hash: checkoutTokenHash,
        paystack_reference: reference,
        provider: "paystack",
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !tx) {
      return jsonReply(req, { error: "Unable to create payment transaction." }, 409, METHODS);
    }

    // Call Paystack Initialize API
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: plan.amount * 100, // Paystack KES subunit is cents (10 KES = 1000)
        currency: "KES",
        reference,
        callback_url: `${siteUrl}/?paystack_ref=${encodeURIComponent(reference)}`,
        metadata: {
          plan_code: planCode,
          transaction_id: tx.id,
          phone: parsedPhone?.e164 || null,
          custom_fields: [
            {
              display_name: "Subscription Plan",
              variable_name: "plan",
              value: plan.label,
            },
          ],
        },
        channels: ["mobile_money", "card"],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const paystackData = await paystackRes.json().catch(() => ({}));
    if (!paystackRes.ok || !paystackData.status || !paystackData.data?.access_code) {
      console.error("paystack_init_error", paystackData);
      await service
        .from("payment_transactions")
        .update({
          status: "failed",
          result_description: paystackData.message || "Paystack initialization failed.",
        })
        .eq("id", tx.id);
      return jsonReply(req, { error: paystackData.message || "Unable to initialize Paystack checkout." }, 502, METHODS);
    }

    await service
      .from("payment_transactions")
      .update({
        paystack_access_code: paystackData.data.access_code,
        status: "submitted",
      })
      .eq("id", tx.id);

    return jsonReply(
      req,
      {
        transaction: {
          id: tx.id,
          status: "submitted",
          reference,
          accessCode: paystackData.data.access_code,
          authorizationUrl: paystackData.data.authorization_url,
          checkoutToken,
          publicKey: paystackPublicKey,
        },
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  // ─── Action: Poll & Verify Paystack Transaction Status ───────────────────────
  if (action === "status" || action === "verify") {
    const reference = String(requestBody.reference || "").trim().toUpperCase();
    const transactionId = String(requestBody.transactionId || "").trim();
    const checkoutToken = String(requestBody.checkoutToken || "").trim();

    if (!reference && !transactionId) {
      return jsonReply(req, { error: "Reference or transaction ID is required." }, 400, METHODS);
    }

    let tokenHash: string | null = null;
    if (checkoutToken) {
      tokenHash = await sha256Hex(checkoutToken);
    }

    let query = service
      .from("payment_transactions")
      .select("id, status, plan_code, amount_kes, paystack_reference, customer_email, phone_e164, checkout_token_hash");

    if (transactionId) {
      query = query.eq("id", transactionId);
    } else {
      query = query.ilike("paystack_reference", reference);
    }

    const { data: tx } = await query.maybeSingle();

    if (tokenHash && tx?.checkout_token_hash && tx.checkout_token_hash !== tokenHash) {
      return jsonReply(req, { error: "Unauthorized transaction token." }, 403, METHODS);
    }

    // 1. If already succeeded in database, return pass immediately
    if (tx && tx.status === "succeeded") {
      const activeRef = tx.paystack_reference || reference;
      const { data: sub } = await service
        .from("subscriptions")
        .select("id, tier, end_date, is_active, payment_reference, mpesa_ref")
        .or(`payment_reference.ilike.${activeRef},mpesa_ref.ilike.${activeRef}`)
        .eq("is_active", true)
        .maybeSingle();

      if (sub && sub.end_date && Date.parse(sub.end_date) > Date.now()) {
        const expiresAt = Date.parse(sub.end_date);
        const passToken = await issuePassToken({
          subId: sub.id,
          tier: sub.tier,
          exp: expiresAt,
          ref: sub.payment_reference || sub.mpesa_ref || activeRef,
        });
        return jsonReply(
          req,
          {
            transaction: {
              id: tx.id,
              status: "succeeded",
              reference: activeRef,
            },
            pass: {
              token: passToken,
              tier: sub.tier,
              expiresAt,
              reference: activeRef,
            },
          },
          200,
          METHODS,
          { "Cache-Control": "no-store" },
        );
      }
    }

    // 2. Query Paystack directly to verify live charge
    const verifyRef = tx?.paystack_reference || reference;
    try {
      const paystackRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(verifyRef)}`,
        {
          headers: { Authorization: `Bearer ${paystackSecretKey}` },
          signal: AbortSignal.timeout(12_000),
        },
      );
      const paystackData = await paystackRes.json().catch(() => ({}));

      if (paystackRes.ok && paystackData.status && paystackData.data?.status === "success") {
        const pAmountKes = Math.round(Number(paystackData.data.amount) / 100);
        const pChannel = String(paystackData.data.channel || "card");
        const pPaidAt = paystackData.data.paid_at ? new Date(paystackData.data.paid_at).toISOString() : new Date().toISOString();
        const pEmail = paystackData.data.customer?.email || tx?.customer_email || null;
        const pPhone = paystackData.data.customer?.phone || tx?.phone_e164 || null;

        // Fulfill atomically in DB
        const { data: rpcResult, error: rpcError } = await service.rpc("fulfill_paystack_payment", {
          p_reference: verifyRef,
          p_amount_kes: pAmountKes,
          p_channel: pChannel,
          p_paid_at: pPaidAt,
          p_customer_email: pEmail,
          p_phone: pPhone,
        });

        if (rpcError) {
          console.error("fulfill_paystack_payment_error", rpcError);
          return jsonReply(req, { error: "Database error fulfilling payment." }, 500, METHODS);
        }

        if (rpcResult?.ok) {
          const expiresAt = Date.parse(rpcResult.end_date);
          const passToken = await issuePassToken({
            subId: rpcResult.subscription_id,
            tier: rpcResult.tier,
            exp: expiresAt,
            ref: verifyRef,
          });

          return jsonReply(
            req,
            {
              transaction: {
                id: tx?.id || rpcResult.subscription_id,
                status: "succeeded",
                reference: verifyRef,
              },
              pass: {
                token: passToken,
                tier: rpcResult.tier,
                expiresAt,
                reference: verifyRef,
              },
            },
            200,
            METHODS,
            { "Cache-Control": "no-store" },
          );
        }
      }

      if (paystackData.data?.status === "failed") {
        if (tx) {
          await service
            .from("payment_transactions")
            .update({
              status: "failed",
              result_description: paystackData.data.gateway_response || "Payment was declined by processor.",
            })
            .eq("id", tx.id);
        }
        return jsonReply(
          req,
          {
            transaction: {
              id: tx?.id,
              status: "failed",
              result_description: paystackData.data.gateway_response || "Payment was declined.",
            },
          },
          200,
          METHODS,
        );
      }
    } catch (verifyErr) {
      console.warn("paystack_verify_warning", verifyErr);
    }

    return jsonReply(
      req,
      {
        transaction: {
          id: tx?.id,
          status: tx?.status || "pending",
        },
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  // ─── Action: Cross-Device Restore Pass ───────────────────────────────────────
  if (action === "restore") {
    if (!checkIpRateLimit(`paystack:restore:${clientIp}`, 10)) {
      return jsonReply(req, { error: "Too many restore attempts. Please wait a minute." }, 429, METHODS);
    }

    const ref = String(requestBody.reference || "").trim().toUpperCase();
    const contact = String(requestBody.emailOrPhone || "").trim();
    if (!ref) {
      return jsonReply(req, { error: "Please enter your Paystack reference or receipt." }, 400, METHODS);
    }

    // Search existing active subscription
    const { data: sub } = await service
      .from("subscriptions")
      .select("id, tier, end_date, is_active, payment_reference, mpesa_ref, phone")
      .or(`payment_reference.ilike.${ref},mpesa_ref.ilike.${ref}`)
      .eq("is_active", true)
      .maybeSingle();

    if (sub && sub.end_date && Date.parse(sub.end_date) > Date.now()) {
      const expiresAt = Date.parse(sub.end_date);
      const passToken = await issuePassToken({
        subId: sub.id,
        tier: sub.tier,
        exp: expiresAt,
        ref: sub.payment_reference || sub.mpesa_ref || ref,
      });

      return jsonReply(
        req,
        {
          pass: {
            token: passToken,
            tier: sub.tier,
            expiresAt,
            reference: sub.payment_reference || sub.mpesa_ref || ref,
          },
        },
        200,
        METHODS,
        { "Cache-Control": "no-store" },
      );
    }

    // If not found in DB, check Paystack API directly
    try {
      const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
        headers: { Authorization: `Bearer ${paystackSecretKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      const paystackData = await paystackRes.json().catch(() => ({}));
      if (paystackRes.ok && paystackData.status && paystackData.data?.status === "success") {
        const pAmountKes = Math.round(Number(paystackData.data.amount) / 100);
        const pChannel = String(paystackData.data.channel || "card");
        const pPaidAt = paystackData.data.paid_at ? new Date(paystackData.data.paid_at).toISOString() : new Date().toISOString();
        const pEmail = paystackData.data.customer?.email || null;
        const pPhone = paystackData.data.customer?.phone || null;

        const { data: rpcResult } = await service.rpc("fulfill_paystack_payment", {
          p_reference: ref,
          p_amount_kes: pAmountKes,
          p_channel: pChannel,
          p_paid_at: pPaidAt,
          p_customer_email: pEmail,
          p_phone: pPhone,
        });

        if (rpcResult?.ok) {
          const expiresAt = Date.parse(rpcResult.end_date);
          const passToken = await issuePassToken({
            subId: rpcResult.subscription_id,
            tier: rpcResult.tier,
            exp: expiresAt,
            ref,
          });

          return jsonReply(
            req,
            {
              pass: {
                token: passToken,
                tier: rpcResult.tier,
                expiresAt,
                reference: ref,
              },
            },
            200,
            METHODS,
            { "Cache-Control": "no-store" },
          );
        }
      }
    } catch {
      // Ignore upstream verify error
    }

    return jsonReply(
      req,
      { error: "No active pass was found for that payment reference. Check your code or buy a new pass." },
      404,
      METHODS,
    );
  }

  return jsonReply(req, { error: "Unknown action." }, 400, METHODS);
});

