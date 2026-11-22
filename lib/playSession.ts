/**
 * In-memory registry of server-issued HMAC `playSessionToken`s returned by
 * `playback-access` so `analytics-event` can cryptographically verify 30s
 * `qualified_view` royalty events without circular imports.
 */
const activePlaySessions = new Map<string, string>();

export function setPlaySessionToken(videoId: string, token: string): void {
  if (!videoId || !token) return;
  if (activePlaySessions.size > 100) {
    const firstKey = activePlaySessions.keys().next().value;
    if (firstKey) activePlaySessions.delete(firstKey);
  }
  activePlaySessions.set(videoId, token);
}

export function getPlaySessionToken(videoId: string): string | null {
  if (!videoId) return null;
  return activePlaySessions.get(videoId) || null;
}
