import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function headers(req: Request) {
  const origins = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean);
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = origins.includes(origin) ? origin : origins[0] || "";
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers(req), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !serviceKey || !token) return json(req, { error: "Authentication is required." }, 401);

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return json(req, { error: "Invalid session." }, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const user = authData.user;
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (action === "export") {
    const tables = [
      { name: "profiles", ownerColumn: "id" },
      { name: "subscriptions", ownerColumn: "user_id" },
      { name: "payment_transactions", ownerColumn: "user_id" },
      { name: "watch_later", ownerColumn: "user_id" },
      { name: "watch_progress", ownerColumn: "user_id" },
      { name: "viewer_preferences", ownerColumn: "user_id" },
    ];
    const records: Record<string, unknown> = {};
    for (const table of tables) {
      const { data, error } = await service.from(table.name).select("*").eq(table.ownerColumn, user.id);
      records[table.name] = error ? { unavailable: true } : data;
    }
    return json(req, {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, phone: user.phone, createdAt: user.created_at },
      records,
    });
  }

  if (action === "delete") {
    if (body.confirmation !== "DELETE") return json(req, { error: "Type DELETE to confirm account deletion." }, 400);
    const { error } = await service.auth.admin.deleteUser(user.id);
    if (error) return json(req, { error: "Account deletion failed." }, 500);
    return json(req, { deleted: true });
  }

  return json(req, { error: "Unknown action." }, 400);
});
