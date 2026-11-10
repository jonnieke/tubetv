import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  Loader2,
  Sparkles,
  ShieldCheck,
  Lock,
  KeyRound,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import { Video } from '../types';
import { isMicroDrama } from '../lib/series';
import {
  SUBSCRIPTION_PLANS,
  SubscriptionPlanCode,
  startMpesaPayment,
  fetchPaymentStatus,
  restoreMpesaPass,
  startPaystackPayment,
  fetchPaystackStatus,
  restorePaystackPass,
} from '../lib/subscriptions';
import { trackEvent } from '../lib/analytics';
import { useLanguage } from '../contexts/LanguageContext';

interface PaywallModalProps {
  video: Video;
  onSuccess: () => void;
  onClose: () => void;
}

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        access_code: string;
        callback?: (response: { reference: string }) => void;
        onClose?: () => void;
      }) => { openIframe: () => void };
    };
  }
}

function loadPaystackInline(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.PaystackPop && typeof window.PaystackPop.setup === 'function') {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const existing = document.getElementById('paystack-inline-js');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'paystack-inline-js';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ video, onSuccess, onClose }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'buy' | 'restore'>('buy');
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'mpesa'>('paystack');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanCode>('daily');
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem('tubetv_user_phone') || '';
    } catch {
      return '';
    }
  });
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('tubetv_user_email') || '';
    } catch {
      return '';
    }
  });
  const [receipt, setReceipt] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'prompt_sent' | 'restoring' | 'completed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [paystackAuthUrl, setPaystackAuthUrl] = useState('');
  const [paystackRef, setPaystackRef] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMicro = isMicroDrama(video) || video.category === 'Micro Dramas' || video.seriesFormat === 'micro-drama';
  const showTitle = video.seriesTitle || video.title;
  const episodeNumber = video.episode || 3;

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    try {
      localStorage.setItem('tubetv_user_phone', val);
    } catch {}
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    try {
      localStorage.setItem('tubetv_user_email', val);
    } catch {}
  };

  const clearTimers = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
  };

  useEffect(() => {
    trackEvent('paywall_view', {
      videoId: video.id,
      category: video.category,
      isMicroDrama: isMicro,
    });
    return () => {
      clearTimers();
    };
  }, [video.id, video.category, isMicro]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const firstInput = dialog?.querySelector<HTMLElement>('input, button:not([aria-label="Close paywall"])');
    firstInput?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab' && dialog) {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose, mode]);

  const validateKenyanPhone = (raw: string): string | null => {
    const cleanPhone = raw.replace(/[\s()-]/g, '');
    if (!/^(?:254|\+254|0)?([17]\d{8})$/.test(cleanPhone)) {
      return null;
    }
    return cleanPhone;
  };

  const handlePaystackCheckout = async () => {
    clearTimers();
    setErrorMessage('');
    setStatus('sending');
    setPaystackAuthUrl('');

    trackEvent('paywall_initiated', {
      videoId: video.id,
      category: video.category,
      isMicroDrama: isMicro,
      plan: selectedPlan,
      channel: 'paystack',
    });

    try {
      const cleanPhone = phone.trim() ? validateKenyanPhone(phone) : null;
      const cleanEmail = email.trim();
      if (cleanPhone) {
        try { localStorage.setItem('tubetv_user_phone', cleanPhone); } catch {}
      }
      if (cleanEmail) {
        try { localStorage.setItem('tubetv_user_email', cleanEmail); } catch {}
      }
      try {
        localStorage.setItem('tubetv_last_watched_video_id', video.id);
        sessionStorage.setItem('tubetv_paywall_target_video_id', video.id);
      } catch {}
      const result = await startPaystackPayment(selectedPlan, {
        email: cleanEmail || undefined,
        phone: cleanPhone || undefined,
      });

      if (!result?.reference || !result?.checkoutToken) {
        throw new Error('Unable to initialize Paystack checkout session.');
      }

      setPaystackRef(result.reference);
      if (result.authorizationUrl) {
        setPaystackAuthUrl(result.authorizationUrl);
      }
      setStatus('prompt_sent');

      // Attempt to launch Paystack Inline iframe
      void loadPaystackInline().then((loaded) => {
        if (loaded && window.PaystackPop?.setup) {
          try {
            const handler = window.PaystackPop.setup({
              key: result.publicKey || (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string) || '',
              access_code: result.accessCode,
              callback: () => {
                // Verified instantly through polling
              },
              onClose: () => {
                // Polling continues if user finished in external tab or mobile app
              },
            });
            handler.openIframe();
          } catch {
            // If iframe fails to open, authorizationUrl button is displayed
          }
        }
      });

      // Poll status until verified
      let attempts = 0;
      const maxAttempts = 60; // 120 seconds total (2s intervals)
      pollIntervalRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const poll = await fetchPaystackStatus(result.reference, result.checkoutToken, result.id);
          const txStatus = poll.transaction.status;

          if (txStatus === 'succeeded' && poll.pass?.token) {
            clearTimers();
            setStatus('completed');
            trackEvent('paywall_completed', {
              videoId: video.id,
              plan: selectedPlan,
              channel: 'paystack',
            });
            completeTimerRef.current = setTimeout(() => {
              onSuccess();
            }, 900);
            return;
          }

          if (txStatus === 'failed') {
            clearTimers();
            setStatus('error');
            setErrorMessage(
              poll.transaction.result_description || 'Payment was declined or cancelled. You were not charged.',
            );
            trackEvent('paywall_failed', {
              videoId: video.id,
              plan: selectedPlan,
              channel: 'paystack',
              reason: 'declined',
            });
            return;
          }
        } catch {
          // Keep polling during transient network errors
        }

        if (attempts >= maxAttempts) {
          clearTimers();
          setStatus('error');
          setErrorMessage(
            'Payment verification timed out. If you received a confirmation SMS or debit, click "Restore Pass" to activate immediately.',
          );
          trackEvent('paywall_failed', {
            videoId: video.id,
            plan: selectedPlan,
            channel: 'paystack',
            reason: 'poll_timeout',
          });
        }
      }, 2000);
    } catch (err: unknown) {
      clearTimers();
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not reach Paystack right now. Check your connection and try again.';
      setStatus('error');
      setErrorMessage(message);
      trackEvent('paywall_failed', {
        videoId: video.id,
        plan: selectedPlan,
        channel: 'paystack',
        reason: 'initiation_error',
      });
    }
  };

  const handleMpesaCheckout = async () => {
    const cleanPhone = validateKenyanPhone(phone);
    if (!cleanPhone) {
      setErrorMessage('Please enter a valid Kenyan Safaricom phone number (e.g. 0712 345 678 or 0112 345 678).');
      return;
    }

    try {
      localStorage.setItem('tubetv_user_phone', cleanPhone);
      localStorage.setItem('tubetv_last_watched_video_id', video.id);
      sessionStorage.setItem('tubetv_paywall_target_video_id', video.id);
    } catch {}

    clearTimers();
    setErrorMessage('');
    setStatus('sending');

    trackEvent('paywall_initiated', {
      videoId: video.id,
      category: video.category,
      isMicroDrama: isMicro,
      plan: selectedPlan,
      channel: 'mpesa_stk',
    });

    try {
      const result = await startMpesaPayment(selectedPlan, cleanPhone);
      if (!result?.id || !result?.checkoutToken) {
        throw new Error('Unable to initialize M-Pesa checkout session.');
      }

      setStatus('prompt_sent');
      if (result.authorizationUrl) {
        setPaystackAuthUrl(result.authorizationUrl);
      }
      if (result.reference) {
        setPaystackRef(result.reference);
      }

      let attempts = 0;
      const maxAttempts = 30; // 60 seconds total (2s intervals)
      pollIntervalRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const poll = await fetchPaymentStatus(result.id, result.checkoutToken);
          const txStatus = poll.transaction.status;

          if (txStatus === 'succeeded' && poll.pass?.token) {
            clearTimers();
            setStatus('completed');
            trackEvent('paywall_completed', {
              videoId: video.id,
              plan: selectedPlan,
              channel: 'mpesa_stk',
            });
            completeTimerRef.current = setTimeout(() => {
              onSuccess();
            }, 900);
            return;
          }

          if (txStatus === 'failed' || txStatus === 'cancelled') {
            clearTimers();
            setStatus('error');
            setErrorMessage(
              poll.transaction.result_description || 'M-Pesa payment was cancelled or declined. You were not charged.',
            );
            trackEvent('paywall_failed', {
              videoId: video.id,
              plan: selectedPlan,
              channel: 'mpesa_stk',
              reason: txStatus,
            });
            return;
          }
        } catch {
          // Transient network error while polling; keep waiting until maxAttempts
        }

        if (attempts >= maxAttempts) {
          clearTimers();
          setStatus('error');
          setErrorMessage(
            'Still waiting for M-Pesa confirmation. If you entered your PIN and received an M-Pesa SMS receipt, use "Restore Pass" above to activate immediately.',
          );
          trackEvent('paywall_failed', {
            videoId: video.id,
            plan: selectedPlan,
            channel: 'mpesa_stk',
            reason: 'poll_timeout',
          });
        }
      }, 2000);
    } catch (err: unknown) {
      clearTimers();
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not reach M-Pesa right now. Check your connection and try again.';
      setStatus('error');
      setErrorMessage(message);
      trackEvent('paywall_failed', {
        videoId: video.id,
        plan: selectedPlan,
        channel: 'mpesa_stk',
        reason: 'initiation_error',
      });
    }
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === 'paystack') {
      return handlePaystackCheckout();
    }
    return handleMpesaCheckout();
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRef = receipt.trim().toUpperCase();
    const cleanContact = phone.trim() || email.trim();

    if (!cleanRef || cleanRef.length < 6) {
      setErrorMessage('Please enter your Paystack reference (e.g. TUBE_...) or M-Pesa receipt code.');
      return;
    }

    setErrorMessage('');
    setStatus('restoring');

    try {
      let restored;
      if (cleanRef.startsWith('TUBE_') || cleanRef.length > 12) {
        restored = await restorePaystackPass(cleanRef, cleanContact);
      } else {
        try {
          restored = await restoreMpesaPass(cleanRef, cleanContact);
        } catch {
          restored = await restorePaystackPass(cleanRef, cleanContact);
        }
      }

      setStatus('completed');
      trackEvent('pass_restored', {
        videoId: video.id,
        tier: restored.tier,
      });
      completeTimerRef.current = setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not restore pass. Please check your reference and contact details.';
      setStatus('error');
      setErrorMessage(message);
    }
  };

  const isBusy = status === 'sending' || status === 'prompt_sent' || status === 'restoring';
  const activePlan = SUBSCRIPTION_PLANS[selectedPlan];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tubetv-paywall-title"
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('paywall.close')}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header Banner */}
        <div
          className={`p-6 text-center ${
            isMicro
              ? 'bg-gradient-to-b from-purple-950/60 to-zinc-950'
              : 'bg-gradient-to-b from-amber-950/60 to-zinc-950'
          } border-b border-zinc-900`}
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-inner mb-3">
            {status === 'completed' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            ) : isMicro ? (
              <Sparkles className="w-6 h-6 text-purple-400" />
            ) : (
              <Lock className="w-6 h-6 text-amber-400" />
            )}
          </div>

          <h2 id="tubetv-paywall-title" className="text-xl font-black text-white tracking-tight">
            {status === 'completed'
              ? t('paywall.passActivated')
              : isMicro
                ? t('paywall.cliffhangerLocked', { episode: episodeNumber })
                : t('paywall.premiumPass')}
          </h2>

          <p className="text-zinc-400 text-xs mt-1.5 max-w-xs mx-auto leading-relaxed">
            {status === 'completed'
              ? t('paywall.confirmedResume')
              : isMicro
                ? t('paywall.microPitch', { title: showTitle, episode: episodeNumber })
                : t('paywall.moviePitch', { title: showTitle })}
          </p>
        </div>

        {status !== 'completed' && (
          <div className="p-6 space-y-4">
            {/* Buy vs Restore Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'buy'}
                disabled={isBusy}
                onClick={() => {
                  setMode('buy');
                  setErrorMessage('');
                  if (status === 'error') setStatus('idle');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
                  mode === 'buy' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t('paywall.tabBuy')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'restore'}
                disabled={isBusy}
                onClick={() => {
                  setMode('restore');
                  setErrorMessage('');
                  if (status === 'error') setStatus('idle');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  mode === 'restore' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <KeyRound size={12} />
                {t('paywall.tabRestore')}
              </button>
            </div>

            {mode === 'buy' ? (
              <form onSubmit={handlePay} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    {t('paywall.choosePass')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setSelectedPlan('daily')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedPlan === 'daily'
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="inline-block text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold mb-1">
                        24H
                      </span>
                      <div className="text-xs font-bold text-white leading-tight">{t('paywall.planDaily')}</div>
                      <div className="text-base font-black text-white mt-0.5">
                        KSh {SUBSCRIPTION_PLANS.daily.amountKes}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{t('paywall.planDailySub')}</div>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setSelectedPlan('weekly')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedPlan === 'weekly'
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="inline-block text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold mb-1">
                        POPULAR
                      </span>
                      <div className="text-xs font-bold text-white leading-tight">{t('paywall.planWeekly')}</div>
                      <div className="text-base font-black text-white mt-0.5">
                        KSh {SUBSCRIPTION_PLANS.weekly.amountKes}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{t('paywall.planWeeklySub')}</div>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setSelectedPlan('monthly')}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedPlan === 'monthly'
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="inline-block text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-bold mb-1">
                        30 DAYS
                      </span>
                      <div className="text-xs font-bold text-white leading-tight">{t('paywall.planMonthly')}</div>
                      <div className="text-base font-black text-white mt-0.5">
                        KSh {SUBSCRIPTION_PLANS.monthly.amountKes}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{t('paywall.planMonthlySub')}</div>
                    </button>
                  </div>
                </div>

                {/* Payment Channel Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    {t('paywall.paymentMethodLabel')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setPaymentMethod('paystack');
                        setErrorMessage('');
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                        paymentMethod === 'paystack'
                          ? 'bg-blue-950/40 border-blue-500 text-white shadow-sm'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white leading-tight">{t('paywall.methodPaystack')}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">Card, Apple Pay, M-Pesa</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setPaymentMethod('mpesa');
                        setErrorMessage('');
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                        paymentMethod === 'mpesa'
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white leading-tight">{t('paywall.methodMpesa')}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">Instant STK Prompt</div>
                      </div>
                    </button>
                  </div>
                </div>

                {paymentMethod === 'paystack' ? (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="paystack-email" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        {t('paywall.emailLabel')}
                      </label>
                      <input
                        id="paystack-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="viewer@example.com"
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        disabled={isBusy}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label htmlFor="paystack-phone" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        {t('paywall.phoneLabel')} <span className="text-zinc-500 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-emerald-400">
                          <Smartphone size={16} />
                        </div>
                        <input
                          id="paystack-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="0712 345 678"
                          value={phone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          disabled={isBusy}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <ShieldCheck size={12} className="text-blue-400 shrink-0" />
                      <span>{t('paywall.paystackHint')}</span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="mpesa-buy-phone" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      {t('paywall.phoneLabel')}
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-emerald-400">
                        <Smartphone size={16} />
                      </div>
                      <input
                        id="mpesa-buy-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        placeholder="0712 345 678"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        disabled={isBusy}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1.5 flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                      <span>{t('paywall.promptHint')}</span>
                    </p>
                  </div>
                )}

                {errorMessage && (
                  <div role="alert" className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200">
                    {errorMessage}
                  </div>
                )}

                {status === 'prompt_sent' && (
                  <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-center space-y-2">
                    <p className="text-sm font-bold text-emerald-300">
                      {paymentMethod === 'paystack' ? t('paywall.openCheckout') : t('paywall.promptSentTitle')}
                    </p>
                    <p className="text-xs text-zinc-300">
                      {paymentMethod === 'paystack'
                        ? t('paywall.paystackHint')
                        : t('paywall.promptSentBody')}
                    </p>
                    {paystackAuthUrl && (
                      <div className="pt-2">
                        <a
                          href={paystackAuthUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ${
                            paymentMethod === 'mpesa'
                              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                              : 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/40'
                          } text-white text-xs font-bold transition-all shadow-md`}
                        >
                          <ExternalLink size={13} />
                          <span>{paymentMethod === 'mpesa' ? 'Open M-Pesa Checkout' : t('paywall.openCheckout')}</span>
                        </a>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <Loader2 size={16} className="animate-spin text-emerald-400" />
                      <span className="text-xs text-zinc-400">{t('paywall.waitingConfirm')}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className={`w-full py-3.5 rounded-xl ${
                    paymentMethod === 'paystack'
                      ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/50'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                  } disabled:bg-zinc-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg`}
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {paymentMethod === 'paystack' ? 'Opening Paystack...' : t('paywall.sendingPrompt')}
                    </>
                  ) : status === 'prompt_sent' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('paywall.waitingConfirm')}
                    </>
                  ) : paymentMethod === 'paystack' ? (
                    t('paywall.payButtonPaystack', { amount: activePlan.amountKes })
                  ) : (
                    t('paywall.payButton', { amount: activePlan.amountKes })
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRestore} className="space-y-4">
                <p className="text-xs text-zinc-400 leading-relaxed">{t('paywall.restoreHint')}</p>

                <div>
                  <label htmlFor="restore-reference" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    {t('paywall.restoreRefLabel')}
                  </label>
                  <input
                    id="restore-reference"
                    type="text"
                    required
                    maxLength={32}
                    placeholder="QKH89X2LMS or TUBE_..."
                    value={receipt}
                    onChange={(e) => setReceipt(e.target.value.toUpperCase())}
                    disabled={isBusy}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm font-mono uppercase text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="restore-contact" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    {t('paywall.restoreContactLabel')}
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-emerald-400">
                      <Smartphone size={16} />
                    </div>
                    <input
                      id="restore-contact"
                      type="text"
                      placeholder="0712 345 678 or viewer@example.com"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={isBusy}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div role="alert" className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/50"
                >
                  {status === 'restoring' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('paywall.restoring')}
                    </>
                  ) : (
                    t('paywall.restoreButton')
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaywallModal;
