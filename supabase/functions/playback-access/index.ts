import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { publicItem } from "../_shared/publicCatalog.ts";
import { verifyPassToken } from "../_shared/passToken.ts";
import { verifyRewardToken } from "../_shared/rewardToken.ts";
import { buildBunnyPlaybackUrl } from "../_shared/bunnyToken.ts";

const METHODS = "GET, OPTIONS";

// Isolate-level metadata & sponsorship caches with in-flight deduplication
// so viral spikes on Episode 3+ don't hammer Bunny's Management API or Postgres.
const VIDEO_META_TTL_MS = 60_000;
const SPONSOR_CACHE_TTL_MS = 60_000;
const videoMetaCache = new Map<string, { item: ReturnType<typeof publicItem>; cachedAt: number }>();
const inFlightVideoMeta = new Map<string, Promise<{ status: number; item: ReturnType<typeof publicItem> }>>();
const sponsorUnlockCache = new Map<string, { sponsorName: string | null; cachedAt: number }>();

async function fetchPublishedVideoMeta(
  libraryId: string,
  accessKey: string,
  videoId: string,
  enforceRating: boolean,
): Promise<{ status: number; item: ReturnType<typeof publicItem> }> {
  const now = Date.now();
  const cached = videoMetaCache.get(videoId);
  if (cached && now - cached.cachedAt < VIDEO_META_TTL_MS) {
    return { status: cached.item ? 200 : 404, item: cached.item };
  }

  const existing = inFlightVideoMeta.get(videoId);
  if (existing) return existing;

  const task = (async () => {
    const upstream = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
      headers: { AccessKey: accessKey, Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!upstream.ok) {
      return { status: upstream.status === 404 ? 404 : 503, item: null };
    }
    const raw = await upstream.json();
    const published = publicItem(raw, enforceRating);
    if (videoMetaCache.size > 2000) {
      for (const [k, v] of videoMetaCache.entries()) {
        if (now - v.cachedAt >= VIDEO_META_TTL_MS) videoMetaCache.delete(k);
      }
    }
    videoMetaCache.set(videoId, { item: published, cachedAt: Date.now() });
    return { status: published ? 200 : 404, item: published };
  })().finally(() => {
    inFlightVideoMeta.delete(videoId);
  });

  inFlightVideoMeta.set(videoId, task);
  return task;
}

/**
 * Verifies a server-issued, HMAC-signed reward unlock token against the persistent
 * `reward_unlock_grants` ledger. Rejects spoofed query params and expired/mismatched tokens.
 */
async function hasValidRewardUnlock(
  req: Request,
  item: { metaTags?: Array<{ property?: string; value?: string }>; title?: unknown },
  videoId: string,
): Promise<boolean> {
  const url = new URL(req.url);
  const rewardToken = (req.headers.get("X-Reward-Token") || url.searchParams.get("rewardToken") || "").trim();
  const deviceId = (url.searchParams.get("deviceId") || "").trim();
  if (!rewardToken || deviceId.length < 6) {
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

  const verified = await verifyRewardToken(rewardToken);
  if (!verified || verified.videoId !== videoId || verified.deviceId !== deviceId) {
    return false;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return false;

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: grant } = await service
    .from("reward_unlock_grants")
    .select("id, expires_at")
    .eq("id", verified.grantId)
    .eq("video_id", videoId)
    .eq("device_id", deviceId)
    .maybeSingle();

  return Boolean(grant && Date.parse(grant.expires_at) > Date.now());
}

/**
 * Checks whether a B2B brand has sponsored this series with a "Free Season Unlock"
 * campaign in `public.show_sponsorships`, making all episodes free during the campaign window.
 */
async function getActiveBrandSponsorUnlock(
  item: { metaTags?: Array<{ property?: string; value?: string }> },
): Promise<string | null> {
  const tags = Array.isArray(item.metaTags) ? item.metaTags : [];
  const seriesId = getTag(tags, "seriesid");
  const seriesTitle = getTag(tags, "seriestitle") || getTag(tags, "series");
  const normalizedTitle = seriesTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const candidateKeys = Array.from(
    new Set([seriesId, seriesTitle.toLowerCase(), normalizedTitle].filter((k) => k && k.length > 0)),
  );
  if (candidateKeys.length === 0) return null;

  const cacheKey = candidateKeys.join("|");
  const cached = sponsorUnlockCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < SPONSOR_CACHE_TTL_MS) {
    return cached.sponsorName;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return null;

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nowIso = new Date().toISOString();
  const { data } = await service
    .from("show_sponsorships")
    .select("sponsor_name")
    .in("series_key", candidateKeys)
    .eq("is_active", true)
    .eq("unlocks_free_viewing", true)
    .lte("starts_at", nowIso)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
    .limit(1)
    .maybeSingle();

  const sponsorName = data?.sponsor_name || null;
  sponsorUnlockCache.set(cacheKey, { sponsorName, cachedAt: Date.now() });
  return sponsorName;
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
    const metaResult = await fetchPublishedVideoMeta(libraryId, accessKey, videoId, enforceRating);
    if (metaResult.status !== 200 || !metaResult.item) {
      return jsonReply(
        req,
        { error: metaResult.status === 404 ? "Video is not available for public playback." : "Video not found." },
        metaResult.status,
        METHODS,
      );
    }

    const published = metaResult.item;

    const locked = isCatalogueItemLocked(published);
    let sponsoredBy: string | null = null;
    if (locked) {
      sponsoredBy = await getActiveBrandSponsorUnlock(published);
    }
    if (
      locked &&
      !sponsoredBy &&
      !(await hasValidEntitlement(req)) &&
      !(await hasValidRewardUnlock(req, published, videoId))
    ) {
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
        ...(sponsoredBy ? { sponsoredBy } : {}),
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

