/**
 * Shared thumbnail fallback helpers.
 *
 * Fallback chain for every <img> showing a video thumbnail:
 *   1. Primary  — utv-posters.b-cdn.net (Optimizer: WebP + resize)
 *   2. Fallback — vz-xxx.b-cdn.net (raw Bunny Stream CDN, no Optimizer)
 *   3. Placeholder — inline SVG data URI, zero network request
 *
 * Usage:
 *   <img
 *     src={video.thumbnail}
 *     onError={makeThumbErrorHandler(video.thumbnailFallback)}
 *   />
 *
 * When there is no fallback URL (e.g. third-party thumbnail):
 *   <img src={url} onError={onThumbError} />
 */

/** Minimal 16:9 dark-zinc SVG — zero network, preserves layout. */
export const THUMB_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' " +
  "width='480' height='270'%3E%3Crect width='480' height='270' fill='%2318181b'/%3E%3C/svg%3E";

/**
 * Returns an onError handler that:
 *   1. Tries `fallbackSrc` (stream CDN) if provided and not yet tried
 *   2. Falls back to the dark placeholder
 *
 * The `data-fb-tried` attribute prevents an infinite retry loop.
 */
export const makeThumbErrorHandler = (fallbackSrc?: string) =>
  (e: React.SyntheticEvent<HTMLImageElement>): void => {
    const img = e.currentTarget;
    if (fallbackSrc && img.getAttribute('data-fb-tried') !== '1') {
      img.setAttribute('data-fb-tried', '1');
      img.src = fallbackSrc;
    } else {
      img.onerror = null;
      img.src = THUMB_PLACEHOLDER;
      img.style.opacity = '0.35';
    }
  };

/**
 * Simple onError for images that have no fallback URL
 * (e.g. notification thumbnails, share previews).
 */
export const onThumbError = (e: React.SyntheticEvent<HTMLImageElement>): void => {
  const img = e.currentTarget;
  img.onerror = null;
  img.src = THUMB_PLACEHOLDER;
  img.style.opacity = '0.35';
};
