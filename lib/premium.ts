
const KEY = 'tube_premium_until';

/** Returns true if the user currently has an active premium subscription */
export const isPremiumActive = (): boolean => {
  try {
    const until = parseInt(localStorage.getItem(KEY) || '0', 10);
    return until > Date.now();
  } catch { return false; }
};

/**
 * Activate premium for `months` months (can be fractional, e.g. 0.1 ≈ 3 days).
 * Dispatches `tube-premium-changed` so subscribers can react.
 */
export const activatePremium = (months: number): void => {
  const ms = months * 30 * 24 * 60 * 60 * 1000;
  try { localStorage.setItem(KEY, String(Date.now() + ms)); } catch {}
  window.dispatchEvent(new Event('tube-premium-changed'));
};

/** Returns the expiry Date, or null if not premium */
export const getPremiumUntil = (): Date | null => {
  try {
    const until = parseInt(localStorage.getItem(KEY) || '0', 10);
    return until > Date.now() ? new Date(until) : null;
  } catch { return null; }
};

/** Clear premium (for testing or expiry) */
export const clearPremium = (): void => {
  try { localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new Event('tube-premium-changed'));
};
