import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifiedAdminId } from "../_shared/admin.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { claimAndSendReceipt, deliverPassMessage, notificationsConfigured } from "../_shared/notify.ts";
import { constantTimeSecretEquals } from "../_shared/passToken.ts";

const METHODS = "POST, OPTIONS";
const REMINDER_WINDOW_MS = 60 * 60 * 1000; // remind when <= 60 min remain
const MAX_PER_SWEEP = 200;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) });
  }
  if (req.method !== "POST") return jsonReply(req, { error: "Method not allowed." }, 405, METHODS);
  if (!isOriginAllowed(req)) return jsonReply(req, { error: "Origin not allowed." }, 403, METHODS);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return jsonReply(req, { error: "Service not configured." }, 503, METHODS);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "sweep");

  // Auth: scheduler secret (cron) or a verified MFA admin (manual run / test message).
  const cronSecret = Deno.env.get("NOTIFY_CRON_SECRET") || "";
  const provided = req.headers.get("x-cron-secret") || "";
  const isCron = Boolean(cronSecret && provided && (await constantTimeSecretEquals(provided, cronSecret)));
  const adminId = isCron ? null : await verifiedAdminId(req);
  if (!isCron && !adminId) {
    return jsonReply(req, { error: "Scheduler secret or verified admin access required." }, 403, METHODS);
  }

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (action === "status") {
    const { data: recent } = await service
      .from("notification_log")
      .select("kind, channel, status, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    return jsonReply(req, { ok: true, configured: notificationsConfigured(), recent: recent || [] }, 200, METHODS);
  }

  if (action === "test") {
    if (!adminId) return jsonReply(req, { ok: false, error: "Test messages require an admin session." }, 200, METHODS);
    const delivered = await deliverPassMessage(service, {
      subscriptionId: null,
      phone: body.phone,
      kind: "test",
      tier: "daily",
      expiresAtMs: Date.now() + 3600_000,
    });
    return jsonReply(req, { ok: true, delivered, configured: notificationsConfigured() }, 200, METHODS);
  }

  // ─── Sweep: (1) receipts missed by inline triggers, (2) expiry reminders ───
  const configured = notificationsConfigured();
  if (!configured.sms && !configured.whatsapp) {
    return jsonReply(req, { ok: true, skipped: "no_channel_configured", receipts: 0, reminders: 0 }, 200, METHODS);
  }

  let receipts = 0;
  let reminders = 0;

  const { data: pendingReceipts } = await service
    .from("subscriptions")
    .select("id")
    .eq("is_active", true)
    .not("phone", "is", null)
    .is("receipt_notified_at", null)
    .gt("created_at", new Date(Date.now() - 45 * 60 * 1000).toISOString())
    .gt("end_date", new Date().toISOString())
    .limit(MAX_PER_SWEEP);
  for (const row of pendingReceipts || []) {
    if (await claimAndSendReceipt(service, row.id)) receipts += 1;
  }

  const now = Date.now();
  const { data: expiring } = await service
    .from("subscriptions")
    .select("id")
    .eq("is_active", true)
    .not("phone", "is", null)
    .is("expiry_notified_at", null)
    .gt("end_date", new Date(now + 60_000).toISOString())
    .lte("end_date", new Date(now + REMINDER_WINDOW_MS).toISOString())
    .limit(MAX_PER_SWEEP);

  for (const row of expiring || []) {
    const { data: claimed } = await service
      .from("subscriptions")
      .update({ expiry_notified_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("expiry_notified_at", null)
      .select("id, phone, tier, end_date")
      .maybeSingle();
    if (!claimed) continue;
    const delivered = await deliverPassMessage(service, {
      subscriptionId: claimed.id,
      phone: claimed.phone,
      kind: "expiry_reminder",
      tier: claimed.tier,
      expiresAtMs: Date.parse(claimed.end_date),
    });
    if (delivered) reminders += 1;
  }

  return jsonReply(req, { ok: true, receipts, reminders }, 200, METHODS);
});
