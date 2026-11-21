import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { publicItem } from "../_shared/publicCatalog.ts";
import { verifyPassToken } from "../_shared/passToken.ts";
import { buildBunnyPlaybackUrl } from "../_shared/bunnyToken.ts";

const METHODS = "GET, OPTIONS";
const VALID_REWARD_SOURCES = new Set(["ad", "share", "streak"]);
const MAX_DAILY_REWARD_EPISODES_PER_DEVICE = 6;
const rewardDeviceUsage = new Map<string, { videoIds: Set<string>; resetAt: number }>();

function hasValidRewardUnlock(
  req: Request,
  item: { metaTags?: Array<{ property?: string; value?: string }>; title?: unknown },
  videoId: string,
): boolean {
  const url = new URL(req.url);
  const rewardSource = (url.searchParams.get("rewardUnlock") || "").trim().toLowerCase();
  const deviceId = (url.searchParams.get("deviceId") || "").trim();
  if (!VALID_REWARD_SOURCES.has(rewardSource) || deviceId.length < 6) {
    return false;
  }

  // Only allow single-episode reward unlocks on episodic content (Micro Dramas / Series)
  const tags = Array.isArray(item.metaTags) ? item.metaTags : [];
  const epStr = getTag(tags, "episode");
  const isEpisodic =
    (epStr !== "" && Number(epStr) > 0) ||
    getTag(tags, "seriesformat").toLowerCase() === "micro-drama" ||
    getTag(tags, "category").toLowerCase() === "micro dramas" ||
    /(?:S\d+)?E(\d{1,3})/i.test(String(item.title || "")) ||
    /Episode\s*(\d{1,3})/i.test(String(item.title || ""));
  if (!isEpisodic) {
    return false;
  }

  const now = Date.now();
  if (rewardDeviceUsage.size > 5000) {
    for (const [k, v] of rewardDeviceUsage.entries()) {
      if (now > v.resetAt) rewardDeviceUsage.delete(k);
    }
  }

  const clientIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon";
  const bucketKey = `${deviceId.slice(0, 64)}:${clientIp}`;
  let record = rewardDeviceUsage.get(bucketKey);
  if (!record || now > record.resetAt) {
    record = { videoIds: new Set<string>(), resetAt: now + 24 * 60 * 60 * 1000 };
    rewardDeviceUsage.set(bucketKey, record);
  }
  if (record.videoIds.has(videoId)) {
    return true;
  }
  if (record.videoIds.size >= MAX_DAILY_REWARD_EPISODES_PER_DEVICE) {
    return false;
  }
  record.videoIds.add(videoId);
  return true;
}

function getTag(tags: Array<{ property?: string; value?: string }>, name: string): string {
  return tags.find((t) => t.property?.toLowerCase() === name.toLowerCase())?.value?.trim() || "";
}

function isCatalogueItemLocked(item: { metaTags?: Array<{ property?: string; value?: string }>; title?: unknown }): boolean {
  const tags = Array.isArray(item.metaTags) ? item.metaTags : [];
  const category = getTag(tags, "category").toLowerCase();
  const isShort = category === "shorts" || getTag(tags, "isshort").toLowerCase() === "true";

  // Shorts are free by default
  if (isShort) {
    return false;
  }

  const freeStr = getTag(tags, "freeepisodes");
  const rawFree = freeStr !== "" ? Number(freeStr) : NaN;
  const totalSeriesEpsStr = getTag(tags, "totalseriesepisodes") || getTag(tags, "seriesepisodecount");
  const totalSeriesEps = totalSeriesEpsStr !== "" ? Number(totalSeriesEpsStr) : NaN;
  const defaultFreeCount = Number.isFinite(totalSeriesEps) && totalSeriesEps >= 30 ? 5 : 2;
  const freeCount = Number.isFinite(rawFree) && rawFree >= 0 ? rawFree : defaultFreeCount;

  const epStr = getTag(tags, "episode");
  const rawEpisode = epStr !== "" ? Number(epStr) : NaN;
  const titleMatch =
    String(item.title || "").match(/(?:S\d+)?E(\d{1,3})/i) ||
    String(item.title || "").match(/Episode\s*(\d{1,3})/i);
  const episodeNum = Number.isFinite(rawEpisode) && rawEpisode > 0
    ? rawEpisode
    : titleMatch
      ? Number(titleMatch[1])
      : undefined;

  // Enforced: Episodic content triggers paywall after episode 2 (episode 3+)
  if (episodeNum !== undefined && episodeNum > 0) {
    return episodeNum > freeCount;
  }

  const accessTier = getTag(tags, "accesstier").toLowerCase();
  if (accessTier === "free" || getTag(tags, "ispremium").toLowerCase() === "false") {
    return false;
  }

  // By default: all videos are premium except shorts and episodes 1 & 2
  return true;
}

