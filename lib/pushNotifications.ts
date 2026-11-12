import { supabase, isSupabaseConfigured } from './supabase';
import { getRememberedPhone } from './subscriptions';

export type PushPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPushPermissionState(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'prompt';
}

export async function subscribeToPushNotifications(customPhone?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications are not supported on this browser.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was denied.' };
    }

    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
      return { success: false, error: 'Service worker not ready.' };
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    let subscription: PushSubscription | null = null;

    if (vapidKey && vapidKey.trim()) {
      try {
        const convertedKey = urlBase64ToUint8Array(vapidKey.trim());
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      } catch (subErr) {
        console.warn('VAPID subscription failed, attempting to reuse existing subscription:', subErr);
        subscription = await registration.pushManager.getSubscription();
      }
    } else {
      subscription = await registration.pushManager.getSubscription();
    }

    const phone = customPhone || getRememberedPhone() || undefined;

    if (subscription && isSupabaseConfigured) {
      const rawSub = subscription.toJSON();
      const endpoint = rawSub.endpoint || '';
      const p256dh = rawSub.keys?.p256dh || '';
      const auth = rawSub.keys?.auth || '';

      if (endpoint && p256dh && auth) {
        await supabase.from('push_subscriptions').upsert(
          {
            endpoint,
            p256dh,
            auth,
            phone: phone || null,
            device_hint: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : null,
          },
          { onConflict: 'endpoint' }
        );
      }
    }

    try {
      localStorage.setItem('tubetv_push_subscribed', 'true');
    } catch {
      // Ignore storage error
    }

    // Show instant confirmation notification
    try {
      await registration.showNotification('TubeTV Alerts Active', {
        body: 'You will receive alerts when new micro-drama episodes and movies drop.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      });
    } catch {
      // Non-fatal if OS suppresses immediate notification
    }

    window.dispatchEvent(new CustomEvent('tubetv:push-updated', { detail: { subscribed: true } }));
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to enable notifications.';
    console.error('Push subscription failed:', err);
    return { success: false, error: message };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      if (isSupabaseConfigured && endpoint) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
    }
    localStorage.removeItem('tubetv_push_subscribed');
    window.dispatchEvent(new CustomEvent('tubetv:push-updated', { detail: { subscribed: false } }));
    return true;
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
    return false;
  }
}
