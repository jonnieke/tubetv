import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { constantTimeSecretEquals } from "../_shared/passToken.ts";

async function verifyPaystackSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret || !rawBody) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return await constantTimeSecretEquals(computedSignature.toLowerCase(), signature.toLowerCase());
  } catch (error) {
    console.error("paystack_signature_verify_error", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!paystackSecret || !supabaseUrl || !serviceKey) {
    return new Response("Configuration missing", { status: 503 });
  }

  const signature = req.headers.get("x-paystack-signature") || "";
  const rawBody = await req.text();

  const isValid = await verifyPaystackSignature(rawBody, signature, paystackSecret);
  if (!isValid) {
    console.warn("invalid_paystack_webhook_signature");
    return new Response("Unauthorized signature", { status: 401 });
  }

  const payload = (() => {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  })();

  if (!payload || !payload.event) {
    return new Response("Invalid payload", { status: 400 });
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (payload.event === "charge.success") {
    const data = payload.data || {};
    const reference = String(data.reference || "").trim().toUpperCase();
    const amountKes = Math.round(Number(data.amount || 0) / 100);
    const channel = String(data.channel || "card");
    const paidAt = data.paid_at ? new Date(data.paid_at).toISOString() : new Date().toISOString();
    const customerEmail = data.customer?.email || null;
    const phone = data.customer?.phone || data.metadata?.phone || null;

    if (reference && amountKes > 0) {
      const { data: rpcResult, error: rpcError } = await service.rpc("fulfill_paystack_payment", {
        p_reference: reference,
        p_amount_kes: amountKes,
        p_channel: channel,
        p_paid_at: paidAt,
        p_customer_email: customerEmail,
        p_phone: phone,
      });

      if (rpcError) {
        console.error("paystack_webhook_fulfill_error", rpcError);
        return new Response("Retry webhook", { status: 500 });
      }

      if (rpcResult?.ok && !rpcResult?.reused) {
        await service.from("analytics_events").insert({
          event_name: "subscription_activated",
          properties: {
            tier: String(rpcResult.tier || ""),
            amountKes,
            provider: "paystack",
            channel,
          },
          page_path: "/paystack/webhook",
          occurred_at: new Date().toISOString(),
        });
      }
    }
  }

  // Acknowledge receipt to Paystack
  return new Response(JSON.stringify({ status: "success" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

