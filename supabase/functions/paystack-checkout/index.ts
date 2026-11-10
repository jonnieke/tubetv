import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { issuePassToken, sha256Hex, verifyPassToken } from "../_shared/passToken.ts";

const PLANS = {
  daily: { amount: 10, label: "TubeTV 24-Hour Pass", hours: 24 },
  weekly: { amount: 50, label: "TubeTV Weekly Pass", hours: 168 },
  monthly: { amount: 149, label: "TubeTV Monthly Pass", hours: 720 },
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

function normalizeGlobalPhone(raw: unknown): { digits: string; e164: string; isKenyan: boolean } | null {
  const ke = normalizeKenyanPhone(raw);
  if (ke) return { ...ke, isKenyan: true };
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return {
    digits,
    e164: `+${digits}`,
    isKenyan: false,
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
    const parsedPhone = rawPhone ? normalizeGlobalPhone(rawPhone) : null;
    const suppliedEmail = String(requestBody.email || authenticatedEmail || "").trim();
    const email = suppliedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedEmail)
      ? suppliedEmail
      : parsedPhone
        ? `${parsedPhone.digits}@tube.co.ke`
        : `guest_${crypto.randomUUID().slice(0, 8)}@tube.co.ke`;

    const regionCode = String(requestBody.regionCode || req.headers.get("cf-ipcountry") || "KE").toUpperCase().slice(0, 8);
    const currencyCode = String(requestBody.currency || "KES").toUpperCase().slice(0, 8);

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
        currency: currencyCode,
        region_code: regionCode,
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

    const requestedChannel = String(requestBody.channel || "").toLowerCase();
    const channels = requestedChannel === "mobile_money"
      ? ["mobile_money"]
      : requestedChannel === "card"
        ? ["card"]
        : ["mobile_money", "card"];

    // 1. If customer requested mobile_money with a Kenyan phone number, attempt direct STK Push charge
    if (requestedChannel === "mobile_money" && parsedPhone?.isKenyan && parsedPhone?.digits) {
      try {
        const chargeRes = await fetch("https://api.paystack.co/charge", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            amount: plan.amount * 100,
            currency: "KES",
            reference,
            metadata: {
              plan_code: planCode,
              transaction_id: tx.id,
              phone: parsedPhone.e164,
            },
            mobile_money: {
              phone: parsedPhone.digits,
              provider: "mpesa",
            },
          }),
          signal: AbortSignal.timeout(12_000),
        });

        const chargeData = await chargeRes.json().catch(() => ({}));
        if (
          chargeRes.ok &&
          chargeData.status &&
          (chargeData.data?.status === "pay_offline" ||
            chargeData.data?.status === "pending" ||
            chargeData.data?.status === "success")
        ) {
          const displayText =
            chargeData.data?.display_text ||
            "An M-Pesa prompt was sent to your phone. Please enter your M-Pesa PIN.";

          await service
            .from("payment_transactions")
            .update({
              status: chargeData.data?.status === "success" ? "succeeded" : "submitted",
              channel: "mobile_money",
              result_description: displayText,
            })
            .eq("id", tx.id);

          return jsonReply(
            req,
            {
              transaction: {
                id: tx.id,
                status: "submitted",
                reference,
                displayText,
                checkoutToken,
                publicKey: paystackPublicKey,
              },
            },
            200,
            METHODS,
            { "Cache-Control": "no-store" },
          );
        }
      } catch (chargeErr) {
        console.warn("paystack_checkout_charge_fallback", chargeErr);
      }
    }

    // 2. Call Paystack Initialize API
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
        channels,
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

    const incomingDeviceId = String(requestBody.deviceId || "").trim();
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
        .select("id, tier, end_date, is_active, payment_reference, mpesa_ref, active_device_id")
        .or(`payment_reference.ilike.${activeRef},mpesa_ref.ilike.${activeRef}`)
        .eq("is_active", true)
        .maybeSingle();

      if (sub && sub.end_date && Date.parse(sub.end_date) > Date.now()) {
        const expiresAt = Date.parse(sub.end_date);
        const boundDeviceId = incomingDeviceId || sub.active_device_id || undefined;
        if (incomingDeviceId && sub.active_device_id !== incomingDeviceId) {
          await service
            .from("subscriptions")
            .update({ active_device_id: incomingDeviceId, updated_at: new Date().toISOString() })
            .eq("id", sub.id);
        }
        const passToken = await issuePassToken({
          subId: sub.id,
          tier: sub.tier,
          exp: expiresAt,
          ref: sub.payment_reference || sub.mpesa_ref || activeRef,
          deviceId: boundDeviceId,
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
              deviceId: boundDeviceId,
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
          p_device_id: incomingDeviceId || null,
        });

        if (rpcError) {
          console.error("fulfill_paystack_payment_error", rpcError);
          return jsonReply(req, { error: "Database error fulfilling payment." }, 500, METHODS);
        }

        if (rpcResult?.ok) {
          const expiresAt = Date.parse(rpcResult.end_date || rpcResult.expires_at);
          const passToken = await issuePassToken({
            subId: rpcResult.subscription_id,
            tier: rpcResult.tier,
            exp: expiresAt,
            ref: verifyRef,
            deviceId: incomingDeviceId || undefined,
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
                deviceId: incomingDeviceId || undefined,
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
      return jsonReply(req, { error: "Too many restore attempts. Please wait a minute." }, 200, METHODS);
    }

    const ref = String(requestBody.reference || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const contact = String(requestBody.emailOrPhone || requestBody.phone || "").trim();
    const incomingDeviceId = String(requestBody.deviceId || "").trim();
    const forceSwitch = Boolean(requestBody.forceSwitch);

    if (!ref && !contact) {
      return jsonReply(req, { error: "Please enter your phone number or reference." }, 200, METHODS);
    }

    const cleanPhoneDigits = contact.replace(/\D/g, "");
    const sub9 = cleanPhoneDigits.length >= 9 ? cleanPhoneDigits.slice(-9) : "";

    // Persistent DB rate limit check across cold starts
    try {
      const { data: allowed } = await service.rpc("check_pass_restore_rate_limit", {
        p_ip: clientIp,
        p_phone_key: sub9 || ref || "anon",
        p_max_per_15m: 12,
      });
      if (allowed === false) {
        return jsonReply(
          req,
          { error: "Too many restore attempts. Please wait 15 minutes and try again." },
          200,
          METHODS,
        );
      }
    } catch {
      // Non-blocking fallback
    }

    // Search existing active subscription directly in SQL before limiting
    let query = service
      .from("subscriptions")
      .select("id, tier, end_date, is_active, payment_reference, mpesa_ref, phone, active_device_id")
      .eq("is_active", true)
      .gt("end_date", new Date().toISOString());

    if (ref && sub9) {
      query = query.or(`payment_reference.ilike.${ref},mpesa_ref.ilike.${ref},phone.ilike.%${sub9}`);
    } else if (ref) {
      query = query.or(`payment_reference.ilike.${ref},mpesa_ref.ilike.${ref}`);
    } else if (sub9) {
      query = query.ilike("phone", `%${sub9}`);
    }

    const { data: subs } = await query.order("end_date", { ascending: false }).limit(10);

    const sub = (subs || []).find((s) => {
      if (ref) {
        if (s.payment_reference?.toUpperCase() === ref || s.mpesa_ref?.toUpperCase() === ref) return true;
      }
      if (sub9) {
        const storedDigits = String(s.phone || "").replace(/\D/g, "");
        if (storedDigits.endsWith(sub9)) return true;
      }
      return false;
    });

    if (sub && sub.end_date && Date.parse(sub.end_date) > Date.now()) {
      const expiresAt = Date.parse(sub.end_date);
      const currentDeviceId = String(sub.active_device_id || "").trim();

      // Enforce 1 device concurrency
      if (currentDeviceId && incomingDeviceId && currentDeviceId !== incomingDeviceId && !forceSwitch) {
        return jsonReply(
          req,
          {
            conflict: true,
            message: "Your pass is currently active on another device. Would you like to log out the other device and watch here?",
            tier: sub.tier,
            expiresAt,
          },
          200,
          METHODS,
        );
      }

      const finalDeviceId = incomingDeviceId || currentDeviceId || crypto.randomUUID();
      if (finalDeviceId !== currentDeviceId) {
        await service
          .from("subscriptions")
          .update({ active_device_id: finalDeviceId, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
      }

      const passToken = await issuePassToken({
        subId: sub.id,
        tier: sub.tier,
        exp: expiresAt,
        ref: sub.payment_reference || sub.mpesa_ref || ref || "PASS",
        deviceId: finalDeviceId,
      });

      return jsonReply(
        req,
        {
          pass: {
            token: passToken,
            tier: sub.tier,
            expiresAt,
            reference: sub.payment_reference || sub.mpesa_ref || ref,
            deviceId: finalDeviceId,
          },
          switched: Boolean(currentDeviceId && incomingDeviceId && currentDeviceId !== incomingDeviceId),
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
      200,
      METHODS,
    );
  }

  return jsonReply(req, { error: "Unknown action." }, 400, METHODS);
});

