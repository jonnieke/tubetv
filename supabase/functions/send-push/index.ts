import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "https://esm.sh/web-push@3.6.7";
import { verifiedAdminId } from "../_shared/admin.ts";
import { recordAdminMutation } from "../_shared/audit.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const METHODS = "POST, OPTIONS";
const VALID_PUSH_HOST_RE =
  /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|google\.com|mozilla\.com|mozaws\.net|apple\.com|windows\.com)\//i;

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

  const adminId = await verifiedAdminId(req);
  if (!adminId) {
    return jsonReply(req, { error: "Verified admin access is required." }, 403, METHODS);
  }

  try {
    const { title, body, url } = await req.json();
    if (typeof title !== "string" || !title.trim() || title.length > 100) {
      return jsonReply(req, { error: "Title must be between 1 and 100 characters." }, 400, METHODS);
    }
    if (typeof body !== "string" || !body.trim() || body.length > 300) {
      return jsonReply(req, { error: "Body must be between 1 and 300 characters." }, 400, METHODS);
    }
    if (url !== undefined && (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//"))) {
      return jsonReply(req, { error: "Notification URL must be a local path." }, 400, METHODS);
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonReply(req, { error: "Push service is not configured." }, 503, METHODS);
    }

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidContact = Deno.env.get("VAPID_CONTACT_EMAIL");
    if (!vapidPublic || !vapidPrivate || !vapidContact) {
      return jsonReply(req, { error: "Push service is not configured." }, 503, METHODS);
    }

    webpush.setVapidDetails(`mailto:${vapidContact}`, vapidPublic, vapidPrivate);
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload = JSON.stringify({ title: title.trim(), body: body.trim(), url: url || "/" });
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

    await recordAdminMutation(adminId, "send_push", null, true);
    return jsonReply(req, { success: true, sentCount }, 200, METHODS);
  } catch (error: unknown) {
    console.error("Push notification error", error);
    await recordAdminMutation(adminId, "send_push", null, false);
    return jsonReply(req, { error: "Unable to send notifications." }, 500, METHODS);
  }
});
