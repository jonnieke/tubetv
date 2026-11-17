/** Public artwork and trailer links must be absolute HTTPS URLs, never executable schemes. */
export function publicMediaUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Extracts an 11-character YouTube video ID from watch, youtu.be, shorts, or embed URLs. */
export function extractYouTubeId(value?: string): string | null {
  const safe = publicMediaUrl(value);
  if (!safe) return null;
  try {
    const url = new URL(safe);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let candidate = '';
    if (host === 'youtu.be') {
      candidate = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        candidate = url.searchParams.get('v') || '';
      } else {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
          candidate = parts[1] || '';
        }
      }
    }
    return YOUTUBE_ID_RE.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

/** Returns a privacy-enhanced youtube-nocookie.com embed URL for in-app trailer playback. */
export function getYouTubeEmbedUrl(value?: string): string | null {
  const id = extractYouTubeId(value);
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
}
