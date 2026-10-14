import type { IncomingMessage, ServerResponse } from 'http';

interface RequestWithQuery extends IncomingMessage {
  query?: Record<string, string | string[]>;
  url?: string;
}

export default async function handler(req: RequestWithQuery, res: ServerResponse) {
  const url = new URL(req.url || '', 'https://www.tube.co.ke');
  const id = (url.searchParams.get('id') || '').trim();

  // Validate GUID format
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.end();
    return;
  }

  const siteUrl = process.env.VITE_SITE_URL || 'https://www.tube.co.ke';
  const pullZone = (process.env.VITE_BUNNY_PULL_ZONE || 'vz-0fe79b1a-8ad.b-cdn.net').replace(/\/$/, '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  let title = 'TubeTV | Watch Video';
  let description = 'Watch Kenyan micro dramas, series, movies and originals on TubeTV.';
  let thumbnail = `https://${pullZone}/${id}/thumbnail.jpg`;

  if (supabaseUrl && anonKey) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/public-catalogue?id=${encodeURIComponent(id)}`, {
        headers: { apikey: anonKey, Accept: 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        const item = data.item;
        if (item) {
          title = `${item.title} | TubeTV`;
          const metaTags = Array.isArray(item.metaTags) ? item.metaTags : [];
          const getMeta = (prop: string) =>
            metaTags.find((t: { property: string; value: string }) => t.property?.toLowerCase() === prop.toLowerCase())?.value || '';
          description = getMeta('episodeSynopsis') || getMeta('description') || getMeta('seriesSynopsis') || description;
          thumbnail = getMeta('thumbnailUrl') || `https://${pullZone}/${id}/${item.thumbnailFileName || 'thumbnail.jpg'}`;
        }
      }
    } catch {
      // Best-effort metadata fetching; fall back to default template on error
    }
  }

  const videoUrl = `${siteUrl}/watch/${encodeURIComponent(id)}`;

  const html = `<!doctype html>
<html lang="en-KE">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${videoUrl}" />

    <!-- Open Graph / WhatsApp / Facebook -->
    <meta property="og:type" content="video.other" />
    <meta property="og:url" content="${videoUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(thumbnail)}" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />
    <meta property="og:site_name" content="TubeTV" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(thumbnail)}" />

    <meta http-equiv="refresh" content="0;url=/watch/${encodeURIComponent(id)}" />
    <script>window.location.replace('/watch/${encodeURIComponent(id)}');</script>
  </head>
  <body style="background:#09090b;color:#fff;font-family:sans-serif;padding:2rem;text-align:center;">
    <p>Opening <a href="/watch/${encodeURIComponent(id)}" style="color:#ef4444;">${escapeHtml(title)}</a>...</p>
  </body>
</html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.end(html);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
