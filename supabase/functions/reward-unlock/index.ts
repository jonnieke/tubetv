import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { issueRewardToken, type RewardUnlockSource } from "../_shared/rewardToken.ts";

const METHODS = "POST, OPTIONS";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Hard server-side anti-farming ceilings (persistent in Postgres across isolate cold starts)
const MAX_AD_STARTS_PER_DEVICE_15M = 12;
const MAX_AD_STARTS_PER_IP_15M = 60;
const MAX_DAILY_REWARD_EPISODES_PER_DEVICE = 6;
const MAX_DAILY_REWARD_EPISODES_PER_IP = 30;
const MAX_DAILY_SHARE_UNLOCKS_PER_DEVICE = 2;
const MAX_DAILY_STREAK_UNLOCKS_PER_DEVICE = 2;
const REWARD_TTL_MS = 24 * 60 * 60 * 1000;

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon"
  ).slice(0, 64);
}

async function issueGrantAndToken(
  service: ReturnType<typeof createClient>,
  params: {
    videoId: string;
    source: RewardUnlockSource;
    deviceId: string;
    clientIp: string;
    adSessionId?: string | null;
  },
): Promise<{ ok: true; rewardToken: string; expiresAt: number } | { ok: false; error: string; status: number }> {
  const since24h = new Date(Date.now() - REWARD_TTL_MS).toISOString();

  // If this device already has an active grant for this exact video, re-issue a fresh signed token
  const { data: existingGrant } = await service
    .from("reward_unlock_grants")
    .select("id, source, expires_at")
    .eq("device_id", params.deviceId)
    .eq("video_id", params.videoId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingGrant?.id) {
    const exp = Date.parse(existingGrant.expires_at);
    const rewardToken = await issueRewardToken({
      grantId: existingGrant.id,
      videoId: params.videoId,
      source: existingGrant.source as RewardUnlockSource,
      deviceId: params.deviceId,
      exp,
    });
    return { ok: true, rewardToken, expiresAt: exp };
  }

  // Enforce per-device 24h quotas
  const { data: deviceGrants } = await service
    .from("reward_unlock_grants")
    .select("video_id, source")
    .eq("device_id", params.deviceId)
    .gte("granted_at", since24h);

  const uniqueDeviceVideos = new Set((deviceGrants || []).map((g) => g.video_id));
  if (uniqueDeviceVideos.size >= MAX_DAILY_REWARD_EPISODES_PER_DEVICE) {
    return { ok: false, error: "Daily free unlock limit reached on this device.", status: 429 };
  }

  if (params.source === "share") {
    const shareCount = (deviceGrants || []).filter((g) => g.source === "share").length;
    if (shareCount >= MAX_DAILY_SHARE_UNLOCKS_PER_DEVICE) {
      return { ok: false, error: "Daily WhatsApp share unlock limit reached.", status: 429 };
    }
  } else if (params.source === "streak") {
    const streakCount = (deviceGrants || []).filter((g) => g.source === "streak").length;
    if (streakCount >= MAX_DAILY_STREAK_UNLOCKS_PER_DEVICE) {
      return { ok: false, error: "Daily streak unlock limit reached.", status: 429 };
    }
  }

  // Enforce per-IP 24h ceiling (generous enough for shared Wi-Fi, tight enough to stop farms)
  const { count: ipCount } = await service
    .from("reward_unlock_grants")
    .select("id", { count: "exact", head: true })
    .eq("client_ip", params.clientIp)
    .gte("granted_at", since24h);

  if ((ipCount || 0) >= MAX_DAILY_REWARD_EPISODES_PER_IP) {
    return { ok: false, error: "Daily unlock limit reached for this network.", status: 429 };
  }

  const expiresAt = Date.now() + REWARD_TTL_MS;
  const { data: inserted, error: insertError } = await service
    .from("reward_unlock_grants")
    .insert({
      video_id: params.videoId,
      source: params.source,
      device_id: params.deviceId,
      client_ip: params.clientIp,
      ad_session_id: params.adSessionId || null,
      expires_at: new Date(expiresAt).toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    console.error("reward_grant_insert_error", insertError);
    return { ok: false, error: "Could not issue unlock token.", status: 503 };
  }

  const rewardToken = await issueRewardToken({
    grantId: inserted.id,
    videoId: params.videoId,
    source: params.source,
    deviceId: params.deviceId,
    exp: expiresAt,
  });

  return { ok: true, rewardToken, expiresAt };
}

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return jsonReply(req, { error: "Reward service is not configured." }, 503, METHODS);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return jsonReply(req, { error: "Invalid request payload." }, 400, METHODS);
  }

  const action = body.action.trim();
  const videoId = String(body.videoId || "").trim();
  const deviceId = String(body.deviceId || "").trim().slice(0, 64);
  if (!UUID_RE.test(videoId) || deviceId.length < 6) {
    return jsonReply(req, { error: "Valid videoId and deviceId are required." }, 400, METHODS);
  }

  const clientIp = getClientIp(req);
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ─── 1. Start a server-timed sponsor ad session ───
  if (action === "start_ad") {
    const rawAdId = String(body.adId || "").trim();
    const adId = rawAdId && UUID_RE.test(rawAdId) ? rawAdId : null;
    const hostCreator = String(body.hostCreator || "").trim().slice(0, 120) || null;

    // Rate-limit ad session starts per device & IP (15-minute window)
    const since15m = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const [{ count: devStarts }, { count: ipStarts }] = await Promise.all([
      service
        .from("ad_watch_sessions")
        .select("id", { count: "exact", head: true })
        .eq("device_id", deviceId)
        .gte("started_at", since15m),
      service
        .from("ad_watch_sessions")
        .select("id", { count: "exact", head: true })
        .eq("client_ip", clientIp)
        .gte("started_at", since15m),
    ]);

    if ((devStarts || 0) >= MAX_AD_STARTS_PER_DEVICE_15M || (ipStarts || 0) >= MAX_AD_STARTS_PER_IP_15M) {
      return jsonReply(req, { error: "Too many ad requests. Please wait a few minutes." }, 429, METHODS);
    }

    let requiredSeconds = 27; // Default for 30s house ad (3s clock-jitter grace)
    let verifiedAdId: string | null = null;
    if (adId) {
      const { data: adRow } = await service
        .from("sponsor_ads")
        .select("id, duration_seconds, is_active, approval_status")
        .eq("id", adId)
        .maybeSingle();

      if (adRow && adRow.is_active && adRow.approval_status === "approved") {
        verifiedAdId = adRow.id;
        const duration = Number(adRow.duration_seconds) || 30;
        requiredSeconds = Math.max(8, Math.min(90, duration - 3));
        // Server-side impression increment (service_role)
        await service.rpc("increment_sponsor_ad_metric", {
          p_ad_id: verifiedAdId,
          p_metric: "impressions",
          p_host_video_id: videoId,
          p_host_creator: hostCreator,
        });
      }
    }

    const { data: session, error: sessionErr } = await service
      .from("ad_watch_sessions")
      .insert({
        ad_id: verifiedAdId,
        host_video_id: videoId,
        host_creator: hostCreator,
        device_id: deviceId,
        client_ip: clientIp,
        required_seconds: requiredSeconds,
      })
      .select("id, started_at, required_seconds")
      .single();

    if (sessionErr || !session?.id) {
      console.error("ad_session_start_error", sessionErr);
      return jsonReply(req, { error: "Could not start ad session." }, 503, METHODS);
    }

    return jsonReply(
      req,
      {
        ok: true,
        sessionId: session.id,
        requiredSeconds: session.required_seconds,
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  // ─── 2. Verify wall-clock completion, credit 60/40 ad-host earnings, and issue signed unlock token ───
  if (action === "complete_ad") {
    const sessionId = String(body.sessionId || "").trim();
    const grantUnlock = body.grantUnlock !== false;
    if (!UUID_RE.test(sessionId)) {
      return jsonReply(req, { error: "Valid sessionId is required." }, 400, METHODS);
    }

    const { data: session } = await service
      .from("ad_watch_sessions")
      .select("id, ad_id, host_video_id, host_creator, device_id, required_seconds, started_at, completed_at, expires_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      return jsonReply(req, { error: "Ad session not found." }, 404, METHODS);
    }
    if (session.completed_at) {
      return jsonReply(req, { error: "Ad session already completed." }, 409, METHODS);
    }
    if (session.device_id !== deviceId || session.host_video_id !== videoId) {
      return jsonReply(req, { error: "Ad session does not match this device or video." }, 403, METHODS);
    }
    if (Date.parse(session.expires_at) <= Date.now()) {
      return jsonReply(req, { error: "Ad session expired." }, 410, METHODS);
    }

    const elapsedSeconds = (Date.now() - Date.parse(session.started_at)) / 1000;
    if (elapsedSeconds < session.required_seconds) {
      return jsonReply(
        req,
        {
          error: "Ad playback has not finished yet.",
          remainingSeconds: Math.ceil(session.required_seconds - elapsedSeconds),
        },
        400,
        METHODS,
      );
    }

    // Atomic single-completion lock: prevents concurrent double-crediting race conditions
    const { data: updated, error: updateErr } = await service
      .from("ad_watch_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", session.id)
      .is("completed_at", null)
      .select("id")
      .maybeSingle();

    if (updateErr || !updated?.id) {
      return jsonReply(req, { error: "Ad session already redeemed." }, 409, METHODS);
    }

    // Credit sponsor completion & 60/40 host creator earnings ONLY after server wall-clock verification
    if (session.ad_id) {
      await service.rpc("increment_sponsor_ad_metric", {
        p_ad_id: session.ad_id,
        p_metric: "completions",
        p_host_video_id: session.host_video_id,
        p_host_creator: session.host_creator,
      });
    }

    if (!grantUnlock) {
      return jsonReply(req, { ok: true, completed: true }, 200, METHODS, { "Cache-Control": "no-store" });
    }

    const grant = await issueGrantAndToken(service, {
      videoId,
      source: "ad",
      deviceId,
      clientIp,
      adSessionId: session.id,
    });
    if (!grant.ok) {
      return jsonReply(req, { error: grant.error }, grant.status, METHODS);
    }

    return jsonReply(
      req,
      {
        ok: true,
        completed: true,
        rewardToken: grant.rewardToken,
        expiresAt: grant.expiresAt,
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  // ─── 3. Claim server-capped share / streak unlock token ───
  if (action === "claim_reward") {
    const source = String(body.source || "").trim().toLowerCase();
    if (source !== "share" && source !== "streak") {
      return jsonReply(req, { error: "Invalid reward source." }, 400, METHODS);
    }

    const grant = await issueGrantAndToken(service, {
      videoId,
      source,
      deviceId,
      clientIp,
    });
    if (!grant.ok) {
      return jsonReply(req, { error: grant.error }, grant.status, METHODS);
    }

    return jsonReply(
      req,
      {
        ok: true,
        rewardToken: grant.rewardToken,
        expiresAt: grant.expiresAt,
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  return jsonReply(req, { error: "Unknown action." }, 400, METHODS);
});
