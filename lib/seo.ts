import type { Video } from '../types';

const SITE_URL = (import.meta.env.VITE_SITE_URL as string) || 'https://www.tube.co.ke';

export function videoPath(videoId: string) {
  return `/watch/${encodeURIComponent(videoId)}`;
}

export function videoStructuredData(video: Video) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description || `Watch ${video.title} on TubeTV.`,
    thumbnailUrl: [video.thumbnail],
    uploadDate: video.uploadDate,
    contentUrl: video.url,
    url: `${SITE_URL}${videoPath(video.id)}`,
    isFamilyFriendly: video.contentRating === 'GE' || video.contentRating === 'PG',
    inLanguage: ['en-KE', 'sw-KE'],
    publisher: { '@type': 'Organization', name: 'TubeTV', url: SITE_URL },
  };
}

export function setVideoMetadata(video?: Video) {
  const title = video ? `${video.title} | TubeTV` : 'TubeTV | Kenyan videos, news, comedy and education';
  const description = video?.description || "Kenya's home for original content, education, farming, faith and live streams.";
  const path = video ? videoPath(video.id) : '/';
  document.title = title;

  const setMeta = (selector: string, attribute: string, value: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(selector);
    if (!element) {
      element = document.createElement('meta');
      const [name, key] = attribute === 'property' ? ['property', selector.match(/"(.+)"/)?.[1]] : ['name', selector.match(/"(.+)"/)?.[1]];
      if (key) element.setAttribute(name, key);
      document.head.appendChild(element);
    }
    element.content = value;
  };

  setMeta('meta[name="description"]', 'name', description);
  setMeta('meta[property="og:title"]', 'property', title);
  setMeta('meta[property="og:description"]', 'property', description);
  if (video?.thumbnail) setMeta('meta[property="og:image"]', 'property', video.thumbnail);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = `${SITE_URL}${path}`;

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
