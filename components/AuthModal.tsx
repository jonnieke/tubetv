import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Phone, ShieldCheck, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { isValidKenyanPhone, requestPhoneOtp, verifyPhoneOtp } from '../lib/supabase';

interface AuthModalProps {
  onSuccess: (user: User) => void;
  onCancel: () => void;
}

type Mode = 'signin' | 'signup';
type Step = 'phone' | 'otp';

const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onCancel }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'otp') otpRef.current?.focus();
  }, [step]);

  const sendCode = async () => {
    setError('');
    if (!isValidKenyanPhone(phone)) {
      setError('Enter a valid Kenyan number, for example 0712 345 678.');
      return;
    }
    if (mode === 'signup' && displayName.trim().length < 2) {
      setError('Enter the name you want shown on TubeTV.');
      return;
    }

    setIsLoading(true);
    const { error: otpError } = await requestPhoneOtp(phone, mode === 'signup', displayName);
    setIsLoading(false);
    if (otpError) {
      const message = otpError.message.toLowerCase();
      setError(message.includes('signups not allowed')
        ? 'No account was found for this number. Switch to Sign Up.'
        : 'We could not send the verification code. Please try again.');
      return;
    }
    setOtp('');
    setStep('otp');
    setResendIn(30);
  };

  const handlePhoneSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendCode();
  };

  const handleOtpSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit code sent to your phone.');
      return;
    }

    setIsLoading(true);
    const { data, error: verifyError } = await verifyPhoneOtp(phone, otp);
    setIsLoading(false);
    if (verifyError || !data.user) {
      setError('That code is invalid or has expired. Request a new code and try again.');
      return;
    }
    onSuccess(data.user);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <button type="button" onClick={onCancel} aria-label="Close sign in" className="absolute right-4 top-4 p-2 text-zinc-500 hover:text-white">
          <X size={20} />
        </button>

        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit}>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-600/15 text-red-500">
              <Phone size={24} />
            </div>
            <h2 id="auth-title" className="text-2xl font-bold text-white">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="mt-2 text-sm text-zinc-400">We will send a one-time verification code by SMS.</p>

            {mode === 'signup' && (
              <label className="mt-6 block text-sm text-zinc-300">
                Display name
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-red-500 focus:outline-none" />
              </label>
            )}

            <label className="mt-5 block text-sm text-zinc-300">
              Phone number
              <input value={phone} onChange={(event) => { setPhone(event.target.value); setError(''); }} type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:border-red-500 focus:outline-none" />
            </label>

            {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
            <button disabled={isLoading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50">
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              Send verification code
            </button>
            <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }} className="mt-5 w-full text-sm text-zinc-400 hover:text-white">
              {mode === 'signin' ? 'New to TubeTV? Create an account' : 'Already have an account? Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <button type="button" onClick={() => { setStep('phone'); setError(''); }} className="mb-6 flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
              <ArrowLeft size={16} /> Change number
            </button>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 text-green-400">
              <CheckCircle2 size={24} />
            </div>
            <h2 id="auth-title" className="text-2xl font-bold text-white">Check your messages</h2>
            <p className="mt-2 text-sm text-zinc-400">Enter the code sent to {phone}.</p>
            <label className="mt-6 block text-sm text-zinc-300">
              Verification code
              <input ref={otpRef} value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-center text-2xl tracking-[0.4em] text-white focus:border-red-500 focus:outline-none" />
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
            <button disabled={isLoading || otp.length !== 6} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50">
              {isLoading && <Loader2 className="animate-spin" size={18} />}
              Verify and continue
            </button>
            <button type="button" disabled={resendIn > 0 || isLoading} onClick={sendCode} className="mt-5 w-full text-sm text-zinc-400 hover:text-white disabled:text-zinc-600">
              {resendIn > 0 ? `Send another code in ${resendIn}s` : 'Send another code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