async function hasValidEntitlement(req: Request): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return false;

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Check HMAC-signed Guest/Receipt Pass Token
  const passToken = (req.headers.get("X-Pass-Token") || "").trim();
  const queryDeviceId = (new URL(req.url).searchParams.get("deviceId") || "").trim();
  if (passToken) {
    const verified = await verifyPassToken(passToken);
    if (verified) {
      const { data: sub } = await service
        .from("subscriptions")
        .select("id, is_active, end_date, active_device_id")
        .eq("id", verified.subId)
        .maybeSingle();
      if (sub?.is_active && (!sub.end_date || Date.parse(sub.end_date) > Date.now())) {
        // Enforce 1-device concurrency: if pass is bound to an active device, require matching deviceId
        const tokenOrQueryDevice = verified.deviceId || queryDeviceId;
        if (sub.active_device_id && (!tokenOrQueryDevice || sub.active_device_id !== tokenOrQueryDevice)) {
          return false;
        }
        return true;
      }
    }
  }

  // 2. Check authenticated Supabase user session
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ") && anonKey) {
    const jwt = authHeader.slice(7).trim();
    if (jwt && jwt !== anonKey) {
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData } = await authClient.auth.getUser(jwt);
      if (authData?.user) {
        if (authData.user.app_metadata?.role === "admin") return true;
        const { data: sub } = await service
          .from("subscriptions")
          .select("id, end_date")
          .eq("user_id", authData.user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (sub && (!sub.end_date || Date.parse(sub.end_date) > Date.now())) {
          return true;
        }
      }
    }
  }

  return false;
}

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

  const libraryId = Deno.env.get("BUNNY_LIBRARY_ID");
  const accessKey = Deno.env.get("BUNNY_ACCESS_KEY");
  const pullZone = Deno.env.get("BUNNY_PULL_ZONE") || "vz-0fe79b1a-8ad.b-cdn.net";
  const tokenAuthKey = Deno.env.get("BUNNY_TOKEN_AUTH_KEY") || "";
  const enforceRating = Deno.env.get("ENFORCE_CONTENT_RATINGS") === "true";

  if (!libraryId || !accessKey) {
    return jsonReply(req, { error: "Playback service is not configured." }, 503, METHODS);
  }

  const videoId = (new URL(req.url).searchParams.get("id") || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)) {
    return jsonReply(req, { error: "Invalid video ID." }, 400, METHODS);
  }

  try {
    const upstream = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
      headers: { AccessKey: accessKey, Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!upstream.ok) {
      return jsonReply(req, { error: "Video not found." }, upstream.status === 404 ? 404 : 503, METHODS);
    }

    const raw = await upstream.json();
    const published = publicItem(raw, enforceRating);
    if (!published) {
      return jsonReply(req, { error: "Video is not available for public playback." }, 404, METHODS);
    }

    const locked = isCatalogueItemLocked(published);
    if (locked && !(await hasValidEntitlement(req)) && !hasValidRewardUnlock(req, published, videoId)) {
      return jsonReply(
        req,
        { locked: true, error: "An active TubeTV pass is required to watch this title." },
        402,
        METHODS,
        { "Cache-Control": "no-store" },
      );
    }

    const signedPlayback = await buildBunnyPlaybackUrl(pullZone, videoId, tokenAuthKey);
    return jsonReply(
      req,
      {
        locked: false,
        playbackUrl: signedPlayback.url,
        signed: signedPlayback.signed,
        expiresAt: signedPlayback.expiresAt,
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  } catch (error) {
    console.error("playback_access_error", error);
    return jsonReply(req, { error: "Playback unavailable." }, 503, METHODS);
  }
});

