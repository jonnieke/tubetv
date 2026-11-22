import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed.' }));
    return;
  }

  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://bbwtdnsgojztxckmkhpz.supabase.co'
  ).replace(/\/$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const siteUrl = (process.env.VITE_SITE_URL || 'https://www.tube.co.ke').replace(/\/$/, '');

  const parsed = new URL(req.url || '/api/catalogue', siteUrl);
  const id = parsed.searchParams.get('id');
  const page = parsed.searchParams.get('page') || '1';
  const itemsPerPage = parsed.searchParams.get('itemsPerPage') || '100';
  const fresh = parsed.searchParams.get('fresh') === '1';

  const upstreamParams = new URLSearchParams();
  if (id) {
    upstreamParams.set('id', id);
  } else {
    upstreamParams.set('page', page);
    upstreamParams.set('itemsPerPage', itemsPerPage);
    upstreamParams.set('orderBy', 'date');
  }
  if (fresh) {
    upstreamParams.set('fresh', '1');
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Origin: siteUrl,
    };
    if (anonKey) {
      headers.apikey = anonKey;
      headers.Authorization = `Bearer ${anonKey}`;
    }

    const upstream = await fetch(`${supabaseUrl}/functions/v1/public-catalogue?${upstreamParams.toString()}`, {
      headers,
      signal: AbortSignal.timeout(12_000),
    });

    const body = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      upstream.ok && !fresh
        ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800'
        : 'no-store',
    );
    res.setHeader('CDN-Cache-Control', upstream.ok && !fresh ? 'public, s-maxage=300, stale-while-revalidate=1800' : 'no-store');
    res.setHeader('X-Catalogue-Proxy', 'vercel-cdn');
    res.end(body);
  } catch (error) {
    console.error('catalogue_proxy_error', error);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Catalogue unavailable.' }));
  }
}
