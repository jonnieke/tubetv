
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

const DISMISS_KEY = 'tube_pwa_dismiss_until';
const PLAY_KEY    = 'tube_pwa_play_count';

export const initPWA = (): void => {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('tube-pwa-installable'));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event('tube-pwa-installed'));
  });
};

export const isInstallable = (): boolean => !!deferredPrompt;

export const isInstalled = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true;

export const isIOS = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;

export const promptInstall = async (): Promise<boolean> => {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
};

/** Track video plays — show banner after threshold plays */
export const recordPlay = (): number => {
  try {
    const n = parseInt(localStorage.getItem(PLAY_KEY) || '0', 10) + 1;
    localStorage.setItem(PLAY_KEY, String(n));
    return n;
  } catch { return 0; }
};

export const getPlayCount = (): number => {
  try { return parseInt(localStorage.getItem(PLAY_KEY) || '0', 10); } catch { return 0; }
};

export const isDismissed = (): boolean => {
  try {
    const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    return Date.now() < until;
  } catch { return false; }
};

/** Dismiss for 7 days */
export const dismiss = (): void => {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 86_400_000)); } catch {}
};

/** Should we show the install banner? */
export const shouldShowBanner = (): boolean =>
  !isInstalled() && !isDismissed() && (isInstallable() || isIOS()) && getPlayCount() >= 2;
