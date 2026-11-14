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
  "qualified_view",
  "video_shared",
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

  // Also aggregate 30-day verified Qualified Views per videoId and succeeded payment_transactions revenue
  const since30d = new Date(Date.now() - 30 * 86400000).toISOString();
  const [qvRes, txRes] = await Promise.all([
    client
      .from("analytics_events")
      .select("properties, occurred_at")
      .eq("event_name", "qualified_view")
      .gte("occurred_at", since30d)
      .limit(5000),
    client
      .from("payment_transactions")
      .select("amount_kes, region_code, currency, provider, channel, plan_code, created_at")
      .eq("status", "succeeded")
      .gte("created_at", since30d)
      .limit(5000),
  ]);

  const qualifiedViewsByVideo: Record<string, number> = {};
  const dailyMap = new Map<string, { revenueKes: number; qualifiedViews: number }>();
  for (let i = 29; i >= 0; i -= 1) {
    const dayKey = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dailyMap.set(dayKey, { revenueKes: 0, qualifiedViews: 0 });
  }

  if (Array.isArray(qvRes.data)) {
    for (const row of qvRes.data) {
      const props = (row.properties || {}) as Record<string, unknown>;
      const vid = typeof props.videoId === "string" ? props.videoId.trim() : "";
      if (vid) {
        qualifiedViewsByVideo[vid] = (qualifiedViewsByVideo[vid] || 0) + 1;
      }
      const dayKey = typeof row.occurred_at === "string" ? row.occurred_at.slice(0, 10) : "";
      const bucket = dayKey ? dailyMap.get(dayKey) : undefined;
      if (bucket) bucket.qualifiedViews += 1;
    }
  }

  let grossRevenueKes30d = 0;
  const revenueByRegion: Record<string, number> = {};
  const revenueByChannel: Record<string, number> = { mpesa: 0, card: 0 };
  const revenueByPlan: Record<string, number> = { daily: 0, weekly: 0, monthly: 0 };
  if (Array.isArray(txRes.data)) {
    for (const tx of txRes.data) {
      const amt = Number(tx.amount_kes) || 0;
      const reg = String(tx.region_code || "KE").toUpperCase();
      grossRevenueKes30d += amt;
      revenueByRegion[reg] = (revenueByRegion[reg] || 0) + amt;

      const ch = String(tx.channel || tx.provider || "").toLowerCase();
      if (ch.includes("card")) {
        revenueByChannel.card += amt;
      } else {
        revenueByChannel.mpesa += amt;
      }

      const plan = String(tx.plan_code || "").toLowerCase();
      if (plan === "daily" || plan === "weekly" || plan === "monthly") {
        revenueByPlan[plan] += amt;
      }

      const dayKey = typeof tx.created_at === "string" ? tx.created_at.slice(0, 10) : "";
      const bucket = dayKey ? dailyMap.get(dayKey) : undefined;
      if (bucket) bucket.revenueKes += amt;
    }
  }

  const dailySeries = Array.from(dailyMap.entries()).map(([date, vals]) => ({
    date,
    revenueKes: vals.revenueKes,
    qualifiedViews: vals.qualifiedViews,
  }));

  return jsonReply(
    req,
    {
      since,
      until: new Date().toISOString(),
      counts: Object.fromEntries(results.map((result) => [result.name, result.count || 0])),
      qualifiedViewsByVideo,
      grossRevenueKes30d,
      revenueByRegion,
      revenueByChannel,
      revenueByPlan,
      dailySeries,
    },
    200,
    METHODS,
    { "Cache-Control": "no-store" },
  );
});
