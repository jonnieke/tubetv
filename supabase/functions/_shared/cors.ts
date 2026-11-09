export function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || "";
  const configured = raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  // If https://www.tube.co.ke is configured, automatically allow apex https://tube.co.ke as well (and vice-versa)
  const expanded = new Set(configured);
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
  return allowed.includes(origin);
}

export function corsHeaders(
  req: Request,
  methods = "GET, POST, OPTIONS",
  extraHeaders: Record<string, string> = {},
): Record<string, string> {
  const allowed = parseAllowedOrigins();
  const origin = (req.headers.get("Origin") || "").trim().replace(/\/$/, "");
  const matchedOrigin = origin && allowed.includes(origin) ? origin : "";

  return {
    ...(matchedOrigin ? { "Access-Control-Allow-Origin": matchedOrigin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, idempotency-key, x-pass-token",
    "Access-Control-Allow-Methods": methods,
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

