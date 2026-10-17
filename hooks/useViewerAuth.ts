import { useState, useEffect, useCallback } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { verifiedActiveAdminUser } from '../lib/adminSession';
import { clearLocalAuthSession } from '../lib/localAuth';
import { isAdminUser } from '../lib/authorization';

export function useViewerAuth() {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    clearLocalAuthSession();
    if (!isSupabaseConfigured) {
      setIsAuthLoading(false);
      return;
    }

    let active = true;
    verifiedActiveAdminUser()
      .then((user) => {
        if (!active) return;
        setCurrentUser(user);
        setIsAuthenticated(Boolean(user));
        setIsAuthLoading(false);
      })
      .catch(() => {
        if (active) setIsAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        return;
      }
      setTimeout(() => {
        if (!active) return;
        verifiedActiveAdminUser().then((user) => {
          if (!active) return;
          setCurrentUser(user);
          setIsAuthenticated(Boolean(user));
        });
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, []);

  const isAdmin = isAdminUser(currentUser);
  const userPhone = currentUser?.phone || currentUser?.email;

  return {
    currentUser,
    isAuthenticated,
    isAuthLoading,
    isAdmin,
    userPhone,
    showLogin,
    setShowLogin,
    handleLogout,
    setCurrentUser,
    setIsAuthenticated,
  };
}
