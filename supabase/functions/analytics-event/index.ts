import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed } from "../_shared/cors.ts";

const EVENTS = new Set([
  "catalogue_view",
  "playback_start",
  "playback_error",
  "playback_first_frame",
  "playback_complete",
  "playback_buffer",
  "episode_next",
  "microdrama_swipe_next",
  "episode_comment_posted",
  "ad_unlock_started",
  "ad_unlock_completed",
  "share_unlock_completed",
  "foryou_impression",
  "foryou_watch_series",
  "paywall_view",
  "paywall_initiated",
  "paywall_completed",
  "paywall_failed",
  "pass_restored",
  "checkout_start",
  "checkout_submitted",
  "subscription_activated",
  "checkout_failed",
  "qualified_view",
  "video_shared",
]);

const METHODS = "POST, OPTIONS";
const rateCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_EVENTS_PER_VIEWER_MINUTE = 60;
const MAX_EVENTS_PER_IP_MINUTE = 1500; // Allows shared school/campus/office Wi-Fi NATs without false 429s

function incrementBucket(bucketKey: string, limit: number): boolean {
  const now = Date.now();
  if (rateCounts.size > 10000) {
    for (const [key, value] of rateCounts.entries()) {
      if (now > value.resetAt) rateCounts.delete(key);
    }
  }
  const record = rateCounts.get(bucketKey);
  if (!record || now > record.resetAt) {
    rateCounts.set(bucketKey, { count: 1, resetAt: now + 60000 });
    return false;
  }
  record.count += 1;
  return record.count > limit;
}

function isRateLimited(ip: string, viewerKey?: string): boolean {
  if (incrementBucket(`ip:${ip}`, MAX_EVENTS_PER_IP_MINUTE)) return true;
  if (viewerKey) {
    return incrementBucket(`viewer:${ip}:${viewerKey}`, MAX_EVENTS_PER_VIEWER_MINUTE);
  }
  return false;
}

serve(async (req) => {
  const originHeader = req.headers.get("Origin") || "";
  const allowed = Boolean(originHeader) && isOriginAllowed(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: allowed ? 204 : 403, headers: corsHeaders(req, METHODS) });
  }
  if (req.method !== "POST" || !allowed) {
    return new Response(null, { status: 403, headers: corsHeaders(req, METHODS) });
  }

  const clientIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous";

  if (Number(req.headers.get("Content-Length") || 0) > 4096) {
    return new Response(null, { status: 413, headers: corsHeaders(req, METHODS) });
  }
  const raw = await req.text();
  if (raw.length > 4096) {
    return new Response(null, { status: 413, headers: corsHeaders(req, METHODS) });
  }
  const body = (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })();
  if (!body || !EVENTS.has(body.name) || typeof body.path !== "string" || body.path.length > 200) {
    return new Response(null, { status: 400, headers: corsHeaders(req, METHODS) });
  }

  const props = body.properties && typeof body.properties === "object" ? body.properties : {};
  const viewerKey = String(props.viewerId || props.userId || props.passRef || "").slice(0, 64).trim();
  if (isRateLimited(clientIp, viewerKey || undefined)) {
    return new Response(JSON.stringify({ error: "Too many events. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders(req, METHODS), "Content-Type": "application/json" },
    });
  }

  const country =
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-geo-country") ||
    req.headers.get("fly-client-country") ||
    "";
  const rawCity =
    req.headers.get("cf-ipcity") ||
    req.headers.get("x-vercel-ip-city") ||
    req.headers.get("x-geo-city") ||
    "";
  const city = (() => {
    if (!rawCity) return "";
    try {
      return decodeURIComponent(rawCity);
    } catch {
      return rawCity;
    }
  })();

  const entries = Object.entries(body.properties || {}).slice(0, 12);
  const properties = {
    ...Object.fromEntries(
      entries
        .filter(
          ([key, value]) =>
            key.length <= 40 &&
            (typeof value === "string" || typeof value === "number" || typeof value === "boolean"),
        )
        .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 120) : value]),
    ),
    ...(country && country !== "XX" ? { country: country.slice(0, 8).toUpperCase() } : {}),
    ...(city ? { city: city.slice(0, 60) } : {}),
  };

  const occurredAt = new Date(body.occurredAt);
  if (Number.isNaN(occurredAt.getTime()) || Math.abs(Date.now() - occurredAt.getTime()) > 86400000) {
    return new Response(null, { status: 400, headers: corsHeaders(req, METHODS) });
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await service.from("analytics_events").insert({
    event_name: body.name,
    properties,
    page_path: body.path,
    occurred_at: occurredAt.toISOString(),
  });

  return new Response(null, { status: error ? 503 : 204, headers: corsHeaders(req, METHODS) });
});
