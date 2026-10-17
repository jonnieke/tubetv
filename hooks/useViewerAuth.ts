import { useState, useEffect, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { verifiedActiveAdminUser } from '../lib/adminSession';
import { isAdminUser } from '../lib/authorization';

export function useViewerAuth() {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false); // Admin login modal
  const [showViewerAuth, setShowViewerAuth] = useState(false); // Viewer phone/email modal

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
        setCurrentUser(user);
        setIsAuthenticated(true);
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

      setCurrentUser(session.user);
      setIsAuthenticated(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    localStorage.removeItem('tubetv_viewer_session');
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
    handleLogout,
    setCurrentUser,
    setIsAuthenticated,
  };
}
