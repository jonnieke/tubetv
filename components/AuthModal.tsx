import React, { useState, useRef, useEffect } from 'react';
import { X, Phone, ArrowRight, ArrowLeft, CheckCircle2, Loader2, Eye, EyeOff, AlertCircle, GraduationCap, Sprout, Tv, Radio } from 'lucide-react';
import { signInWithPhone, signUpWithPhone, normalizePhone, isValidKenyanPhone } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

type AuthStep = 'phone' | 'pin_login' | 'pin_setup' | 'pin_confirm' | 'success';
type AuthMode = 'signin' | 'signup';

interface AuthModalProps {
  onSuccess: (user: User) => void;
  onCancel: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onCancel }) => {
  const [step, setStep] = useState<AuthStep>('phone');
  const [mode, setMode] = useState<AuthMode>('signin');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '']);
  const [displayName, setDisplayName] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === 'pin_login' || step === 'pin_setup') {
      setTimeout(() => pinRefs.current[0]?.focus(), 100);
    }
    if (step === 'pin_confirm') {
      setTimeout(() => confirmPinRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const pinValue = pin.join('');
  const confirmPinValue = confirmPin.join('');
  const normalizedPhone = normalizePhone(phone);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidKenyanPhone(phone)) {
      setError('Please enter a valid Kenyan number (e.g. 0712 345 678)');
      return;
    }
    // We go straight to PIN — no OTP, no SMS cost
    setStep(mode === 'signin' ? 'pin_login' : 'pin_setup');
  };

  const handlePinInput = (
    index: number,
    value: string,
    pinArr: string[],
    setPinArr: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newPin = [...pinArr];
    newPin[index] = digit;
    setPinArr(newPin);
    setError('');

    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    pinArr: string[],
    setPinArr: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace' && !pinArr[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleLoginSubmit = async (latestPin?: string) => {
    const finalPin = typeof latestPin === 'string' ? latestPin : pinValue;
    if (finalPin.length < 6) { setError('Enter your full 6-digit PIN'); return; }
    setIsLoading(true);
    setError('');

    const { data, error: authError } = await signInWithPhone(normalizedPhone, finalPin);
    setIsLoading(false);

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        setError('Wrong PIN or account not found. New here? Switch to Sign Up.');
      } else if (authError.message.toLowerCase().includes('email not confirmed')) {
        setError('Account not confirmed. Go to Supabase → Auth → Users, delete this user, then Sign Up again.');
      } else if (authError.status === 400) {
        setError('Sign-in failed. The account may not exist yet — try Sign Up instead.');
      } else {
        setError(authError.message);
      }
      setPin(['', '', '', '', '', '']);
      pinRefs.current[0]?.focus();
      return;
    }

    if (data?.user) {
      setStep('success');
      setTimeout(() => onSuccess(data.user!), 1200);
    }
  };

  const handleSetupPinNext = () => {
    if (pinValue.length < 6) { setError('Your PIN must be exactly 6 digits'); return; }
    const sequential = '012345678901234567890987654321098765432109';
    if (sequential.includes(pinValue) || new Set(pinValue.split('')).size === 1) {
      setError('PIN is too simple. Try a less predictable combination.');
      return;
    }
    setError('');
    setStep('pin_confirm');
  };

  const handleSignupSubmit = async (latestConfirm?: string | React.MouseEvent | void) => {
    const finalConfirm = typeof latestConfirm === 'string' ? latestConfirm : confirmPinValue;
    
    if (finalConfirm !== pinValue) {
      setError("PINs don't match. Please try again.");
      setConfirmPin(['', '', '', '', '', '']);
      confirmPinRefs.current[0]?.focus();
      return;
    }
    setIsLoading(true);
    setError('');

    const { data, error: authError } = await signUpWithPhone(normalizedPhone, pinValue, displayName || normalizedPhone);
    setIsLoading(false);

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already taken') || authError.status === 422) {
        setError('This number already has an account. Switch to Sign In and enter your PIN.');
        setStep('phone');
        setMode('signin');
      } else if (authError.message.toLowerCase().includes('password')) {
        setError('PIN rejected: must be 6 digits with no repeated numbers (e.g. 111111).');
      } else {
        setError(authError.message);
      }
      return;
    }

    if (data?.user) {
      setStep('success');
      setTimeout(() => onSuccess(data.user!), 1200);
    }
  };

  // --- RENDER HELPER: PIN DOT GRID ---
  const renderPinGrid = (
    pinArr: string[],
    setPinArr: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    label: string,
    onComplete?: (val: string) => void
  ) => (
    <div>
      <p className="text-zinc-400 text-sm mb-4 text-center">{label}</p>
      <div className="flex justify-center gap-3">
        {pinArr.map((digit, i) => (
          <div key={i} className="relative">
            <input
              ref={(el) => { refs.current[i] = el; }}
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => {
                const digit = e.target.value.replace(/\D/g, '').slice(-1);
                const newPin = [...pinArr];
                newPin[i] = digit;
                
                handlePinInput(i, e.target.value, pinArr, setPinArr, refs);
                
                // Auto-submit when last digit filled
                if (i === 5 && digit && onComplete) {
                  setTimeout(() => onComplete(newPin.join('')), 80);
                }
              }}
              onKeyDown={(e) => handlePinKeyDown(e, i, pinArr, setPinArr, refs)}
              className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-zinc-950 text-white
                focus:outline-none transition-all duration-200 caret-transparent
                ${digit
                  ? 'border-red-500 bg-red-500/5 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                  : 'border-zinc-700 focus:border-zinc-500'
                }`}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const PROMO_FEATURES = [
    { icon: Tv,            label: 'Drama & Comedy',  desc: 'Original Kenyan series' },
    { icon: GraduationCap, label: 'Education',        desc: 'CBC & KCSE content' },
    { icon: Sprout,        label: 'Farming Tips',     desc: 'Agribusiness guides' },
    { icon: Radio,         label: 'Live Streams',     desc: 'Sports, news & events' },
  ];

  const PROMO_SHOWS = [
    { initials: 'TL', label: 'The Landlord',       gradient: 'from-orange-900 to-zinc-900' },
    { initials: 'NC', label: 'Nairobi Chronicles', gradient: 'from-blue-900 to-zinc-900' },
    { initials: 'SS', label: 'Shamba Smart',       gradient: 'from-green-900 to-zinc-900' },
    { initials: 'KC', label: 'KCSE Champions',     gradient: 'from-purple-900 to-zinc-900' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200 p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-[800px] relative shadow-2xl overflow-hidden flex">

        {/* ── Left promo panel (desktop only) ── */}
        <div className="hidden md:flex flex-col justify-between w-[340px] flex-shrink-0 bg-gradient-to-b from-zinc-900 to-zinc-950 border-r border-zinc-800/60 p-8 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-40 rounded-full"
              style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.12) 0%, transparent 70%)' }} />
          </div>
          {/* Subtle dot grid */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }} />

          {/* Logo */}
          <div className="relative">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center font-black text-sm shadow-lg shadow-red-600/30">T</div>
              <span className="text-xl font-black tracking-tight">Tube<span className="text-red-500">TV</span></span>
            </div>
            <h3 className="text-2xl font-black text-white leading-tight mb-2">
              Stream Kenya,<br />
              <span style={{
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>Watch Everything.</span>
            </h3>
            <p className="text-zinc-500 text-sm mb-6">100% Kenyan content. Completely free.</p>

            {/* Features list */}
            <div className="space-y-3">
              {PROMO_FEATURES.map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-800/80 rounded-lg flex items-center justify-center flex-shrink-0 border border-zinc-700/50">
                    <f.icon size={14} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold">{f.label}</p>
                    <p className="text-zinc-600 text-[10px]">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Show thumbnails grid */}
          <div className="relative mt-6">
            <p className="text-zinc-700 text-[10px] uppercase tracking-wider mb-2.5">Now Streaming</p>
            <div className="grid grid-cols-2 gap-2">
              {PROMO_SHOWS.map(s => (
                <div key={s.initials} className={`relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br ${s.gradient} border border-white/[0.06] flex items-center justify-center`}>
                  <span className="text-white/[0.08] text-3xl font-black">{s.initials}</span>
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/80 to-transparent flex items-end px-1.5 pb-1">
                    <p className="text-white/70 text-[8px] font-bold truncate">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 relative">
          {/* Top accent bar */}
          <div className="h-0.5 w-full bg-gradient-to-r from-green-500/60 via-red-500 to-green-500/60" />

          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-zinc-600 hover:text-white transition-colors z-10 w-7 h-7 rounded-full bg-zinc-900/80 flex items-center justify-center border border-zinc-800"
          >
            <X size={15} />
          </button>

        <div className="p-8">

          {/* ─── STEP: PHONE ─── */}
          {step === 'phone' && (
            <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
              {/* Logo area */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-14 h-14 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-red-900/30">
                  <Phone className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-black text-white">
                  {mode === 'signin' ? 'Welcome back' : 'Create account'}
                </h2>
                <p className="text-zinc-500 text-sm mt-1 text-center">
                  {mode === 'signin'
                    ? 'Enter your phone number to continue'
                    : 'Sign up with your Kenyan number'}
                </p>
              </div>

              <form onSubmit={handlePhoneSubmit} className="space-y-5">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5 ml-1">Display Name (optional)</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Wanjiku"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 ml-1">Phone Number</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                      <span className="text-lg">🇰🇪</span>
                      <span className="text-zinc-500 text-sm font-medium">+254</span>
                      <div className="w-px h-4 bg-zinc-700" />
                    </div>
                    <input
                      ref={phoneRef}
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setError(''); }}
                      placeholder="0712 345 678"
                      className={`w-full bg-zinc-900 border rounded-xl pl-24 pr-4 py-3 text-white placeholder-zinc-600 focus:outline-none transition-colors
                        ${error ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-600'}`}
                    />
                  </div>
                  {error && (
                    <p className="text-red-400 text-xs mt-2 ml-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-[0.98] transform duration-100"
                >
                  Continue <ArrowRight size={18} />
                </button>
              </form>

              {/* Mode switcher */}
              <div className="mt-6 text-center">
                <p className="text-zinc-600 text-sm">
                  {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setPin(['','','','','','']); }}
                    className="text-red-400 hover:text-red-300 font-bold transition-colors"
                  >
                    {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ─── STEP: PIN LOGIN ─── */}
          {step === 'pin_login' && (
            <div className="animate-in slide-in-from-right-4 fade-in duration-300">
              <button
                onClick={() => { setStep('phone'); setPin(['','','','','','']); setError(''); }}
                className="flex items-center gap-1 text-zinc-500 hover:text-white text-sm mb-6 transition-colors"
              >
                <ArrowLeft size={16} /> {normalizedPhone}
              </button>

              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-black text-white">PIN</span>
                </div>
                <h2 className="text-xl font-bold text-white">Enter your PIN</h2>
                <p className="text-zinc-500 text-xs mt-1">Your 6-digit account PIN</p>
              </div>

              {renderPinGrid(pin, setPin, pinRefs, "", handleLoginSubmit)}

              {error && (
                <p className="text-red-400 text-xs mt-4 text-center flex items-center justify-center gap-1">
                  <AlertCircle size={12} /> {error}
                </p>
              )}

              <button
                onClick={() => handleLoginSubmit()}
                disabled={isLoading || pinValue.length < 6}
                className="w-full mt-6 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
              </button>

              <button
                onClick={() => setShowPin(!showPin)}
                className="w-full mt-3 text-zinc-500 hover:text-zinc-300 text-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPin ? 'Hide PIN' : 'Show PIN'}
              </button>
            </div>
          )}

          {/* ─── STEP: PIN SETUP ─── */}
          {step === 'pin_setup' && (
            <div className="animate-in slide-in-from-right-4 fade-in duration-300">
              <button
                onClick={() => { setStep('phone'); setPin(['','','','','','']); setError(''); }}
                className="flex items-center gap-1 text-zinc-500 hover:text-white text-sm mb-6 transition-colors"
              >
                <ArrowLeft size={16} /> Back
              </button>

              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-black text-white">PIN</span>
                </div>
                <h2 className="text-xl font-bold text-white">Create your PIN</h2>
                <p className="text-zinc-500 text-xs mt-1">You'll use this to sign in — like your M-Pesa PIN</p>
              </div>

              {renderPinGrid(pin, setPin, pinRefs, "")}

              {error && (
                <p className="text-red-400 text-xs mt-4 text-center flex items-center justify-center gap-1">
                  <AlertCircle size={12} /> {error}
                </p>
              )}

              <button
                onClick={handleSetupPinNext}
                disabled={pinValue.length < 6}
                className="w-full mt-6 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Next <ArrowRight size={18} />
              </button>

              <button
                onClick={() => setShowPin(!showPin)}
                className="w-full mt-3 text-zinc-500 hover:text-zinc-300 text-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPin ? 'Hide PIN' : 'Show PIN'}
              </button>
            </div>
          )}

          {/* ─── STEP: CONFIRM PIN ─── */}
          {step === 'pin_confirm' && (
            <div className="animate-in slide-in-from-right-4 fade-in duration-300">
              <button
                onClick={() => { setStep('pin_setup'); setConfirmPin(['','','','','','']); setError(''); }}
                className="flex items-center gap-1 text-zinc-500 hover:text-white text-sm mb-6 transition-colors"
              >
                <ArrowLeft size={16} /> Back
              </button>

              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-black text-white">✓</span>
                </div>
                <h2 className="text-xl font-bold text-white">Confirm your PIN</h2>
                <p className="text-zinc-500 text-xs mt-1">Enter it again to confirm</p>
              </div>

              {renderPinGrid(confirmPin, setConfirmPin, confirmPinRefs, "", handleSignupSubmit)}

              {error && (
                <p className="text-red-400 text-xs mt-4 text-center flex items-center justify-center gap-1">
                  <AlertCircle size={12} /> {error}
                </p>
              )}

              <button
                onClick={handleSignupSubmit}
                disabled={isLoading || confirmPinValue.length < 6}
                className="w-full mt-6 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 size={18} className="animate-spin" /> Creating account...</>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          )}

          {/* ─── STEP: SUCCESS ─── */}
          {step === 'success' && (
            <div className="animate-in zoom-in fade-in duration-500 text-center py-6">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {mode === 'signup' ? 'Welcome!' : 'Welcome back!'}
              </h2>
              <p className="text-zinc-400 text-sm">Signed in as {normalizedPhone}</p>
            </div>
          )}

          {/* Security note at base */}
          {step !== 'success' && (
            <p className="text-zinc-700 text-[11px] text-center mt-6">
              🔒 No SMS charges · Secure PIN · Kenyan-built
            </p>
          )}
        </div>
        </div>{/* end right form panel */}
      </div>
    </div>
  );
};

export default AuthModal;
