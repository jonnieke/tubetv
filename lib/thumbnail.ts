/**
 * Shared thumbnail fallback helpers.
 *
 * When a thumbnail URL returns 404 or fails to load, every <img> showing
 * a video thumbnail should call onThumbError (or makeThumbErrorHandler).
 * This replaces the broken image with a visible dark zinc placeholder that
 * preserves the layout instead of collapsing to an empty gap.
 */

/**
 * Visible 16:9 placeholder — zinc-800 background with a centred play chevron.
 * Uses a path-based icon so it renders correctly without fonts in all browsers.
 * Full opacity so it's clearly visible against any dark or light background.
 */
export const THUMB_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='270'%3E" +
  "%3Crect width='480' height='270' fill='%2327272a'/%3E" +
  // Rounded outer circle
  "%3Ccircle cx='240' cy='135' r='32' fill='%2352525b'/%3E" +
  // Play triangle (slightly right of centre so it looks centred optically)
  "%3Cpolygon points='230%2C119 230%2C151 258%2C135' fill='%2371717a'/%3E" +
  "%3C/svg%3E";

/**
 * Returns an onError handler that:
 *   1. Tries `fallbackSrc` (e.g. a different CDN) if provided and not yet tried
 *   2. Falls back to the visible zinc placeholder
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
      img.style.opacity = '1';
    }
  };

/**
 * Simple onError for images that have no fallback URL.
 * Shows the zinc placeholder at full opacity — no invisible grey gap.
 */
export const onThumbError = (e: React.SyntheticEvent<HTMLImageElement>): void => {
  const img = e.currentTarget;
  img.onerror = null;
  img.src = THUMB_PLACEHOLDER;
  img.style.opacity = '1';
};
