// ==============================================================================
// TubeTV PWA Lifecycle & Installation Helper
// ==============================================================================

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

/**
 * Initializes PWA Service Worker and listens for install prompt availability
 */
export function initPWA(): void {
  if (typeof window === 'undefined') return;

  // 1. Register Service Worker in supporting browsers
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Listen for new service worker updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available, prompt can be issued if desired
                  console.info('[TubeTV PWA] New update available.');
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn('[TubeTV PWA] Service worker registration failed:', error);
        });
    });
  }

  // 2. Capture 'beforeinstallprompt'
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyInstallListeners(true);
  });

  // 3. Listen for successful install
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstallListeners(false);
    console.info('[TubeTV PWA] App was installed successfully.');
  });
}

/**
 * Checks if the current app is already running in standalone PWA display mode
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Subscribes a callback to install prompt availability changes
 */
export function onInstallAvailabilityChange(callback: (canInstall: boolean) => void): () => void {
  installListeners.add(callback);
  callback(deferredPrompt !== null);

  return () => {
    installListeners.delete(callback);
  };
}

function notifyInstallListeners(canInstall: boolean) {
  installListeners.forEach((listener) => listener(canInstall));
}

/**
 * Triggers the native browser install prompt dialog
 */
export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    return 'unavailable';
  }

  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notifyInstallListeners(false);
    return choice.outcome;
  } catch (err) {
    console.warn('[TubeTV PWA] Install prompt failed:', err);
    return 'unavailable';
  }
}
