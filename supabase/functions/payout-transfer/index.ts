import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY is not configured.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization token." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify requesting creator user
    const userClient = createClient(SUPABASE_URL, req.headers.get("apikey") || "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { amount, phone_number } = body;

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount < 500) {
      return new Response(
        JSON.stringify({ error: "Minimum withdrawal amount is KES 500.00." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check Available Balance via RPC
    const { data: metrics, error: metricsErr } = await supabaseAdmin.rpc("get_creator_metrics", {
      p_creator_id: user.id,
    });

    if (metricsErr || !metrics) {
      throw new Error("Could not calculate creator metrics.");
    }

    if (Number(metrics.available_balance_kes) < withdrawAmount) {
      return new Response(
        JSON.stringify({
          error: `Insufficient balance. Available: KES ${metrics.available_balance_kes}, Requested: KES ${withdrawAmount}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Format Safaricom M-Pesa Phone Number (2547XXXXXXXX or 2541XXXXXXXX)
    let sanitizedPhone = String(phone_number || "").trim().replace(/\D/g, "");
    if (sanitizedPhone.startsWith("0")) {
      sanitizedPhone = `254${sanitizedPhone.slice(1)}`;
    } else if (sanitizedPhone.startsWith("+254")) {
      sanitizedPhone = sanitizedPhone.replace("+", "");
    }

    if (!/^254[71]\d{8}$/.test(sanitizedPhone)) {
      return new Response(
        JSON.stringify({ error: "Invalid Safaricom M-Pesa number. Must be format 2547XXXXXXXX or 2541XXXXXXXX." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch or Create Paystack Recipient Code
    const { data: profile } = await supabaseAdmin
      .from("creator_profiles")
      .select("paystack_recipient_code, legal_name, display_name")
      .eq("id", user.id)
      .maybeSingle();

    let recipientCode = profile?.paystack_recipient_code;

    if (!recipientCode) {
      const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "mobile_money",
          name: profile?.legal_name || profile?.display_name || "TubeTV Creator",
          account_number: sanitizedPhone,
          bank_code: "MPESA",
          currency: "KES",
        }),
      });

      const recipientData = await recipientRes.json();
      if (!recipientRes.ok || !recipientData.status) {
        throw new Error(recipientData.message || "Failed to create M-Pesa transfer recipient with Paystack.");
      }

      recipientCode = recipientData.data.recipient_code;

      // Update creator profile with recipient code
      await supabaseAdmin
        .from("creator_profiles")
        .update({
          paystack_recipient_code: recipientCode,
          phone_number: sanitizedPhone,
        })
        .eq("id", user.id);
    }

    // 4. Record Payout Request in database
    const { data: payoutRow, error: payoutInsertErr } = await supabaseAdmin
      .from("payout_requests")
      .insert({
        creator_id: user.id,
        amount: withdrawAmount,
        currency: "KES",
        payout_method: "mpesa",
        payout_destination: sanitizedPhone,
        status: "processing",
      })
      .select()
      .single();

    if (payoutInsertErr || !payoutRow) {
      throw new Error(`Failed to record payout request: ${payoutInsertErr?.message}`);
    }

    // 5. Initiate Paystack Transfer (M-Pesa B2C)
    // Note: Paystack KES amounts are in subunits (KES * 100)
    const amountInSubunits = Math.round(withdrawAmount * 100);
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amountInSubunits,
        recipient: recipientCode,
        reason: `TubeTV Creator Payout - #${payoutRow.id.slice(0, 8)}`,
        reference: `PAYOUT-${payoutRow.id}`,
      }),
    });

    const transferData = await transferRes.json();

    if (!transferRes.ok || !transferData.status) {
      // Mark as failed so creator balance is not locked
      await supabaseAdmin
        .from("payout_requests")
        .update({
          status: "failed",
          failure_reason: transferData.message || "Paystack transfer initiation error",
        })
        .eq("id", payoutRow.id);

      throw new Error(transferData.message || "Paystack transfer initiation failed.");
    }

    // Update with Paystack transfer code
    await supabaseAdmin
      .from("payout_requests")
      .update({
        paystack_transfer_code: transferData.data.transfer_code,
        paystack_reference: transferData.data.reference,
        status: transferData.data.status === "success" ? "paid" : "processing",
        processed_at: new Date().toISOString(),
      })
      .eq("id", payoutRow.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "M-Pesa withdrawal initiated successfully.",
        payout_id: payoutRow.id,
        status: transferData.data.status,
        amount: withdrawAmount,
        destination: sanitizedPhone,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
