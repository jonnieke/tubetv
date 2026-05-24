/**
 * Shared thumbnail fallback helpers.
 *
 * Usage on any <img> that shows a video thumbnail:
 *   <img src={video.thumbnail} onError={onThumbError} ... />
 *
 * When the CDN returns a 404, the Optimizer can't process the image,
 * or the network times out, the broken-image browser icon is replaced
 * with a neutral dark placeholder so the layout stays intact and the
 * user never sees a broken image indicator.
 */

/** A minimal 16×9 dark-zinc SVG encoded as a data URI — zero network request. */
export const THUMB_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' " +
  "width='480' height='270'%3E%3Crect width='480' height='270' fill='%2318181b'/%3E%3C/svg%3E";

/**
 * Drop-in onError handler for thumbnail <img> elements.
 * Sets onerror=null first to prevent infinite re-fire if the
 * placeholder itself somehow fails.
 */
export const onThumbError = (e: React.SyntheticEvent<HTMLImageElement>): void => {
  const img = e.currentTarget;
  img.onerror = null;
  img.src = THUMB_PLACEHOLDER;
  img.style.opacity = '0.4'; // dim placeholder so it reads as "no image"
};
