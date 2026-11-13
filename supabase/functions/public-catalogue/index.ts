import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { publicItem } from "../_shared/publicCatalog.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";

const libraryId = Deno.env.get("BUNNY_LIBRARY_ID");
const accessKey = Deno.env.get("BUNNY_ACCESS_KEY");
const enforceRating = Deno.env.get("ENFORCE_CONTENT_RATINGS") === "true";
const METHODS = "GET, OPTIONS";

// Isolate-level SWR cache to protect Bunny Management API and keep warm TTFB <10ms.
const CACHE_TTL_MS = 60_000;
const STALE_TTL_MS = 300_000;
const catalogCache = new Map<string, { payload: unknown; cachedAt: number }>();

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
  if (!libraryId || !accessKey) {
    return jsonReply(req, { error: "Catalogue unavailable." }, 503, METHODS, { "Cache-Control": "no-store" });
  }

  const query = new URL(req.url).searchParams;
  const bypassCache = query.get("fresh") === "1";
  const cacheHeader = bypassCache
    ? "no-store"
    : "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

  const singleId = query.get("id");
  if (singleId) {
    if (!/^[0-9a-f-]{36}$/i.test(singleId)) {
      return jsonReply(req, { error: "Invalid video ID." }, 400, METHODS, { "Cache-Control": "no-store" });
    }
    try {
      const upstream = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${singleId}`, {
        headers: { AccessKey: accessKey, Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!upstream.ok) {
        return jsonReply(req, { error: "Video not found." }, upstream.status === 404 ? 404 : 503, METHODS, {
          "Cache-Control": "no-store",
        });
      }
      const data = await upstream.json();
      const item = publicItem(data, enforceRating);
      if (!item) {
        return jsonReply(req, { error: "Video is not available for public playback." }, 404, METHODS, {
          "Cache-Control": "no-store",
        });
      }
      return jsonReply(req, { item }, 200, METHODS, { "Cache-Control": cacheHeader });
    } catch (error) {
      console.error("public_catalogue_single_error", error);
      return jsonReply(req, { error: "Video unavailable." }, 503, METHODS, { "Cache-Control": "no-store" });
    }
  }

  const page = Number(query.get("page") || 1);
  const itemsPerPage = Number(query.get("itemsPerPage") || 100);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !Number.isSafeInteger(itemsPerPage) ||
    itemsPerPage < 10 ||
    itemsPerPage > 100
  ) {
    return jsonReply(req, { error: "Invalid page or page size." }, 400, METHODS, { "Cache-Control": "no-store" });
  }

  const cacheKey = `list:${page}:${itemsPerPage}`;
  const cached = !bypassCache ? catalogCache.get(cacheKey) : undefined;
  const ageMs = cached ? Date.now() - cached.cachedAt : Infinity;
  if (cached && ageMs < CACHE_TTL_MS) {
    return jsonReply(req, cached.payload, 200, METHODS, {
      "Cache-Control": cacheHeader,
      "X-Catalog-Cache": "HIT",
    });
  }

  try {
    const upstream = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=${itemsPerPage}&orderBy=date`,
      {
        headers: { AccessKey: accessKey, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!upstream.ok) {
      if (cached && ageMs < STALE_TTL_MS) {
        return jsonReply(req, cached.payload, 200, METHODS, {
          "Cache-Control": cacheHeader,
          "X-Catalog-Cache": "STALE",
        });
      }
      return jsonReply(req, { error: "Catalogue unavailable." }, 503, METHODS, { "Cache-Control": "no-store" });
    }
    const data = await upstream.json();
    const items = Array.isArray(data.items)
      ? data.items.map((item: Record<string, unknown>) => publicItem(item, enforceRating)).filter(Boolean)
      : [];
    const payload = { items, totalItems: Number(data.totalItems) || 0, currentPage: page, itemsPerPage };
    catalogCache.set(cacheKey, { payload, cachedAt: Date.now() });
    return jsonReply(
      req,
      payload,
      200,
      METHODS,
      { "Cache-Control": cacheHeader, "X-Catalog-Cache": "MISS" },
    );
  } catch (error) {
    if (cached && ageMs < STALE_TTL_MS) {
      return jsonReply(req, cached.payload, 200, METHODS, {
        "Cache-Control": cacheHeader,
        "X-Catalog-Cache": "STALE",
      });
    }
    console.error("public_catalogue_error", error);
    return jsonReply(req, { error: "Catalogue unavailable." }, 503, METHODS, { "Cache-Control": "no-store" });
  }
});
