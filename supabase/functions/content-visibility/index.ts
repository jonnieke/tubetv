import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifiedAdminId } from '../_shared/admin.ts';
import { recordAdminMutation } from '../_shared/audit.ts';

const BUNNY_ACCESS_KEY = Deno.env.get("BUNNY_ACCESS_KEY");
const LIBRARY_ID = Deno.env.get("BUNNY_LIBRARY_ID");
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "";
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function isAllowedBrowserOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  return !origin || ALLOWED_ORIGINS.includes(origin);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed." }, 405);
  }
  if (!isAllowedBrowserOrigin(req)) {
    return jsonResponse(req, { error: "Origin not allowed." }, 403);
  }
  const adminId = await verifiedAdminId(req);
  if (!adminId) return jsonResponse(req, { error: "Verified admin access is required." }, 403);
  if (!BUNNY_ACCESS_KEY || !LIBRARY_ID) {
    return jsonResponse(req, { error: "Bunny.net configuration is missing." }, 503);
  }

  try {
    const body = await req.json();
    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
    const hidden = body.hidden;
    if (!/^[0-9a-f-]{36}$/i.test(videoId) || typeof hidden !== "boolean") {
      return jsonResponse(req, { error: "A valid videoId and hidden flag are required." }, 400);
    }

    const bunnyUrl = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}`;
    const headers = {
      AccessKey: BUNNY_ACCESS_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const currentResponse = await fetch(bunnyUrl, { headers });
    if (!currentResponse.ok) {
      return jsonResponse(req, { error: "Unable to load the video." }, currentResponse.status);
    }

    const currentVideo = await currentResponse.json();
    const currentTags = Array.isArray(currentVideo.metaTags) ? currentVideo.metaTags : [];
    const metaTags = currentTags.filter(
      (tag: { property?: unknown }) => String(tag.property || "").toLowerCase() !== "muted",
    );
    if (hidden) metaTags.push({ property: "muted", value: "true" });

    const updateResponse = await fetch(bunnyUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ metaTags }),
    });
    if (!updateResponse.ok) {
      return jsonResponse(req, { error: "Unable to update video visibility." }, updateResponse.status);
    }
    await recordAdminMutation(adminId, hidden ? 'hide_video' : 'show_video', videoId, true);

    return jsonResponse(req, { videoId, hidden }, 200);
  } catch (error: unknown) {
    console.error("Content visibility error", error);
    return jsonResponse(req, { error: "Unable to update video visibility." }, 500);
  }
});
