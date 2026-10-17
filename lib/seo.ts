import type { Video } from '../types';
import { isMicroDrama } from './series';

const SITE_URL = (import.meta.env.VITE_SITE_URL as string) || 'https://www.tube.co.ke';

export function videoPath(videoId: string) {
  return `/watch/${encodeURIComponent(videoId)}`;
}

export function videoStructuredData(video: Video) {
  const isDrama = isMicroDrama(video);
  const canonical = `${SITE_URL}${videoPath(video.id)}`;

  if (isDrama) {
    return {
      '@context': 'https://schema.org',
      '@type': 'TVEpisode',
      name: video.title,
      description: video.episodeSynopsis || video.description || `Watch ${video.title} on TubeTV.`,
      image: video.thumbnail,
      thumbnailUrl: [video.thumbnail],
      uploadDate: video.uploadDate,
      contentUrl: video.url,
      url: canonical,
      episodeNumber: video.episode || 1,
      seasonNumber: video.season || 1,
      duration: video.duration ? `PT${video.duration.replace(/[^0-9]/g, '')}M` : undefined,
      isFamilyFriendly: video.contentRating === 'GE' || video.contentRating === 'PG',
      inLanguage: ['en-KE', 'sw-KE'],
      partOfSeries: {
        '@type': 'TVSeries',
        name: video.seriesTitle || video.title,
        genre: video.genre || 'Drama',
        inLanguage: ['en-KE', 'sw-KE'],
        publisher: { '@type': 'Organization', name: 'TubeTV', url: SITE_URL },
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Micro Dramas', item: `${SITE_URL}/?view=MICRO_DRAMAS` },
          { '@type': 'ListItem', position: 3, name: video.seriesTitle || 'Series', item: canonical },
          { '@type': 'ListItem', position: 4, name: `Episode ${video.episode || 1}` },
        ],
      },
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1', 'h2', 'p'],
      },
      publisher: { '@type': 'Organization', name: 'TubeTV', url: SITE_URL },
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description || `Watch ${video.title} on TubeTV.`,
    thumbnailUrl: [video.thumbnail],
    uploadDate: video.uploadDate,
    contentUrl: video.url,
    url: canonical,
    isFamilyFriendly: video.contentRating === 'GE' || video.contentRating === 'PG',
    inLanguage: ['en-KE', 'sw-KE'],
    publisher: { '@type': 'Organization', name: 'TubeTV', url: SITE_URL },
  };
}

export function setVideoMetadata(video?: Video) {
  const isDrama = video ? isMicroDrama(video) : false;
  const title = video
    ? isDrama && video.seriesTitle
      ? `${video.title} (Ep. ${video.episode || 1}) · ${video.seriesTitle} | TubeTV`
      : `${video.title} | TubeTV`
    : 'TubeTV | Kenyan videos, news, comedy and education';

  const description =
    video?.episodeSynopsis ||
    video?.description ||
    "Kenya's home for original content, education, farming, faith and live streams.";

  const path = video ? videoPath(video.id) : '/';
  const canonicalUrl = `${SITE_URL}${path}`;

  document.title = title;

  const setMeta = (selector: string, attribute: string, value: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(selector);
    if (!element) {
      element = document.createElement('meta');
      const [name, key] =
        attribute === 'property'
          ? ['property', selector.match(/"(.+)"/)?.[1]]
          : ['name', selector.match(/"(.+)"/)?.[1]];
      if (key) element.setAttribute(name, key);
      document.head.appendChild(element);
    }
    element.content = value;
  };

  setMeta('meta[name="description"]', 'name', description);
  setMeta('meta[property="og:title"]', 'property', title);
  setMeta('meta[property="og:description"]', 'property', description);
  setMeta('meta[property="og:type"]', 'property', isDrama ? 'video.episode' : 'video.other');
  setMeta('meta[property="og:url"]', 'property', canonicalUrl);
  setMeta('meta[name="twitter:card"]', 'name', 'summary_large_image');
  setMeta('meta[name="twitter:title"]', 'name', title);
  setMeta('meta[name="twitter:description"]', 'name', description);

  if (video?.thumbnail) {
    setMeta('meta[property="og:image"]', 'property', video.thumbnail);
    setMeta('meta[property="og:image:width"]', 'property', isDrama ? '720' : '1280');
    setMeta('meta[property="og:image:height"]', 'property', isDrama ? '1280' : '720');
    setMeta('meta[name="twitter:image"]', 'name', video.thumbnail);
  }

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  // oEmbed discovery tag
  let oembedLink = document.head.querySelector<HTMLLinkElement>('link[rel="alternate"][type="application/json+oembed"]');
  if (video) {
    if (!oembedLink) {
      oembedLink = document.createElement('link');
      oembedLink.rel = 'alternate';
      oembedLink.type = 'application/json+oembed';
      document.head.appendChild(oembedLink);
    }
    oembedLink.title = title;
    oembedLink.href = `${SITE_URL}/api/oembed?url=${encodeURIComponent(canonicalUrl)}`;
  } else {
    oembedLink?.remove();
  }

  // Schema.org JSON-LD
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
