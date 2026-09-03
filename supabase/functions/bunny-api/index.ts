import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BUNNY_ACCESS_KEY = Deno.env.get("BUNNY_ACCESS_KEY");
const LIBRARY_ID = Deno.env.get("BUNNY_LIBRARY_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const ADMIN_PIN = Deno.env.get("ADMIN_PIN");
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((origin) => origin.trim()).filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "";
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin",
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

async function isAdminRequest(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY },
  });
  if (!userResponse.ok) return false;

  const user = await userResponse.json();
  return user.app_metadata?.role === "admin";
}

function isPinAuthorizedUpdate(req: Request, subPath: string) {
  if (!ADMIN_PIN || req.headers.get("x-admin-pin") !== ADMIN_PIN) return false;
  if (req.method !== "POST") return false;

  // During the test phase, the shared PIN is deliberately limited to updating
  // metadata on an existing video or replacing that video's thumbnail.
  return /^[0-9a-f-]{36}(?:\/thumbnail)?$/i.test(subPath);
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

    if (
      req.method !== "GET" &&
      !isPinAuthorizedUpdate(req, subPath) &&
      !(await isAdminRequest(req))
    ) {
      return jsonResponse(req, { error: "Admin access is required to modify content." }, 403);
    }

    let bunnyUrl = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`;
    if (subPath) bunnyUrl += `/${subPath}`;
    if (url.search) bunnyUrl += url.search;

    const bunnyResponse = await fetch(bunnyUrl, {
      method: req.method,
      headers: {
        AccessKey: BUNNY_ACCESS_KEY,
        "Content-Type": req.headers.get("Content-Type") || "application/json",
        Accept: "application/json",
      },
      body: req.method === "GET" || req.method === "HEAD" ? null : await req.arrayBuffer(),
    });

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
