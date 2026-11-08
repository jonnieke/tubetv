import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  X,
  Coins,
  ShieldCheck,
  Smartphone,
  Mail,
  Loader2,
  Sparkles,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, phoneToE164, requestPhoneOtp, verifyPhoneOtp } from '../lib/supabase';
import { isAnotherDeviceActive, claimActiveDevice } from '../lib/deviceSession';

interface ViewerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export default function ViewerAuthModal({ isOpen, onClose, onSuccess }: ViewerAuthModalProps) {
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem('tube_verified_phone') || '';
    } catch {
      return '';
    }
  });
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'input' | 'conflict'>('input');
  const [conflictDeviceName, setConflictDeviceName] = useState('Another Device');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    const e164 = phoneToE164(phone);
    if (!isSupabaseConfigured || !e164) {
      setErrorMessage(isSupabaseConfigured ? 'Enter a valid Kenyan mobile number.' : 'Sign-in is unavailable.');
      return;
    }

    setIsLoading(true);
    try {
      if (!otpPhone) {
        const { error } = await requestPhoneOtp(e164, true, undefined, 'sms');
        if (error) throw error;
        setOtpPhone(e164);
        setSuccessMessage('Enter the verification code sent to your phone.');
        return;
      }
      const { data, error } = await verifyPhoneOtp(otpPhone, otp.trim());
      if (error) throw error;
      if (!data?.session || !data.user) throw new Error('Unable to verify your phone.');
      await checkDeviceAndComplete(data.user, otpPhone);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in with phone.');
    } finally {
      setIsLoading(false);
    }
  };

  // Checks for concurrent active device; shows 1-device modal if another device is active
  const checkDeviceAndComplete = async (user: User, identifier: string) => {
    const conflict = isAnotherDeviceActive(user);
    if (conflict.isAnotherActive) {
      setPendingUser(user);
      setConflictDeviceName(conflict.activeDeviceName);
      setStep('conflict');
      setIsLoading(false);
      return;
    }

    // Single device claimed
    await claimActiveDevice(user);
    await finalizeLogin(user, identifier);
  };

  // Force log out the other device and take over on this device
  const handleLogoutOtherDevice = async () => {
    if (!pendingUser) return;
    setIsLoading(true);
    try {
      await claimActiveDevice(pendingUser);
      await finalizeLogin(pendingUser, phoneToE164(phone) || phone);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to switch device. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Email Sign In / Sign Up
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !email.includes('@') || email.trim().toLowerCase().endsWith('@viewer.tube.co.ke')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      if (password) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (!signInError && signInData.session && signInData.user) {
          await checkDeviceAndComplete(signInData.user, email);
          return;
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          setErrorMessage(signUpError.message);
          setIsLoading(false);
          return;
        }

        if (signUpData.session && signUpData.user) {
          await checkDeviceAndComplete(signUpData.user, email);
        } else {
          setSuccessMessage('Check your email to confirm your account, then sign in.');
          return;
        }
      } else {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true },
        });

        if (otpError) {
          setErrorMessage(otpError.message);
          setIsLoading(false);
          return;
        }

        setSuccessMessage('Check your email inbox for your instant sign-in link!');
        setIsLoading(false);
        return;
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeLogin = async (user: User, identifier: string) => {
    // Persist session & phone locally so viewer is permanently remembered
    try {
      localStorage.setItem('tubetv_viewer_session', JSON.stringify(user));
      if (user.phone && user.phone_confirmed_at) localStorage.setItem('tube_verified_phone', phoneToE164(user.phone));
      else localStorage.removeItem('tube_verified_phone');
    } catch {}

    setIsLoading(false);
    onSuccess(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Welcome Bonus Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
            <Coins className="w-7 h-7 fill-amber-400 animate-pulse" />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-lg font-black text-white tracking-tight">Sign in to TubeTV</h3>
          </div>
          <p className="text-xs text-zinc-400 max-w-[260px] mx-auto leading-relaxed">
            Verify your phone number or email to access your wallet and purchases.
          </p>
        </div>

        {/* Status Messages */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
            {errorMessage}
          </div>
        )}
        {successMessage && step !== 'conflict' && (
          <div className="mb-4 p-3 rounded-xl bg-green-950/60 border border-green-800 text-xs text-green-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Step: Single Device Conflict Resolution */}
        {step === 'conflict' ? (
          <div className="space-y-4 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white mb-1">Active on Another Device</h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                This number (<strong className="text-white">{phone}</strong>) is currently active on:
                <span className="block font-semibold text-amber-400 mt-1">📱 {conflictDeviceName}</span>
              </p>
              <p className="text-[11px] text-zinc-400 mt-2">
                TubeTV permits a <strong>maximum of 1 active device</strong> at a time.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleLogoutOtherDevice}
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Logging out other device...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-black" />
                    <span>Log Out Other Device & Watch Here</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('input');
                }}
                className="w-full py-2 text-xs text-zinc-400 hover:text-white"
              >
                Use a different number
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Auth Method Tabs */}
            <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800 mb-4">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone');
                  setErrorMessage('');
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  authMethod === 'phone'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Phone (Kenya)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setErrorMessage('');
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  authMethod === 'email'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Email</span>
              </button>
            </div>

            {/* Direct Kenyan Phone Flow */}
            {authMethod === 'phone' && (
              <form onSubmit={handlePhoneAuth} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Kenyan Mobile Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      placeholder="0712 345 678 or 0110 123 456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)} disabled={Boolean(otpPhone) || isLoading}
                      required
                      autoFocus
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Maximum 1 active device per phone number.
                  </span>
                </div>

                {otpPhone && (
                  <div className="space-y-2">
                    <label className="block text-xs text-zinc-300">
                      Verification code
                      <input value={otp} onChange={e => setOtp(e.target.value)} required
                        inputMode="numeric" autoComplete="one-time-code"
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3" />
                    </label>
                    <button type="button" disabled={isLoading} onClick={() => {
                      setOtpPhone(''); setOtp(''); setSuccessMessage(''); setErrorMessage('');
                    }} className="text-xs text-zinc-300 underline">Change number or resend</button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4 text-black" />
                      <span>{otpPhone ? 'Verify code' : 'Send verification code'}</span>
                      <ArrowRight className="w-4 h-4 text-black" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Email Flow */}
            {authMethod === 'email' && (
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">
                    Password <span className="text-zinc-500 text-[10px] normal-case">(Optional for Magic Link)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Leave blank for Magic Link"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Sign in</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
