export function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const configured = raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const expanded = new Set(configured);
  expanded.add("https://www.tube.co.ke");
  expanded.add("https://tube.co.ke");
  expanded.add("https://tubetv-now.vercel.app");
  for (const item of configured) {
    if (item === "https://www.tube.co.ke") expanded.add("https://tube.co.ke");
    if (item === "https://tube.co.ke") expanded.add("https://www.tube.co.ke");
  }
  return [...expanded];
}

export function isOriginAllowed(req: Request): boolean {
  const origin = (req.headers.get("Origin") || "").trim().replace(/\/$/, "");
  if (!origin) return true; // Non-browser / server-to-server request
  const allowed = parseAllowedOrigins();
  if (allowed.includes(origin)) return true;

  try {
    const url = new URL(origin);
    if (url.hostname === "tube.co.ke" || url.hostname.endsWith(".tube.co.ke")) return true;
    if (url.hostname.endsWith(".vercel.app")) return true;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
  } catch {
    // Malformed origin
  }
  return false;
}

export function corsHeaders(
  req: Request,
  methods = "GET, POST, OPTIONS",
  extraHeaders: Record<string, string> = {},
): Record<string, string> {
  const origin = (req.headers.get("Origin") || "").trim().replace(/\/$/, "");
  const matchedOrigin = isOriginAllowed(req) && origin ? origin : "";

  return {
    ...(matchedOrigin ? { "Access-Control-Allow-Origin": matchedOrigin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, idempotency-key, x-pass-token",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    ...extraHeaders,
  };
}

export function jsonReply(
  req: Request,
  body: unknown,
  status = 200,
  methods = "GET, POST, OPTIONS",
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req, methods, extraHeaders),
      "Content-Type": "application/json",
    },
  });
}

