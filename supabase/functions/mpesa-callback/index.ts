import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const PLAN_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };

function metadataValue(items: Array<{ Name: string; Value?: unknown }> = [], name: string) {
  return items.find((item) => item.Name === name)?.Value;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expectedSecret = Deno.env.get("MPESA_CALLBACK_SECRET") || "";
  const suppliedSecret = new URL(req.url).searchParams.get("secret") || "";
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return new Response("Forbidden", { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  const callback = payload?.Body?.stkCallback;
  if (!callback?.CheckoutRequestID) return new Response("Invalid callback", { status: 400 });

  const service = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: transaction } = await service
    .from("payment_transactions")
    .select("*")
    .eq("checkout_request_id", callback.CheckoutRequestID)
    .maybeSingle();
  if (!transaction) {
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const resultCode = Number(callback.ResultCode);
  if (resultCode !== 0) {
    await service.from("payment_transactions").update({
      status: resultCode === 1032 ? "cancelled" : "failed",
      result_code: resultCode,
      result_description: String(callback.ResultDesc || "Payment failed."),
    }).eq("id", transaction.id);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const items = callback.CallbackMetadata?.Item || [];
  const amount = Number(metadataValue(items, "Amount"));
  const receipt = String(metadataValue(items, "MpesaReceiptNumber") || "");
  const phone = String(metadataValue(items, "PhoneNumber") || "").replace(/\D/g, "");
  const expectedPhone = String(transaction.phone_e164).replace(/\D/g, "");
  if (amount !== transaction.amount_kes || !receipt || phone !== expectedPhone) {
    await service.from("payment_transactions").update({
      status: "failed",
      result_code: -1,
      result_description: "Callback details did not match the payment request.",
    }).eq("id", transaction.id);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (transaction.status === "succeeded") {
    const { data: existingEntitlement } = await service
      .from("subscriptions")
      .select("id")
      .eq("user_id", transaction.user_id)
      .eq("mpesa_ref", receipt)
      .maybeSingle();
    if (existingEntitlement) {
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  await service.from("payment_transactions").update({
    status: "succeeded",
    mpesa_receipt: receipt,
    result_code: 0,
    result_description: "Payment received.",
  }).eq("id", transaction.id);

  const { data: current } = await service
    .from("subscriptions")
    .select("id, end_date")
    .eq("user_id", transaction.user_id)
    .eq("is_active", true)
    .maybeSingle();
  const now = new Date();
  const base = current?.end_date && new Date(current.end_date) > now ? new Date(current.end_date) : now;
  base.setUTCDate(base.getUTCDate() + (PLAN_DAYS[transaction.plan_code] || 1));
  if (current) {
    await service.from("subscriptions").update({ is_active: false, updated_at: now.toISOString() }).eq("id", current.id);
  }
  const { error: subscriptionError } = await service.from("subscriptions").insert({
    user_id: transaction.user_id,
    phone: transaction.phone_e164,
    tier: transaction.plan_code,
    mpesa_ref: receipt,
    start_date: now.toISOString(),
    end_date: base.toISOString(),
    is_active: true,
  });
  if (subscriptionError) {
    console.error("Entitlement activation failed", subscriptionError);
    return new Response("Retry callback", { status: 500 });
  }

  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
    headers: { "Content-Type": "application/json" },
  });
});
