import type { VercelRequest, VercelResponse } from '@vercel/node';

const SITE_URL = process.env.VITE_SITE_URL || 'https://www.tube.co.ke';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let videoItems: any[] = [];

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/public-catalogue?page=1&itemsPerPage=100`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        videoItems = data.items || [];
      }
    } catch (err) {
      console.error('Error fetching catalogue for sitemap:', err);
    }
  }

  // Fallback items if catalogue endpoint is unavailable
  if (videoItems.length === 0) {
    videoItems = [
      {
        guid: 'micro-ns-1',
        title: 'The Stolen Ledger - Nairobi Secrets Episode 1',
        length: 105,
        thumbnailFileName: 'thumbnail.jpg',
        dateUploaded: '2026-10-01T12:00:00Z',
        metaTags: [
          { property: 'description', value: 'Wanjiku stumbles upon an encrypted flash drive after her boss vanishes.' },
        ],
      },
      {
        guid: 'micro-ns-2',
        title: 'Midnight Call - Nairobi Secrets Episode 2',
        length: 130,
        thumbnailFileName: 'thumbnail.jpg',
        dateUploaded: '2026-10-02T12:00:00Z',
        metaTags: [
          { property: 'description', value: 'An unknown caller gives Wanjiku 30 minutes to drop the drive.' },
        ],
      },
      {
        guid: 'micro-ns-3',
        title: 'The Trap in Westlands - Nairobi Secrets Episode 3',
        length: 125,
        thumbnailFileName: 'thumbnail.jpg',
        dateUploaded: '2026-10-03T12:00:00Z',
        metaTags: [
          { property: 'description', value: 'Wanjiku arrives at the drop point with an undercover DCI detective.' },
        ],
      },
    ];
  }

  const urlsXml = videoItems
    .map((item) => {
      const desc =
        item.metaTags?.find((t: any) => t.property?.toLowerCase() === 'description')?.value ||
        item.metaTags?.find((t: any) => t.property?.toLowerCase() === 'episodesynopsis')?.value ||
        `Watch ${item.title} on TubeTV Kenya.`;
      const thumb =
        item.metaTags?.find((t: any) => t.property?.toLowerCase() === 'thumbnailurl')?.value ||
        `https://vz-0fe79b1a-8ad.b-cdn.net/${item.guid}/${item.thumbnailFileName || 'thumbnail.jpg'}`;

      return `  <url>
    <loc>${SITE_URL}/watch/${encodeURIComponent(item.guid)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumb)}</video:thumbnail_loc>
      <video:title>${escapeXml(item.title)}</video:title>
      <video:description>${escapeXml(desc)}</video:description>
      <video:player_loc allow_embed="yes">${SITE_URL}/watch/${encodeURIComponent(item.guid)}</video:player_loc>
      <video:duration>${item.length || 120}</video:duration>
      <video:publication_date>${item.dateUploaded ? new Date(item.dateUploaded).toISOString() : new Date().toISOString()}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
  </url>`;
    })
    .join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urlsXml}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).send(sitemap);
}
