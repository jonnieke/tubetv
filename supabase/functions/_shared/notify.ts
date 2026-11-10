import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type NotifyKind = "receipt" | "expiry_reminder" | "test";

const SITE_URL = (Deno.env.get("PAYSTACK_SITE_URL") || Deno.env.get("SITE_URL") || "https://www.tube.co.ke").replace(/\/$/, "");

/** Normalises Kenyan (07xx / 01xx) and international numbers to digits-only E.164 (no plus). */
export function toWhatsAppDigits(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[\s()-]/g, "");
  if (/^\+?254[17]\d{8}$/.test(cleaned)) return cleaned.replace(/^\+/, "");
  if (/^0[17]\d{8}$/.test(cleaned)) return `254${cleaned.slice(1)}`;
  if (/^[17]\d{8}$/.test(cleaned)) return `254${cleaned}`;
  const digits = cleaned.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

function maskPhone(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 3)}***${digits.slice(-2)}` : "***";
}

function tierLabel(tier: string): string {
  const t = String(tier || "").toLowerCase();
  return t === "daily" ? "Daily" : t === "weekly" ? "Weekly" : t === "monthly" ? "Monthly" : "TubeTV";
}

function formatEat(ms: number): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

export function buildMessage(kind: NotifyKind, tier: string, expiresAtMs: number): string {
  if (kind === "expiry_reminder") {
    return `TubeTV: Your ${tierLabel(tier)} Pass ends at ${formatEat(expiresAtMs)}. Renew in seconds with M-Pesa or card: ${SITE_URL}`;
  }
  if (kind === "test") {
    return `TubeTV: Test message. Notifications are working. ${SITE_URL}`;
  }
  return `TubeTV: Your ${tierLabel(tier)} Pass is active until ${formatEat(expiresAtMs)}. Watch now: ${SITE_URL} . On a new phone? Tap Restore Pass and enter this number.`;
}

async function sendWhatsApp(
  digits: string,
  kind: NotifyKind,
  tier: string,
  expiresAtMs: number,
): Promise<{ ok: boolean; detail: string } | null> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  const template =
    kind === "expiry_reminder" ? Deno.env.get("WHATSAPP_TEMPLATE_EXPIRY") : Deno.env.get("WHATSAPP_TEMPLATE_RECEIPT");
  if (!token || !phoneId || !template) return null; // Not configured

  const lang = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "en";
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digits,
        type: "template",
        template: {
          name: template,
          language: { code: lang },
          // Template body variables: {{1}} = tier, {{2}} = expiry time, {{3}} = site URL
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: tierLabel(tier) },
                { type: "text", text: formatEat(expiresAtMs) },
                { type: "text", text: SITE_URL },
              ],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, detail: "whatsapp_accepted" };
    return { ok: false, detail: `whatsapp_${res.status}:${String(body?.error?.message || "error").slice(0, 120)}` };
  } catch (err) {
    return { ok: false, detail: `whatsapp_exception:${err instanceof Error ? err.message.slice(0, 80) : "unknown"}` };
  }
}

async function sendSms(digits: string, message: string): Promise<{ ok: boolean; detail: string } | null> {
  const username = Deno.env.get("AT_USERNAME");
  const apiKey = Deno.env.get("AT_API_KEY");
  if (!username || !apiKey) return null; // Not configured

  const base =
    username === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
  const form = new URLSearchParams({ username, to: `+${digits}`, message });
  const sender = Deno.env.get("AT_SENDER_ID");
  if (sender) form.set("from", sender);

  try {
    const res = await fetch(`${base}/version1/messaging`, {
      method: "POST",
      headers: { apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    const recipient = body?.SMSMessageData?.Recipients?.[0];
    if (res.ok && recipient && /success|sent/i.test(String(recipient.status))) {
      return { ok: true, detail: "sms_accepted" };
    }
    return { ok: false, detail: `sms_${res.status}:${String(recipient?.status || body?.SMSMessageData?.Message || "error").slice(0, 120)}` };
  } catch (err) {
    return { ok: false, detail: `sms_exception:${err instanceof Error ? err.message.slice(0, 80) : "unknown"}` };
  }
}

export function notificationsConfigured(): { whatsapp: boolean; sms: boolean } {
  return {
    whatsapp: Boolean(Deno.env.get("WHATSAPP_TOKEN") && Deno.env.get("WHATSAPP_PHONE_ID")),
    sms: Boolean(Deno.env.get("AT_USERNAME") && Deno.env.get("AT_API_KEY")),
  };
}

/**
 * Delivers one pass notification. WhatsApp is preferred when configured; SMS is the fallback.
 * Always writes a notification_log row. Returns true when a channel accepted the message.
 */
export async function deliverPassMessage(
  service: SupabaseClient,
  opts: { subscriptionId: string | null; phone: unknown; kind: NotifyKind; tier: string; expiresAtMs: number },
): Promise<boolean> {
  const digits = toWhatsAppDigits(opts.phone);
  const log = async (channel: "sms" | "whatsapp" | "none", status: "sent" | "failed" | "skipped", detail: string) => {
    await service.from("notification_log").insert({
      subscription_id: opts.subscriptionId,
      kind: opts.kind,
      channel,
      recipient_hint: digits ? maskPhone(digits) : null,
      status,
      detail,
    });
  };

  if (!digits) {
    await log("none", "skipped", "no_phone_on_pass");
    return false;
  }

  const wa = await sendWhatsApp(digits, opts.kind, opts.tier, opts.expiresAtMs);
  if (wa?.ok) {
    await log("whatsapp", "sent", wa.detail);
    return true;
  }
  if (wa && !wa.ok) await log("whatsapp", "failed", wa.detail);

  const sms = await sendSms(digits, buildMessage(opts.kind, opts.tier, opts.expiresAtMs));
  if (sms?.ok) {
    await log("sms", "sent", sms.detail);
    return true;
  }
  if (sms && !sms.ok) {
    await log("sms", "failed", sms.detail);
    return false;
  }
  if (!wa) await log("none", "skipped", "no_channel_configured");
  return false;
}

/** Atomically claims a notification slot so the same pass is never messaged twice, even under concurrent triggers. */
export async function claimAndSendReceipt(service: SupabaseClient, subscriptionId: string): Promise<boolean> {
  const { data: claimed } = await service
    .from("subscriptions")
    .update({ receipt_notified_at: new Date().toISOString() })
    .eq("id", subscriptionId)
    .is("receipt_notified_at", null)
    .select("id, phone, tier, end_date")
    .maybeSingle();
  if (!claimed) return false;
  const expiresAtMs = claimed.end_date ? Date.parse(claimed.end_date) : 0;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;
  return deliverPassMessage(service, {
    subscriptionId: claimed.id,
    phone: claimed.phone,
    kind: "receipt",
    tier: claimed.tier,
    expiresAtMs,
  });
}
