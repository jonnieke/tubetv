import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BUNNY_ACCESS_KEY = Deno.env.get("BUNNY_ACCESS_KEY");
const LIBRARY_ID = Deno.env.get("BUNNY_LIBRARY_ID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accesskey",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!BUNNY_ACCESS_KEY || !LIBRARY_ID) {
    return new Response(
      JSON.stringify({ error: "Bunny.net configuration missing in Edge Function secrets." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Path is like: /functions/v1/bunny-api/{videoId}/thumbnail
    // We want only the parts AFTER "bunny-api"
    const bunnyApiIndex = pathParts.findIndex(p => p === 'bunny-api');
    const subPath = bunnyApiIndex >= 0 ? pathParts.slice(bunnyApiIndex + 1).join("/") : '';
    
    let bunnyUrl = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`;
    if (subPath) {
      bunnyUrl += `/${subPath}`;
    }
    
    // Append query params
    if (url.search) {
      bunnyUrl += url.search;
    }

    console.log(`Proxying ${req.method} to: ${bunnyUrl}`);

    const bunnyResponse = await fetch(bunnyUrl, {
      method: req.method,
      headers: {
        AccessKey: BUNNY_ACCESS_KEY,
        "Content-Type": req.headers.get("Content-Type") || "application/json",
        Accept: "application/json",
      },
      body: req.method === "GET" ? null : await req.arrayBuffer(),
    });

    const data = await bunnyResponse.text();
    
    return new Response(data, {
      status: bunnyResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": bunnyResponse.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Bunny Proxy Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
