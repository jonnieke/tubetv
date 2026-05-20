
const KEY = 'tube_push_subscribed';

export const isPushSubscribed = (): boolean => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};

/** Returns the current Notification permission state. */
export const getPushPermission = (): NotificationPermission | 'unsupported' => {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
};

/**
 * Requests notification permission from the browser.
 * Returns 'granted' | 'denied' | 'default' | 'unsupported'.
 */
export const requestPushPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') {
    try { localStorage.setItem(KEY, '1'); } catch {}
    return 'granted';
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    try { localStorage.setItem(KEY, '1'); } catch {}
    // Fire a welcome notification straight away to confirm it works
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('Habari za Tube TV 🇰🇪', {
        body: 'Utapata arifa kuhusu maudhui mapya. Asante!',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      });
    } catch {
      // Non-fatal: SW may not be registered yet
    }
  }
  return result;
};

/** Remove stored subscription state (user revoked in settings). */
export const clearPushSubscription = (): void => {
  try { localStorage.removeItem(KEY); } catch {}
};
