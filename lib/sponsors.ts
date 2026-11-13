export interface SponsorSlot {
  name: string;
  tagline: string;
  url: string;
  badge: string;
}

/**
 * Configurable B2B/brand sponsorship slot for free-tier viewers (Shorts & Ep 1-2).
 * Set VITE_SPONSOR_NAME + VITE_SPONSOR_URL in Vercel env vars to activate a live campaign.
 */
export function getActiveSponsor(): SponsorSlot | null {
  const name = (import.meta.env.VITE_SPONSOR_NAME as string | undefined)?.trim();
  const url = (import.meta.env.VITE_SPONSOR_URL as string | undefined)?.trim();
  if (!name || !url || !/^https:\/\//i.test(url)) return null;
  const tagline =
    (import.meta.env.VITE_SPONSOR_TAGLINE as string | undefined)?.trim() ||
    'Proudly supporting Kenyan creators and free episodes on TubeTV.';
  const badge = (import.meta.env.VITE_SPONSOR_BADGE as string | undefined)?.trim() || 'Presented by';
  return { name, tagline, url, badge };
}
