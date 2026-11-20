import { beforeEach, describe, expect, it } from 'vitest';
import { captureSessionAttribution, getSessionAttribution } from './attribution';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('session viral attribution', () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    (globalThis as unknown as { window?: unknown }).window = {
      sessionStorage: storage,
      location: { search: '', pathname: '/' },
    };
  });

  it('captures TikTok UTM parameters and persists them across the session', () => {
    const attr = captureSessionAttribution(
      '?utm_source=TikTok&utm_campaign=roommates_ep1&ref=creator42',
      '',
      '/watch/micro-roommates-ep1',
    );

    expect(attr.trafficSource).toBe('tiktok');
    expect(attr.campaign).toBe('roommates_ep1');
    expect(attr.referrerCode).toBe('creator42');
    expect(getSessionAttribution()?.trafficSource).toBe('tiktok');

    // Subsequent internal navigation without query params preserves the landing attribution
    const preserved = captureSessionAttribution('', '', '/watch/micro-roommates-ep2');
    expect(preserved.trafficSource).toBe('tiktok');
    expect(preserved.campaign).toBe('roommates_ep1');
  });

  it('recognizes WhatsApp share-to-unlock viral links', () => {
    const attr = captureSessionAttribution('?src=wa_unlock', '', '/watch/ep-3');
    expect(attr.trafficSource).toBe('wa_unlock');
  });
});
