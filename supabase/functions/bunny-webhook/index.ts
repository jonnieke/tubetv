import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { verifiedAdminId } from "../_shared/admin.ts";
import { constantTimeSecretEquals } from "../_shared/passToken.ts";
import { publicItem } from "../_shared/publicCatalog.ts";

const METHODS = "POST, OPTIONS";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getTag(tags: Array<{ property?: string; value?: string }>, name: string): string {
  return tags.find((t) => String(t.property || "").toLowerCase() === name.toLowerCase())?.value?.trim() || "";
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

async function upsertBunnyItem(
  service: ReturnType<typeof createClient>,
  raw: Record<string, unknown>,
  enforceRating: boolean,
): Promise<boolean> {
  const guid = String(raw.guid || "").trim();
  if (!UUID_RE.test(guid)) return false;

  const published = publicItem(raw, enforceRating);
  const tags = Array.isArray(raw.metaTags)
    ? (raw.metaTags as Array<{ property?: string; value?: string }>)
    : [];

  const title = String(raw.title || "Untitled").trim();
  const seriesTitle = getTag(tags, "seriestitle") || getTag(tags, "series") || null;
  const rawSeriesId = getTag(tags, "seriesid") || (seriesTitle ? slugify(seriesTitle) : null);
  const seriesFormat = getTag(tags, "seriesformat") || (getTag(tags, "category").toLowerCase() === "micro dramas" ? "micro-drama" : "series");
  const category = getTag(tags, "category") || null;
  const author = getTag(tags, "author") || null;
  const seasonNum = Number(getTag(tags, "season"));
  const epNum = Number(getTag(tags, "episode"));
  const freeEps = Number(getTag(tags, "freeepisodes"));
  const accessTier = getTag(tags, "accesstier") || null;

  if (rawSeriesId && seriesTitle) {
    await service.from("catalogue_series").upsert(
      {
        id: rawSeriesId,
        title: seriesTitle,
        slug: slugify(seriesTitle),
        series_format: seriesFormat,
        synopsis: getTag(tags, "seriessynopsis") || null,
        poster_url: getTag(tags, "seriesposterurl") || null,
        category,
        author,
        is_published: Boolean(published),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  }

  const { error } = await service.from("catalogue_episodes").upsert(
    {
      guid,
      series_id: rawSeriesId,
      series_title: seriesTitle,
      title,
      season_number: Number.isFinite(seasonNum) && seasonNum > 0 ? Math.floor(seasonNum) : null,
      episode_number: Number.isFinite(epNum) && epNum > 0 ? Math.floor(epNum) : null,
      category,
      author,
      access_tier: accessTier,
      free_episodes: Number.isFinite(freeEps) && freeEps >= 0 ? Math.floor(freeEps) : null,
      duration_seconds: Math.max(0, Math.round(Number(raw.length) || 0)),
      thumbnail_file_name: typeof raw.thumbnailFileName === "string" ? raw.thumbnailFileName : null,
      encoding_status: Number(raw.status) || 0,
      is_published: Boolean(published),
      views: Math.max(0, Math.round(Number(raw.views) || 0)),
      meta_tags: tags,
      raw_public_item: published || null,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guid" },
  );

  return !error;
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
  const libraryId = (Deno.env.get("BUNNY_LIBRARY_ID") || "").trim();
  const accessKey = (Deno.env.get("BUNNY_ACCESS_KEY") || "").trim();
  const enforceRating = Deno.env.get("ENFORCE_CONTENT_RATINGS") === "true";

  if (!supabaseUrl || !serviceKey || !libraryId || !accessKey) {
    return jsonReply(req, { error: "Bunny sync service is not configured." }, 503, METHODS);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return jsonReply(req, { error: "Invalid JSON payload." }, 400, METHODS);
  }

  // ─── Mode 1: Admin / Cron Full Catalogue Backfill Sync ───
  if (body.action === "sync_all") {
    const providedCron = (req.headers.get("x-cron-secret") || "").trim();
    const expectedCron = (Deno.env.get("OPS_CRON_SECRET") || Deno.env.get("NOTIFY_CRON_SECRET") || "").trim();
    const isCron = Boolean(providedCron && expectedCron && (await constantTimeSecretEquals(providedCron, expectedCron)));
    const isAdmin = isCron ? true : Boolean(await verifiedAdminId(req));
    if (!isAdmin) {
      return jsonReply(req, { error: "Verified admin or cron secret required." }, 403, METHODS);
    }

    let page = 1;
    let totalSynced = 0;
    const maxPages = 20;

    while (page <= maxPages) {
      const res = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=100&orderBy=date`,
        {
          headers: { AccessKey: accessKey, Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) break;
      const data = await res.json();
      const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
      if (items.length === 0) break;

      for (const item of items) {
        const ok = await upsertBunnyItem(service, item, enforceRating);
        if (ok) totalSynced += 1;
      }

      if (items.length < 100) break;
      page += 1;
    }

    return jsonReply(req, { ok: true, totalSynced, pagesScanned: page }, 200, METHODS);
  }

  // ─── Mode 2: Bunny Stream Encoding Webhook Callback ───
  const webhookSecret = (Deno.env.get("BUNNY_WEBHOOK_SECRET") || "").trim();
  if (webhookSecret) {
    const supplied = (new URL(req.url).searchParams.get("secret") || "").trim();
    if (!(await constantTimeSecretEquals(supplied, webhookSecret))) {
      return jsonReply(req, { error: "Invalid webhook secret." }, 403, METHODS);
    }
  }

  const incomingLibraryId = String(body.VideoLibraryId ?? "").trim();
  const videoGuid = String(body.VideoGuid ?? "").trim();
  if (incomingLibraryId !== libraryId || !UUID_RE.test(videoGuid)) {
    return jsonReply(req, { error: "Invalid Bunny webhook payload." }, 400, METHODS);
  }

  const upstream = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}`, {
    headers: { AccessKey: accessKey, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!upstream.ok) {
    return jsonReply(req, { error: "Could not fetch video from Bunny." }, 502, METHODS);
  }
  const raw = (await upstream.json()) as Record<string, unknown>;
  const synced = await upsertBunnyItem(service, raw, enforceRating);

  return jsonReply(req, { ok: synced, videoGuid, status: body.Status ?? null }, synced ? 200 : 503, METHODS);
});
