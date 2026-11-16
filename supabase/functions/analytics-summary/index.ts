import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifiedAdminId } from "../_shared/admin.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";

const METHODS = "GET, OPTIONS";

function generateDefaultPortalCode(creatorName: string): string {
  const clean = (creatorName || "CREATOR").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = (clean.slice(0, 2) || "CR").padEnd(2, "X");
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % 900 + 100;
  }
  return `TUBE-${prefix}${hash}`;
}
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

  const reqUrl = new URL(req.url);
  const creatorCode = (reqUrl.searchParams.get("creator_code") || "").trim().toUpperCase();
  const creatorName = (reqUrl.searchParams.get("creator_name") || "").trim();
  const requestedVideoIds = (reqUrl.searchParams.get("video_ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 500);
  const isAdmin = await verifiedAdminId(req);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return jsonReply(req, { error: "Analytics unavailable." }, 503, METHODS, { "Cache-Control": "no-store" });
  }

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const rawFrom = reqUrl.searchParams.get("from");
  const rawTo = reqUrl.searchParams.get("to");
  const parsedFrom = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? new Date(`${rawFrom}T00:00:00.000Z`) : new Date(Date.now() - 30 * 86400000);
  const parsedTo = rawTo && /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? new Date(`${rawTo}T23:59:59.999Z`) : new Date();
  const rangeFromIso = Number.isNaN(parsedFrom.getTime()) ? new Date(Date.now() - 30 * 86400000).toISOString() : parsedFrom.toISOString();
  const rangeToIso = Number.isNaN(parsedTo.getTime()) ? new Date().toISOString() : parsedTo.toISOString();

  if (!isAdmin) {
    if (!creatorCode || requestedVideoIds.length === 0) {
      return jsonReply(req, { error: "Verified admin or creator access required." }, 403, METHODS);
    }
    const { data: profileMatch } = await client
      .from("creator_payout_profiles")
      .select("creator_name")
      .eq("portal_access_code", creatorCode)
      .limit(1);
    const matchedProfileName = Array.isArray(profileMatch) && profileMatch.length > 0 ? String(profileMatch[0]?.creator_name || "") : "";
    const hasProfile = Boolean(matchedProfileName) && (!creatorName || matchedProfileName.trim().toLowerCase() === creatorName.toLowerCase());
    const matchesDeterministicCode = Boolean(creatorName) && creatorCode === generateDefaultPortalCode(creatorName);
    if (!hasProfile && !matchesDeterministicCode) {
      return jsonReply(req, { error: "Invalid creator access code." }, 403, METHODS);
    }

    const allowedIds = new Set(requestedVideoIds);
    const { data: creatorEvents, error: creatorErr } = await client
      .from("analytics_events")
      .select("event_name, properties, occurred_at")
      .in("event_name", ["playback_start", "qualified_view", "playback_complete", "video_shared"])
      .gte("occurred_at", rangeFromIso)
      .lte("occurred_at", rangeToIso)
      .order("occurred_at", { ascending: false })
      .limit(2000);

    if (creatorErr) {
      return jsonReply(req, { error: "Analytics unavailable." }, 503, METHODS, { "Cache-Control": "no-store" });
    }

    const viewerSet = new Set<string>();
    const byLocation: Record<string, { interactions: number; watchSeconds: number }> = {};
    const byVideoMap = new Map<string, { interactions: number; watchSeconds: number; viewers: Set<string> }>();
    let totalWatchSeconds = 0;
    let totalInteractions = 0;
    const rangeInteractions: Array<{
      occurredAt: string;
      date: string;
      videoId: string;
      viewerId: string;
      location: string;
      device: string;
      event: string;
      watchSeconds: number;
    }> = [];

    for (const row of creatorEvents || []) {
      const props = (row.properties || {}) as Record<string, unknown>;
      const videoId = typeof props.videoId === "string" ? props.videoId : "";
      if (!videoId || !allowedIds.has(videoId)) continue;
      totalInteractions += 1;
      const viewerId = typeof props.viewerId === "string" && props.viewerId ? props.viewerId : "Guest";
      const city = typeof props.city === "string" ? props.city : "";
      const country = typeof props.country === "string" ? props.country : "KE";
      const location = city ? `${city}, ${country}` : country;
      const device = typeof props.device === "string" && props.device ? props.device : "Web";
      const watchSeconds = typeof props.watchSeconds === "number" && Number.isFinite(props.watchSeconds) ? Math.max(0, Math.round(props.watchSeconds)) : 0;
      const occurredAt = typeof row.occurred_at === "string" ? row.occurred_at : "";

      viewerSet.add(viewerId);
      totalWatchSeconds += watchSeconds;
      if (!byLocation[location]) byLocation[location] = { interactions: 0, watchSeconds: 0 };
      byLocation[location].interactions += 1;
      byLocation[location].watchSeconds += watchSeconds;

      const vEntry = byVideoMap.get(videoId) || { interactions: 0, watchSeconds: 0, viewers: new Set<string>() };
      vEntry.interactions += 1;
      vEntry.watchSeconds += watchSeconds;
      vEntry.viewers.add(viewerId);
      byVideoMap.set(videoId, vEntry);

      if (rangeInteractions.length < 250) {
        rangeInteractions.push({
          occurredAt,
          date: occurredAt.slice(0, 10),
          videoId,
          viewerId,
          location,
          device,
          event: String(row.event_name || "playback_start"),
          watchSeconds,
        });
      }
    }

    const byVideo = Object.fromEntries(
      Array.from(byVideoMap.entries()).map(([vid, stats]) => [
        vid,
        { interactions: stats.interactions, watchSeconds: stats.watchSeconds, uniqueViewers: stats.viewers.size },
      ]),
    );

    return jsonReply(
      req,
      {
        rangeSummary: {
          from: rangeFromIso.slice(0, 10),
          to: rangeToIso.slice(0, 10),
          totalInteractions,
          uniqueViewers: viewerSet.size,
          totalWatchSeconds,
          avgWatchSeconds: totalInteractions > 0 ? Math.round(totalWatchSeconds / totalInteractions) : 0,
          byLocation,
          byVideo,
        },
        rangeInteractions,
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }
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

  // Also aggregate 30-day verified Qualified Views per videoId and succeeded payment_transactions revenue,
  // plus detailed Date A -> Date B interaction, revenue & QV logs.
  const since30d = new Date(Date.now() - 30 * 86400000).toISOString();
  const [qvRes, txRes, rangeEventsRes, rangeTxRes] = await Promise.all([
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
    client
      .from("analytics_events")
      .select("event_name, properties, occurred_at")
      .in("event_name", ["playback_start", "qualified_view", "playback_complete", "video_shared"])
      .gte("occurred_at", rangeFromIso)
      .lte("occurred_at", rangeToIso)
      .order("occurred_at", { ascending: false })
      .limit(1000),
    client
      .from("payment_transactions")
      .select("amount_kes, region_code, created_at")
      .eq("status", "succeeded")
      .gte("created_at", rangeFromIso)
      .lte("created_at", rangeToIso)
      .limit(5000),
  ]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const qualifiedViewsByVideo: Record<string, number> = {};
  const todayQualifiedViewsByVideo: Record<string, number> = {};
  const dailyMap = new Map<string, { revenueKes: number; qualifiedViews: number }>();
  for (let i = 29; i >= 0; i -= 1) {
    const dayKey = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dailyMap.set(dayKey, { revenueKes: 0, qualifiedViews: 0 });
  }

  if (Array.isArray(qvRes.data)) {
    for (const row of qvRes.data) {
      const props = (row.properties || {}) as Record<string, unknown>;
      const vid = typeof props.videoId === "string" ? props.videoId.trim() : "";
      const dayKey = typeof row.occurred_at === "string" ? row.occurred_at.slice(0, 10) : "";
      if (vid) {
        qualifiedViewsByVideo[vid] = (qualifiedViewsByVideo[vid] || 0) + 1;
        if (dayKey === todayKey) {
          todayQualifiedViewsByVideo[vid] = (todayQualifiedViewsByVideo[vid] || 0) + 1;
        }
      }
      const bucket = dayKey ? dailyMap.get(dayKey) : undefined;
      if (bucket) bucket.qualifiedViews += 1;
    }
  }

  let grossRevenueKes30d = 0;
  let todayRevenueKes = 0;
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
      if (dayKey === todayKey) todayRevenueKes += amt;
      const bucket = dayKey ? dailyMap.get(dayKey) : undefined;
      if (bucket) bucket.revenueKes += amt;
    }
  }

  const dailySeries = Array.from(dailyMap.entries()).map(([date, vals]) => ({
    date,
    revenueKes: vals.revenueKes,
    qualifiedViews: vals.qualifiedViews,
  }));

  const viewerSet = new Set<string>();
  const byLocation: Record<string, { interactions: number; watchSeconds: number }> = {};
  let rangeTotalWatchSeconds = 0;
  const rangeInteractions: Array<{
    occurredAt: string;
    date: string;
    videoId: string;
    viewerId: string;
    location: string;
    device: string;
    event: string;
    watchSeconds: number;
  }> = [];

  const rangeQualifiedViewsByVideo: Record<string, number> = {};
  if (Array.isArray(rangeEventsRes.data)) {
    for (const row of rangeEventsRes.data) {
      const props = (row.properties || {}) as Record<string, unknown>;
      const videoId = typeof props.videoId === "string" ? props.videoId : "";
      if (!videoId) continue;
      if (row.event_name === "qualified_view") {
        rangeQualifiedViewsByVideo[videoId] = (rangeQualifiedViewsByVideo[videoId] || 0) + 1;
      }
      const viewerId = typeof props.viewerId === "string" && props.viewerId ? props.viewerId : "Guest";
      const city = typeof props.city === "string" ? props.city : "";
      const country = typeof props.country === "string" ? props.country : "KE";
      const location = city ? `${city}, ${country}` : country;
      const device = typeof props.device === "string" && props.device ? props.device : "Web";
      const watchSeconds = typeof props.watchSeconds === "number" && Number.isFinite(props.watchSeconds) ? Math.max(0, Math.round(props.watchSeconds)) : 0;
      const occurredAt = typeof row.occurred_at === "string" ? row.occurred_at : "";

      viewerSet.add(viewerId);
      rangeTotalWatchSeconds += watchSeconds;
      if (!byLocation[location]) byLocation[location] = { interactions: 0, watchSeconds: 0 };
      byLocation[location].interactions += 1;
      byLocation[location].watchSeconds += watchSeconds;

      if (rangeInteractions.length < 250) {
        rangeInteractions.push({
          occurredAt,
          date: occurredAt.slice(0, 10),
          videoId,
          viewerId,
          location,
          device,
          event: String(row.event_name || "playback_start"),
          watchSeconds,
        });
      }
    }
  }

  let rangeRevenueKes = 0;
  const rangeRevenueByRegion: Record<string, number> = {};
  if (Array.isArray(rangeTxRes.data)) {
    for (const tx of rangeTxRes.data) {
      const amt = Number(tx.amount_kes) || 0;
      const reg = String(tx.region_code || "KE").toUpperCase();
      rangeRevenueKes += amt;
      rangeRevenueByRegion[reg] = (rangeRevenueByRegion[reg] || 0) + amt;
    }
  }

  const rangeSummary = {
    from: rangeFromIso.slice(0, 10),
    to: rangeToIso.slice(0, 10),
    totalInteractions: Array.isArray(rangeEventsRes.data) ? rangeEventsRes.data.length : 0,
    uniqueViewers: viewerSet.size,
    totalWatchSeconds: rangeTotalWatchSeconds,
    avgWatchSeconds: rangeInteractions.length > 0 ? Math.round(rangeTotalWatchSeconds / rangeInteractions.length) : 0,
    byLocation,
  };

  return jsonReply(
    req,
    {
      since,
      until: new Date().toISOString(),
      counts: Object.fromEntries(results.map((result) => [result.name, result.count || 0])),
      qualifiedViewsByVideo,
      todayQualifiedViewsByVideo,
      grossRevenueKes30d,
      todayRevenueKes,
      rangeRevenueKes,
      rangeRevenueByRegion,
      rangeQualifiedViewsByVideo,
      revenueByRegion,
      revenueByChannel,
      revenueByPlan,
      dailySeries,
      rangeSummary,
      rangeInteractions,
    },
    200,
    METHODS,
    { "Cache-Control": "no-store" },
  );
});
