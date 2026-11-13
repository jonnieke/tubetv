import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { issuePassToken, sha256Hex, verifyPassToken } from "../_shared/passToken.ts";

const PLANS = {
  daily: { amount: 10, label: "TubeTV Daily", hours: 24 },
  weekly: { amount: 50, label: "TubeTV Weekly", hours: 168 },
  monthly: { amount: 149, label: "TubeTV Monthly", hours: 720 },
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

/**
 * Supports Kenyan (07XX / +254) as well as Pan-African & Diaspora E.164 phone numbers
 * (+255 TZ, +256 UG, +250 RW, +234 NG, +233 GH, +27 ZA, +1 US/CA, +44 UK, etc.)
 */
function normalizeGlobalPhone(raw: unknown): { digits: string; e164: string; sub9: string } | null {
  const ke = normalizeKenyanPhone(raw);
  if (ke) return ke;
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  const sub9 = digits.slice(-9);
  return {
    digits,
    e164: `+${digits}`,
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
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
  const siteUrl = (
    Deno.env.get("PAYSTACK_SITE_URL") ||
    Deno.env.get("SITE_URL") ||
    "https://www.tube.co.ke"
  ).replace(/\/$/, "");

  if (!supabaseUrl || !serviceKey) {
    return jsonReply(req, { error: "Payment service is not configured." }, 503, METHODS);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const requestBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(requestBody.action || "initiate");
  const clientIp = getClientIp(req);

  // ─── Action: Verify an existing signed pass token ───────────────────────────
  if (action === "verify") {
    const token = String(req.headers.get("X-Pass-Token") || requestBody.passToken || "").trim();
    const incomingDeviceId = String(requestBody.deviceId || "").trim();
    const verified = await verifyPassToken(token);
    if (!verified) {
      return jsonReply(req, { valid: false }, 200, METHODS, { "Cache-Control": "no-store" });
    }
    const { data: sub } = await service
      .from("subscriptions")
      .select("id, tier, end_date, is_active, mpesa_ref, payment_reference, active_device_id, viewer_state")
      .eq("id", verified.subId)
      .maybeSingle();

    const expiresAt = sub?.end_date ? Date.parse(sub.end_date) : verified.exp;
    if (!sub || !sub.is_active || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return jsonReply(req, { valid: false }, 200, METHODS, { "Cache-Control": "no-store" });
    }

    // 1-Device Concurrency Check: If another device took over this pass, invalidate this device's session
    const tokenOrClientDevice = verified.deviceId || incomingDeviceId;
    if (sub.active_device_id && tokenOrClientDevice && sub.active_device_id !== tokenOrClientDevice) {
      return jsonReply(req, { valid: false, reason: "device_switched" }, 200, METHODS, { "Cache-Control": "no-store" });
    }

    return jsonReply(
      req,
      {
        valid: true,
        pass: {
          tier: sub.tier,
          expiresAt,
          mpesaReceipt: sub.mpesa_ref || sub.payment_reference,
          deviceId: sub.active_device_id || tokenOrClientDevice || undefined,
        },
        viewerState: sub.viewer_state || {},
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  // ─── Action: Cross-Device Cloud Sync of Continue Watching & Watch List ──────
  if (action === "sync_state" || action === "get_state") {
    const token = String(req.headers.get("X-Pass-Token") || requestBody.passToken || "").trim();
    const verified = await verifyPassToken(token);
    if (!verified) {
      return jsonReply(req, { error: "Valid pass token required." }, 401, METHODS);
    }

    const { data: sub } = await service
      .from("subscriptions")
      .select("id, is_active, end_date, active_device_id, viewer_state")
      .eq("id", verified.subId)
      .maybeSingle();

    if (!sub || !sub.is_active || (sub.end_date && Date.parse(sub.end_date) <= Date.now())) {
      return jsonReply(req, { error: "Pass expired or inactive." }, 403, METHODS);
    }

    if (action === "get_state") {
      return jsonReply(req, { viewerState: sub.viewer_state || {} }, 200, METHODS, { "Cache-Control": "no-store" });
    }

    // Merge incoming watchProgress and watchLater into subscriptions.viewer_state
    const existingState = (sub.viewer_state && typeof sub.viewer_state === "object" ? sub.viewer_state : {}) as Record<
      string,
      unknown
    >;
    const existingProgress = (
      existingState.progress && typeof existingState.progress === "object" ? existingState.progress : {}
    ) as Record<string, unknown>;
    const incomingProgress = (
      requestBody.progress && typeof requestBody.progress === "object" ? requestBody.progress : {}
    ) as Record<string, unknown>;

    const mergedProgress = { ...existingProgress, ...incomingProgress };
    const watchLaterArr = Array.isArray(requestBody.watchLater)
      ? requestBody.watchLater.filter((id) => typeof id === "string").slice(0, 200)
      : Array.isArray(existingState.watchLater)
        ? existingState.watchLater
        : [];

    const nextState = {
      progress: mergedProgress,
      watchLater: watchLaterArr,
      lastWatchedVideoId:
        typeof requestBody.lastWatchedVideoId === "string"
          ? requestBody.lastWatchedVideoId
          : existingState.lastWatchedVideoId || null,
      updatedAt: new Date().toISOString(),
    };

    await service
      .from("subscriptions")
      .update({ viewer_state: nextState })
      .eq("id", sub.id);

    return jsonReply(req, { ok: true, viewerState: nextState }, 200, METHODS, { "Cache-Control": "no-store" });
  }

  // ─── Action: Poll payment status using checkoutToken ────────────────────────
  if (action === "status") {
    const transactionId = String(requestBody.transactionId || "").trim();
    const checkoutToken = String(requestBody.checkoutToken || "").trim();
    const incomingDeviceId = String(requestBody.deviceId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(transactionId) || checkoutToken.length < 16) {
      return jsonReply(req, { error: "Valid transaction credentials are required." }, 400, METHODS);
    }

    const tokenHash = await sha256Hex(checkoutToken);
    const { data: tx } = await service
      .from("payment_transactions")
      .select("id, status, plan_code, mpesa_receipt, paystack_reference, customer_email, phone_e164, result_description, checkout_token_hash")
      .eq("id", transactionId)
      .maybeSingle();

    if (!tx || tx.checkout_token_hash !== tokenHash) {
      return jsonReply(req, { error: "Transaction not found." }, 404, METHODS);
    }

    // 1. If transaction already succeeded in DB, return pass token
    if (tx.status === "succeeded") {
      const activeRef = tx.mpesa_receipt || tx.paystack_reference;
      const { data: sub } = await service
        .from("subscriptions")
        .select("id, tier, end_date, is_active, mpesa_ref, payment_reference, active_device_id")
        .or(`mpesa_ref.ilike.${activeRef},payment_reference.ilike.${activeRef}`)
        .eq("is_active", true)
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub && sub.is_active && sub.end_date && Date.parse(sub.end_date) > Date.now()) {
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
          ref: sub.mpesa_ref || sub.payment_reference || activeRef || "",
          deviceId: boundDeviceId,
        });
        return jsonReply(
          req,
          {
            transaction: {
              id: tx.id,
              status: "succeeded",
              result_description: tx.result_description,
              mpesa_receipt: sub.mpesa_ref || sub.payment_reference || activeRef,
            },
            pass: {
              token: passToken,
              tier: sub.tier,
              expiresAt,
              mpesaReceipt: sub.mpesa_ref || sub.payment_reference || activeRef,
              deviceId: boundDeviceId,
            },
          },
          200,
          METHODS,
          { "Cache-Control": "no-store" },
        );
      }
    }

    // 2. If processed via Paystack and still pending, actively verify with Paystack API
    if (tx.paystack_reference && paystackSecretKey && (tx.status === "pending" || tx.status === "submitted")) {
      try {
        const paystackRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(tx.paystack_reference)}`,
          {
            headers: { Authorization: `Bearer ${paystackSecretKey}` },
            signal: AbortSignal.timeout(10_000),
          },
        );
        const paystackData = await paystackRes.json().catch(() => ({}));

        if (paystackRes.ok && paystackData.status && paystackData.data?.status === "success") {
          const pAmountKes = Math.round(Number(paystackData.data.amount) / 100);
          const pChannel = String(paystackData.data.channel || "mobile_money");
          const pPaidAt = paystackData.data.paid_at
            ? new Date(paystackData.data.paid_at).toISOString()
            : new Date().toISOString();
          const pEmail = paystackData.data.customer?.email || tx.customer_email || null;
          const pPhone = paystackData.data.customer?.phone || tx.phone_e164 || null;

          const { data: rpcResult } = await service.rpc("fulfill_paystack_payment", {
            p_reference: tx.paystack_reference,
            p_amount_kes: pAmountKes,
            p_channel: pChannel,
            p_paid_at: pPaidAt,
            p_customer_email: pEmail,
            p_phone: pPhone,
            p_device_id: incomingDeviceId || null,
          });

          if (rpcResult?.ok) {
            const expiresAt = rpcResult.expires_at
              ? Date.parse(rpcResult.expires_at)
              : Date.now() + 24 * 3600 * 1000;
            const passToken = await issuePassToken({
              subId: rpcResult.subscription_id,
              tier: rpcResult.tier || tx.plan_code,
              exp: expiresAt,
              ref: tx.paystack_reference,
              deviceId: incomingDeviceId || undefined,
            });
            return jsonReply(
              req,
              {
                transaction: {
                  id: tx.id,
                  status: "succeeded",
                  result_description: "Payment confirmed successfully.",
                  mpesa_receipt: tx.paystack_reference,
                },
                pass: {
                  token: passToken,
                  tier: rpcResult.tier || tx.plan_code,
                  expiresAt,
                  mpesaReceipt: tx.paystack_reference,
                  deviceId: incomingDeviceId || undefined,
                },
              },
              200,
              METHODS,
              { "Cache-Control": "no-store" },
            );
          }
        } else if (paystackData.data?.status === "failed") {
          await service
            .from("payment_transactions")
            .update({
              status: "failed",
              result_description: paystackData.data.gateway_response || "Payment was declined or cancelled.",
            })
            .eq("id", tx.id);
          return jsonReply(
            req,
            {
              transaction: {
                id: tx.id,
                status: "failed",
                result_description: paystackData.data.gateway_response || "Payment was declined.",
              },
            },
            200,
            METHODS,
            { "Cache-Control": "no-store" },
          );
        }
      } catch (pollErr) {
        console.warn("mpesa_paystack_verify_poll_err", pollErr);
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

  // ─── Action: Phone-number-only cross-device recovery (1-device concurrency) ──
  if (action === "restore") {
    if (!checkIpRateLimit(`restore:${clientIp}`, 10)) {
      return jsonReply(req, { error: "Too many restore attempts. Please wait a minute and try again." }, 200, METHODS);
    }

    const parsedPhone = normalizeGlobalPhone(requestBody.phone);
    const receipt = String(requestBody.mpesaReceipt || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!parsedPhone && !receipt) {
      return jsonReply(
        req,
        { error: "Please enter a valid phone number (e.g. 0712 345 678 or +1 / +44 / +234...)." },
        200,
        METHODS,
      );
    }

    const sub9 = parsedPhone?.sub9 || "";
    const incomingDeviceId = String(requestBody.deviceId || "").trim();
    const forceSwitch = Boolean(requestBody.forceSwitch);

    // Persistent DB rate limit check across cold starts (protects against phone enumeration)
    try {
      const { data: allowed } = await service.rpc("check_pass_restore_rate_limit", {
        p_ip: clientIp,
        p_phone_key: sub9 || receipt || "anon",
        p_max_per_15m: 12,
      });
      if (allowed === false) {
        return jsonReply(
          req,
          { error: "Too many restore attempts for this number. Please wait 15 minutes and try again." },
          200,
          METHODS,
        );
      }
    } catch {
      // Non-blocking fallback to in-memory limiter if RPC unavailable
    }

    // Query active subscriptions matching this phone (or receipt) directly in SQL before limiting
    let subQuery = service
      .from("subscriptions")
      .select("id, phone, tier, end_date, is_active, mpesa_ref, payment_reference, active_device_id, viewer_state")
      .eq("is_active", true)
      .gt("end_date", new Date().toISOString());

    if (receipt && sub9) {
      subQuery = subQuery.or(`phone.ilike.%${sub9},mpesa_ref.ilike.${receipt},payment_reference.ilike.${receipt}`);
    } else if (receipt) {
      subQuery = subQuery.or(`mpesa_ref.ilike.${receipt},payment_reference.ilike.${receipt}`);
    } else {
      subQuery = subQuery.ilike("phone", `%${sub9}`);
    }

    const { data: subs, error: subError } = await subQuery
      .order("end_date", { ascending: false })
      .limit(10);

    if (subError) {
      return jsonReply(req, { error: "Database service temporarily unavailable." }, 200, METHODS);
    }

    // Match by phone number suffix or receipt
    let sub = (subs || []).find((s) => {
      const storedDigits = String(s.phone || "").replace(/\D/g, "");
      const phoneMatch = Boolean(sub9 && storedDigits.endsWith(sub9));
      if (receipt) {
        const refMatch =
          (s.mpesa_ref && s.mpesa_ref.toUpperCase() === receipt) ||
          (s.payment_reference && s.payment_reference.toUpperCase() === receipt);
        return phoneMatch || refMatch;
      }
      return phoneMatch;
    });

    // Fallback: if no active subscription yet, check if a recent Paystack transaction for this phone/receipt succeeded upstream
    if (!sub && paystackSecretKey && (sub9 || receipt)) {
      try {
        let txQuery = service
          .from("payment_transactions")
          .select("id, paystack_reference, plan_code, phone_e164, customer_email, status")
          .not("paystack_reference", "is", null);

        if (receipt && sub9) {
          txQuery = txQuery.or(`phone_e164.ilike.%${sub9},paystack_reference.ilike.${receipt}`);
        } else if (receipt) {
          txQuery = txQuery.ilike("paystack_reference", receipt);
        } else {
          txQuery = txQuery.ilike("phone_e164", `%${sub9}`);
        }

        const { data: recentTxs } = await txQuery.order("created_at", { ascending: false }).limit(3);
        for (const cand of recentTxs || []) {
          if (!cand.paystack_reference) continue;
          const paystackRes = await fetch(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(cand.paystack_reference)}`,
            {
              headers: { Authorization: `Bearer ${paystackSecretKey}` },
              signal: AbortSignal.timeout(8_000),
            },
          );
          const paystackData = await paystackRes.json().catch(() => ({}));
          if (paystackRes.ok && paystackData.status && paystackData.data?.status === "success") {
            const pAmountKes = Math.round(Number(paystackData.data.amount) / 100);
            const pChannel = String(paystackData.data.channel || "mobile_money");
            const pPaidAt = paystackData.data.paid_at
              ? new Date(paystackData.data.paid_at).toISOString()
              : new Date().toISOString();
            const pEmail = paystackData.data.customer?.email || cand.customer_email || null;
            const pPhone = paystackData.data.customer?.phone || cand.phone_e164 || parsedPhone?.e164 || null;

            const { data: rpcResult } = await service.rpc("fulfill_paystack_payment", {
              p_reference: cand.paystack_reference,
              p_amount_kes: pAmountKes,
              p_channel: pChannel,
              p_paid_at: pPaidAt,
              p_customer_email: pEmail,
              p_phone: pPhone,
              p_device_id: incomingDeviceId || null,
            });
            if (rpcResult?.ok && rpcResult.subscription_id) {
              const { data: fulfilledSub } = await service
                .from("subscriptions")
                .select("id, phone, tier, end_date, is_active, mpesa_ref, payment_reference, active_device_id, viewer_state")
                .eq("id", rpcResult.subscription_id)
                .maybeSingle();
              if (fulfilledSub) {
                sub = fulfilledSub;
                break;
              }
            }
          }
        }
      } catch {
        // Non-blocking upstream verification check
      }
    }

    if (!sub) {
      // Check if there was an expired subscription for this phone number or receipt
      try {
        let expQuery = service
          .from("subscriptions")
          .select("id, phone, tier, end_date, mpesa_ref, payment_reference")
          .order("end_date", { ascending: false })
          .limit(1);

        if (receipt && sub9) {
          expQuery = expQuery.or(`phone.ilike.%${sub9},mpesa_ref.ilike.${receipt},payment_reference.ilike.${receipt}`);
        } else if (receipt) {
          expQuery = expQuery.or(`mpesa_ref.ilike.${receipt},payment_reference.ilike.${receipt}`);
        } else if (sub9) {
          expQuery = expQuery.ilike("phone", `%${sub9}`);
        }

        const { data: expiredSubs } = await expQuery;
        const expiredSub = expiredSubs?.[0];

        if (expiredSub) {
          const expTime = expiredSub.end_date ? Date.parse(expiredSub.end_date) : 0;
          return jsonReply(
            req,
            {
              expired: true,
              tier: expiredSub.tier,
              expiredAt: expTime,
              phone: parsedPhone?.e164 || expiredSub.phone || "",
              message: "Your TubeTV pass for this number has expired. Renew your pass to extend watching.",
            },
            200,
            METHODS,
          );
        }
      } catch (err) {
        console.warn("check_expired_sub_error", err);
      }

      return jsonReply(
        req,
        { error: "No active pass found for this phone number. Choose a pass below to start watching." },
        200,
        METHODS,
      );
    }

    const expiresAt = sub.end_date ? Date.parse(sub.end_date) : 0;
    if (!sub.is_active || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return jsonReply(
        req,
        {
          expired: true,
          tier: sub.tier,
          expiredAt: expiresAt || null,
          phone: parsedPhone?.e164 || sub.phone || "",
          message: "Your TubeTV pass for this number has expired. Renew your pass to extend watching.",
        },
        200,
        METHODS,
      );
    }

    const currentDeviceId = String(sub.active_device_id || "").trim();

    // 1-Device Concurrency Enforcement:
    // If active on another device and user has NOT confirmed forceSwitch, prompt them
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

    // Assign active device ID to this new session
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
      ref: sub.mpesa_ref || sub.payment_reference || "PASS",
      deviceId: finalDeviceId,
    });

    return jsonReply(
      req,
      {
        pass: {
          token: passToken,
          tier: sub.tier,
          expiresAt,
          mpesaReceipt: sub.mpesa_ref || sub.payment_reference || "PASS",
          phone: parsedPhone?.e164 || sub.phone || "",
          deviceId: finalDeviceId,
        },
        viewerState: sub.viewer_state || {},
        switched: Boolean(currentDeviceId && incomingDeviceId && currentDeviceId !== incomingDeviceId),
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  // ─── Action: Initiate M-Pesa Payment ─────────────────────────────────────────
  if (action !== "initiate") {
    return jsonReply(req, { error: "Unknown payment action." }, 400, METHODS);
  }

  if (!checkIpRateLimit(`stk:${clientIp}`, 10)) {
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

  // Associate authenticated user if session JWT is present
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

  const TIER_RANKS: Record<string, number> = { daily: 1, weekly: 2, monthly: 3 };
  const requestedRank = TIER_RANKS[planCode] || 1;

  // Check if subscriber already has an active subscription for this phone
  const sub9 = parsedPhone.sub9;
  const { data: existingActiveSub } = await service
    .from("subscriptions")
    .select("id, tier, end_date")
    .eq("is_active", true)
    .gt("end_date", new Date().toISOString())
    .ilike("phone", `%${sub9}`)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingActiveSub) {
    const existingRank = TIER_RANKS[existingActiveSub.tier?.toLowerCase()] || 1;
    if (requestedRank <= existingRank) {
      const expDate = existingActiveSub.end_date ? new Date(existingActiveSub.end_date).toLocaleString() : "active";
      return jsonReply(
        req,
        {
          error: `You already have an active ${existingActiveSub.tier.toUpperCase()} pass (valid until ${expDate}). You cannot subscribe to the same or lower tier. You can only upgrade to a bigger tier.`,
          currentTier: existingActiveSub.tier,
          activeUntil: existingActiveSub.end_date,
        },
        409,
        METHODS,
      );
    }
  }

  // Check existing idempotent request
  const { data: existing } = await service
    .from("payment_transactions")
    .select("id, status, checkout_request_id, paystack_reference, result_description")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    return jsonReply(req, { transaction: existing, reused: true }, 200, METHODS);
  }

  // Check Daraja secrets vs Paystack fallback
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
  const shortcode = Deno.env.get("MPESA_SHORTCODE");
  const passkey = Deno.env.get("MPESA_PASSKEY");
  const callbackBaseUrl = Deno.env.get("MPESA_CALLBACK_URL");
  const callbackSecret = Deno.env.get("MPESA_CALLBACK_SECRET");
  const environment = Deno.env.get("MPESA_ENV") === "production" ? "production" : "sandbox";

  const hasDaraja = Boolean(
    consumerKey && consumerSecret && shortcode && passkey && callbackBaseUrl && callbackSecret
  );
  const hasPaystack = Boolean(paystackSecretKey);

  if (!hasDaraja && !hasPaystack) {
    return jsonReply(req, { error: "M-Pesa payments are temporarily unavailable." }, 503, METHODS);
  }

  const checkoutToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const checkoutTokenHash = await sha256Hex(checkoutToken);

  // ─── Direct Daraja STK Push path ───────────────────────────────────────────
  if (hasDaraja) {
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
      const callbackUrl = new URL(callbackBaseUrl!);
      callbackUrl.searchParams.set("secret", callbackSecret!);

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
  }

  // ─── Paystack M-Pesa Engine (Production Fallback) ─────────────────────────
  const reference = `TUBE_MP_${Date.now()}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const customerEmail = `${parsedPhone.digits}@tube.co.ke`;

  const { data: transaction, error: insertError } = await service
    .from("payment_transactions")
    .insert({
      user_id: authenticatedUserId,
      phone_e164: parsedPhone.e164,
      customer_email: customerEmail,
      plan_code: planCode,
      amount_kes: plan.amount,
      idempotency_key: idempotencyKey,
      checkout_token_hash: checkoutTokenHash,
      paystack_reference: reference,
      provider: "paystack",
      channel: "mobile_money",
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !transaction) {
    return jsonReply(req, { error: "Unable to create payment request." }, 409, METHODS);
  }

  let directPromptSent = false;
  let customerMessage = "M-Pesa STK push sent. Please enter your PIN on your phone.";
  let authorizationUrl: string | undefined;

  // 1. Attempt Paystack Charge API for instant STK Push prompt to handset
  try {
    const chargeRes = await fetch("https://api.paystack.co/charge", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: customerEmail,
        amount: plan.amount * 100,
        currency: "KES",
        reference,
        metadata: {
          plan_code: planCode,
          transaction_id: transaction.id,
          phone: parsedPhone.e164,
          custom_fields: [
            { display_name: "Subscription Plan", variable_name: "plan", value: plan.label },
          ],
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
      directPromptSent = true;
      customerMessage =
        chargeData.data?.display_text ||
        "An M-Pesa prompt has been sent to your phone. Enter your M-Pesa PIN to complete payment.";
      await service
        .from("payment_transactions")
        .update({
          status: chargeData.data?.status === "success" ? "succeeded" : "submitted",
          result_description: customerMessage,
        })
        .eq("id", transaction.id);
    } else {
      console.warn("paystack_charge_api_fallback", chargeData?.message || chargeData);
    }
  } catch (chargeErr) {
    console.warn("paystack_charge_api_network_error", chargeErr);
  }

  // 2. If Charge API did not accept direct prompt, initialize Paystack checkout for M-Pesa
  if (!directPromptSent) {
    try {
      const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: customerEmail,
          amount: plan.amount * 100,
          currency: "KES",
          reference,
          callback_url: `${siteUrl}/?paystack_ref=${encodeURIComponent(reference)}`,
          metadata: {
            plan_code: planCode,
            transaction_id: transaction.id,
            phone: parsedPhone.e164,
            custom_fields: [
              { display_name: "Subscription Plan", variable_name: "plan", value: plan.label },
            ],
          },
          channels: ["mobile_money"],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const initData = await initRes.json().catch(() => ({}));
      if (!initRes.ok || !initData.status || !initData.data?.access_code) {
        await service
          .from("payment_transactions")
          .update({
            status: "failed",
            result_description: initData.message || "Paystack M-Pesa initialization failed.",
          })
          .eq("id", transaction.id);
        return jsonReply(
          req,
          { error: initData.message || "Unable to initiate M-Pesa payment right now. Please try again." },
          502,
          METHODS,
        );
      }

      authorizationUrl = initData.data.authorization_url;
      customerMessage = "Please authorize the M-Pesa payment prompt.";
      await service
        .from("payment_transactions")
        .update({
          paystack_access_code: initData.data.access_code,
          status: "submitted",
          result_description: customerMessage,
        })
        .eq("id", transaction.id);
    } catch (initErr) {
      console.error("paystack_init_network_error", initErr);
      await service
        .from("payment_transactions")
        .update({ status: "failed", result_description: "Network timeout initiating payment." })
        .eq("id", transaction.id);
      return jsonReply(req, { error: "Could not reach payment gateway. Check your connection." }, 502, METHODS);
    }
  }

  return jsonReply(
    req,
    {
      transaction: {
        id: transaction.id,
        status: "submitted",
        checkoutToken,
        checkoutRequestId: reference,
        reference,
        authorizationUrl,
        message: customerMessage,
      },
    },
    200,
    METHODS,
    { "Cache-Control": "no-store" },
  );
});
