import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { publicItem } from "../_shared/publicCatalog.ts";
import { verifyPassToken } from "../_shared/passToken.ts";
import { buildBunnyPlaybackUrl } from "../_shared/bunnyToken.ts";

const METHODS = "GET, OPTIONS";

function getTag(tags: Array<{ property?: string; value?: string }>, name: string): string {
  return tags.find((t) => t.property?.toLowerCase() === name.toLowerCase())?.value?.trim() || "";
}

function isCatalogueItemLocked(item: { metaTags?: Array<{ property?: string; value?: string }>; title?: unknown }): boolean {
  const tags = Array.isArray(item.metaTags) ? item.metaTags : [];
  const seriesFormat = getTag(tags, "seriesformat").toLowerCase();
  const category = getTag(tags, "category").toLowerCase();
  const isMicroDrama = seriesFormat === "micro-drama" || category === "micro dramas";

  // Long-format videos allow a 30-second preview before triggering the paywall in the player
  if (!isMicroDrama) {
    return false;
  }

  const rawFree = Number(getTag(tags, "freeepisodes"));
  const freeCount = Number.isFinite(rawFree) && rawFree >= 0 ? rawFree : 2;
  const rawEpisode = Number(getTag(tags, "episode"));
  const titleMatch =
    String(item.title || "").match(/(?:S\d+)?E(\d{1,3})/i) ||
    String(item.title || "").match(/Episode\s*(\d{1,3})/i);
  const episodeNum = Number.isFinite(rawEpisode) && rawEpisode > 0
    ? rawEpisode
    : titleMatch
      ? Number(titleMatch[1])
      : undefined;

  // Enforced: Micro-drama triggers immediate paywall after episode 2 (episode 3+)
  if (episodeNum !== undefined && episodeNum > 0) {
    return episodeNum > freeCount;
  }

  const accessTier = getTag(tags, "accesstier").toLowerCase();
  if (accessTier === "free") return false;

  return accessTier === "premium" || getTag(tags, "ispremium").toLowerCase() === "true";
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
    if (locked && !(await hasValidEntitlement(req))) {
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

