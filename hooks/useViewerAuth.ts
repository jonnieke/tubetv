import { useState, useEffect, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isAdminUser } from '../lib/authorization';
import { isAnotherDeviceActive, claimActiveDevice } from '../lib/deviceSession';

// Helper to retrieve persisted local viewer user or reconstructed phone user
function getPersistedViewerUser(): SupabaseUser | null {
  try {
    const stored = localStorage.getItem('tubetv_viewer_session');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}

  try {
    const phone = localStorage.getItem('tube_verified_phone');
    if (phone) {
      const rawDigits = phone.replace(/\D/g, '');
      return {
        id: `viewer_${rawDigits}`,
        app_metadata: {},
        user_metadata: { phone, display_name: phone },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as SupabaseUser;
    }
  } catch {}

  return null;
}

export function useViewerAuth() {
  // Synchronously initialize with remembered user so viewer is IMMEDIATELY recognized on visit!
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(() => getPersistedViewerUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getPersistedViewerUser()));
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false); // Admin login modal
  const [showViewerAuth, setShowViewerAuth] = useState(false); // Viewer phone/email modal
  const [deviceConflictNotice, setDeviceConflictNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // Background session verification with Supabase
    const verifySession = async () => {
      const persistedPhone = typeof window !== 'undefined' ? localStorage.getItem('tube_verified_phone') : null;

      if (!isSupabaseConfigured) {
        const local = getPersistedViewerUser();
        if (local && active) {
          setCurrentUser(local);
          setIsAuthenticated(true);
        }
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!active) return;

        if (user) {
          // Check single active device check
          const conflict = isAnotherDeviceActive(user);
          if (conflict.isAnotherActive) {
            void supabase.auth.signOut().catch(() => {});
            localStorage.removeItem('tubetv_viewer_session');
            localStorage.removeItem('tube_verified_phone');
            setCurrentUser(null);
            setIsAuthenticated(false);
            setDeviceConflictNotice(
              `Logged out because this number was signed into on another device (${conflict.activeDeviceName}). Only 1 device allowed at a time.`
            );
            return;
          }

          // If no active device registered yet, claim this device
          if (!user.user_metadata?.active_device_id) {
            void claimActiveDevice(user);
          }

          // Persist user and phone so viewer is ALWAYS remembered across visits
          try {
            localStorage.setItem('tubetv_viewer_session', JSON.stringify(user));
            const phone = user.user_metadata?.phone || user.phone || persistedPhone;
            if (phone) localStorage.setItem('tube_verified_phone', phone);
          } catch {}

          setCurrentUser(user);
          setIsAuthenticated(true);
          return;
        }

        // If no user in Supabase, but we have a remembered phone:
        // Try silent background login with synthetic viewer credentials
        if (persistedPhone) {
          const rawDigits = persistedPhone.replace(/\D/g, '');
          const syntheticEmail = `${rawDigits}@viewer.tube.co.ke`;
          const fallbackPassword = `tube_${rawDigits.slice(-6) || 'welcome2026'}`;

          const { data: signData } = await supabase.auth.signInWithPassword({
            email: syntheticEmail,
            password: fallbackPassword,
          });

          if (!active) return;

          if (signData?.user) {
            if (signData.session) {
              await supabase.auth.setSession(signData.session);
            }
            try {
              localStorage.setItem('tubetv_viewer_session', JSON.stringify(signData.user));
              localStorage.setItem('tube_verified_phone', persistedPhone);
            } catch {}
            setCurrentUser(signData.user);
            setIsAuthenticated(true);
            return;
          }

          // If background sign in fails (e.g. offline/network), KEEP the persisted viewer user active!
          const restored = getPersistedViewerUser();
          if (restored && active) {
            setCurrentUser(restored);
            setIsAuthenticated(true);
          }
        }
      } catch {
        // Network error: maintain remembered user
        if (active) {
          const restored = getPersistedViewerUser();
          if (restored) {
            setCurrentUser(restored);
            setIsAuthenticated(true);
          }
        }
      }
    };

    void verifySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) {
        // Only drop session if localStorage was explicitly cleared (logout)
        const stored = getPersistedViewerUser();
        if (!stored) {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
        return;
      }

      const conflict = isAnotherDeviceActive(session.user);
      if (conflict.isAnotherActive) {
        void supabase.auth.signOut().catch(() => {});
        localStorage.removeItem('tubetv_viewer_session');
        localStorage.removeItem('tube_verified_phone');
        setCurrentUser(null);
        setIsAuthenticated(false);
        setDeviceConflictNotice(
          `Logged out because this number was signed into on another device (${conflict.activeDeviceName}). Only 1 device allowed at a time.`
        );
      } else {
        try {
          localStorage.setItem('tubetv_viewer_session', JSON.stringify(session.user));
          const phone = session.user.user_metadata?.phone || session.user.phone;
          if (phone) localStorage.setItem('tube_verified_phone', phone);
        } catch {}
        setCurrentUser(session.user);
        setIsAuthenticated(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Periodic heartbeat single-device check (every 20s and on tab focus)
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !isSupabaseConfigured) return;

    const checkDevice = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const conflict = isAnotherDeviceActive(user);
          if (conflict.isAnotherActive) {
            await handleLogout();
            setDeviceConflictNotice(
              `You have been logged out because this phone number was logged in on another device (${conflict.activeDeviceName}). Only 1 active device is allowed at a time.`
            );
          }
        }
      } catch {}
    };

    const interval = setInterval(checkDevice, 20000);
    window.addEventListener('focus', checkDevice);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkDevice);
    };
  }, [isAuthenticated, currentUser]);

  const handleLogout = useCallback(async () => {
    try {
      localStorage.removeItem('tubetv_viewer_session');
      localStorage.removeItem('tube_verified_phone');
    } catch {}
    if (isSupabaseConfigured) {
      await supabase.auth.signOut().catch(() => {});
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, []);

  const isAdmin = isAdminUser(currentUser);
  const userPhone =
    currentUser?.phone ||
    currentUser?.user_metadata?.phone ||
    (typeof window !== 'undefined' ? localStorage.getItem('tube_verified_phone') || '' : '') ||
    currentUser?.email;

  return {
    currentUser,
    isAuthenticated,
    isAuthLoading,
    isAdmin,
    userPhone,
    showLogin,
    setShowLogin,
    showViewerAuth,
    setShowViewerAuth,
    deviceConflictNotice,
    setDeviceConflictNotice,
    handleLogout,
    setCurrentUser,
    setIsAuthenticated,
  };
}
