import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifiedAdminId } from "../_shared/admin.ts";
import { recordAdminMutation } from "../_shared/audit.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { buildBunnyTusUploadSignature } from "../_shared/bunnyToken.ts";

const BUNNY_ACCESS_KEY = Deno.env.get("BUNNY_ACCESS_KEY");
const LIBRARY_ID = Deno.env.get("BUNNY_LIBRARY_ID");
const METHODS = "GET, POST, PUT, OPTIONS";
const ALLOWED_QUERY_KEYS = new Set(["page", "itemsPerPage", "orderBy", "search", "collection"]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) });
  }
  if (!isOriginAllowed(req)) {
    return jsonReply(req, { error: "Origin not allowed." }, 403, METHODS);
  }
  if (!BUNNY_ACCESS_KEY || !LIBRARY_ID) {
    return jsonReply(req, { error: "Bunny.net configuration is missing." }, 503, METHODS);
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const bunnyApiIndex = pathParts.findIndex((part) => part === "bunny-api");
    const subPath = bunnyApiIndex >= 0 ? pathParts.slice(bunnyApiIndex + 1).join("/") : "";

    const adminId = await verifiedAdminId(req);
    if (!adminId) {
      return jsonReply(req, { error: "Verified admin access is required." }, 403, METHODS);
    }

    // Issue short-lived Direct TUS upload credentials so browsers upload directly to Bunny Stream
    const tusMatch = subPath.match(/^([0-9a-f-]{36})\/tus-signature$/i);
    if (tusMatch && req.method === "POST") {
      const videoId = tusMatch[1];
      const tusCredentials = await buildBunnyTusUploadSignature(LIBRARY_ID, BUNNY_ACCESS_KEY, videoId);
      await recordAdminMutation(adminId, "bunny_tus_signature", videoId, true);
      return jsonReply(req, tusCredentials, 200, METHODS, { "Cache-Control": "no-store" });
    }

    if (subPath && !/^[0-9a-f-]{36}(?:\/thumbnail)?$/i.test(subPath)) {
      return jsonReply(req, { error: "Invalid content path." }, 400, METHODS);
    }
    if (!["GET", "POST", "PUT"].includes(req.method)) {
      return jsonReply(req, { error: "Method not allowed." }, 405, METHODS);
    }

    let bunnyUrl = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`;
    if (subPath) bunnyUrl += `/${subPath}`;

    const safeParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (ALLOWED_QUERY_KEYS.has(key)) safeParams.set(key, value);
    }
    const qs = safeParams.toString();
    if (qs) bunnyUrl += `?${qs}`;

    const isThumbnailUpload = req.method === "POST" && /\/thumbnail$/i.test(subPath);
    const bunnyResponse = await fetch(bunnyUrl, {
      method: req.method,
      headers: {
        AccessKey: BUNNY_ACCESS_KEY,
        "Content-Type": isThumbnailUpload
          ? "application/octet-stream"
          : req.headers.get("Content-Type") || "application/json",
        Accept: "application/json",
      },
      body: req.method === "GET" ? null : req.body,
    });

    if (req.method !== "GET") {
      await recordAdminMutation(adminId, `bunny_${req.method.toLowerCase()}`, subPath || null, bunnyResponse.ok);
    }

    return new Response(await bunnyResponse.text(), {
      status: bunnyResponse.status,
      headers: {
        ...corsHeaders(req, METHODS),
        "Content-Type": bunnyResponse.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error: unknown) {
    console.error("Bunny proxy error", error);
    return jsonReply(req, { error: "Unable to process the content request." }, 500, METHODS);
  }
});
