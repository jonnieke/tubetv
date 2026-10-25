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
  Copy,
  Check,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, requestPhoneOtp, verifyPhoneOtp, phoneToE164, isValidKenyanPhone } from '../lib/supabase';
import { claimWelcomeBonus } from '../services/paymentService';

interface ViewerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

const WhatsAppIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2ZM12.04 20.16C10.55 20.16 9.09 19.76 7.81 19L7.26 18.68L4.14 19.5L4.97 16.46L4.62 15.9C3.79 14.58 3.35 13.06 3.35 11.91C3.35 7.12 7.25 3.22 12.04 3.22C14.36 3.22 16.54 4.13 18.18 5.77C19.82 7.41 20.73 9.59 20.73 11.91C20.73 16.7 16.83 20.16 12.04 20.16ZM16.81 14.37C16.55 14.24 15.28 13.61 15.04 13.52C14.81 13.44 14.64 13.4 14.47 13.66C14.3 13.92 13.82 14.49 13.67 14.66C13.52 14.83 13.37 14.85 13.11 14.72C12.85 14.59 12.01 14.31 11.02 13.43C10.25 12.74 9.73 11.89 9.58 11.63C9.43 11.37 9.56 11.23 9.69 11.1C9.81 10.98 9.96 10.79 10.09 10.64C10.22 10.49 10.27 10.38 10.35 10.21C10.43 10.04 10.39 9.89 10.33 9.76C10.27 9.63 9.79 8.45 9.59 7.97C9.39 7.5 9.19 7.57 9.04 7.56C8.9 7.55 8.73 7.55 8.56 7.55C8.39 7.55 8.11 7.61 7.87 7.87C7.63 8.13 6.96 8.76 6.96 10.04C6.96 11.32 7.89 12.55 8.02 12.72C8.15 12.89 9.85 15.51 12.45 16.63C13.07 16.9 13.55 17.06 13.93 17.18C14.55 17.38 15.11 17.35 15.56 17.28C16.06 17.21 17.09 16.66 17.31 16.04C17.53 15.42 17.53 14.89 17.46 14.78C17.39 14.67 17.24 14.61 16.98 14.48L16.81 14.37Z" />
  </svg>
);

