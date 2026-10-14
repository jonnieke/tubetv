import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { publicItem } from '../_shared/publicCatalog.ts';

const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);
const libraryId = Deno.env.get('BUNNY_LIBRARY_ID');
const accessKey = Deno.env.get('BUNNY_ACCESS_KEY');
const enforceRating = Deno.env.get('ENFORCE_CONTENT_RATINGS') === 'true';

function headers(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}
function reply(req: Request, body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}
serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== 'GET') return reply(req, {error:'Method not allowed.'}, 405);
  const origin = req.headers.get('Origin');
  if (origin && !allowed.includes(origin)) return reply(req, {error:'Origin not allowed.'}, 403);
  if (!libraryId || !accessKey) return reply(req, {error:'Catalogue unavailable.'}, 503);
  const query = new URL(req.url).searchParams;
  const singleId = query.get('id');
  if (singleId) {
    if (!/^[0-9a-f-]{36}$/i.test(singleId)) return reply(req, {error:'Invalid video ID.'}, 400);
    try {
      const upstream = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${singleId}`, {headers:{AccessKey:accessKey,Accept:'application/json'}});
      if (!upstream.ok) return reply(req, {error:'Video not found.'}, upstream.status === 404 ? 404 : 503);
      const data = await upstream.json();
      const item = publicItem(data, enforceRating);
      if (!item) return reply(req, {error:'Video is not available for public playback.'}, 404);
      return reply(req, {item}, 200);
    } catch (error) {
      console.error('public_catalogue_single_error', error);
      return reply(req, {error:'Video unavailable.'}, 503);
    }
  }
  const page = Number(query.get('page') || 1);
  const itemsPerPage = Number(query.get('itemsPerPage') || 100);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !Number.isSafeInteger(itemsPerPage) || itemsPerPage < 10 || itemsPerPage > 100) return reply(req, {error:'Invalid page or page size.'}, 400);
  try {
    const upstream = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=${itemsPerPage}&orderBy=date`, {headers:{AccessKey:accessKey,Accept:'application/json'}});
    if (!upstream.ok) return reply(req, {error:'Catalogue unavailable.'}, 503);
    const data = await upstream.json();
    const items = Array.isArray(data.items) ? data.items.map((item: Record<string, unknown>) => publicItem(item, enforceRating)).filter(Boolean) : [];
    return reply(req, {items, totalItems: Number(data.totalItems) || 0, currentPage: page, itemsPerPage}, 200);
  } catch (error) {
    console.error('public_catalogue_error', error);
    return reply(req, {error:'Catalogue unavailable.'}, 503);
  }
});
