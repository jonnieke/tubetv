import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMediaBlocked, setOverlayMediaBlocked } from './mediaGuard';

describe('global media guard', () => {
  afterEach(() => {
    setOverlayMediaBlocked(false);
  });

  it('blocks media playback while a paywall or auth overlay is open and pauses active videos', () => {
    const pauseSpy = vi.fn();
    (globalThis as unknown as { document?: unknown }).document = {
      visibilityState: 'visible',
      querySelectorAll: () => [{ paused: false, pause: pauseSpy }],
    };

    expect(isMediaBlocked()).toBe(false);
    setOverlayMediaBlocked(true);
    expect(isMediaBlocked()).toBe(true);
    expect(pauseSpy).toHaveBeenCalledTimes(1);

    setOverlayMediaBlocked(false);
    expect(isMediaBlocked()).toBe(false);
  });

  it('reports media as blocked when the page visibility is hidden (navigated away)', () => {
    (globalThis as unknown as { document?: unknown }).document = {
      visibilityState: 'hidden',
      querySelectorAll: () => [],
    };
    expect(isMediaBlocked()).toBe(true);
  });
});
