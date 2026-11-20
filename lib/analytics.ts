export type AnalyticsEventName =
  | 'catalogue_view'
  | 'playback_start'
  | 'playback_error'
  | 'playback_first_frame'
  | 'playback_complete'
  | 'playback_buffer'
  | 'episode_next'
  | 'paywall_view'
  | 'paywall_initiated'
  | 'paywall_completed'
  | 'paywall_failed'
  | 'pass_restored'
  | 'checkout_start'
  | 'checkout_submitted'
  | 'subscription_activated'
  | 'checkout_failed'
  | 'qualified_view'
  | 'video_shared';

type EventProperties = Record<string, string | number | boolean | undefined>;

const endpoint = (import.meta.env.VITE_ANALYTICS_ENDPOINT as string) || '';

export function sanitizeEventProperties(properties: EventProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, 12)
      .map(([key, value]) => [key.slice(0, 40), typeof value === 'string' ? value.slice(0, 120) : value])
  );
}

function normalizeAnalyticsPhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10 && /^0[17]/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`;
  return undefined;
}

function getAnonViewerMeta(): { viewerId?: string; device?: string; city?: string; phone?: string; passRef?: string } {
  if (typeof window === 'undefined') return {};
  let viewerId: string | undefined;
  let phone: string | undefined;
  let passRef: string | undefined;
  try {
    viewerId = window.localStorage.getItem('tubetv_viewer_id') || undefined;
    if (!viewerId) {
      viewerId = `vw_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem('tubetv_viewer_id', viewerId);
    }
    const rawPass = window.localStorage.getItem('tubetv_pass');
    if (rawPass) {
      const parsed = JSON.parse(rawPass) as { phone?: string; mpesaReceipt?: string; expiresAt?: number };
      if (!parsed.expiresAt || parsed.expiresAt > Date.now()) {
        if (parsed.phone) phone = normalizeAnalyticsPhone(parsed.phone);
        if (!phone && parsed.mpesaReceipt) passRef = String(parsed.mpesaReceipt).trim().slice(0, 80);
      }
    }
    if (!phone) {
      const savedPhone = window.localStorage.getItem('tubetv_saved_phone') || '';
      if (savedPhone) phone = normalizeAnalyticsPhone(savedPhone);
    }
  } catch {
    // Ignore storage errors
  }
  let city: string | undefined;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('/') && !tz.startsWith('Etc/')) {
      const segment = tz.split('/').pop()?.replace(/_/g, ' ').trim();
      if (segment) city = segment;
    }
  } catch {
    // Ignore Intl errors
  }
  const w = window.innerWidth || 1024;
  const device = w < 640 ? 'Mobile' : w < 1024 ? 'Tablet' : 'Desktop';
  return {
    viewerId,
    device,
    ...(city ? { city } : {}),
    ...(phone ? { phone } : {}),
    ...(passRef ? { passRef } : {}),
  };
}

export function trackEvent(name: AnalyticsEventName, properties: EventProperties = {}) {
  if (typeof window === 'undefined') return;
  const meta = getAnonViewerMeta();
  const event = {
    name,
    properties: sanitizeEventProperties({
      ...meta,
      ...properties,
    }),
    path: window.location.pathname,
    occurredAt: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent('tubetv:analytics', { detail: event }));
  const host = window.location.hostname;
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  const allowLocal = (import.meta.env.VITE_ANALYTICS_ALLOW_LOCALHOST as string) === 'true';
  if (!endpoint || (isLocalHost && !allowLocal)) return;
  const payload = JSON.stringify(event);
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([payload], { type: 'text/plain' }));
    } else if (typeof fetch !== 'undefined') {
      fetch(endpoint, {
        method: 'POST',
        body: payload,
        mode: 'cors',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain' },
      }).catch(() => {});
    }
  } catch {}
}
