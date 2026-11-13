import type { IncomingMessage, ServerResponse } from 'http';

interface RequestWithQuery extends IncomingMessage {
  query?: Record<string, string | string[]>;
  url?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: RequestWithQuery, res: ServerResponse) {
  const url = new URL(req.url || '', 'https://www.tube.co.ke');
  const id = (url.searchParams.get('id') || '').trim();

  if (!id || !UUID_RE.test(id)) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.setHeader('Cache-Control', 'no-store');
    res.end();
    return;
  }

  const rawSiteUrl = (process.env.VITE_SITE_URL || 'https://www.tube.co.ke').replace(/\/$/, '');
  const siteUrl = /^https:\/\//i.test(rawSiteUrl) ? rawSiteUrl : 'https://www.tube.co.ke';
  const pullZone = (
    process.env.VITE_BUNNY_PULL_ZONE ||
    process.env.BUNNY_PULL_ZONE ||
    'vz-0fe79b1a-8ad.b-cdn.net'
  ).replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://bbwtdnsgojztxckmkhpz.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let title = 'TubeTV | Watch Kenyan Stories';
  let description = 'Watch Kenyan micro dramas, series, movies and originals on TubeTV.';
  let thumbnail = pullZone ? `https://${pullZone}/${id}/thumbnail.jpg` : `${siteUrl}/og-default.png`;
  let uploadDate: string | undefined;
  let durationIso: string | undefined;
  let genre = '';
  let seriesTitle = '';
  let episodeLabel = '';
  let creator = 'TubeTV';
  let transcriptExcerpt = '';
  let isAccessibleForFree = false;
  let fetchedItem = false;

  if (supabaseUrl && anonKey) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/public-catalogue?id=${encodeURIComponent(id)}`, {
        headers: { apikey: anonKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      if (response.ok) {
        const data = await response.json();
        const item = data?.item;
        if (item) {
          fetchedItem = true;
          title = `${item.title} | TubeTV`;
          const metaTags = Array.isArray(item.metaTags) ? item.metaTags : [];
          const getMeta = (prop: string) =>
            metaTags.find((t: { property: string; value: string }) => t.property?.toLowerCase() === prop.toLowerCase())
              ?.value || '';
          description =
            getMeta('episodeSynopsis') || getMeta('description') || getMeta('seriesSynopsis') || description;
          const customThumb = getMeta('seriesPosterUrl').trim() || getMeta('thumbnailUrl').trim();
          if (/^https:\/\//i.test(customThumb)) {
            thumbnail = customThumb;
          } else if (pullZone) {
            thumbnail = `https://${pullZone}/${id}/${item.thumbnailFileName || 'thumbnail.jpg'}`;
          }
          if (item.dateUploaded && !Number.isNaN(Date.parse(item.dateUploaded))) {
            uploadDate = new Date(item.dateUploaded).toISOString();
          }
          if (typeof item.length === 'number' && Number.isFinite(item.length) && item.length > 0) {
            durationIso = `PT${Math.round(item.length)}S`;
          }
          genre = getMeta('genre').trim() || getMeta('category').trim();
          seriesTitle = getMeta('seriesTitle').trim() || getMeta('series').trim();
          const epNum = Number(getMeta('episode'));
          if (Number.isFinite(epNum) && epNum > 0) {
            episodeLabel = `Episode ${epNum}`;
          }
          creator = getMeta('author').trim() || getMeta('creator').trim() || 'TubeTV';
          transcriptExcerpt = getMeta('transcript').trim().slice(0, 600);
          const categoryLower = getMeta('category').trim().toLowerCase();
          const isShort = categoryLower === 'shorts' || getMeta('isShort').trim().toLowerCase() === 'true';
          const freeEpisodes = Number(getMeta('freeEpisodes'));
          const freeLimit = Number.isFinite(freeEpisodes) && freeEpisodes >= 0 ? freeEpisodes : 2;
          isAccessibleForFree =
            isShort ||
            (Number.isFinite(epNum) && epNum > 0 && epNum <= freeLimit) ||
            getMeta('accessTier').trim().toLowerCase() === 'free';
        }
      }
    } catch {
      // Best-effort metadata fetching; fall back to default template with no-store
    }
  }

  if (!/^https:\/\//i.test(thumbnail)) {
    thumbnail = `${siteUrl}/og-default.png`;
  }

  const safeVideoUrl = escapeHtml(`${siteUrl}/watch/${encodeURIComponent(id)}`);
  const safePath = escapeHtml(`/watch/${encodeURIComponent(id)}`);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeThumbnail = escapeHtml(thumbnail);

  const videoSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title.replace(/\s*\|\s*TubeTV$/i, ''),
    description,
    thumbnailUrl: [thumbnail],
    url: `${siteUrl}/watch/${encodeURIComponent(id)}`,
    inLanguage: ['en-KE', 'sw-KE'],
    isAccessibleForFree,
    ...(uploadDate ? { uploadDate } : {}),
    ...(durationIso ? { duration: durationIso } : {}),
    ...(genre ? { genre } : {}),
    ...(transcriptExcerpt ? { transcript: transcriptExcerpt } : {}),
    ...(seriesTitle
      ? {
          partOfSeries: {
            '@type': 'TVSeries',
            name: seriesTitle,
          },
        }
      : {}),
    creator: {
      '@type': 'Organization',
      name: creator,
    },
    publisher: {
      '@type': 'Organization',
      name: 'TubeTV',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/icon-512.png`,
      },
    },
  };

  const html = `<!doctype html>
<html lang="en-KE">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${safeVideoUrl}" />

    <!-- Open Graph / WhatsApp / Facebook / Apple Messages -->
    <meta property="og:type" content="video.other" />
    <meta property="og:url" content="${safeVideoUrl}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeThumbnail}" />
    <meta property="og:image:secure_url" content="${safeThumbnail}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:locale" content="en_KE" />
    <meta property="og:site_name" content="TubeTV" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${safeVideoUrl}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeThumbnail}" />
    <meta name="twitter:image:alt" content="${safeTitle}" />

    <!-- JSON-LD Video Structured Data for Google Search & Discover -->
    <script type="application/ld+json">
${JSON.stringify(videoSchema, null, 2)}
    </script>
  </head>
  <body style="background:#09090b;color:#fff;font-family:sans-serif;padding:2rem;text-align:center;max-width:720px;margin:0 auto;">
    <main>
      <h1>${safeTitle}</h1>
      ${seriesTitle || episodeLabel || genre ? `<p style="color:#a1a1aa;font-size:0.9rem;">${escapeHtml([seriesTitle, episodeLabel, genre, creator].filter(Boolean).join(' • '))}</p>` : ''}
      <p>${safeDescription}</p>
      ${transcriptExcerpt ? `<section aria-label="Transcript preview"><p style="color:#d4d4d8;font-size:0.85rem;">${escapeHtml(transcriptExcerpt)}</p></section>` : ''}
      <p><a href="${safePath}" style="color:#ef4444;font-weight:bold;text-decoration:none;">Watch on TubeTV &rarr;</a></p>
    </main>
  </body>
</html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    fetchedItem ? 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' : 'no-store',
  );
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
