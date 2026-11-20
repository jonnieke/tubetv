/**
 * Lightweight HLS cache warmer for instant (<300ms) Micro Drama episode-to-episode transitions.
 *
 * Instead of mounting a second video decoder (which causes OOM/stutter on low-RAM Android devices),
 * this fetches the next episode's HLS master playlist, resolves the first variant playlist, and
 * warms the HTTP cache with the init segment (`EXT-X-MAP`) + first media segment (`.ts`/`.m4s`).
 */

const warmedUrls = new Set<string>();
const MAX_WARMED_CACHE = 40;

function resolveRelativeUrl(baseUrl: string, ref: string): string {
  try {
    return new URL(ref, baseUrl).toString();
  } catch {
    return ref;
  }
}

export function extractFirstVariantUrl(masterPlaylist: string, baseUrl: string): string | null {
  const lines = masterPlaylist
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Pick the first non-comment media playlist URI (typically lowest/fast-start rung in Bunny Stream)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const next = lines[i + 1];
      if (next && !next.startsWith('#')) {
        return resolveRelativeUrl(baseUrl, next);
      }
    }
  }
  return null;
}

export function extractWarmSegmentUrls(mediaPlaylist: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const lines = mediaPlaylist
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('#EXT-X-MAP:')) {
      const match = line.match(/URI="([^"]+)"/i);
      if (match?.[1]) {
        urls.push(resolveRelativeUrl(baseUrl, match[1]));
      }
      continue;
    }
    if (!line.startsWith('#')) {
      urls.push(resolveRelativeUrl(baseUrl, line));
      // Warm only the first media segment to save mobile data while eliminating first-frame spinner
      break;
    }
  }

  return urls;
}

export async function prebufferHlsStream(
  streamUrl: string,
  signal?: AbortSignal,
): Promise<{ warmed: boolean; segmentCount: number }> {
  if (!streamUrl || !streamUrl.includes('.m3u8')) {
    return { warmed: false, segmentCount: 0 };
  }
  if (warmedUrls.has(streamUrl)) {
    return { warmed: true, segmentCount: 0 };
  }

  try {
    const masterRes = await fetch(streamUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal,
    });
    if (!masterRes.ok) return { warmed: false, segmentCount: 0 };
    const masterText = await masterRes.text();
    if (signal?.aborted) return { warmed: false, segmentCount: 0 };

    const variantUrl = extractFirstVariantUrl(masterText, streamUrl);
    let mediaPlaylistText = masterText;
    let mediaBaseUrl = streamUrl;

    if (variantUrl) {
      const variantRes = await fetch(variantUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal,
      });
      if (!variantRes.ok) return { warmed: false, segmentCount: 0 };
      mediaPlaylistText = await variantRes.text();
      mediaBaseUrl = variantUrl;
      if (signal?.aborted) return { warmed: false, segmentCount: 0 };
    }

    const segments = extractWarmSegmentUrls(mediaPlaylistText, mediaBaseUrl);
    await Promise.all(
      segments.map((segUrl) =>
        fetch(segUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          signal,
        })
          .then((res) => (res.ok ? res.arrayBuffer() : null))
          .catch(() => null),
      ),
    );

    if (warmedUrls.size >= MAX_WARMED_CACHE) {
      const oldest = warmedUrls.values().next().value;
      if (oldest) warmedUrls.delete(oldest);
    }
    warmedUrls.add(streamUrl);
    return { warmed: true, segmentCount: segments.length };
  } catch {
    return { warmed: false, segmentCount: 0 };
  }
}
