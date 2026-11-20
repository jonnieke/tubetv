import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "https://esm.sh/web-push@3.6.7";
import { verifiedAdminId } from "../_shared/admin.ts";
import { recordAdminMutation } from "../_shared/audit.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { constantTimeSecretEquals } from "../_shared/passToken.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const METHODS = "POST, OPTIONS";
const VALID_PUSH_HOST_RE =
  /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|google\.com|mozilla\.com|mozaws\.net|apple\.com|windows\.com)\//i;

interface DigestQueueRow {
  id: string;
  main_title: string;
  is_series: boolean;
}

function buildDigestCopy(rows: DigestQueueRow[]): { title: string; body: string } {
  const uniqueTitles: Array<{ title: string; isSeries: boolean }> = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const clean = (row.main_title || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueTitles.push({ title: clean, isSeries: Boolean(row.is_series) });
  }

  if (uniqueTitles.length === 1) {
    const item = uniqueTitles[0];
    return item.isSeries
      ? { title: "New on TubeTV", body: `New episodes of ${item.title} are now streaming!` }
      : { title: "New on TubeTV", body: `Watch "${item.title}" now streaming on TubeTV!` };
  }

  if (uniqueTitles.length === 2) {
    return {
      title: "New on TubeTV Today",
      body: `New episodes & titles of ${uniqueTitles[0].title} and ${uniqueTitles[1].title} are now streaming!`,
    };
  }

  const remaining = uniqueTitles.length - 2;
  return {
    title: "New on TubeTV Today",
    body: `${uniqueTitles[0].title}, ${uniqueTitles[1].title} & ${remaining} more ${remaining === 1 ? "title" : "titles"} are now streaming!`,
  };
}

async function broadcastPush(
  serviceClient: SupabaseClient,
  payloadObj: { title: string; body: string; url: string },
): Promise<number> {
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidContact = Deno.env.get("VAPID_CONTACT_EMAIL");
  if (!vapidPublic || !vapidPrivate || !vapidContact) {
    throw new Error("Push service is not configured.");
  }

  webpush.setVapidDetails(`mailto:${vapidContact}`, vapidPublic, vapidPrivate);
  const payload = JSON.stringify(payloadObj);
  let sentCount = 0;
  let offset = 0;
  const pageSize = 500;
  const concurrency = 50;

  while (true) {
    const { data: subscriptions, error } = await serviceClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!subscriptions?.length) break;

    for (let i = 0; i < subscriptions.length; i += concurrency) {
      const batch = subscriptions.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (subscription) => {
          if (!VALID_PUSH_HOST_RE.test(subscription.endpoint)) {
            await serviceClient.from("push_subscriptions").delete().eq("id", subscription.id);
            return;
          }
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              payload,
            );
            sentCount += 1;
          } catch (error: unknown) {
            const statusCode =
              typeof error === "object" && error && "statusCode" in error
                ? Number((error as { statusCode: unknown }).statusCode)
                : 0;
            if (statusCode === 404 || statusCode === 410) {
              await serviceClient.from("push_subscriptions").delete().eq("id", subscription.id);
            } else {
              console.error("Push delivery failed", error);
            }
          }
        }),
      );
    }

    if (subscriptions.length < pageSize) break;
    offset += pageSize;
  }

  return sentCount;
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
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonReply(req, { error: "Push service is not configured." }, 503, METHODS);
  }

  const bodyJson = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof bodyJson.action === "string" ? bodyJson.action : "send";

  const cronSecret = Deno.env.get("NOTIFY_CRON_SECRET") || "";
  const provided = req.headers.get("x-cron-secret") || "";
  const isCron = Boolean(cronSecret && provided && (await constantTimeSecretEquals(provided, cronSecret)));
  const adminId = isCron ? null : await verifiedAdminId(req);

  if (action === "daily_digest") {
    if (!isCron && !adminId) {
      return jsonReply(req, { error: "Scheduler secret or verified admin access is required." }, 403, METHODS);
    }
  } else if (!adminId) {
    return jsonReply(req, { error: "Verified admin access is required." }, 403, METHODS);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (action === "queue_title") {
      const videoId = typeof bodyJson.videoId === "string" ? bodyJson.videoId.trim().slice(0, 120) : "";
      const mainTitle = typeof bodyJson.mainTitle === "string" ? bodyJson.mainTitle.trim().slice(0, 100) : "";
      const isSeries = Boolean(bodyJson.isSeries);
      if (!videoId || !mainTitle) {
        return jsonReply(req, { error: "videoId and mainTitle are required." }, 400, METHODS);
      }

      const { data: existing } = await serviceClient
        .from("new_show_digest_queue")
        .select("id")
        .eq("video_id", videoId)
        .is("notified_at", null)
        .limit(1);

      if (!existing?.length) {
        const { error: insertErr } = await serviceClient
          .from("new_show_digest_queue")
          .insert({ video_id: videoId, main_title: mainTitle, is_series: isSeries });
        if (insertErr) throw insertErr;
      }

      return jsonReply(req, { success: true, queued: true, mainTitle }, 200, METHODS);
    }

    if (action === "daily_digest") {
      const { data: pending, error: pendingErr } = await serviceClient
        .from("new_show_digest_queue")
        .select("id, main_title, is_series")
        .is("notified_at", null)
        .order("created_at", { ascending: true })
        .limit(200);

      if (pendingErr) throw pendingErr;
      if (!pending?.length) {
        return jsonReply(req, { success: true, skipped: "no_new_titles", sentCount: 0 }, 200, METHODS);
      }

      const copy = buildDigestCopy(pending as DigestQueueRow[]);
      const sentCount = await broadcastPush(serviceClient, {
        title: copy.title.slice(0, 100),
        body: copy.body.slice(0, 300),
        url: "/",
      });

      const ids = pending.map((r) => r.id);
      await serviceClient
        .from("new_show_digest_queue")
        .update({ notified_at: new Date().toISOString() })
        .in("id", ids);

      if (adminId) await recordAdminMutation(adminId, "send_push_digest", null, true);
      return jsonReply(req, { success: true, sentCount, titlesBatched: ids.length, copy }, 200, METHODS);
    }

    const { title, body, url } = bodyJson;
    if (typeof title !== "string" || !title.trim() || title.length > 100) {
      return jsonReply(req, { error: "Title must be between 1 and 100 characters." }, 400, METHODS);
    }
    if (typeof body !== "string" || !body.trim() || body.length > 300) {
      return jsonReply(req, { error: "Body must be between 1 and 300 characters." }, 400, METHODS);
    }
    if (url !== undefined && (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//"))) {
      return jsonReply(req, { error: "Notification URL must be a local path." }, 400, METHODS);
    }

    const sentCount = await broadcastPush(serviceClient, {
      title: title.trim(),
      body: body.trim(),
      url: (url as string | undefined) || "/",
    });

    if (adminId) await recordAdminMutation(adminId, "send_push", null, true);
    return jsonReply(req, { success: true, sentCount }, 200, METHODS);
  } catch (error: unknown) {
    console.error("Push notification error", error);
    if (adminId) await recordAdminMutation(adminId, "send_push", null, false);
    const msg = error instanceof Error && error.message === "Push service is not configured."
      ? "Push service is not configured."
      : "Unable to send notifications.";
    const status = msg === "Push service is not configured." ? 503 : 500;
    return jsonReply(req, { error: msg }, status, METHODS);
  }
});
