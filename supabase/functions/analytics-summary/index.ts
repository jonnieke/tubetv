import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifiedAdminId } from "../_shared/admin.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";

const METHODS = "GET, OPTIONS";
const names = [
  "catalogue_view",
  "playback_start",
  "playback_first_frame",
  "playback_complete",
  "episode_next",
  "playback_error",
  "playback_buffer",
  "paywall_view",
  "paywall_initiated",
  "paywall_completed",
  "paywall_failed",
  "pass_restored",
  "checkout_start",
  "checkout_submitted",
  "subscription_activated",
  "checkout_failed",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) });
  }
  if (req.method !== "GET") {
    return jsonReply(req, { error: "Method not allowed." }, 405, METHODS);
  }
  if (!isOriginAllowed(req)) {
    return jsonReply(req, { error: "Origin not allowed." }, 403, METHODS);
  }
  if (!(await verifiedAdminId(req))) {
    return jsonReply(req, { error: "Verified admin access required." }, 403, METHODS);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return jsonReply(req, { error: "Analytics unavailable." }, 503, METHODS, { "Cache-Control": "no-store" });
  }

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const results = await Promise.all(
    names.map(async (name) => {
      const { count, error } = await client
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", name)
        .gte("occurred_at", since);
      return { name, count, error };
    }),
  );

  if (results.some((result) => result.error)) {
    return jsonReply(req, { error: "Analytics unavailable." }, 503, METHODS, { "Cache-Control": "no-store" });
  }

  return jsonReply(
    req,
    {
      since,
      until: new Date().toISOString(),
      counts: Object.fromEntries(results.map((result) => [result.name, result.count || 0])),
    },
    200,
    METHODS,
    { "Cache-Control": "no-store" },
  );
});
