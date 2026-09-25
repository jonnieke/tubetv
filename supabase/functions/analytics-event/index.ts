import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const EVENTS = new Set([
  "catalogue_view",
  "playback_start",
  "playback_error",
  "playback_first_frame",
  "playback_complete",
  "playback_buffer",
  "episode_next",
]);

function allowedOrigin(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((item) => item.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}

function headers(origin: string) {
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    ...(origin ? { "Access-Control-Allow-Credentials": "true" } : {}),
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const origin = allowedOrigin(req);
  if (req.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: headers(origin) });
  if (req.method !== "POST" || !origin) return new Response(null, { status: 403 });
  if (Number(req.headers.get("Content-Length") || 0) > 4096) return new Response(null, { status: 413 });
  const raw = await req.text();
  if (raw.length > 4096) return new Response(null, { status: 413, headers: headers(origin) });
  const body = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  if (!body || !EVENTS.has(body.name) || typeof body.path !== "string" || body.path.length > 200) {
    return new Response(null, { status: 400, headers: headers(origin) });
  }

  const entries = Object.entries(body.properties || {}).slice(0, 12);
  const properties = Object.fromEntries(entries.filter(([key, value]) =>
    key.length <= 40 && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
  ).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 120) : value]));

  const occurredAt = new Date(body.occurredAt);
  if (Number.isNaN(occurredAt.getTime()) || Math.abs(Date.now() - occurredAt.getTime()) > 86400000) {
    return new Response(null, { status: 400, headers: headers(origin) });
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error } = await service.from("analytics_events").insert({
    event_name: body.name,
    properties,
    page_path: body.path,
    occurred_at: occurredAt.toISOString(),
  });

  return new Response(null, { status: error ? 503 : 204, headers: headers(origin) });
});
