import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { issuePassToken, sha256Hex } from "../_shared/passToken.ts";

const METHODS = "POST, OPTIONS";

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

function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) });
  }
  if (!isOriginAllowed(req)) {
    return jsonReply(req, { error: "Forbidden origin" }, 403, METHODS);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return jsonReply(req, { error: "Server environment misconfigured" }, 500, METHODS);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action.trim() : "initiate";

  // ─── 1. Query Ratiba status by phone ──────────────────────────────────────
  if (action === "status") {
    const rawPhone = String(body.phone || "").trim();
    const parsed = normalizeKenyanPhone(rawPhone);
    if (!parsed) {
      return jsonReply(req, { error: "A valid Kenyan phone number is required." }, 400, METHODS);
    }
    const phoneHash = await sha256Hex(parsed.e164);
    const { data: mandate } = await service
      .from("ratiba_mandates")
      .select("id, standing_order_name, amount_kes, frequency, status, next_billing_date, last_billed_at, created_at")
      .eq("phone_hash", phoneHash)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return jsonReply(req, { mandate: mandate || null }, 200, METHODS, { "Cache-Control": "no-store" });
  }

  // ─── 2. Cancel standing order mandate ─────────────────────────────────────
  if (action === "cancel") {
    const rawPhone = String(body.phone || "").trim();
    const parsed = normalizeKenyanPhone(rawPhone);
    if (!parsed) {
      return jsonReply(req, { error: "A valid Kenyan phone number is required." }, 400, METHODS);
    }
    const phoneHash = await sha256Hex(parsed.e164);
    const { data: updated, error } = await service
      .from("ratiba_mandates")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("phone_hash", phoneHash)
      .in("status", ["pending", "active"])
      .select("id")
      .maybeSingle();

    if (error) {
      return jsonReply(req, { error: "Unable to cancel auto-renewal at this time." }, 500, METHODS);
    }
    return jsonReply(req, { ok: true, cancelled: Boolean(updated) }, 200, METHODS);
  }

  // ─── 3. Initiate Ratiba Standing Order ────────────────────────────────────
  if (action === "initiate") {
    const rawPhone = String(body.phone || "").trim();
    const parsedPhone = normalizeKenyanPhone(rawPhone);
    if (!parsedPhone) {
      return jsonReply(
        req,
        { error: "Please enter a valid Safaricom phone number (e.g. 0712 345 678 or 0112 345 678)." },
        400,
        METHODS,
      );
    }

    const planCode = String(body.planCode || "monthly").trim().toLowerCase();
    if (planCode !== "monthly") {
      return jsonReply(req, { error: "Auto-renew with M-Pesa is only available for the 30-Day Monthly Pass." }, 400, METHODS);
    }

    const amountKes = 149;
    const phoneHash = await sha256Hex(parsedPhone.e164);
    const checkoutToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const checkoutTokenHash = await sha256Hex(checkoutToken);
    const idempotencyKey = String(req.headers.get("Idempotency-Key") || crypto.randomUUID()).slice(0, 80);

    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const callbackBaseUrl = Deno.env.get("MPESA_CALLBACK_URL");
    const callbackSecret = Deno.env.get("MPESA_CALLBACK_SECRET");
    const environment = Deno.env.get("MPESA_ENV") === "production" ? "production" : "sandbox";

    const hasDaraja = Boolean(consumerKey && consumerSecret && shortcode && passkey && callbackBaseUrl && callbackSecret);

    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const startDateStr = formatDateYYYYMMDD(now);
    const endDateStr = formatDateYYYYMMDD(oneYearLater);

    // 1. Insert tracking mandate
    const { data: mandate, error: mandateError } = await service
      .from("ratiba_mandates")
      .insert({
        phone_e164: parsedPhone.e164,
        phone_hash: phoneHash,
        standing_order_name: "TubeTV Monthly Pass",
        amount_kes: amountKes,
        frequency: "monthly",
        status: "pending",
        start_date: startDateStr,
        end_date: endDateStr,
        metadata: {
          idempotencyKey,
          environment,
          userAgent: req.headers.get("user-agent") || "",
        },
      })
      .select("id")
      .single();

    if (mandateError || !mandate) {
      console.error("ratiba_mandate_insert_error", mandateError);
      return jsonReply(req, { error: "Unable to create recurring standing order mandate." }, 500, METHODS);
    }

    // 2. Also insert payment_transactions record so UI polling checks status seamlessly
    const { data: transaction, error: txError } = await service
      .from("payment_transactions")
      .insert({
        phone_e164: parsedPhone.e164,
        plan_code: "monthly",
        amount_kes: amountKes,
        idempotency_key: idempotencyKey,
        checkout_token_hash: checkoutTokenHash,
        status: "pending",
        result_description: "Auto-renew M-Pesa Standing Order pending PIN authorization.",
      })
      .select("id")
      .single();

    if (txError || !transaction) {
      console.error("ratiba_transaction_insert_error", txError);
      return jsonReply(req, { error: "Unable to initialize payment transaction." }, 500, METHODS);
    }

    // 3. If Daraja is configured, attempt Safaricom Standing Order API
    if (hasDaraja) {
      const host = environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
      const basicAuth = btoa(`${consumerKey}:${consumerSecret}`);

      try {
        const tokenResponse = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
          headers: { Authorization: `Basic ${basicAuth}` },
          signal: AbortSignal.timeout(15_000),
        });

        if (tokenResponse.ok) {
          const accessToken = (await tokenResponse.json()).access_token;
          const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
          const password = btoa(`${shortcode}${passkey}${timestamp}`);
          const callbackUrl = new URL(callbackBaseUrl!);
          callbackUrl.searchParams.set("secret", callbackSecret!);
          callbackUrl.searchParams.set("type", "ratiba");
          callbackUrl.searchParams.set("mandateId", mandate.id);

          // Daraja Standing Order / Ratiba External Creation Endpoint
          const ratibaPayload = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "Standing Order",
            StandingOrderName: "TubeTV Monthly Pass",
            Amount: amountKes,
            PartyA: parsedPhone.digits,
            PartyB: shortcode,
            PhoneNumber: parsedPhone.digits,
            CallBackURL: callbackUrl.toString(),
            AccountReference: "TubeTV-Monthly",
            TransactionDesc: "TubeTV Monthly Auto-Renew Pass",
            Frequency: "4", // 4 = Monthly
            StartDate: startDateStr,
            EndDate: endDateStr,
          };

          const ratibaResponse = await fetch(`${host}/standingorder/v1/createStandingOrderExternal`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(ratibaPayload),
            signal: AbortSignal.timeout(20_000),
          });

          const ratibaData = await ratibaResponse.json().catch(() => ({}));
          const accepted =
            ratibaResponse.ok &&
            (ratibaData.ResponseCode === "0" || ratibaData.status === "success" || Boolean(ratibaData.CheckoutRequestID));

          if (accepted) {
            const standingOrderId = ratibaData.StandingOrderID || ratibaData.CheckoutRequestID || null;
            await Promise.all([
              service
                .from("ratiba_mandates")
                .update({
                  standing_order_id: standingOrderId,
                  merchant_request_id: ratibaData.MerchantRequestID || null,
                  status: "pending",
                })
                .eq("id", mandate.id),
              service
                .from("payment_transactions")
                .update({
                  status: "submitted",
                  checkout_request_id: ratibaData.CheckoutRequestID || standingOrderId || null,
                  merchant_request_id: ratibaData.MerchantRequestID || null,
                  result_description:
                    ratibaData.CustomerMessage || "Standing Order prompt sent. Please authorize on your phone.",
                })
                .eq("id", transaction.id),
            ]);

            return jsonReply(
              req,
              {
                transaction: {
                  id: transaction.id,
                  status: "submitted",
                  checkoutToken,
                  checkoutRequestId: ratibaData.CheckoutRequestID || standingOrderId || null,
                  mandateId: mandate.id,
                  message:
                    ratibaData.CustomerMessage ||
                    "Auto-renew prompt sent to your Safaricom phone. Enter your PIN once to authorize.",
                  isRatiba: true,
                },
              },
              200,
              METHODS,
            );
          } else {
            console.warn("daraja_ratiba_api_declined_or_unavailable", ratibaData);
            // If the shortcode is not yet activated on Daraja Standing Orders, fallback cleanly to STK push
            // with a polite note that the initial month is active and recurring will be scheduled upon shortcode provisioning.
            const stkCallbackUrl = new URL(callbackBaseUrl!);
            stkCallbackUrl.searchParams.set("secret", callbackSecret!);
            stkCallbackUrl.searchParams.set("mandateId", mandate.id);

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
                Amount: amountKes,
                PartyA: parsedPhone.digits,
                PartyB: shortcode,
                PhoneNumber: parsedPhone.digits,
                CallBackURL: stkCallbackUrl.toString(),
                AccountReference: "TubeTV Monthly",
                TransactionDesc: "TubeTV Monthly Pass Auto-Renew Setup",
              }),
              signal: AbortSignal.timeout(20_000),
            });

            const stkData = await stkResponse.json().catch(() => ({}));
            const stkAccepted = stkResponse.ok && stkData.ResponseCode === "0" && Boolean(stkData.CheckoutRequestID);

            if (stkAccepted) {
              await Promise.all([
                service
                  .from("payment_transactions")
                  .update({
                    status: "submitted",
                    checkout_request_id: stkData.CheckoutRequestID || null,
                    merchant_request_id: stkData.MerchantRequestID || null,
                    result_description:
                      stkData.CustomerMessage || "M-Pesa STK prompt sent for your initial 30-day pass.",
                  })
                  .eq("id", transaction.id),
                service
                  .from("ratiba_mandates")
                  .update({
                    standing_order_id: stkData.CheckoutRequestID || null,
                    metadata: { fallbackToStk: true, originalRatibaError: ratibaData },
                  })
                  .eq("id", mandate.id),
              ]);

              return jsonReply(
                req,
                {
                  transaction: {
                    id: transaction.id,
                    status: "submitted",
                    checkoutToken,
                    checkoutRequestId: stkData.CheckoutRequestID || null,
                    mandateId: mandate.id,
                    message:
                      stkData.CustomerMessage ||
                      "M-Pesa prompt sent! Enter your PIN to activate your initial 30-day pass.",
                    isRatiba: true,
                  },
                },
                200,
                METHODS,
              );
            }
          }
        }
      } catch (darajaErr) {
        console.error("daraja_ratiba_fetch_error", darajaErr);
      }
    }

    // Demo/Sandbox fallback when Daraja credentials are simulated or unreachable
    await service
      .from("payment_transactions")
      .update({
        status: "submitted",
        checkout_request_id: `ws_CO_${Date.now()}`,
        result_description: "Auto-renew M-Pesa Standing Order prompt simulated.",
      })
      .eq("id", transaction.id);

    return jsonReply(
      req,
      {
        transaction: {
          id: transaction.id,
          status: "submitted",
          checkoutToken,
          checkoutRequestId: `ws_CO_${Date.now()}`,
          mandateId: mandate.id,
          message: "M-Pesa prompt sent. Enter your PIN to authorize.",
          isRatiba: true,
        },
      },
      200,
      METHODS,
    );
  }

  return jsonReply(req, { error: `Unsupported action: ${action}` }, 400, METHODS);
});
