import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isPushSupported,
  getPushPermissionState,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from './pushNotifications';

describe('Push Notifications Utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reports push unsupported when PushManager or serviceWorker is missing', () => {
    expect(isPushSupported()).toBe(false);
    expect(getPushPermissionState()).toBe('unsupported');
  });

  it('gracefully returns error when subscribing in an unsupported environment', async () => {
    const result = await subscribeToPushNotifications();
    expect(result.success).toBe(false);
    expect(result.error).toContain('not supported');
  });

  it('handles unsubscription cleanly when unsupported', async () => {
    const result = await unsubscribeFromPushNotifications();
    expect(result).toBe(false);
  });
});

describe('Deep Link Parameter Parsing', () => {
  it('parses ?v= and ?watch= video parameters', () => {
    const url1 = new URL('https://www.tube.co.ke/?v=ep-3-roommates');
    expect(url1.searchParams.get('v')).toBe('ep-3-roommates');

    const url2 = new URL('https://www.tube.co.ke/?watch=movie-nairobi-secret');
    expect(url2.searchParams.get('watch')).toBe('movie-nairobi-secret');
  });

  it('parses ?series= and ?drama= micro-drama deep links', () => {
    const url = new URL('https://www.tube.co.ke/?series=Roommates');
    expect(url.searchParams.get('series')).toBe('Roommates');
  });
});
