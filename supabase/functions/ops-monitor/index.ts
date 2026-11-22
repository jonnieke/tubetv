import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { verifiedAdminId } from "../_shared/admin.ts";
import { constantTimeSecretEquals } from "../_shared/passToken.ts";

const METHODS = "GET, POST, OPTIONS";
const errorRateCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_ERROR_REPORTS_PER_IP_MIN = 12;

const PLAN_DURATION_HOURS: Record<string, number> = {
  daily: 24,
  weekly: 24 * 7,
  monthly: 24 * 30,
};

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon"
  ).slice(0, 64);
}

function isErrorRateLimited(ip: string): boolean {
  const now = Date.now();
  if (errorRateCounts.size > 5000) {
    for (const [k, v] of errorRateCounts.entries()) {
      if (now > v.resetAt) errorRateCounts.delete(k);
    }
  }
  const rec = errorRateCounts.get(ip);
  if (!rec || now > rec.resetAt) {
    errorRateCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ERROR_REPORTS_PER_IP_MIN;
}

async function isAuthorizedOpsCaller(req: Request): Promise<boolean> {
  const providedSecret = (req.headers.get("x-cron-secret") || req.headers.get("x-ops-secret") || "").trim();
  const expectedCron = (Deno.env.get("OPS_CRON_SECRET") || Deno.env.get("NOTIFY_CRON_SECRET") || "").trim();
  if (providedSecret && expectedCron && (await constantTimeSecretEquals(providedSecret, expectedCron))) {
    return true;
  }
  const adminId = await verifiedAdminId(req);
  return Boolean(adminId);
}

async function sendOpsAlert(title: string, details: string): Promise<void> {
  const webhookUrl = (Deno.env.get("OPS_ALERT_WEBHOOK_URL") || "").trim();
  if (!webhookUrl || !/^https:\/\//i.test(webhookUrl)) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 *TubeTV Ops Alert*: ${title}\n${details}`,
        content: `🚨 **TubeTV Ops Alert**: ${title}\n${details}`,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    console.error("ops_alert_webhook_error", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) });
  }
  if (!isOriginAllowed(req)) {
    return jsonReply(req, { error: "Origin not allowed." }, 403, METHODS);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return jsonReply(req, { error: "Ops monitor is not configured." }, 503, METHODS);
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ─── GET /ops-monitor -> lightweight public liveness + DB ping ───
  if (req.method === "GET") {
    const t0 = Date.now();
    const { error: dbErr } = await service.from("show_sponsorships").select("id").limit(1);
    const dbMs = Date.now() - t0;
    const status = dbErr ? "degraded" : "ok";
    return jsonReply(
      req,
      { status, dbLatencyMs: dbMs, timestamp: new Date().toISOString() },
      dbErr ? 503 : 200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  if (req.method !== "POST") {
    return jsonReply(req, { error: "Method not allowed." }, 405, METHODS);
  }

  const rawText = await req.text();
  if (rawText.length > 12_000) {
    return jsonReply(req, { error: "Payload too large." }, 413, METHODS);
  }
  const body = (() => {
    try {
      return JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();
  if (!body || typeof body.action !== "string") {
    return jsonReply(req, { error: "Invalid request." }, 400, METHODS);
  }

  const action = body.action.trim();

  // ─── 1. Public rate-limited frontend crash/error intake ───
  if (action === "report_error") {
    const clientIp = getClientIp(req);
    if (isErrorRateLimited(clientIp)) {
      return jsonReply(req, { ok: false, error: "Rate limited." }, 429, METHODS);
    }
    const message = String(body.message || "").trim().slice(0, 500);
    if (!message) {
      return jsonReply(req, { error: "Error message is required." }, 400, METHODS);
    }
    const source = String(body.source || "error_boundary").trim().slice(0, 60);
    const stack = typeof body.stack === "string" ? body.stack.slice(0, 2500) : null;
    const pagePath = typeof body.pagePath === "string" ? body.pagePath.slice(0, 200) : null;
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 240);
    const fingerprint = `${source}:${message.slice(0, 120)}`;

    const { error } = await service.from("client_error_logs").insert({
      fingerprint,
      source,
      message,
      stack,
      page_path: pagePath,
      user_agent: userAgent,
      client_ip: clientIp,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });

    if (error) {
      console.error("client_error_insert_failed", error);
      return jsonReply(req, { ok: false }, 503, METHODS);
    }
    return jsonReply(req, { ok: true }, 202, METHODS, { "Cache-Control": "no-store" });
  }

  // ─── Privileged Ops Actions (Cron Secret OR Verified Admin MFA) ───
  if (!(await isAuthorizedOpsCaller(req))) {
    return jsonReply(req, { error: "Unauthorized ops request." }, 403, METHODS);
  }

  // ─── 2. Health Check (Catalogue CDN + Postgres + Recent Error Spike) ───
  if (action === "health_check") {
    const siteUrl = (Deno.env.get("SITE_URL") || "https://www.tube.co.ke").replace(/\/$/, "");
    const t0 = Date.now();
    let catalogueStatus = 0;
    let catalogueMs = 0;
    try {
      const catRes = await fetch(`${siteUrl}/api/catalogue?page=1&itemsPerPage=10`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      catalogueStatus = catRes.status;
      await catRes.text();
      catalogueMs = Date.now() - t0;
    } catch {
      catalogueMs = Date.now() - t0;
    }

    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentErrors } = await service
      .from("client_error_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since1h);

    const healthy = catalogueStatus === 200;
    if (!healthy) {
      await sendOpsAlert("Catalogue Health Check Failed", `GET ${siteUrl}/api/catalogue returned HTTP ${catalogueStatus} (${catalogueMs}ms)`);
    } else if ((recentErrors || 0) >= 25) {
      await sendOpsAlert("Client Error Spike", `${recentErrors} client errors logged in the last 60 minutes.`);
    }

    return jsonReply(
      req,
      {
        ok: healthy,
        catalogueStatus,
        catalogueMs,
        recentErrorsLastHour: recentErrors || 0,
        checkedAt: new Date().toISOString(),
      },
      healthy ? 200 : 503,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  // ─── 3. Payment Reconciliation (Auto-Recover Missed Paystack Webhooks & Alert on Stuck M-Pesa) ───
  if (action === "reconcile_payments") {
    const paystackSecret = (Deno.env.get("PAYSTACK_SECRET_KEY") || "").trim();
    const cutoffRecent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const cutoffOld = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: stuckRows, error: queryErr } = await service
      .from("payment_transactions")
      .select("id, user_id, phone, plan_code, amount_kes, status, provider, paystack_reference, checkout_request_id, created_at")
      .in("status", ["pending", "submitted"])
      .lte("created_at", cutoffRecent)
      .gte("created_at", cutoffOld)
      .order("created_at", { ascending: true })
      .limit(50);

    if (queryErr) {
      console.error("reconcile_query_error", queryErr);
      return jsonReply(req, { error: "Could not query stuck transactions." }, 503, METHODS);
    }

    const stuck = stuckRows || [];
    let recoveredCount = 0;
    let stillStuckCount = 0;
    const details: Array<Record<string, unknown>> = [];

    for (const tx of stuck) {
      const ref = String(tx.paystack_reference || "").trim();
      if (paystackSecret && ref) {
        try {
          const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
            headers: { Authorization: `Bearer ${paystackSecret}`, Accept: "application/json" },
            signal: AbortSignal.timeout(8_000),
          });
          const verifyJson = await verifyRes.json().catch(() => ({}));
          const psStatus = String(verifyJson?.data?.status || "").toLowerCase();

          if (verifyRes.ok && psStatus === "success") {
            const hours = PLAN_DURATION_HOURS[String(tx.plan_code || "monthly")] || 24 * 30;
            const endDate = new Date(Date.now() + hours * 3600 * 1000).toISOString();

            await service
              .from("payment_transactions")
              .update({ status: "succeeded", result_description: "Auto-reconciled via Paystack verify" })
              .eq("id", tx.id);

            await service.from("subscriptions").insert({
              user_id: tx.user_id || null,
              tier: tx.plan_code || "monthly",
              is_active: true,
              end_date: endDate,
              mpesa_ref: ref,
              phone: tx.phone || null,
            });

            recoveredCount += 1;
            details.push({ id: tx.id, ref, outcome: "recovered_paystack" });
            continue;
          } else if (verifyRes.ok && (psStatus === "failed" || psStatus === "abandoned")) {
            await service
              .from("payment_transactions")
              .update({ status: "failed", result_description: `Reconciled as ${psStatus}` })
              .eq("id", tx.id);
            details.push({ id: tx.id, ref, outcome: `marked_${psStatus}` });
            continue;
          }
        } catch (err) {
          console.error("reconcile_paystack_error", ref, err);
        }
      }

      stillStuckCount += 1;
      details.push({
        id: tx.id,
        provider: tx.provider || (ref ? "paystack" : "mpesa"),
        ref: ref || tx.checkout_request_id || tx.id,
        amountKes: tx.amount_kes,
        createdAt: tx.created_at,
        outcome: "still_stuck",
      });
    }

    await service.from("payment_reconciliation_runs").insert({
      checked_count: stuck.length,
      recovered_count: recoveredCount,
      still_stuck_count: stillStuckCount,
      details,
    });

    if (recoveredCount > 0 || stillStuckCount >= 3) {
      await sendOpsAlert(
        "Payment Reconciliation Summary",
        `Checked: ${stuck.length} | Auto-Recovered: ${recoveredCount} | Still Stuck: ${stillStuckCount}`,
      );
    }

    return jsonReply(
      req,
      {
        ok: true,
        checkedCount: stuck.length,
        recoveredCount,
        stillStuckCount,
        details,
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  return jsonReply(req, { error: "Unknown action." }, 400, METHODS);
});
