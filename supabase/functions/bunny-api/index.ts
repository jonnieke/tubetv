import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifiedAdminId } from '../_shared/admin.ts';
import { recordAdminMutation } from '../_shared/audit.ts';

const BUNNY_ACCESS_KEY = Deno.env.get("BUNNY_ACCESS_KEY");
const LIBRARY_ID = Deno.env.get("BUNNY_LIBRARY_ID");
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((origin) => origin.trim()).filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "";
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!BUNNY_ACCESS_KEY || !LIBRARY_ID) {
    return jsonResponse(req, { error: "Bunny.net configuration is missing." }, 503);
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const bunnyApiIndex = pathParts.findIndex((part) => part === "bunny-api");
    const subPath = bunnyApiIndex >= 0 ? pathParts.slice(bunnyApiIndex + 1).join("/") : "";

    const adminId = await verifiedAdminId(req);
    if (!adminId) return jsonResponse(req, { error: "Verified admin access is required." }, 403);
    if (subPath && !/^[0-9a-f-]{36}(?:\/thumbnail)?$/i.test(subPath)) {
      return jsonResponse(req, { error: "Invalid content path." }, 400);
    }
    if (!["GET", "POST", "PUT"].includes(req.method)) return jsonResponse(req, { error: "Method not allowed." }, 405);

    let bunnyUrl = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`;
    if (subPath) bunnyUrl += `/${subPath}`;
    if (url.search) bunnyUrl += url.search;

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
      // Pass the incoming stream through instead of holding a second full copy
      // of uploaded media inside the memory-limited Edge Function worker.
      body: req.method === "GET" || req.method === "HEAD" ? null : req.body,
    });

    if (req.method !== 'GET') await recordAdminMutation(adminId, `bunny_${req.method.toLowerCase()}`, subPath || null, bunnyResponse.ok);

    return new Response(await bunnyResponse.text(), {
      status: bunnyResponse.status,
      headers: {
        ...corsHeaders(req),
        "Content-Type": bunnyResponse.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error: unknown) {
    console.error("Bunny proxy error", error);
    return jsonResponse(req, { error: "Unable to process the content request." }, 500);
  }
});
