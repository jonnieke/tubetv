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

function getAnonViewerMeta(): { viewerId?: string; device?: string; city?: string } {
  if (typeof window === 'undefined') return {};
  let viewerId: string | undefined;
  try {
    viewerId = window.localStorage.getItem('tubetv_viewer_id') || undefined;
    if (!viewerId) {
      viewerId = `vw_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem('tubetv_viewer_id', viewerId);
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
  return { viewerId, device, ...(city ? { city } : {}) };
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
  if (!endpoint) return;
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
