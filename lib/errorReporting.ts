/**
 * Lightweight production error & crash reporter.
 * Sends ErrorBoundary and unhandled runtime crashes to the `ops-monitor` Edge Function
 * (deduplicated per session so a render loop never floods the server).
 */

const SUPABASE_URL = ((import.meta.env.VITE_SUPABASE_URL as string) || '').replace(/\/$/, '');
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
const reportedFingerprints = new Set<string>();

export function reportClientError(
  error: unknown,
  context: { source?: string; componentStack?: string; extra?: Record<string, unknown> } = {},
): void {
  if (typeof window === 'undefined' || !SUPABASE_URL) return;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return;

  const errObj = error instanceof Error ? error : new Error(String(error || 'Unknown client error'));
  const source = context.source || 'error_boundary';
  const message = (errObj.message || String(error)).slice(0, 500);
  const fingerprint = `${source}:${message.slice(0, 120)}`;
  if (reportedFingerprints.has(fingerprint)) return;
  reportedFingerprints.add(fingerprint);

  const payload = JSON.stringify({
    action: 'report_error',
    source,
    message,
    stack: (errObj.stack || context.componentStack || '').slice(0, 2500),
    pagePath: `${window.location.pathname}${window.location.search}`.slice(0, 200),
    metadata: context.extra || {},
  });

  try {
    void fetch(`${SUPABASE_URL}/functions/v1/ops-monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}),
      },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never throw from an error reporter
  }
}