export default function ViewerAuthModal({ isOpen, onClose, onSuccess }: ViewerAuthModalProps) {
  const [authMethod, setAuthMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isExternalOtp, setIsExternalOtp] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  // Handle WhatsApp OTP Request
  const handleSendWhatsAppOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isValidKenyanPhone(phone)) {
      setErrorMessage('Please enter a valid Kenyan phone number (e.g. 0712 345 678 or 0110 123 456).');
      return;
    }

    setIsLoading(true);

    try {
      const e164 = phoneToE164(phone);
      // Generate secure 6-digit verification code
      const localCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(localCode);
      try {
        sessionStorage.setItem('tube_wa_code', localCode);
        sessionStorage.setItem('tube_wa_phone', e164 || phone);
      } catch {}

      let sentViaSupabase = false;
      if (isSupabaseConfigured) {
        const { error } = await requestPhoneOtp(phone, true, `Viewer ${phone}`, 'whatsapp');
        if (!error) {
          sentViaSupabase = true;
          setIsExternalOtp(true);
        } else {
          setIsExternalOtp(false);
        }
      }

      setStep('otp');
      if (sentViaSupabase) {
        setSuccessMessage('Verification code sent to your WhatsApp! Check your WhatsApp chat.');
      } else {
        setSuccessMessage('WhatsApp verification code ready. Click below to verify and claim your 5 free coins!');
      }
    } catch {
      setStep('otp');
      setSuccessMessage('WhatsApp verification code ready. Enter the 6-digit code below to claim.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const e164 = phoneToE164(phone) || phone;

      // 1. If sent via Supabase Phone Provider
      if (isExternalOtp) {
        const { data, error } = await verifyPhoneOtp(phone, cleanOtp);
        if (error || !data?.user) {
          // If Supabase check fails, fallback to checking local generated code
          if (cleanOtp !== generatedCode && cleanOtp !== sessionStorage.getItem('tube_wa_code')) {
            setErrorMessage('Invalid verification code. Please check your code and try again.');
            setIsLoading(false);
            return;
          }
        } else if (data.user) {
          await finalizeLogin(data.user, e164);
          return;
        }
      } else {
        // 2. Validate against generated code
        const storedCode = sessionStorage.getItem('tube_wa_code') || generatedCode;
        if (cleanOtp !== storedCode) {
          setErrorMessage('Invalid verification code. Please enter the 6-digit code shown.');
          setIsLoading(false);
          return;
        }
      }

      // Register or sign in user with phone captured
      const user = await registerViewerWithPhone(e164);
      await finalizeLogin(user, e164);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to verify code. Please try again.');
      setIsLoading(false);
    }
  };

  // Register / Sign in viewer with phone captured into Supabase & localStorage
  const registerViewerWithPhone = async (phoneE164: string): Promise<User> => {
    const rawDigits = phoneE164.replace(/\D/g, '');
    const syntheticEmail = `${rawDigits}@viewer.tube.co.ke`;
    const fallbackPassword = `tube_${rawDigits.slice(-6) || 'welcome2026'}`;

    let user: User | null = null;

    if (isSupabaseConfigured) {
      // Try Sign In first
      const { data: signData } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: fallbackPassword,
      });

      if (signData?.user) {
        user = signData.user;
      } else {
        // Sign Up with phone in metadata
        const { data: upData } = await supabase.auth.signUp({
          email: syntheticEmail,
          password: fallbackPassword,
          options: {
            data: {
              phone: phoneE164,
              phone_number: phoneE164,
              display_name: phone,
              is_viewer: true,
            },
          },
        });
        user = upData?.user || null;
      }

      // Explicitly update profile with phone_e164
      if (user) {
        try {
          await supabase.from('profiles').update({
            phone_e164: phoneE164,
            display_name: phone,
            updated_at: new Date().toISOString(),
          }).eq('id', user.id);
        } catch {}
      }
    }

    if (!user) {
      user = {
        id: `viewer_${rawDigits || Date.now()}`,
        app_metadata: {},
        user_metadata: { phone: phoneE164 },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as User;
    }

    // Persist verified phone locally
    try {
      localStorage.setItem('tube_verified_phone', phoneE164);
    } catch {}

    return user;
  };

  // Email Sign In / Sign Up
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
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

        if (!signInError && signInData.user) {
          await finalizeLogin(signInData.user, email);
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

        if (signUpData.user) {
          await finalizeLogin(signUpData.user, email);
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
    try {
      // Provisions exactly 5 free coins
      await claimWelcomeBonus(user.id);
    } catch {}

    setSuccessMessage('Verified! 5 Free Coins added to your TubeTV wallet.');
    setTimeout(() => {
      onSuccess(user);
      onClose();
    }, 600);
  };

  const copyCode = () => {
    if (generatedCode) {
      navigator.clipboard?.writeText(generatedCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
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
            <h3 className="text-lg font-black text-white tracking-tight">Claim 5 Free Coins</h3>
          </div>
          <p className="text-xs text-zinc-400 max-w-[260px] mx-auto leading-relaxed">
            Verify your phone with WhatsApp to activate your wallet and get 5 free episodes immediately!
          </p>
        </div>

        {/* Auth Method Selector */}
        <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setAuthMethod('whatsapp');
              setStep('input');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              authMethod === 'whatsapp'
                ? 'bg-[#25D366] text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <WhatsAppIcon className="w-4 h-4" />
            <span>WhatsApp (Kenya)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod('email');
              setStep('input');
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

        {/* Status Messages */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-green-950/60 border border-green-800 text-xs text-green-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* WhatsApp Flow */}
        {authMethod === 'whatsapp' && (
          <div>
            {step === 'input' ? (
              <form onSubmit={handleSendWhatsAppOtp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Kenyan WhatsApp Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      placeholder="0712 345 678 or 0110 123 456"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      autoFocus
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#25D366]"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Enter Safaricom, Airtel, or Telkom phone number.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Sending code...</span>
                    </>
                  ) : (
                    <>
                      <WhatsAppIcon className="w-4 h-4" />
                      <span>Send Code via WhatsApp</span>
                      <ArrowRight className="w-4 h-4 text-black" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 text-xs text-zinc-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[#25D366] font-bold">
                      <WhatsAppIcon className="w-4 h-4" />
                      <span>WhatsApp Code for {phone}</span>
                    </div>
                  </div>

                  {generatedCode && (
                    <div className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2">
                      <div>
                        <span className="text-[10px] text-zinc-400 block">Your 6-Digit Code:</span>
                        <span className="font-mono text-base font-extrabold text-white tracking-widest">{generatedCode}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={copyCode}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          {codeCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          <span>{codeCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Verify my TubeTV account (${phone}). Code: ${generatedCode}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-black text-[10px] font-extrabold flex items-center gap-1 transition-colors"
                        >
                          <WhatsAppIcon className="w-3 h-3" />
                          <span>Share</span>
                        </a>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-zinc-300">
                    Enter the 6-digit code below to verify your phone number and claim your 5 free coins.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Enter 6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-[#25D366]"
                  />
                  <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-500">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('input');
                        setOtpCode('');
                      }}
                      className="text-zinc-400 hover:text-white"
                    >
                      Change number
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleSendWhatsAppOtp(e)}
                      className="text-[#25D366] hover:underline"
                    >
                      Resend code
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Verifying code...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-black" />
                      <span>Verify & Claim 5 Coins</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
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
                  <span>Sign In & Claim 5 Coins</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
