import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifiedAdminId } from "../_shared/admin.ts";
import { recordAdminMutation } from "../_shared/audit.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";

const BUNNY_ACCESS_KEY = Deno.env.get("BUNNY_ACCESS_KEY");
const LIBRARY_ID = Deno.env.get("BUNNY_LIBRARY_ID");
const METHODS = "POST, OPTIONS";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) });
  }
  if (req.method !== "POST") {
    return jsonReply(req, { error: "Method not allowed." }, 405, METHODS);
  }
  if (!isOriginAllowed(req)) {
    return jsonReply(req, { error: "Origin not allowed." }, 403, METHODS);
  }
  const adminId = await verifiedAdminId(req);
  if (!adminId) {
    return jsonReply(req, { error: "Verified admin access is required." }, 403, METHODS);
  }
  if (!BUNNY_ACCESS_KEY || !LIBRARY_ID) {
    return jsonReply(req, { error: "Bunny.net configuration is missing." }, 503, METHODS);
  }

  try {
    const body = await req.json();
    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
    const hidden = body.hidden;
    if (!/^[0-9a-f-]{36}$/i.test(videoId) || typeof hidden !== "boolean") {
      return jsonReply(req, { error: "A valid videoId and hidden flag are required." }, 400, METHODS);
    }

    const bunnyUrl = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}`;
    const headers = {
      AccessKey: BUNNY_ACCESS_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const currentResponse = await fetch(bunnyUrl, { headers, signal: AbortSignal.timeout(8_000) });
    if (!currentResponse.ok) {
      return jsonReply(req, { error: "Unable to load the video." }, currentResponse.status, METHODS);
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
      signal: AbortSignal.timeout(8_000),
    });
    if (!updateResponse.ok) {
      return jsonReply(req, { error: "Unable to update video visibility." }, updateResponse.status, METHODS);
    }
    await recordAdminMutation(adminId, hidden ? "hide_video" : "show_video", videoId, true);

    return jsonReply(req, { videoId, hidden }, 200, METHODS, { "Cache-Control": "no-store" });
  } catch (error: unknown) {
    console.error("Content visibility error", error);
    return jsonReply(req, { error: "Unable to update video visibility." }, 500, METHODS);
  }
});
