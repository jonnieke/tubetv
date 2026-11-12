import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isAdminUser } from '../lib/authorization';

interface Props {
  onSuccess: (user: User) => void;
  onCancel: () => void;
}

const AuthModal: React.FC<Props> = ({ onSuccess, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    emailRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previous?.focus();
    };
  }, [onCancel]);

  const signIn = async () => {
    if (!isSupabaseConfigured) {
      setError('Admin sign-in is unavailable until Supabase is configured.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError || !data.user) {
        setError(authError?.message || 'Sign-in failed.');
        return;
      }
      if (!isAdminUser(data.user)) {
        await supabase.auth.signOut();
        setError('This account does not have administrator privileges.');
        return;
      }
      onSuccess(data.user);
    } catch {
      setError('Unable to connect to the sign-in service.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isSupabaseConfigured) {
      setResetError('Admin sign-in is unavailable until Supabase is configured.');
      return;
    }
    const targetEmail = email.trim();
    if (!targetEmail) {
      setResetError('Enter your admin email address above first.');
      return;
    }
    setResetLoading(true);
    setResetError('');
    setResetMessage('');
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/admin/setup`,
      });
      if (resetErr) {
        setResetError(resetErr.message);
      } else {
        setResetMessage(`Password reset link sent to ${targetEmail}. Check your inbox.`);
      }
    } catch {
      setResetError('Unable to send password reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close sign in"
          className="absolute right-4 top-4 p-2 text-zinc-500 hover:text-white"
        >
          <X size={20} />
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void signIn();
          }}
        >
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-600/15 text-red-500">
            <ShieldCheck size={24} />
          </div>
          <h2 id="auth-title" className="text-2xl font-bold">
            Admin access
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in with your email and password to access the TubeTV dashboard.
          </p>

          <label className="mt-6 block text-sm">
            Email
            <input
              ref={emailRef}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 focus:border-red-500 focus:outline-none"
            />
          </label>
          <label className="mt-5 block text-sm">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 focus:border-red-500 focus:outline-none"
            />
          </label>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={resetLoading}
              onClick={handleResetPassword}
              className="text-xs text-zinc-400 hover:text-white underline underline-offset-2 transition-colors disabled:opacity-50"
            >
              {resetLoading ? 'Sending link…' : 'Forgot password?'}
            </button>
          </div>

          {resetMessage && (
            <p role="status" className="mt-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-md p-2">
              {resetMessage}
            </p>
          )}
          {resetError && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {resetError}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-bold disabled:opacity-50 hover:bg-red-700 transition-colors"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
