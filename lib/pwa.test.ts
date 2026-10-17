import { describe, expect, it, beforeEach } from 'vitest';
import { isRunningStandalone, onInstallAvailabilityChange } from '../lib/pwa';

describe('PWA Lifecycle & Installation Helper', () => {
  beforeEach(() => {
    // Reset any state if necessary
  });

  it('detects standard browser window as not running standalone', () => {
    // In node/vitest, matchMedia returns default false
    const standalone = isRunningStandalone();
    expect(standalone).toBe(false);
  });

  it('allows subscription to install availability changes', () => {
    let notifiedValue: boolean | null = null;
    const unsubscribe = onInstallAvailabilityChange((canInstall) => {
      notifiedValue = canInstall;
    });

    // Initial value is emitted immediately
    expect(notifiedValue).toBe(false);

    unsubscribe();
  });
});
