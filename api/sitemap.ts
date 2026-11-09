import type { IncomingMessage, ServerResponse } from 'http';

interface CatalogueItem {
  guid?: string;
  dateUploaded?: string;
  metaTags?: Array<{ property?: string; value?: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const rawSiteUrl = (process.env.VITE_SITE_URL || 'https://www.tube.co.ke').replace(/\/$/, '');
  const siteUrl = /^https:\/\//i.test(rawSiteUrl) ? rawSiteUrl : 'https://www.tube.co.ke';
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  const entries: Array<{ loc: string; lastmod?: string; changefreq: string; priority: string }> = [
    { loc: `${siteUrl}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${siteUrl}/privacy`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${siteUrl}/terms`, changefreq: 'monthly', priority: '0.4' },
  ];

  let fetchedCatalogue = false;

  if (supabaseUrl && anonKey) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/public-catalogue?page=1&itemsPerPage=250`, {
        headers: { apikey: anonKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        const items: CatalogueItem[] = Array.isArray(data?.items) ? data.items : [];
        fetchedCatalogue = true;
        for (const item of items) {
          const guid = (item.guid || '').trim();
          if (!UUID_RE.test(guid)) continue;
          const tags = Array.isArray(item.metaTags) ? item.metaTags : [];
          const getMeta = (prop: string) =>
            tags.find((t) => t.property?.toLowerCase() === prop.toLowerCase())?.value || '';
          if (getMeta('muted').toLowerCase() === 'true') continue;
          if (getMeta('contentRating').toUpperCase() === '18') continue;

          const uploaded = item.dateUploaded ? new Date(item.dateUploaded) : null;
          const lastmod =
            uploaded && !Number.isNaN(uploaded.getTime()) ? uploaded.toISOString().split('T')[0] : undefined;

          entries.push({
            loc: `${siteUrl}/watch/${encodeURIComponent(guid)}`,
            lastmod,
            changefreq: 'weekly',
            priority: '0.8',
          });
        }
      }
    } catch {
      // Serve core static routes if catalogue fetch times out
    }
  }

  const xmlBody = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${
          entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''
        }\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlBody}\n</urlset>\n`;

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

