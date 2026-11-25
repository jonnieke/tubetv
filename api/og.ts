import type { IncomingMessage, ServerResponse } from 'http';

interface RequestWithQuery extends IncomingMessage {
  query?: Record<string, string | string[]>;
  url?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: RequestWithQuery, res: ServerResponse) {
  const url = new URL(req.url || '', 'https://www.tube.co.ke');
  const id = (url.searchParams.get('id') || '').trim();
  const seriesParam = (url.searchParams.get('series') || '').trim().toLowerCase();
  const landingParam = (url.searchParams.get('landing') || '').trim().toLowerCase();

  if (landingParam === 'cinema') {
    const rawSiteUrl = (process.env.VITE_SITE_URL || 'https://www.tube.co.ke').replace(/\/$/, '');
    const siteUrl = /^https:\/\//i.test(rawSiteUrl) ? rawSiteUrl : 'https://www.tube.co.ke';
    const cinemaUrl = `${siteUrl}/movies`;
    const cinemaTitle = 'TubeTV Cinema | Unlimited Kenyan Movies & Series';
    const cinemaDesc =
      'Stream full-length Kenyan Movies, Drama Series, School Flix, Kids & Originals on TubeTV Cinema — unlock unlimited access from KSh 10 via M-Pesa.';
    let cinemaThumb = `${siteUrl}/og-default.png`;
    const supabaseUrl =
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      'https://bbwtdnsgojztxckmkhpz.supabase.co';
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && anonKey) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/public-catalogue?page=1&itemsPerPage=40&compact=1`, {
          headers: { apikey: anonKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          const data = await response.json();
          const items = Array.isArray(data?.items) ? data.items : [];
          const movieItem = items.find((it: { metaTags?: Array<{ property?: string; value?: string }>; signedThumbnailUrl?: string }) => {
            const tags = Array.isArray(it.metaTags) ? it.metaTags : [];
            const cat = tags.find((t) => t.property?.toLowerCase() === 'category')?.value?.toLowerCase() || '';
            return (cat === 'movies' || cat === 'series') && typeof it.signedThumbnailUrl === 'string' && it.signedThumbnailUrl.startsWith('https://');
          });
          if (movieItem?.signedThumbnailUrl) {
            cinemaThumb = movieItem.signedThumbnailUrl;
          }
        }
      } catch {
        // Fall back to default OG image
      }
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    res.end(`<!doctype html><html lang="en-KE"><head><meta charset="utf-8" /><title>${escapeHtml(cinemaTitle)}</title><meta name="description" content="${escapeHtml(cinemaDesc)}" /><link rel="canonical" href="${escapeHtml(cinemaUrl)}" /><meta property="og:type" content="website" /><meta property="og:url" content="${escapeHtml(cinemaUrl)}" /><meta property="og:title" content="${escapeHtml(cinemaTitle)}" /><meta property="og:description" content="${escapeHtml(cinemaDesc)}" /><meta property="og:image" content="${escapeHtml(cinemaThumb)}" /><meta property="og:image:secure_url" content="${escapeHtml(cinemaThumb)}" /><meta property="og:locale" content="en_KE" /><meta property="og:site_name" content="TubeTV" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${escapeHtml(cinemaTitle)}" /><meta name="twitter:description" content="${escapeHtml(cinemaDesc)}" /><meta name="twitter:image" content="${escapeHtml(cinemaThumb)}" /></head><body style="background:#09090b;color:#fff;font-family:system-ui,sans-serif;padding:2rem;text-align:center;"><h1>${escapeHtml(cinemaTitle)}</h1><p>${escapeHtml(cinemaDesc)}</p><p><a href="/movies" style="color:#ef4444;font-weight:bold;">Open TubeTV Cinema &rarr;</a></p></body></html>`);
    return;
  }

  if (!seriesParam && (!id || !UUID_RE.test(id))) {
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
  let cleanName = 'TubeTV Story';
  let description = 'Watch Kenyan micro dramas, series, movies and originals on TubeTV.';
  let seriesSynopsisText = '';
  let thumbnail = pullZone ? `https://${pullZone}/${id}/thumbnail.jpg` : `${siteUrl}/og-default.png`;
  let uploadDate: string | undefined;
  let durationIso: string | undefined;
  let durationMinutesLabel = '';
  let category = '';
  let genre = '';
  let seriesTitle = '';
  let episodeLabel = '';
  let creator = 'TubeTV';
  let transcriptExcerpt = '';
  let isAccessibleForFree = false;
  let episodeCount = 0;
  let fetchedItem = false;
  let notFound = false;

  if (supabaseUrl && anonKey) {
    try {
      if (seriesParam) {
        const slugify = (s: string) =>
          s
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        let matched: Array<{ guid?: string; title?: string; thumbnailFileName?: string; signedSeriesPosterUrl?: string; signedThumbnailUrl?: string; metaTags?: Array<{ property?: string; value?: string }> }> = [];
        let sawCatalogueResponse = false;
        for (let page = 1; page <= 5; page += 1) {
          const response = await fetch(`${supabaseUrl}/functions/v1/public-catalogue?page=${page}&itemsPerPage=100`, {
            headers: { apikey: anonKey, Accept: 'application/json' },
            signal: AbortSignal.timeout(4000),
          });
          if (!response.ok) break;
          sawCatalogueResponse = true;
          const data = await response.json();
          const items = Array.isArray(data?.items) ? data.items : [];
          const pageMatched = items.filter((item: { title?: string; metaTags?: Array<{ property?: string; value?: string }> }) => {
            const tags = Array.isArray(item.metaTags) ? item.metaTags : [];
            const st = tags.find((t) => t.property?.toLowerCase() === 'seriestitle')?.value ||
              tags.find((t) => t.property?.toLowerCase() === 'series')?.value ||
              item.title || '';
            return slugify(st) === seriesParam;
          });
          if (pageMatched.length > 0) {
            matched = matched.concat(pageMatched);
          }
          if (items.length < 100) break;
        }
        if (matched.length > 0) {
          fetchedItem = true;
          episodeCount = matched.length;
          const first = matched[0];
          const tags = Array.isArray(first.metaTags) ? first.metaTags : [];
          const getMeta = (prop: string) =>
            tags.find((t: { property?: string; value?: string }) => t.property?.toLowerCase() === prop.toLowerCase())?.value || '';
          seriesTitle = getMeta('seriesTitle') || getMeta('series') || first.title || seriesParam;
          cleanName = seriesTitle;
          title = `${seriesTitle} | TubeTV`;
          category = getMeta('category').trim();
          genre = getMeta('genre').trim() || category;
          creator = getMeta('author') || getMeta('creator') || 'TubeTV';
          seriesSynopsisText = getMeta('seriesSynopsis').trim();
          description =
            seriesSynopsisText ||
            getMeta('description').trim() ||
            `Stream ${seriesTitle} (${episodeCount} ${episodeCount === 1 ? 'episode' : 'episodes'}${genre ? `, ${genre}` : ''}) on TubeTV.`;
          const signedThumb =
            (typeof first.signedSeriesPosterUrl === 'string' && first.signedSeriesPosterUrl) ||
            (typeof first.signedThumbnailUrl === 'string' && first.signedThumbnailUrl) ||
            '';
          const customThumb = getMeta('seriesPosterUrl').trim() || getMeta('thumbnailUrl').trim();
          if (/^https:\/\//i.test(signedThumb)) {
            thumbnail = signedThumb;
          } else if (/^https:\/\//i.test(customThumb)) {
            thumbnail = customThumb;
          } else if (pullZone && first.guid) {
            thumbnail = `https://${pullZone}/${first.guid}/${first.thumbnailFileName || 'thumbnail.jpg'}`;
          }
          isAccessibleForFree = true;
        } else if (sawCatalogueResponse) {
          notFound = true;
        }
      } else {
        const response = await fetch(`${supabaseUrl}/functions/v1/public-catalogue?id=${encodeURIComponent(id)}`, {
          headers: { apikey: anonKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(4000),
        });
        if (response.status === 404) {
          notFound = true;
        } else if (response.ok) {
          const data = await response.json();
          const item = data?.item;
          if (!item) {
            notFound = true;
          } else {
            fetchedItem = true;
            cleanName = String(item.title || 'TubeTV Video').trim().replace(/\.mp4$/i, '');
            title = `${cleanName} | TubeTV`;
            const metaTags = Array.isArray(item.metaTags) ? item.metaTags : [];
            const getMeta = (prop: string) =>
              metaTags.find((t: { property: string; value: string }) => t.property?.toLowerCase() === prop.toLowerCase())
                ?.value || '';
            category = getMeta('category').trim();
            genre = getMeta('genre').trim() || category;
            seriesTitle = getMeta('seriesTitle').trim() || getMeta('series').trim();
            seriesSynopsisText = getMeta('seriesSynopsis').trim();
            const epNum = Number(getMeta('episode'));
            if (Number.isFinite(epNum) && epNum > 0) {
              episodeLabel = `Episode ${epNum}`;
            }
            creator = getMeta('author').trim() || getMeta('creator').trim() || 'TubeTV';
            if (typeof item.length === 'number' && Number.isFinite(item.length) && item.length > 0) {
              const secs = Math.round(item.length);
              durationIso = `PT${secs}S`;
              const mins = Math.floor(secs / 60);
              const remSecs = secs % 60;
              durationMinutesLabel = mins > 0 ? `${mins}m ${remSecs}s` : `${remSecs}s`;
            }
            const explicitDesc =
              getMeta('episodeSynopsis').trim() ||
              getMeta('description').trim() ||
              seriesSynopsisText;
            const contextParts = [seriesTitle, episodeLabel, genre || category, durationMinutesLabel].filter(Boolean).join(' · ');
            description =
              explicitDesc ||
              `Watch "${cleanName}"${contextParts ? ` (${contextParts})` : ''} on TubeTV — Kenyan and African originals, micro dramas, series, and films.`;
            const signedThumb =
              (typeof item.signedSeriesPosterUrl === 'string' && item.signedSeriesPosterUrl) ||
              (typeof item.signedThumbnailUrl === 'string' && item.signedThumbnailUrl) ||
              '';
            const customThumb = getMeta('seriesPosterUrl').trim() || getMeta('thumbnailUrl').trim();
            if (/^https:\/\//i.test(signedThumb)) {
              thumbnail = signedThumb;
            } else if (/^https:\/\//i.test(customThumb)) {
              thumbnail = customThumb;
            } else if (pullZone) {
              thumbnail = `https://${pullZone}/${id}/${item.thumbnailFileName || 'thumbnail.jpg'}`;
            }
            if (item.dateUploaded && !Number.isNaN(Date.parse(item.dateUploaded))) {
              uploadDate = new Date(item.dateUploaded).toISOString();
            }
            transcriptExcerpt = getMeta('transcript').trim().slice(0, 600);
            const categoryLower = category.toLowerCase();
            const isShort = categoryLower === 'shorts' || getMeta('isShort').trim().toLowerCase() === 'true';
            const freeEpisodes = Number(getMeta('freeEpisodes'));
            const freeLimit = Number.isFinite(freeEpisodes) && freeEpisodes >= 0 ? freeEpisodes : 2;
            isAccessibleForFree =
              isShort ||
              (Number.isFinite(epNum) && epNum > 0 && epNum <= freeLimit) ||
              getMeta('accessTier').trim().toLowerCase() === 'free';
          }
        }
      }
    } catch {
      // Best-effort metadata fetching; fall back to default template with no-store
    }
  }

  if (!/^https:\/\//i.test(thumbnail)) {
    thumbnail = `${siteUrl}/og-default.png`;
  }

  const canonicalPath = seriesParam ? `/series/${encodeURIComponent(seriesParam)}` : `/watch/${encodeURIComponent(id)}`;
  const safeVideoUrl = escapeHtml(`${siteUrl}${canonicalPath}`);
  const safePath = escapeHtml(canonicalPath);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeThumbnail = escapeHtml(thumbnail);

  const videoSchema: Record<string, unknown> = seriesParam
    ? {
        '@context': 'https://schema.org',
        '@type': 'TVSeries',
        name: seriesTitle || title.replace(/\s*\|\s*TubeTV$/i, ''),
        description,
        image: [thumbnail],
        url: `${siteUrl}${canonicalPath}`,
        inLanguage: ['en-KE', 'sw-KE'],
        ...(episodeCount > 0 ? { numberOfEpisodes: episodeCount } : {}),
        ...(genre ? { genre } : {}),
        creator: { '@type': 'Organization', name: creator },
        publisher: {
          '@type': 'Organization',
          name: 'TubeTV',
          url: siteUrl,
          logo: { '@type': 'ImageObject', url: `${siteUrl}/icon-512.png` },
        },
      }
    : {
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

  if (notFound) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(`<!doctype html><html lang="en-KE"><head><meta charset="utf-8" /><title>Title Not Found | TubeTV</title><meta name="robots" content="noindex" /></head><body style="background:#09090b;color:#fff;font-family:sans-serif;padding:2rem;text-align:center;"><h1>Title Not Found</h1><p>This video or series is no longer available on TubeTV.</p><p><a href="/" style="color:#ef4444;">Browse TubeTV Catalogue</a></p></body></html>`);
    return;
  }

  const html = `<!doctype html>
<html lang="en-KE">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <meta name="robots" content="index, follow, max-image-preview:large" />
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
  <body style="background:#09090b;color:#fff;font-family:system-ui,-apple-system,sans-serif;padding:1.5rem;max-width:760px;margin:0 auto;line-height:1.6;">
    <header style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #27272a;padding-bottom:1rem;margin-bottom:1.5rem;">
      <a href="/" style="color:#ef4444;font-weight:900;font-size:1.25rem;text-decoration:none;">TubeTV</a>
      <nav aria-label="Primary" style="display:flex;gap:1rem;font-size:0.875rem;">
        <a href="/" style="color:#d4d4d8;text-decoration:none;">Home</a>
        <a href="/?view=MICRO_DRAMAS" style="color:#d4d4d8;text-decoration:none;">Micro Dramas</a>
        <a href="/?view=ORIGINALS" style="color:#d4d4d8;text-decoration:none;">Movies &amp; Series</a>
        <a href="/?view=KIDS" style="color:#d4d4d8;text-decoration:none;">Kids</a>
      </nav>
    </header>
    <main>
      <figure style="margin:0 0 1.25rem 0;">
        <img src="${safeThumbnail}" alt="${escapeHtml(cleanName)}" width="1280" height="720" style="width:100%;max-height:420px;object-fit:cover;border-radius:12px;background:#18181b;" />
      </figure>
      <h1 style="font-size:1.75rem;margin:0 0 0.5rem 0;">${escapeHtml(cleanName)}</h1>
      ${seriesTitle || episodeLabel || genre || category ? `<p style="color:#a1a1aa;font-size:0.95rem;margin:0 0 1rem 0;">${escapeHtml([seriesTitle, episodeLabel, category, genre, durationMinutesLabel].filter(Boolean).join(' • '))}</p>` : ''}
      <p style="color:#e4e4e7;margin:0 0 1rem 0;">${safeDescription}</p>
      ${seriesSynopsisText && seriesSynopsisText !== description ? `<p style="color:#a1a1aa;font-size:0.95rem;margin:0 0 1rem 0;">${escapeHtml(seriesSynopsisText)}</p>` : ''}
      <dl style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;background:#18181b;border:1px solid #27272a;border-radius:10px;padding:1rem;margin:1rem 0;font-size:0.875rem;">
        ${category ? `<div><dt style="color:#71717a;">Category</dt><dd style="margin:0;color:#f4f4f5;">${escapeHtml(category)}</dd></div>` : ''}
        ${genre ? `<div><dt style="color:#71717a;">Genre</dt><dd style="margin:0;color:#f4f4f5;">${escapeHtml(genre)}</dd></div>` : ''}
        ${durationMinutesLabel ? `<div><dt style="color:#71717a;">Duration</dt><dd style="margin:0;color:#f4f4f5;">${escapeHtml(durationMinutesLabel)}</dd></div>` : ''}
        ${uploadDate ? `<div><dt style="color:#71717a;">Published</dt><dd style="margin:0;color:#f4f4f5;">${escapeHtml(uploadDate.slice(0, 10))}</dd></div>` : ''}
        <div><dt style="color:#71717a;">Access</dt><dd style="margin:0;color:#f4f4f5;">${isAccessibleForFree ? 'Free to Watch' : 'TubeTV Unlimited Pass'}</dd></div>
        <div><dt style="color:#71717a;">Platform</dt><dd style="margin:0;color:#f4f4f5;">TubeTV Kenya</dd></div>
      </dl>
      ${transcriptExcerpt ? `<section aria-label="Transcript preview" style="margin:1rem 0;"><h2 style="font-size:1rem;color:#d4d4d8;">Preview</h2><p style="color:#a1a1aa;font-size:0.9rem;">${escapeHtml(transcriptExcerpt)}</p></section>` : ''}
      <p style="margin-top:1.5rem;"><a href="${safePath}" style="display:inline-block;background:#e50923;color:#fff;padding:0.75rem 1.5rem;border-radius:8px;font-weight:bold;text-decoration:none;">Watch ${escapeHtml(cleanName)} on TubeTV &rarr;</a></p>
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
