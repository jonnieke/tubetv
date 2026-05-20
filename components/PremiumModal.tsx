
import React, { useState, useEffect } from 'react';
import { Crown, X, Phone, CheckCircle, Loader2, Zap, Wifi, Shield, Star } from 'lucide-react';
import { activatePremium } from '../lib/premium';

interface Props {
  userPhone?: string | null;
  onClose: () => void;
}

type Step = 'plans' | 'phone' | 'stk' | 'success';

const PLANS = [
  {
    id: 'trial',
    label: '3-Day Trial',
    price: 'KES 0',
    originalPrice: '',
    months: 3 / 30,
    badge: 'FREE TRIAL',
    badgeColor: 'bg-emerald-600',
    features: ['All premium content', 'No ads', '3 days only'],
    highlight: false,
  },
  {
    id: 'monthly',
    label: 'Monthly',
    price: 'KES 99',
    perLabel: '/month',
    originalPrice: '',
    months: 1,
    badge: '',
    badgeColor: '',
    features: ['All content', 'No ads', 'HD quality', 'Cancel anytime'],
    highlight: false,
  },
  {
    id: 'yearly',
    label: 'Annual',
    price: 'KES 999',
    perLabel: '/year',
    originalPrice: 'KES 1,188',
    months: 12,
    badge: 'SAVE 16%',
    badgeColor: 'bg-amber-600',
    features: ['All content', 'No ads', 'HD quality', '2 months free'],
    highlight: true,
  },
] as const;

type Plan = typeof PLANS[number];

