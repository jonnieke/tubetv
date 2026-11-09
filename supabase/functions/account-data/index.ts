import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifiedAdminId } from "../_shared/admin.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";

const METHODS = "POST, OPTIONS";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) });
  }
  if (req.method !== "POST") {
    return jsonReply(req, { error: "Method not allowed." }, 405, METHODS);
  }
  if (!isOriginAllowed(req)) {
    return jsonReply(req, { error: "Origin not allowed." }, 403, METHODS);
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !serviceKey || !token) {
    return jsonReply(req, { error: "Authentication is required." }, 401, METHODS);
  }

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonReply(req, { error: "Invalid session." }, 401, METHODS);
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
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
      { name: "push_subscriptions", ownerColumn: "user_id" },
    ];
    const records: Record<string, unknown> = {};
    for (const table of tables) {
      const { data, error } = await service.from(table.name).select("*").eq(table.ownerColumn, user.id);
      records[table.name] = error ? { unavailable: true } : data;
    }
    return jsonReply(
      req,
      {
        exportedAt: new Date().toISOString(),
        account: {
          id: user.id,
          email: user.email || null,
          phone: user.phone || null,
          createdAt: user.created_at,
        },
        records,
      },
      200,
      METHODS,
      { "Cache-Control": "no-store" },
    );
  }

  if (action === "delete") {
    if (body.confirmation !== "DELETE") {
      return jsonReply(req, { error: "Type DELETE to confirm account deletion." }, 400, METHODS);
    }

    // Require MFA (aal2) before deleting an administrator account
    if (user.app_metadata?.role === "admin") {
      const mfaAdmin = await verifiedAdminId(req);
      if (!mfaAdmin) {
        return jsonReply(req, { error: "MFA verification is required to delete an admin account." }, 403, METHODS);
      }
    }

    // Scrub phone PII while retaining anonymized KRA financial audit ledger rows
    await Promise.all([
      service.from("videos").update({ creator_phone: null }).eq("creator_id", user.id),
      service
        .from("payment_transactions")
        .update({ phone_e164: "REDACTED", user_id: null })
        .eq("user_id", user.id),
      service
        .from("subscriptions")
        .update({ phone: "REDACTED", is_active: false, user_id: null })
        .eq("user_id", user.id),
    ]);

    const { error } = await service.auth.admin.deleteUser(user.id);
    if (error) {
      return jsonReply(req, { error: "Account deletion failed." }, 500, METHODS);
    }
    return jsonReply(req, { deleted: true }, 200, METHODS, { "Cache-Control": "no-store" });
  }

  return jsonReply(req, { error: "Unknown action." }, 400, METHODS);
});
