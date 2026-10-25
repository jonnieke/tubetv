import { useState, useEffect, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isAdminUser } from '../lib/authorization';
import { isAnotherDeviceActive, claimActiveDevice } from '../lib/deviceSession';

export function useViewerAuth() {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false); // Admin login modal
  const [showViewerAuth, setShowViewerAuth] = useState(false); // Viewer phone/email modal
  const [deviceConflictNotice, setDeviceConflictNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Check for local demo user
      const stored = localStorage.getItem('tubetv_viewer_session');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          setCurrentUser(user);
          setIsAuthenticated(true);
        } catch {}
      }
      setIsAuthLoading(false);
      return;
    }

    let active = true;

    // Check current session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (user) {
        // Enforce single active device check
        const conflict = isAnotherDeviceActive(user);
        if (conflict.isAnotherActive) {
          // Another device is active: log out this device
          void supabase.auth.signOut().catch(() => {});
          setCurrentUser(null);
          setIsAuthenticated(false);
          setDeviceConflictNotice(
            `Logged out because this number was signed into on another device (${conflict.activeDeviceName}). Only 1 device allowed at a time.`
          );
        } else {
          // If no active device registered yet, claim this device
          if (!user.user_metadata?.active_device_id) {
            void claimActiveDevice(user);
          }
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      } else {
        const stored = localStorage.getItem('tubetv_viewer_session');
        if (stored) {
          try {
            const localUser = JSON.parse(stored);
            setCurrentUser(localUser);
            setIsAuthenticated(true);
          } catch {}
        }
      }
      setIsAuthLoading(false);
    }).catch(() => {
      if (active) setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) {
        const stored = localStorage.getItem('tubetv_viewer_session');
        if (!stored) {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
        return;
      }

      const conflict = isAnotherDeviceActive(session.user);
      if (conflict.isAnotherActive) {
        void supabase.auth.signOut().catch(() => {});
        setCurrentUser(null);
        setIsAuthenticated(false);
        setDeviceConflictNotice(
          `Logged out because this number was signed into on another device (${conflict.activeDeviceName}). Only 1 device allowed at a time.`
        );
      } else {
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
            // Another device took over
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
    localStorage.removeItem('tubetv_viewer_session');
    localStorage.removeItem('tube_verified_phone');
    if (isSupabaseConfigured) {
      await supabase.auth.signOut().catch(() => {});
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, []);

  const isAdmin = isAdminUser(currentUser);
  const userPhone = currentUser?.phone || currentUser?.email || currentUser?.user_metadata?.phone;

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
