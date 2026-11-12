import type { Video } from '../types';
import { isVideoLocked } from './monetization';

const SITE_URL = ((import.meta.env.VITE_SITE_URL as string) || 'https://www.tube.co.ke').replace(/\/$/, '');
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

export function videoPath(videoId: string) {
  return `/watch/${encodeURIComponent(videoId)}`;
}

export function videoStructuredData(video: Video) {
  const locked = isVideoLocked(video, false);
  const image = video.seriesPosterUrl || video.thumbnail || DEFAULT_OG_IMAGE;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.seriesTitle || video.title,
    description:
      video.episodeSynopsis || video.seriesSynopsis || video.description || `Watch ${video.title} on TubeTV.`,
    thumbnailUrl: [image],
    uploadDate: video.uploadDate,
    ...(locked || !video.url ? {} : { contentUrl: video.url }),
    isAccessibleForFree: !locked,
    url: `${SITE_URL}${videoPath(video.id)}`,
    isFamilyFriendly: video.contentRating === 'GE' || video.contentRating === 'PG',
    inLanguage: ['en-KE', 'sw-KE'],
    publisher: {
      '@type': 'Organization',
      name: 'TubeTV',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
    },
  };
}

function upsertMeta(selector: string, attribute: 'name' | 'property', value: string) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    const key = selector.match(/"(.+)"/)?.[1];
    if (key) element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = value;
}

function upsertCanonical(path: string) {
  if (typeof document === 'undefined') return;
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function setPageMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}) {
  if (typeof document === 'undefined') return;
  const fullUrl = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const ogImage = image || DEFAULT_OG_IMAGE;

  document.title = title;
  upsertMeta('meta[name="description"]', 'name', description);
  upsertMeta('meta[property="og:title"]', 'property', title);
  upsertMeta('meta[property="og:description"]', 'property', description);
  upsertMeta('meta[property="og:url"]', 'property', fullUrl);
  upsertMeta('meta[property="og:image"]', 'property', ogImage);
  upsertMeta('meta[property="og:image:secure_url"]', 'property', ogImage);
  upsertMeta('meta[name="twitter:title"]', 'name', title);
  upsertMeta('meta[name="twitter:description"]', 'name', description);
  upsertMeta('meta[name="twitter:image"]', 'name', ogImage);
  upsertCanonical(path);
}

export function setVideoMetadata(video?: Video) {
  if (typeof document === 'undefined') return;
  const title = video ? `${video.seriesTitle || video.title} | TubeTV` : 'TubeTV | Kenyan videos, news, comedy and education';
  const description =
    video?.episodeSynopsis ||
    video?.seriesSynopsis ||
    video?.description ||
    "Kenya's home for original content, education, farming, faith and live streams.";
  const path = video ? videoPath(video.id) : '/';
  const image = video?.seriesPosterUrl || video?.thumbnail || DEFAULT_OG_IMAGE;

  setPageMetadata({
    title,
    description,
    path,
    image,
  });

  let schema = document.getElementById('tubetv-video-schema');
  if (!video) {
    schema?.remove();
    return;
  }
  if (!schema) {
    schema = document.createElement('script');
    schema.id = 'tubetv-video-schema';
    schema.setAttribute('type', 'application/ld+json');
    document.head.appendChild(schema);
  }
  schema.textContent = JSON.stringify(videoStructuredData(video));
}
