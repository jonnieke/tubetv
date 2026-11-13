import type { IncomingMessage, ServerResponse } from 'http';

interface CatalogueItem {
  guid?: string;
  title?: string;
  length?: number;
  dateUploaded?: string;
  thumbnailFileName?: string;
  metaTags?: Array<{ property?: string; value?: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const rawSiteUrl = (process.env.VITE_SITE_URL || 'https://www.tube.co.ke').replace(/\/$/, '');
  const siteUrl = /^https:\/\//i.test(rawSiteUrl) ? rawSiteUrl : 'https://www.tube.co.ke';
  const pullZone = (
    process.env.VITE_BUNNY_PULL_ZONE ||
    process.env.BUNNY_PULL_ZONE ||
    'vz-0fe79b1a-8ad.b-cdn.net'
  )
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://bbwtdnsgojztxckmkhpz.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  interface SitemapEntry {
    loc: string;
    lastmod?: string;
    changefreq: string;
    priority: string;
    video?: {
      thumbnailLoc: string;
      title: string;
      description: string;
      duration?: number;
      publicationDate?: string;
    };
  }

  const entries: SitemapEntry[] = [
    { loc: `${siteUrl}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${siteUrl}/privacy`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${siteUrl}/terms`, changefreq: 'monthly', priority: '0.4' },
  ];
  const seenSeries = new Set<string>();

  let fetchedCatalogue = false;

  if (supabaseUrl && anonKey) {
    try {
      // public-catalogue caps itemsPerPage at 100; paginate up to 5 pages (500 titles).
      for (let page = 1; page <= 5; page += 1) {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/public-catalogue?page=${page}&itemsPerPage=100`,
          {
            headers: { apikey: anonKey, Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          },
        );
        if (!response.ok) break;
        const data = await response.json();
        const items: CatalogueItem[] = Array.isArray(data?.items) ? data.items : [];
        fetchedCatalogue = true;

        for (const item of items) {
          const guid = (item.guid || '').trim();
          if (!UUID_RE.test(guid)) continue;
          const tags = Array.isArray(item.metaTags) ? item.metaTags : [];
          const getMeta = (prop: string) =>
            tags.find((t) => t.property?.toLowerCase() === prop.toLowerCase())?.value?.trim() || '';
          if (getMeta('muted').toLowerCase() === 'true') continue;
          if (getMeta('contentRating').toUpperCase() === '18') continue;

          const uploaded = item.dateUploaded ? new Date(item.dateUploaded) : null;
          const isValidDate = uploaded && !Number.isNaN(uploaded.getTime());
          const lastmod = isValidDate ? uploaded.toISOString().split('T')[0] : undefined;

          const rawThumb = getMeta('seriesPosterUrl') || getMeta('thumbnailUrl');
          const thumbnailLoc = /^https:\/\//i.test(rawThumb)
            ? rawThumb
            : `https://${pullZone}/${guid}/${item.thumbnailFileName || 'thumbnail.jpg'}`;
          const title = (item.title || 'TubeTV Video').trim();
          const description =
            getMeta('episodeSynopsis') ||
            getMeta('description') ||
            getMeta('seriesSynopsis') ||
            `Watch ${title} on TubeTV.`;
          const duration =
            typeof item.length === 'number' && Number.isFinite(item.length) && item.length > 0
              ? Math.round(item.length)
              : undefined;

          entries.push({
            loc: `${siteUrl}/watch/${encodeURIComponent(guid)}`,
            lastmod,
            changefreq: 'weekly',
            priority: '0.8',
            video: {
              thumbnailLoc,
              title,
              description,
              duration,
              publicationDate: isValidDate ? uploaded.toISOString() : undefined,
            },
          });

          const rawSeries = getMeta('seriesTitle') || getMeta('series');
          const sSlug = rawSeries
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          if (sSlug && !seenSeries.has(sSlug)) {
            seenSeries.add(sSlug);
            entries.push({
              loc: `${siteUrl}/series/${encodeURIComponent(sSlug)}`,
              lastmod,
              changefreq: 'weekly',
              priority: '0.9',
            });
          }
        }

        if (items.length < 100) break;
      }
    } catch {
      // Serve core static routes if catalogue fetch times out
    }
  }

  const xmlBody = entries
    .map((entry) => {
      const videoBlock = entry.video
        ? `\n    <video:video>\n      <video:thumbnail_loc>${escapeXml(entry.video.thumbnailLoc)}</video:thumbnail_loc>\n      <video:title>${escapeXml(entry.video.title)}</video:title>\n      <video:description>${escapeXml(entry.video.description)}</video:description>${
            entry.video.duration ? `\n      <video:duration>${entry.video.duration}</video:duration>` : ''
          }${
            entry.video.publicationDate
              ? `\n      <video:publication_date>${escapeXml(entry.video.publicationDate)}</video:publication_date>`
              : ''
          }\n    </video:video>`
        : '';
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${
        entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''
      }\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>${videoBlock}\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${xmlBody}\n</urlset>\n`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', fetchedCatalogue ? 'public, max-age=900, s-maxage=3600' : 'public, max-age=120');
  res.end(xml);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
