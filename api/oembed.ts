import type { VercelRequest, VercelResponse } from '@vercel/node';

const SITE_URL = process.env.VITE_SITE_URL || 'https://www.tube.co.ke';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;
  const targetUrl = Array.isArray(url) ? url[0] : url || '';

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Extract video ID from URL
  const match = targetUrl.match(/\/watch\/([^/?#]+)/);
  const videoId = match ? decodeURIComponent(match[1]) : 'default';

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');

  const oembed = {
    version: '1.0',
    type: 'video',
    provider_name: 'TubeTV',
    provider_url: SITE_URL,
    title: 'Watch on TubeTV',
    author_name: 'TubeTV Originals',
    author_url: SITE_URL,
    html: `<iframe src="${SITE_URL}/watch/${encodeURIComponent(videoId)}" width="360" height="640" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`,
    width: 360,
    height: 640,
    thumbnail_width: 720,
    thumbnail_height: 1280,
  };

  return res.status(200).json(oembed);
}
