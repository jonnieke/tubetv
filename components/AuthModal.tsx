import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Phone, ShieldCheck, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { isValidKenyanPhone } from '../lib/supabase';
import { verifyLocalAdminLogin } from '../lib/localAuth';

interface AuthModalProps {
  onSuccess: (user: User) => void;
  onCancel: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onCancel }) => {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pinRef.current?.focus();
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!isValidKenyanPhone(phone)) {
      setError('Enter a valid Kenyan number, for example 0712 345 678.');
      return;
    }
    if (!pin.trim()) {
      setError('Enter the admin PIN.');
      return;
    }

    setIsLoading(true);
    const { user, error: loginError } = verifyLocalAdminLogin(phone, pin);
    setIsLoading(false);

    if (loginError || !user) {
      setError(loginError?.message || 'Unable to unlock admin access.');
      return;
    }

    onSuccess(user);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <button type="button" onClick={onCancel} aria-label="Close sign in" className="absolute right-4 top-4 p-2 text-zinc-500 hover:text-white">
          <X size={20} />
        </button>

        <form onSubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-600/15 text-red-500">
            <Phone size={24} />
          </div>
          <h2 id="auth-title" className="text-2xl font-bold text-white">Admin access</h2>
          <p className="mt-2 text-sm text-zinc-400">Enter your phone number and the shared PIN to open TubeTV admin tools.</p>

          <label className="mt-6 block text-sm text-zinc-300">
            Phone number
            <input
              value={phone}
              onChange={(event) => { setPhone(event.target.value); setError(''); }}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-red-500 focus:outline-none"
            />
          </label>

          <label className="mt-5 block text-sm text-zinc-300">
            PIN
            <input
              ref={pinRef}
              value={pin}
              onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-center text-2xl tracking-[0.4em] text-white focus:border-red-500 focus:outline-none"
            />
          </label>

          {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
          <button disabled={isLoading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50">
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            Unlock admin access
          </button>
          <p className="mt-4 text-xs leading-5 text-zinc-500">This is a local access gate. It does not use SMS or Supabase OTP.</p>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
