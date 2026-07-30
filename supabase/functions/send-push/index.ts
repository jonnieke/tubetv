import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import webpush from "https://esm.sh/web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((origin) => origin.trim()).filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "";
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !supabaseUrl || !supabaseAnonKey) return null;
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || data.user?.app_metadata?.role !== "admin") return null;
  return data.user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed." }, 405);
  }
  if (!(await requireAdmin(req))) {
    return jsonResponse(req, { error: "Admin access is required." }, 403);
  }

  try {
    const { title, body, url } = await req.json();
    if (typeof title !== "string" || !title.trim() || title.length > 100) {
      return jsonResponse(req, { error: "Title must be between 1 and 100 characters." }, 400);
    }
    if (typeof body !== "string" || !body.trim() || body.length > 300) {
      return jsonResponse(req, { error: "Body must be between 1 and 300 characters." }, 400);
    }
    if (url !== undefined && (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//"))) {
      return jsonResponse(req, { error: "Notification URL must be a local path." }, 400);
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse(req, { error: "Push service is not configured." }, 503);
    }

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidContact = Deno.env.get("VAPID_CONTACT_EMAIL");
    if (!vapidPublic || !vapidPrivate || !vapidContact) {
      return jsonResponse(req, { error: "Push service is not configured." }, 503);
    }

    webpush.setVapidDetails(`mailto:${vapidContact}`, vapidPublic, vapidPrivate);
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: subscriptions, error } = await serviceClient
      .from("push_subscriptions").select("id, endpoint, p256dh, auth");
    if (error) throw error;
    if (!subscriptions?.length) {
      return jsonResponse(req, { success: true, sentCount: 0 }, 200);
    }

    const payload = JSON.stringify({ title: title.trim(), body: body.trim(), url: url || "/" });
    let sentCount = 0;
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload);
        sentCount += 1;
      } catch (error: unknown) {
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode: unknown }).statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) {
          await serviceClient.from("push_subscriptions").delete().eq("id", subscription.id);
        } else {
          console.error("Push delivery failed", error);
        }
      }
    }));
    return jsonResponse(req, { success: true, sentCount }, 200);
  } catch (error: unknown) {
    console.error("Push notification error", error);
    return jsonResponse(req, { error: "Unable to send notifications." }, 500);
  }
});