const PremiumModal: React.FC<Props> = ({ userPhone, onClose }) => {
  const [step, setStep]                   = useState<Step>('plans');
  const [selectedPlan, setSelectedPlan]   = useState<Plan>(PLANS[1]);
  const [phone, setPhone]                 = useState(userPhone?.replace(/^\+?254/, '') || '');
  const [countdown, setCountdown]         = useState(5);
  const [phoneError, setPhoneError]       = useState('');

  // STK push countdown → auto-advance to success
  useEffect(() => {
    if (step !== 'stk') return;
    setCountdown(5);
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(tick);
          setTimeout(() => setStep('success'), 400);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [step]);

  const handlePhoneSubmit = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      setPhoneError('Enter a valid Kenyan phone number (e.g. 0712 345 678)');
      return;
    }
    setPhoneError('');
    setStep('stk');
  };

  const handleSuccess = () => {
    activatePremium(selectedPlan.months);
    onClose();
  };

  const CIRCUMFERENCE = 2 * Math.PI * 34;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-amber-950 to-zinc-900 px-6 pt-6 pb-5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.2),transparent_60%)]" />
          <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors z-10">
            <X size={18} />
          </button>
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 bg-amber-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Crown size={22} className="text-amber-400" />
            </div>
            <div>
              <p className="text-white font-black leading-tight">Ndovu Premium</p>
              <p className="text-amber-400/70 text-xs">Kenya's best streaming experience</p>
            </div>
          </div>
        </div>

        <div className="p-5">

          {/* ──── STEP: Plan selection ──── */}
          {step === 'plans' && (
            <>
              <div className="space-y-2 mb-5">
                {PLANS.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full rounded-2xl p-3.5 border text-left transition-all ${
                      selectedPlan.id === plan.id
                        ? 'border-amber-500 bg-amber-950/30'
                        : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-600'
                    } ${plan.highlight ? 'ring-1 ring-amber-500/20' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${
                        selectedPlan.id === plan.id ? 'border-amber-500 bg-amber-500' : 'border-zinc-600'
                      }`}>
                        {selectedPlan.id === plan.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-white font-black text-sm">{plan.label}</span>
                          {plan.badge && (
                            <span className={`text-[9px] font-black text-white px-1.5 py-0.5 rounded-full ${plan.badgeColor}`}>
                              {plan.badge}
                            </span>
                          )}
                          {plan.highlight && (
                            <span className="text-[9px] font-black text-amber-400 border border-amber-500/40 px-1.5 py-0.5 rounded-full">
                              POPULAR
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1.5 mb-1.5">
                          <span className="text-white font-black text-lg">{plan.price}</span>
                          {'perLabel' in plan && plan.perLabel && (
                            <span className="text-zinc-500 text-xs">{plan.perLabel}</span>
                          )}
                          {plan.originalPrice && (
                            <span className="text-zinc-600 text-xs line-through">{plan.originalPrice}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
                          {plan.features.map(f => (
                            <span key={f} className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                              <CheckCircle size={8} className="text-amber-500 flex-shrink-0" /> {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* M-Pesa divider */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Pay with</span>
                <span className="text-sm font-black" style={{ color: '#4caf50' }}>M-PESA</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <button
                onClick={() => setStep('phone')}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 active:scale-[0.98]"
              >
                <Zap size={15} /> Continue with {selectedPlan.label}
              </button>
            </>
          )}

          {/* ──── STEP: Phone entry ──── */}
          {step === 'phone' && (
            <>
              <div className="mb-4">
                <p className="text-white font-black text-sm">{selectedPlan.label} · {selectedPlan.price}</p>
                <p className="text-zinc-500 text-xs mt-0.5">Enter your M-Pesa number to receive the payment prompt</p>
              </div>

              <div className="mb-1">
                <div className={`flex items-center gap-2 bg-zinc-800 border rounded-xl px-3 py-3 transition-colors ${
                  phoneError ? 'border-red-500' : 'border-zinc-700 focus-within:border-amber-500'
                }`}>
                  <Phone size={15} className="text-zinc-500 flex-shrink-0" />
                  <span className="text-zinc-400 text-sm font-mono select-none">+254</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value.replace(/[^0-9]/g, '')); setPhoneError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handlePhoneSubmit()}
                    placeholder="712 345 678"
                    autoFocus
                    maxLength={9}
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600 font-mono"
                    inputMode="numeric"
                  />
                </div>
                {phoneError && <p className="text-red-400 text-[11px] mt-1.5 ml-1">{phoneError}</p>}
              </div>

              <div className="flex items-start gap-2 my-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3">
                <Shield size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  You'll receive an M-Pesa prompt. Enter your PIN on your phone to confirm the payment.
                  {' '}<span className="text-zinc-600">Safaricom M-Pesa only. No card needed.</span>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep('plans')}
                  className="flex-[0_0_auto] w-20 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm rounded-2xl transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handlePhoneSubmit}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-sm rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Phone size={14} /> Send STK Push
                </button>
              </div>
            </>
          )}

          {/* ──── STEP: STK countdown ──── */}
          {step === 'stk' && (
            <div className="py-4 text-center">
              {/* Circular countdown */}
              <div className="relative w-24 h-24 mx-auto mb-5">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#27272a" strokeWidth="5" />
                  <circle
                    cx="40" cy="40" r="34" fill="none" stroke="#f59e0b" strokeWidth="5"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - countdown / 5)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.95s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-black text-3xl tabular-nums">{countdown}</span>
                </div>
              </div>

              <p className="text-white font-black text-base mb-1.5">Check your phone!</p>
              <p className="text-zinc-400 text-sm mb-1">
                M-Pesa prompt sent to{' '}
                <span className="text-white font-bold">+254{phone}</span>
              </p>
              <p className="text-zinc-600 text-xs mb-5">Enter your M-Pesa PIN to confirm {selectedPlan.price}</p>

              <div className="flex items-center justify-center gap-2 text-zinc-500">
                <Loader2 size={13} className="text-amber-400 animate-spin" />
                <span className="text-xs">Waiting for confirmation…</span>
              </div>
            </div>
          )}

          {/* ──── STEP: Success ──── */}
          {step === 'success' && (
            <div className="py-2 text-center">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in-50 duration-500">
                <CheckCircle size={30} className="text-emerald-400" />
              </div>
              <p className="text-white font-black text-xl mb-1">Asante! 🎉</p>
              <p className="text-zinc-300 text-sm mb-1">
                Welcome to <span className="text-amber-400 font-black">Ndovu Premium</span>
              </p>
              <p className="text-zinc-500 text-xs mb-5">
                {selectedPlan.months >= 12
                  ? 'Your annual plan is active — 12 months of unlimited streaming!'
                  : selectedPlan.months < 0.5
                  ? '3-day free trial is active. Enjoy ad-free premium streaming!'
                  : 'Monthly plan active. Enjoy unlimited streaming!'}
              </p>

              {/* Benefits badges */}
              <div className="flex gap-2 mb-5">
                {[
                  { icon: <Star size={12} className="text-amber-400" />, label: 'All Content' },
                  { icon: <Wifi size={12} className="text-blue-400" />, label: 'HD Quality' },
                  { icon: <Shield size={12} className="text-emerald-400" />, label: 'No Ads' },
                ].map(b => (
                  <div key={b.label} className="flex-1 bg-zinc-800 rounded-xl p-2.5 flex flex-col items-center gap-1.5">
                    {b.icon}
                    <span className="text-[9px] text-zinc-400 font-bold">{b.label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSuccess}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Zap size={14} /> Start Watching
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiumModal;
