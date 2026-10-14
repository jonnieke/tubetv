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
  | 'paywall_completed';

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
  const event = {
    name,
    properties: sanitizeEventProperties(properties),
    path: window.location.pathname,
    occurredAt: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent('tubetv:analytics', { detail: event }));
  if (!endpoint || !navigator.sendBeacon) return;
  navigator.sendBeacon(endpoint, new Blob([JSON.stringify(event)], { type: 'application/json' }));
}
