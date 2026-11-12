import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifiedAdminId } from "../_shared/admin.ts";
import { recordAdminMutation } from "../_shared/audit.ts";
import { corsHeaders, isOriginAllowed, jsonReply } from "../_shared/cors.ts";
import { sha256Hex } from "../_shared/passToken.ts";

const METHODS = "POST, OPTIONS";
const FORMATS = ["feature", "series", "micro-drama", "documentary", "short", "other"];
const STATUSES = ["new", "reviewing", "accepted", "declined"];
const MAX_PER_IP_PER_HOUR = 4;

const memoryHits = new Map<string, { count: number; resetAt: number }>();
function memoryLimited(key: string, max: number): boolean {
  const now = Date.now();
  const hit = memoryHits.get(key);
  if (!hit || now > hit.resetAt) {
    memoryHits.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  hit.count += 1;
  return hit.count > max;
}

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

function clean(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function httpsUrl(value: unknown, max = 500): string | null {
  const raw = clean(value, max);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, METHODS) });
  }
  if (req.method !== "POST") return jsonReply(req, { error: "Method not allowed." }, 405, METHODS);
  if (!isOriginAllowed(req)) return jsonReply(req, { error: "Origin not allowed." }, 403, METHODS);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return jsonReply(req, { ok: false, error: "Service not configured." }, 200, METHODS);
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "submit");

  // ─── Public: submit a project ───
  if (action === "submit") {
    const ip = clientIp(req);
    if (memoryLimited(`submit:${ip}`, 6)) {
      return jsonReply(req, { ok: false, error: "Too many attempts. Please wait a minute and try again." }, 200, METHODS);
    }

    // Honeypot: real people never fill the hidden "website" field.
    if (clean(body.website, 200)) return jsonReply(req, { ok: true }, 200, METHODS);

    const fullName = clean(body.fullName, 120);
    const email = clean(body.email, 200).toLowerCase();
    const filmTitle = clean(body.filmTitle, 200);
    const synopsis = clean(body.synopsis, 2000);
    const format = clean(body.format, 30);
    const trailerUrl = httpsUrl(body.trailerUrl);
    const screenerUrl = body.screenerUrl ? httpsUrl(body.screenerUrl) : null;

    if (fullName.length < 2) return jsonReply(req, { ok: false, error: "Please enter your full name." }, 200, METHODS);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return jsonReply(req, { ok: false, error: "Please enter a valid email address." }, 200, METHODS);
    }
    if (!filmTitle) return jsonReply(req, { ok: false, error: "Please enter the title of your project." }, 200, METHODS);
    if (!FORMATS.includes(format)) return jsonReply(req, { ok: false, error: "Please choose a format." }, 200, METHODS);
    if (synopsis.length < 20) {
      return jsonReply(req, { ok: false, error: "Tell us a little more — the synopsis needs at least 20 characters." }, 200, METHODS);
    }
    if (!trailerUrl) {
      return jsonReply(req, { ok: false, error: "Add a trailer link (a public https:// URL, e.g. YouTube or Vimeo)." }, 200, METHODS);
    }
    if (body.screenerUrl && !screenerUrl) {
      return jsonReply(req, { ok: false, error: "The screener link must be a public https:// URL." }, 200, METHODS);
    }
    if (body.rightsConfirmed !== true) {
      return jsonReply(req, { ok: false, error: "Please confirm you own or control the rights to this work." }, 200, METHODS);
    }

    // Durable per-IP limit across cold starts (hashed — raw IPs are never stored).
    const ipHash = await sha256Hex(`filmmaker:${ip}`);
    const { count } = await service
      .from("filmmaker_submissions")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gt("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) {
      return jsonReply(req, { ok: false, error: "You've sent several submissions recently. Please try again later." }, 200, METHODS);
    }

    const { error } = await service.from("filmmaker_submissions").insert({
      full_name: fullName,
      email,
      phone: clean(body.phone, 40) || null,
      country: clean(body.country, 80) || null,
      studio_name: clean(body.studioName, 160) || null,
      film_title: filmTitle,
      format,
      synopsis,
      trailer_url: trailerUrl,
      screener_url: screenerUrl,
      rights_confirmed: true,
      ip_hash: ipHash,
    });
    if (error) {
      console.error("filmmaker_submission_insert_error", error.code);
      return jsonReply(req, { ok: false, error: "We couldn't save your submission. Please try again." }, 200, METHODS);
    }
    return jsonReply(req, { ok: true }, 200, METHODS);
  }

  // ─── Admin: review queue ───
  const adminId = await verifiedAdminId(req);
  if (!adminId) return jsonReply(req, { ok: false, error: "Verified admin access is required." }, 200, METHODS);

  if (action === "list") {
    const status = clean(body.status, 20);
    let query = service
      .from("filmmaker_submissions")
      .select(
        "id, created_at, full_name, email, phone, country, studio_name, film_title, format, synopsis, trailer_url, screener_url, status, admin_notes, reviewed_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (STATUSES.includes(status)) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return jsonReply(req, { ok: false, error: "Could not load submissions." }, 200, METHODS);

    const { data: counts } = await service.from("filmmaker_submissions").select("status");
    const tally: Record<string, number> = { new: 0, reviewing: 0, accepted: 0, declined: 0 };
    for (const row of counts || []) tally[row.status] = (tally[row.status] || 0) + 1;
    return jsonReply(req, { ok: true, submissions: data || [], counts: tally }, 200, METHODS);
  }

  if (action === "update") {
    const id = clean(body.id, 60);
    const status = clean(body.status, 20);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !STATUSES.includes(status)) {
      return jsonReply(req, { ok: false, error: "Invalid update." }, 200, METHODS);
    }
    const { error } = await service
      .from("filmmaker_submissions")
      .update({
        status,
        admin_notes: clean(body.adminNotes, 2000) || null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    await recordAdminMutation(adminId, "filmmaker_submission_review", id, !error);
    if (error) return jsonReply(req, { ok: false, error: "Could not save review." }, 200, METHODS);
    return jsonReply(req, { ok: true }, 200, METHODS);
  }

  return jsonReply(req, { ok: false, error: "Unknown action." }, 200, METHODS);
});
