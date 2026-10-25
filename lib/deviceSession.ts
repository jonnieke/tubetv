import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Returns a stable unique ID for this browser / device
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem('tube_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem('tube_device_id', id);
    }
    return id;
  } catch {
    return 'dev_fallback_' + Date.now().toString(36);
  }
}

/**
 * Returns a friendly device and browser label (e.g. "Safari on iPhone", "Chrome on Windows")
 */
export function getDeviceName(): string {
  try {
    const ua = navigator.userAgent;
    let browser = 'Browser';
    let os = 'Device';

    // Detect OS
    if (/iPhone/i.test(ua)) os = 'iPhone';
    else if (/iPad/i.test(ua)) os = 'iPad';
    else if (/Android/i.test(ua)) os = 'Android Phone';
    else if (/Windows/i.test(ua)) os = 'Windows PC';
    else if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac';
    else if (/Linux/i.test(ua)) os = 'Linux';

    // Detect Browser
    if (/Edg/i.test(ua)) browser = 'Edge';
    else if (/Chrome/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';

    return `${browser} on ${os}`;
  } catch {
    return 'Web Browser';
  }
}

/**
 * Checks if another device currently holds the active session
 */
export function isAnotherDeviceActive(user: SupabaseUser | null): {
  isAnotherActive: boolean;
  activeDeviceName: string;
  activeDeviceId: string;
} {
  if (!user) {
    return { isAnotherActive: false, activeDeviceName: '', activeDeviceId: '' };
  }

  const myDeviceId = getDeviceId();
  const remoteDeviceId = user.user_metadata?.active_device_id;
  const remoteDeviceName = user.user_metadata?.active_device_name || 'Another Device';

  if (remoteDeviceId && remoteDeviceId !== myDeviceId) {
    return {
      isAnotherActive: true,
      activeDeviceName: remoteDeviceName,
      activeDeviceId: remoteDeviceId,
    };
  }

  return {
    isAnotherActive: false,
    activeDeviceName: '',
    activeDeviceId: remoteDeviceId || '',
  };
}

/**
 * Sets this device as the single active device for this user in Supabase
 */
export async function claimActiveDevice(user?: SupabaseUser | null): Promise<boolean> {
  try {
    const myDeviceId = getDeviceId();
    const myDeviceName = getDeviceName();

    const { error } = await supabase.auth.updateUser({
      data: {
        active_device_id: myDeviceId,
        active_device_name: myDeviceName,
        active_at: new Date().toISOString(),
      },
    });

    return !error;
  } catch {
    return false;
  }
}
