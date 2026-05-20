
const ACTIVE_KEY = 'tube_kids_mode';
const PIN_KEY    = 'tube_kids_pin';

export const isKidsModeActive = (): boolean => {
  try { return localStorage.getItem(ACTIVE_KEY) === 'true'; } catch { return false; }
};

export const setKidsModeActive = (v: boolean): void => {
  try { localStorage.setItem(ACTIVE_KEY, v ? 'true' : 'false'); } catch {}
};

export const getKidsPin = (): string | null => {
  try { return localStorage.getItem(PIN_KEY); } catch { return null; }
};

export const setKidsPin = (pin: string): void => {
  try { localStorage.setItem(PIN_KEY, pin); } catch {}
};

export const hasKidsPin = (): boolean => !!getKidsPin();

/** Returns true if pin matches stored pin */
export const verifyKidsPin = (pin: string): boolean => {
  const stored = getKidsPin();
  return stored !== null && stored === pin;
};

/** Views allowed when Kids Mode is active */
export const KIDS_SAFE_VIEWS = new Set([
  'HOME', 'KIDS', 'EDUCATION', 'WATCH_LATER',
]);
