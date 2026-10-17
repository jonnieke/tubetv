import type { VercelRequest, VercelResponse } from '@vercel/node';

// Regular expression matching social platform scrapers and search bots
const SOCIAL_BOTS = /whatsapp|facebookexternalhit|twitterbot|telegrambot|slackbot|discordbot|applebot|bingbot|googlebot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|snapchat|skypeuripreview/i;

const SITE_URL = process.env.VITE_SITE_URL || 'https://www.tube.co.ke';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const BUNNY_PULL_ZONE = process.env.VITE_BUNNY_PULL_ZONE || 'vz-0fe79b1a-8ad.b-cdn.net';

interface VideoMeta {
  id: string;
  title: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  synopsis?: string;
  thumbnail: string;
  duration?: string;
  isMicroDrama?: boolean;
}

// Fallback metadata for common or demo episodes
function getFallbackMetadata(id: string): VideoMeta {
  return {
    id,
    title: 'Watch Kenyan Micro Dramas & Originals',
    seriesTitle: 'TubeTV Originals',
    synopsis: 'Stream the latest high-intensity vertical micro dramas and Kenyan series on TubeTV.',
    thumbnail: `https://${BUNNY_PULL_ZONE}/${id}/thumbnail.jpg`,
    isMicroDrama: true,
  };
}

async function fetchVideoDetails(videoId: string): Promise<VideoMeta> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return getFallbackMetadata(videoId);
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/public-catalogue?page=1&itemsPerPage=100`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      const item = data.items?.find((v: any) => v.guid === videoId);
      if (item) {
        const getTag = (name: string) =>
          item.metaTags?.find((t: any) => t.property?.toLowerCase() === name.toLowerCase())?.value || '';

        const seriesTitle = getTag('seriesTitle') || getTag('series');
        const season = parseInt(getTag('season')) || 1;
        const episode = parseInt(getTag('episode')) || 1;
        const category = getTag('category');
        const synopsis = getTag('episodeSynopsis') || getTag('description') || getTag('seriesSynopsis');
        const thumbUrl = getTag('thumbnailUrl') || `https://${BUNNY_PULL_ZONE}/${item.guid}/${item.thumbnailFileName || 'thumbnail.jpg'}`;

        return {
          id: item.guid,
          title: item.title,
          seriesTitle: seriesTitle || undefined,
          season,
          episode,
          synopsis: synopsis || undefined,
          thumbnail: thumbUrl,
          isMicroDrama: category?.toLowerCase().includes('micro') || getTag('seriesFormat') === 'micro-drama',
        };
      }
    }
  } catch (err) {
    console.error('Error fetching video for OG preview:', err);
  }

  return getFallbackMetadata(videoId);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const videoId = Array.isArray(id) ? id[0] : id || '';

  if (!videoId) {
    return res.redirect(302, '/');
  }

  const userAgent = req.headers['user-agent'] || '';
  const isBot = SOCIAL_BOTS.test(userAgent);
  const video = await fetchVideoDetails(videoId);

  const cleanTitle = escapeHtml(
    video.seriesTitle
      ? `${video.title} (Ep. ${video.episode || 1}) · ${video.seriesTitle}`
      : `${video.title} | TubeTV`
  );
  const cleanDesc = escapeHtml(
    video.synopsis || "Watch the latest Kenyan vertical micro dramas, comedy, and stories on TubeTV."
  );
  const cleanThumb = escapeHtml(video.thumbnail);
  const canonicalUrl = `${SITE_URL}/watch/${encodeURIComponent(videoId)}`;

  // Set edge caching: 1 hour browser, 24 hours edge cache, stale-while-revalidate for 7 days
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // JSON-LD Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': video.isMicroDrama ? 'TVEpisode' : 'VideoObject',
    name: video.title,
    description: video.synopsis || cleanDesc,
    thumbnailUrl: [video.thumbnail],
    url: canonicalUrl,
    inLanguage: ['en-KE', 'sw-KE'],
    ...(video.isMicroDrama
      ? {
          episodeNumber: video.episode || 1,
          seasonNumber: video.season || 1,
          partOfSeries: {
            '@type': 'TVSeries',
            name: video.seriesTitle || 'TubeTV Originals',
          },
        }
      : {}),
    publisher: {
      '@type': 'Organization',
      name: 'TubeTV',
      url: SITE_URL,
    },
  };

  const html = `<!doctype html>
<html lang="en-KE">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cleanTitle}</title>
  <meta name="description" content="${cleanDesc}" />
  <meta name="theme-color" content="#dc2626" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph / WhatsApp / Facebook -->
  <meta property="og:type" content="${video.isMicroDrama ? 'video.episode' : 'video.other'}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="TubeTV" />
  <meta property="og:title" content="${cleanTitle}" />
  <meta property="og:description" content="${cleanDesc}" />
  <meta property="og:image" content="${cleanThumb}" />
  <meta property="og:image:secure_url" content="${cleanThumb}" />
  <meta property="og:image:width" content="720" />
  <meta property="og:image:height" content="1280" />
  <meta property="og:image:alt" content="${cleanTitle}" />
  <meta property="og:locale" content="en_KE" />

  <!-- Twitter / X Cards -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@TubeTV_KE" />
  <meta name="twitter:title" content="${cleanTitle}" />
  <meta name="twitter:description" content="${cleanDesc}" />
  <meta name="twitter:image" content="${cleanThumb}" />

  <!-- oEmbed Discovery -->
  <link rel="alternate" type="application/json+oembed" href="${SITE_URL}/api/oembed?url=${encodeURIComponent(canonicalUrl)}" title="${cleanTitle}" />

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd)}
  </script>

  ${
    !isBot
      ? `<!-- Seamless client redirect to SPA route for human browsers -->
  <script>
    window.location.replace('/?watch=' + encodeURIComponent('${videoId}'));
  </script>`
      : ''
  }
  <style>
    body { background-color: #09090b; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
    .card { max-width: 420px; background: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
    .thumb { width: 100%; aspect-ratio: 9/16; object-fit: cover; background: #27272a; }
    .info { padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 8px 0; color: #f4ecdd; }
    p { font-size: 13px; line-height: 1.5; color: #a1a1aa; margin: 0 0 16px 0; }
    .btn { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: bold; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <img class="thumb" src="${cleanThumb}" alt="${cleanTitle}" />
    <div class="info">
      <h1>${cleanTitle}</h1>
      <p>${cleanDesc}</p>
      <a class="btn" href="${canonicalUrl}">▶ Watch on TubeTV</a>
    </div>
  </div>
</body>
</html>`;

  return res.status(200).send(html);
}
