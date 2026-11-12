import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifiedAdminId } from "../_shared/admin.ts";
import { recordAdminMutation } from "../_shared/audit.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";

const METHODS = "POST, OPTIONS";
const MAX_ITEMS_PER_BATCH = 50;
const MIN_PAYOUT_KES = 1000; // mirrors MINIMUM_PAYOUT_THRESHOLD_KES
const MAX_SINGLE_PAYOUT_KES = 150_000; // hard safety cap per creator per batch

type Item = { creatorName: string; grossKes: number };
type Outcome = {
  creatorName: string;
  status: "initiated" | "skipped" | "failed";
  message: string;
  netKes?: number;
  reference?: string;
};

function normalizeKenyanMsisdn(raw: string): string | null {
  const cleaned = String(raw || "").replace(/[\s()-]/g, "").replace(/^\+/, "");
  if (/^254[17]\d{8}$/.test(cleaned)) return `0${cleaned.slice(3)}`;
  if (/^0[17]\d{8}$/.test(cleaned)) return cleaned;
  if (/^[17]\d{8}$/.test(cleaned)) return `0${cleaned}`;
  return null;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14) || "creator";
}

async function paystack(path: string, secret: string, body: unknown) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.status === true, json };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) });
  }
  if (req.method !== "POST") return jsonReply(req, { error: "Method not allowed." }, 405, METHODS);
  if (!isOriginAllowed(req)) return jsonReply(req, { error: "Origin not allowed." }, 403, METHODS);

  const adminId = await verifiedAdminId(req);
  if (!adminId) {
    return jsonReply(req, { ok: false, error: "Verified admin access is required." }, 200, METHODS);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return jsonReply(req, { ok: false, error: "Payout service is not configured." }, 200, METHODS);
  }
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "list");
  // Canonical period key: "November 2026 (Current)" and "November 2026" must be the SAME cycle,
  // otherwise relabelling a period would bypass the one-payout-per-period guard.
  const periodLabel = String(body.periodLabel || "").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

  // ─── List payout statuses for a period ───
  if (action === "list") {
    let query = service
      .from("creator_payouts")
      .select("creator_name, payout_rail, destination_hint, gross_kes, withholding_kes, amount_kes, reference, status, failure_reason, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (periodLabel) query = query.eq("period_label", periodLabel);
    const { data, error } = await query;
    if (error) return jsonReply(req, { ok: false, error: "Could not load payouts." }, 200, METHODS);
    return jsonReply(req, { ok: true, payouts: data || [], transfersConfigured: Boolean(paystackSecret) }, 200, METHODS);
  }

  if (action !== "disburse") {
    return jsonReply(req, { ok: false, error: "Unknown action." }, 200, METHODS);
  }

  // ─── Disburse ───
  if (!paystackSecret) {
    return jsonReply(req, { ok: false, error: "Paystack is not configured for transfers." }, 200, METHODS);
  }
  if (!periodLabel) {
    return jsonReply(req, { ok: false, error: "A payout period is required." }, 200, METHODS);
  }
  if (/all\s*time/i.test(periodLabel)) {
    return jsonReply(req, { ok: false, error: "Pick a single monthly cycle — 'All Time' can't be disbursed." }, 200, METHODS);
  }
  const rawItems = Array.isArray(body.items) ? (body.items as Item[]) : [];
  if (rawItems.length === 0 || rawItems.length > MAX_ITEMS_PER_BATCH) {
    return jsonReply(req, { ok: false, error: `Send between 1 and ${MAX_ITEMS_PER_BATCH} creators per batch.` }, 200, METHODS);
  }

  const dryRun = body.dryRun === true;
  const outcomes: Outcome[] = [];
  const seen = new Set<string>();

  for (const raw of rawItems) {
    const creatorName = String(raw?.creatorName || "").trim().slice(0, 160);
    const grossKes = Math.round(Number(raw?.grossKes));
    if (!creatorName || seen.has(creatorName.toLowerCase())) {
      outcomes.push({ creatorName: creatorName || "(blank)", status: "skipped", message: "Missing or duplicate creator." });
      continue;
    }
    seen.add(creatorName.toLowerCase());

    if (!Number.isFinite(grossKes) || grossKes < MIN_PAYOUT_KES) {
      outcomes.push({ creatorName, status: "skipped", message: `Below the KSh ${MIN_PAYOUT_KES} payout threshold.` });
      continue;
    }
    if (grossKes > MAX_SINGLE_PAYOUT_KES) {
      outcomes.push({
        creatorName,
        status: "skipped",
        message: `Exceeds the KSh ${MAX_SINGLE_PAYOUT_KES.toLocaleString()} safety cap — pay manually after review.`,
      });
      continue;
    }

    // Payout destination always comes from the saved directory, never from the browser.
    const { data: profile } = await service
      .from("creator_payout_profiles")
      .select("payout_rail, payout_account, withholding_tax_percent")
      .eq("creator_name", creatorName)
      .maybeSingle();
    if (!profile) {
      outcomes.push({ creatorName, status: "skipped", message: "No Payout Directory profile saved." });
      continue;
    }
    if (!/m-?pesa/i.test(String(profile.payout_rail || ""))) {
      outcomes.push({ creatorName, status: "skipped", message: "Rail is not M-Pesa — use the Batch CSV for this creator." });
      continue;
    }
    const msisdn = normalizeKenyanMsisdn(String(profile.payout_account || ""));
    if (!msisdn) {
      outcomes.push({ creatorName, status: "skipped", message: "Saved M-Pesa number is invalid." });
      continue;
    }

    const whtPercent = Math.min(100, Math.max(0, Number(profile.withholding_tax_percent) || 0));
    const withholdingKes = Math.round(grossKes * (whtPercent / 100));
    const netKes = grossKes - withholdingKes;
    if (netKes <= 0) {
      outcomes.push({ creatorName, status: "skipped", message: "Net amount after withholding tax is zero." });
      continue;
    }

    if (dryRun) {
      outcomes.push({ creatorName, status: "skipped", message: `Dry run OK → KSh ${netKes.toLocaleString()} to ${msisdn.slice(0, 4)}***${msisdn.slice(-2)}`, netKes });
      continue;
    }

    // Idempotency: the partial unique index (period, creator) blocks double payment.
    const reference = `tubepay_${slug(periodLabel)}_${slug(creatorName)}_${crypto.randomUUID().slice(0, 8)}`.slice(0, 50);
    const hint = `${msisdn.slice(0, 4)}***${msisdn.slice(-2)}`;
    const { error: insertError } = await service.from("creator_payouts").insert({
      period_label: periodLabel,
      creator_name: creatorName,
      payout_rail: "M-Pesa B2C (Kenya)",
      destination_hint: hint,
      gross_kes: grossKes,
      withholding_kes: withholdingKes,
      amount_kes: netKes,
      reference,
      status: "pending",
      initiated_by: adminId,
    });
    if (insertError) {
      const duplicate = insertError.code === "23505";
      outcomes.push({
        creatorName,
        status: "skipped",
        message: duplicate ? "Already paid or in-flight for this period." : "Could not record payout.",
      });
      continue;
    }

    const failRow = async (message: string) => {
      await service
        .from("creator_payouts")
        .update({ status: "failed", failure_reason: message.slice(0, 300), updated_at: new Date().toISOString() })
        .eq("reference", reference);
      outcomes.push({ creatorName, status: "failed", message, netKes, reference });
    };

    try {
      const recipient = await paystack("/transferrecipient", paystackSecret, {
        type: "mobile_money",
        name: creatorName.slice(0, 100),
        account_number: msisdn,
        bank_code: "MPESA",
        currency: "KES",
      });
      const recipientCode = recipient.json?.data?.recipient_code;
      if (!recipient.ok || !recipientCode) {
        await failRow(String(recipient.json?.message || "Could not create transfer recipient."));
        continue;
      }

      const transfer = await paystack("/transfer", paystackSecret, {
        source: "balance",
        amount: netKes * 100,
        currency: "KES",
        recipient: recipientCode,
        reason: `TubeTV creator royalty (${periodLabel})`.slice(0, 100),
        reference,
      });
      if (!transfer.ok) {
        await failRow(String(transfer.json?.message || "Transfer was rejected."));
        continue;
      }

      const transferStatus = String(transfer.json?.data?.status || "pending");
      const mapped = transferStatus === "success" ? "success" : transferStatus === "otp" ? "otp" : "pending";
      await service
        .from("creator_payouts")
        .update({
          status: mapped,
          recipient_code: recipientCode,
          transfer_code: transfer.json?.data?.transfer_code || null,
          updated_at: new Date().toISOString(),
        })
        .eq("reference", reference);
      outcomes.push({
        creatorName,
        status: "initiated",
        message:
          mapped === "otp"
            ? "Paystack requires OTP approval — disable transfer OTP in Paystack settings or approve in the dashboard."
            : mapped === "success"
              ? `Sent KSh ${netKes.toLocaleString()} to ${hint}.`
              : `Queued KSh ${netKes.toLocaleString()} to ${hint}. Final status arrives by webhook.`,
        netKes,
        reference,
      });
    } catch (err) {
      await failRow(err instanceof Error ? `Network error: ${err.message.slice(0, 100)}` : "Network error.");
    }
  }

  if (!dryRun) {
    await recordAdminMutation(
      adminId,
      "creator_payout_disburse",
      periodLabel,
      outcomes.some((o) => o.status === "initiated"),
    );
  }
  return jsonReply(req, { ok: true, dryRun, outcomes }, 200, METHODS);
});
