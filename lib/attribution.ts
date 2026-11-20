/**
 * Viral traffic attribution for TikTok, Reels, WhatsApp & creator referral links.
 * Persists the landing source in sessionStorage so downstream funnel events
 * (Ep 1 Start -> Ep 2 Start -> Paywall Hit -> Ad/WA Unlock -> Paid Pass)
 * automatically carry source attribution.
 */

export interface SessionAttribution {
  trafficSource: string;
  campaign?: string;
  referrerCode?: string;
  landingPath?: string;
}

const SESSION_ATTR_KEY = 'tubetv_session_attribution_v1';

function normalizeSource(raw: string): string {
  const clean = raw.trim().toLowerCase();
  if (!clean) return 'direct';
  if (clean.includes('tiktok') || clean === 'tt') return 'tiktok';
  if (clean.includes('wa_unlock')) return 'wa_unlock';
  if (clean.includes('whatsapp') || clean === 'wa') return 'whatsapp';
  if (clean.includes('instagram') || clean === 'ig' || clean === 'reels') return 'instagram';
  if (clean.includes('facebook') || clean === 'fb') return 'facebook';
  if (clean.includes('youtube') || clean === 'yt') return 'youtube';
  if (clean.includes('twitter') || clean === 'x') return 'x';
  return clean.replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'direct';
}

function inferSourceFromReferrer(referrer: string): string {
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.includes('tiktok')) return 'tiktok';
    if (host.includes('whatsapp') || host.includes('wa.me')) return 'whatsapp';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('facebook') || host.includes('fb.com')) return 'facebook';
    if (host.includes('youtube') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('t.co') || host.includes('x.com') || host.includes('twitter')) return 'x';
    if (host.includes('google')) return 'google';
    return host.slice(0, 32);
  } catch {
    return 'direct';
  }
}

export function captureSessionAttribution(
  search?: string,
  referrer?: string,
  pathname?: string,
): SessionAttribution {
  const rawSearch =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';
  const rawReferrer =
    referrer !== undefined
      ? referrer
      : typeof document !== 'undefined'
        ? document.referrer
        : '';
  const rawPath =
    pathname !== undefined
      ? pathname
      : typeof window !== 'undefined'
        ? window.location.pathname
        : '/';

  const params = new URLSearchParams(rawSearch);
  const explicitSource = params.get('utm_source') || params.get('src') || params.get('source') || '';
  const campaign = (params.get('utm_campaign') || params.get('campaign') || '').trim().slice(0, 64) || undefined;
  const referrerCode = (params.get('ref') || '').trim().slice(0, 40) || undefined;

  const existing = getSessionAttribution();
  if (!explicitSource && !campaign && !referrerCode && existing && existing.trafficSource !== 'direct') {
    return existing;
  }

  const trafficSource = explicitSource
    ? normalizeSource(explicitSource)
    : inferSourceFromReferrer(rawReferrer);

  const next: SessionAttribution = {
    trafficSource,
    ...(campaign ? { campaign } : {}),
    ...(referrerCode ? { referrerCode } : {}),
    landingPath: rawPath.slice(0, 120),
  };

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(SESSION_ATTR_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }

  return next;
}

export function getSessionAttribution(): SessionAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_ATTR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionAttribution>;
    if (!parsed.trafficSource) return null;
    return {
      trafficSource: String(parsed.trafficSource),
      ...(parsed.campaign ? { campaign: String(parsed.campaign) } : {}),
      ...(parsed.referrerCode ? { referrerCode: String(parsed.referrerCode) } : {}),
      ...(parsed.landingPath ? { landingPath: String(parsed.landingPath) } : {}),
    };
  } catch {
    return null;
  }
}
