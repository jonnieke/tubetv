import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { constantTimeSecretEquals } from "../_shared/passToken.ts";

function metadataValue(items: Array<{ Name: string; Value?: unknown }> = [], name: string) {
  return items.find((item) => item.Name === name)?.Value;
}

function getCallerIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

async function verifyCheckoutUpstream(checkoutRequestId: string): Promise<boolean> {
  const environment = Deno.env.get("MPESA_ENV") === "production" ? "production" : "sandbox";
  const shouldVerify = Deno.env.get("MPESA_VERIFY_UPSTREAM") !== "false" && environment === "production";
  if (!shouldVerify) return true;

  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
  const shortcode = Deno.env.get("MPESA_SHORTCODE");
  const passkey = Deno.env.get("MPESA_PASSKEY");
  if (!consumerKey || !consumerSecret || !shortcode || !passkey) return false;

  try {
    const host = "https://api.safaricom.co.ke";
    const tokenResp = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResp.ok) return false;
    const { access_token: accessToken } = await tokenResp.json();
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const queryResp = await fetch(`${host}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!queryResp.ok) return false;
    const data = await queryResp.json();
    return String(data.ResultCode) === "0";
  } catch (err) {
    console.error("mpesa_upstream_verify_error", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Optional IP allowlist when configured for Safaricom Daraja egress IPs
  const configuredIps = (Deno.env.get("MPESA_ALLOWED_IPS") || "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (configuredIps.length > 0) {
    const callerIp = getCallerIp(req);
    if (!callerIp || !configuredIps.includes(callerIp)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const expectedSecret = Deno.env.get("MPESA_CALLBACK_SECRET") || "";
  const suppliedSecret =
    req.headers.get("X-Callback-Secret") || new URL(req.url).searchParams.get("secret") || "";

  if (!(await constantTimeSecretEquals(suppliedSecret, expectedSecret))) {
    return new Response("Forbidden", { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  const callback = payload?.Body?.stkCallback;
  const checkoutRequestId = typeof callback?.CheckoutRequestID === "string" ? callback.CheckoutRequestID.trim() : "";
  if (!checkoutRequestId || checkoutRequestId.length > 120) {
    return new Response("Invalid callback", { status: 400 });
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const resultCode = Number(callback.ResultCode);
  if (resultCode !== 0) {
    const { data: failedTx } = await service
      .from("payment_transactions")
      .update({
        status: resultCode === 1032 ? "cancelled" : "failed",
        result_code: Number.isFinite(resultCode) ? resultCode : -1,
        result_description: String(callback.ResultDesc || "Payment failed.").slice(0, 240),
      })
      .eq("checkout_request_id", checkoutRequestId)
      .neq("status", "succeeded")
      .select("plan_code")
      .maybeSingle();

    if (failedTx) {
      await service.from("analytics_events").insert({
        event_name: "checkout_failed",
        properties: { plan: failedTx.plan_code, resultCode: Number.isFinite(resultCode) ? resultCode : -1 },
        page_path: "/mpesa/callback",
        occurred_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const items = Array.isArray(callback.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
  const amount = Math.round(Number(metadataValue(items, "Amount")));
  const receipt = String(metadataValue(items, "MpesaReceiptNumber") || "").trim().toUpperCase();
  const phoneDigits = String(metadataValue(items, "PhoneNumber") || "").replace(/\D/g, "");

  if (!Number.isFinite(amount) || amount <= 0 || !receipt || !phoneDigits) {
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstreamConfirmed = await verifyCheckoutUpstream(checkoutRequestId);
  if (!upstreamConfirmed) {
    console.error("mpesa_upstream_verification_rejected", { checkoutRequestId });
    return new Response("Upstream verification pending", { status: 502 });
  }

  const { data: rpcResult, error: rpcError } = await service.rpc("fulfill_mpesa_payment", {
    p_checkout_request_id: checkoutRequestId,
    p_amount_kes: amount,
    p_receipt: receipt,
    p_phone_digits: phoneDigits,
  });

  if (rpcError) {
    console.error("mpesa_fulfill_rpc_error", rpcError);
    return new Response("Retry callback", { status: 500 });
  }

  if (rpcResult?.ok && !rpcResult?.reused) {
    await service.from("analytics_events").insert({
      event_name: "subscription_activated",
      properties: { tier: String(rpcResult.tier || ""), amountKes: amount },
      page_path: "/mpesa/callback",
      occurred_at: new Date().toISOString(),
    });
  }

  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
    headers: { "Content-Type": "application/json" },
  });
});
