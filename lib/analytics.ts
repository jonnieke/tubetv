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
  | 'qualified_view';

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

export function trackEvent(name: AnalyticsEventName, properties: EventProperties = {}) {
  if (typeof window === 'undefined') return;
  const event = {
    name,
    properties: sanitizeEventProperties(properties),
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
