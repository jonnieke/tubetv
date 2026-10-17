import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SITE_URL = Deno.env.get('SITE_URL') || 'https://www.tube.co.ke';
const BUNNY_PULL_ZONE = Deno.env.get('BUNNY_PULL_ZONE') || 'vz-0fe79b1a-8ad.b-cdn.net';
const LIBRARY_ID = Deno.env.get('BUNNY_LIBRARY_ID');
const ACCESS_KEY = Deno.env.get('BUNNY_ACCESS_KEY');

serve(async (req: Request) => {
  const url = new URL(req.url);
  const videoId = url.searchParams.get('id') || '';

  if (!videoId) {
    return new Response('Missing video id', { status: 400 });
  }

  let title = 'Watch on TubeTV';
  let description = 'Kenya’s home for original micro-dramas, stories, and entertainment.';
  let thumbnail = `https://${BUNNY_PULL_ZONE}/${videoId}/thumbnail.jpg`;

  if (LIBRARY_ID && ACCESS_KEY) {
    try {
      const res = await fetch(`https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}`, {
        headers: { AccessKey: ACCESS_KEY, Accept: 'application/json' },
      });
      if (res.ok) {
        const item = await res.json();
        title = item.title || title;
        const tags = item.metaTags || [];
        const descTag = tags.find((t: any) => t.property?.toLowerCase() === 'description')?.value;
        const seriesTag = tags.find((t: any) => t.property?.toLowerCase() === 'seriestitle')?.value;
        if (descTag) description = descTag;
        if (seriesTag) title = `${item.title} · ${seriesTag}`;
      }
    } catch {
      // Use fallbacks
    }
  }

  const canonical = `${SITE_URL}/watch/${encodeURIComponent(videoId)}`;

  const html = `<!doctype html>
<html lang="en-KE">
<head>
  <meta charset="UTF-8">
  <title>${title} | TubeTV</title>
  <meta name="description" content="${description}">
  <meta property="og:site_name" content="TubeTV">
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${title} | TubeTV">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${thumbnail}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${thumbnail}">
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <img src="${thumbnail}" alt="${title}">
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
});
