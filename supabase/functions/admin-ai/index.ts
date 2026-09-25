import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifiedAdminId } from '../_shared/admin.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const origins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
const key = Deno.env.get('GEMINI_API_KEY');
function headers(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    ...(origins.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}
function reply(req: Request, body: unknown, status: number) { return new Response(JSON.stringify(body), { status, headers: headers(req) }); }
serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, {status:204,headers:headers(req)});
  if (req.method !== 'POST') return reply(req,{error:'Method not allowed.'},405);
  const origin = req.headers.get('Origin');
  if (origin && !origins.includes(origin)) return reply(req,{error:'Origin not allowed.'},403);
  const adminId = await verifiedAdminId(req);
  if (!adminId) return reply(req,{error:'Verified admin access required.'},403);
  if (!key) return reply(req,{error:'AI service is not configured.'},503);
  const rawBody = await req.text().catch(() => '');
  if (rawBody.length > 2048) return reply(req,{error:'Request too large.'},413);
  let body: Record<string, unknown> | null = null;
  try { body = JSON.parse(rawBody); } catch { /* Invalid JSON is handled below. */ }
  if (!body || !['metadata','thumbnail'].includes(body.action) || typeof body.input !== 'string' || body.input.length < 2 || body.input.length > 500) return reply(req,{error:'Invalid request.'},400);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return reply(req,{error:'AI service is not configured.'},503);
  const service = createClient(url, serviceKey, {auth:{persistSession:false,autoRefreshToken:false}});
  const { data: permitted, error: quotaError } = await service.rpc('consume_admin_ai_quota',{p_admin_id:adminId,p_limit:20});
  if (quotaError) { console.error('admin_ai_quota_error',quotaError); return reply(req,{error:'AI service is unavailable.'},503); }
  if (!permitted) return reply(req,{error:'Daily AI limit reached.'},429);
  const isImage = body.action === 'thumbnail';
  const prompt = isImage
    ? `Create a cinematic 16:9 streaming thumbnail for this topic. No text or logos. ${body.input}`
    : `Suggest honest, concise streaming metadata using only this filename and size: ${body.input}. Do not invent actors or plot details. Reply as JSON object with title and description; if uncertain, keep description general.`;
  const model = isImage ? 'gemini-2.5-flash-image' : 'gemini-2.5-flash';
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:isImage ? {maxOutputTokens:512} : {responseMimeType:'application/json',maxOutputTokens:350}}),
      signal:AbortSignal.timeout(30000),
    });
    if (!upstream.ok) { console.error('admin_ai_upstream_error',{adminId,status:upstream.status}); return reply(req,{error:'AI service unavailable.'},502); }
    const data = await upstream.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    if (isImage) {
      const image = parts.find((part: {inlineData?: {mimeType?: string; data?: string}}) => part.inlineData?.data)?.inlineData;
      if (!image?.data || !['image/png','image/jpeg','image/webp'].includes(image.mimeType) || image.data.length > 4_000_000) return reply(req,{error:'No suitable image was generated.'},502);
      console.info('admin_ai_thumbnail',{adminId});
      return reply(req,{image:`data:${image.mimeType};base64,${image.data}`},200);
    }
    const text = parts.find((part: {text?: string}) => typeof part.text === 'string')?.text || '';
    const metadata = JSON.parse(text);
    if (typeof metadata.title !== 'string' || typeof metadata.description !== 'string') return reply(req,{error:'Invalid AI response.'},502);
    console.info('admin_ai_metadata',{adminId});
    return reply(req,{title:metadata.title.slice(0,150),description:metadata.description.slice(0,700)},200);
  } catch (error) { console.error('admin_ai_error',error); return reply(req,{error:'AI service unavailable.'},502); }
});
