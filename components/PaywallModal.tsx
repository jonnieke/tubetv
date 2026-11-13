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
  Laptop,
  LogOut,
  ChevronDown,
  ChevronUp,
  Globe,
  Clock,
} from 'lucide-react';
import { Video } from '../types';
import { isMicroDrama } from '../lib/series';
import {
  SUBSCRIPTION_PLANS,
  SubscriptionPlanCode,
  REGIONAL_PRICING,
  RegionCode,
  detectDefaultRegion,
  savePreferredRegion,
  saveRememberedPhone,
  startMpesaPayment,
  fetchPaymentStatus,
  restoreMpesaPass,
  startPaystackPayment,
  fetchPaystackStatus,
  restorePaystackPass,
  restorePassByPhone,
} from '../lib/subscriptions';
import { trackEvent } from '../lib/analytics';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface PaywallModalProps {
  video?: Video | null;
  onSuccess: () => void;
  onClose: () => void;
}

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email?: string;
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
  const { language, t } = useLanguage();
  const [mode, setMode] = useState<'buy' | 'restore'>('buy');
  const [regionCode, setRegionCode] = useState<RegionCode>(() => detectDefaultRegion());
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'mpesa'>('paystack');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanCode>('daily');
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem('tubetv_user_phone') || localStorage.getItem('tubetv_saved_phone') || '';
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
  const [autoRenewWithMpesa, setAutoRenewWithMpesa] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'prompt_sent' | 'restoring' | 'completed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [paystackAuthUrl, setPaystackAuthUrl] = useState('');
  const [paystackRef, setPaystackRef] = useState('');
  const [deviceConflict, setDeviceConflict] = useState(false);
  const [restoreExpiredInfo, setRestoreExpiredInfo] = useState<{ tier?: string; phone?: string } | null>(null);
  const [showAdvancedRef, setShowAdvancedRef] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMicro = Boolean(
    video && (isMicroDrama(video) || video.category === 'Micro Dramas' || video.seriesFormat === 'micro-drama')
  );
  const showTitle = video ? (video.seriesTitle || video.title) : 'TubeTV Unlimited Pass';
  const episodeNumber = video?.episode || 1;

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    saveRememberedPhone(val);
    try {
      localStorage.setItem('tubetv_user_phone', val);
    } catch {}
  };

  const handleRegionChange = (nextRegion: RegionCode) => {
    setRegionCode(nextRegion);
    savePreferredRegion(nextRegion);
    if (!REGIONAL_PRICING[nextRegion].supportsMpesaStk) {
      setPaymentMethod('paystack');
    }
    setErrorMessage('');
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    try {
      localStorage.setItem('tubetv_user_email', val);
    } catch {}
  };

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(({ data }) => {
        const userEmail = data?.user?.email;
        if (userEmail && !email) {
          setEmail(userEmail);
          try {
            localStorage.setItem('tubetv_user_email', userEmail);
          } catch {}
        }
      }).catch(() => {});
    }
  }, []);

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
      videoId: video?.id || 'pass_direct',
      category: video?.category || 'Pass',
      isMicroDrama: isMicro,
    });
    return () => {
      clearTimers();
    };
  }, [video?.id, video?.category, isMicro]);

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

  const validateGlobalPhone = (raw: string): string | null => {
    const ke = validateKenyanPhone(raw);
    if (ke) return ke;
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 9 && digits.length <= 15) {
      return `+${digits}`;
    }
    return null;
  };

  const activeRegion = REGIONAL_PRICING[regionCode] || REGIONAL_PRICING.KE;

  const handlePaystackCheckout = async () => {
    clearTimers();
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMessage(t('paywall.emailRequiredError'));
      setStatus('idle');
      setTimeout(() => {
        const input = document.getElementById('paystack-email');
        input?.focus();
      }, 50);
      return;
    }

    setStatus('sending');
    setPaystackAuthUrl('');

    trackEvent('paywall_initiated', {
      videoId: video?.id || 'pass_direct',
      category: video?.category || 'Pass',
      isMicroDrama: isMicro,
      plan: selectedPlan,
      channel: 'paystack',
    });

    try {
      const cleanPhone = phone.trim() ? validateGlobalPhone(phone) : null;
      if (cleanPhone) {
        saveRememberedPhone(cleanPhone);
        try { localStorage.setItem('tubetv_user_phone', cleanPhone); } catch {}
      }
      try { localStorage.setItem('tubetv_user_email', cleanEmail); } catch {}
      try {
        if (video?.id) {
          localStorage.setItem('tubetv_last_watched_video_id', video.id);
          sessionStorage.setItem('tubetv_paywall_target_video_id', video.id);
        }
      } catch {}
      const result = await startPaystackPayment(selectedPlan, {
        email: cleanEmail,
        phone: cleanPhone || undefined,
        regionCode,
        currency: activeRegion.currency,
        returnPath: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });

      if (!result?.reference || !result?.checkoutToken) {
        throw new Error('Unable to initialize Paystack checkout session.');
      }

      setPaystackRef(result.reference);
      if (result.authorizationUrl) {
        setPaystackAuthUrl(result.authorizationUrl);
      }

      // Check if Paystack Inline popup can be launched
      let inlineOpened = false;
      const publicKey = (result.publicKey || (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string) || '').trim();

      if (publicKey && typeof window !== 'undefined') {
        const loaded = await loadPaystackInline().catch(() => false);
        if (loaded && window.PaystackPop?.setup) {
          try {
            const handler = window.PaystackPop.setup({
              key: publicKey,
              email: cleanEmail,
              access_code: result.accessCode,
              callback: () => {
                // Polling below will verify and complete
              },
              onClose: () => {
                // Polling continues
              },
            });
            handler.openIframe();
            inlineOpened = true;
          } catch (popupErr) {
            console.warn('Paystack inline iframe failed, redirecting to hosted checkout', popupErr);
          }
        }
      }

      // If inline iframe is not available (e.g. no public key configured) or failed to open:
      // Immediately navigate to the secure Paystack checkout page where the credit card form is hosted!
      if (!inlineOpened && result.authorizationUrl) {
        try {
          if (video?.id) {
            localStorage.setItem('tubetv_last_watched_video_id', video.id);
            sessionStorage.setItem('tubetv_paywall_target_video_id', video.id);
          }
        } catch {}
        window.location.href = result.authorizationUrl;
        return;
      }

      setStatus('prompt_sent');

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
              videoId: video?.id || 'pass_direct',
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
              videoId: video?.id || 'pass_direct',
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
            videoId: video?.id || 'pass_direct',
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
        videoId: video?.id || 'pass_direct',
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
      if (video?.id) {
        localStorage.setItem('tubetv_last_watched_video_id', video.id);
        sessionStorage.setItem('tubetv_paywall_target_video_id', video.id);
      }
    } catch {}

    clearTimers();
    setErrorMessage('');
    setStatus('sending');

    const isAutoRenew = autoRenewWithMpesa && selectedPlan === 'monthly';
    trackEvent('paywall_initiated', {
      videoId: video?.id || 'pass_direct',
      category: video?.category || 'Pass',
      isMicroDrama: isMicro,
      plan: selectedPlan,
      channel: isAutoRenew ? 'mpesa_ratiba' : 'mpesa_stk',
    });

    try {
      const result = await startMpesaPayment(selectedPlan, cleanPhone, { autoRenew: isAutoRenew });
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
              videoId: video?.id || 'pass_direct',
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
              videoId: video?.id || 'pass_direct',
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
            videoId: video?.id || 'pass_direct',
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
        videoId: video?.id || 'pass_direct',
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

  const handleRestore = async (e?: React.FormEvent, forceSwitch = false) => {
    if (e) e.preventDefault();
    const cleanPhone = phone.trim();
    const cleanRef = receipt.trim().toUpperCase();

    if (!cleanPhone && !cleanRef) {
      setErrorMessage('Please enter your phone number to restore your pass.');
      return;
    }

    setErrorMessage('');
    setDeviceConflict(false);
    setRestoreExpiredInfo(null);
    setStatus('restoring');

    try {
      const result = await restorePassByPhone({
        phone: cleanPhone,
        forceSwitch,
        mpesaReceipt: cleanRef,
        reference: cleanRef,
      });

      if (result.conflict) {
        setStatus('idle');
        setDeviceConflict(true);
        return;
      }

      if (result.expired) {
        setStatus('idle');
        setRestoreExpiredInfo({
          tier: result.tier,
          phone: result.phone || cleanPhone,
        });
        return;
      }

      if (!result.success || !result.pass) {
        setStatus('error');
        setErrorMessage(result.message || 'No active pass matched that phone number.');
        return;
      }

      setStatus('completed');
      trackEvent('pass_restored', {
        videoId: video?.id || 'pass_direct',
        tier: result.pass.tier,
      });
      completeTimerRef.current = setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not restore pass. Please check your phone number.';
      setStatus('error');
      setErrorMessage(message);
    }
  };

  const handleExtendWatching = (tier?: string) => {
    const targetPhone = restoreExpiredInfo?.phone || phone;
    if (targetPhone) {
      handlePhoneChange(targetPhone);
    }
    if (tier === 'daily' || tier === 'weekly' || tier === 'monthly') {
      setSelectedPlan(tier);
    }
    setPaymentMethod('mpesa');
    setRestoreExpiredInfo(null);
    setDeviceConflict(false);
    setErrorMessage('');
    setMode('buy');
  };

  const isBusy = status === 'sending' || status === 'prompt_sent' || status === 'restoring';
  const activePlan = SUBSCRIPTION_PLANS[selectedPlan];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tubetv-paywall-title"
        className="relative w-full max-w-md my-auto max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('paywall.close')}
          className="absolute top-3.5 right-3.5 z-10 w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>

        {/* Header Banner */}
        <div
          className={`px-5 py-3.5 text-center shrink-0 ${
            isMicro
              ? 'bg-gradient-to-b from-purple-950/60 to-zinc-950'
              : 'bg-gradient-to-b from-amber-950/60 to-zinc-950'
          } border-b border-zinc-900`}
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner mb-2">
            {status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : isMicro ? (
              <Sparkles className="w-5 h-5 text-purple-400" />
            ) : (
              <Lock className="w-5 h-5 text-amber-400" />
            )}
          </div>

          <h2 id="tubetv-paywall-title" className="text-lg font-black text-white tracking-tight">
            {status === 'completed'
              ? t('paywall.passActivated')
              : isMicro
                ? t('paywall.cliffhangerLocked', { episode: episodeNumber })
                : t('paywall.premiumPass')}
          </h2>

          <p className="text-zinc-400 text-xs mt-1 max-w-xs mx-auto leading-relaxed">
            {status === 'completed'
              ? t('paywall.confirmedResume')
              : isMicro
                ? t('paywall.microPitch', { title: showTitle, episode: episodeNumber })
                : video
                  ? t('paywall.moviePitch', { title: showTitle })
                  : language === 'sw'
                    ? 'Pata pasi ya TubeTV kwa utazamaji usio na kikomo wa filamu, tamthilia fupi, na vipindi vyote vya Kenya.'
                    : 'Get unlimited access to all premium Kenyan movies, series, and cliffhangers across TubeTV.'}
          </p>
        </div>

        {status !== 'completed' && (
          <div className="flex-1 overflow-y-auto px-5 py-3.5 space-y-3 no-scrollbar">
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
              <form onSubmit={handlePay} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {t('paywall.choosePass')}
                    </label>
                    <div className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-0.5">
                      <Globe size={11} className="text-emerald-400 shrink-0" />
                      <select
                        aria-label="Region and currency"
                        disabled={isBusy}
                        value={regionCode}
                        onChange={(e) => handleRegionChange(e.target.value as RegionCode)}
                        className="bg-transparent text-[11px] font-semibold text-zinc-200 focus:outline-none cursor-pointer"
                      >
                        {(Object.keys(REGIONAL_PRICING) as RegionCode[]).map((code) => (
                          <option key={code} value={code} className="bg-zinc-900 text-white">
                            {REGIONAL_PRICING[code].flag} {REGIONAL_PRICING[code].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setSelectedPlan('daily')}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        selectedPlan === 'daily'
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="inline-block text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold mb-0.5">
                        24H
                      </span>
                      <div className="text-xs font-bold text-white leading-tight">{t('paywall.planDaily')}</div>
                      <div className="text-sm font-black text-white mt-0.5">
                        {regionCode === 'KE' ? `KSh ${SUBSCRIPTION_PLANS.daily.amountKes}` : activeRegion.prices.daily}
                      </div>
                      <div className="text-[9px] text-zinc-400 mt-0.5 leading-tight">{t('paywall.planDailySub')}</div>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setSelectedPlan('weekly')}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        selectedPlan === 'weekly'
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="inline-block text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold mb-0.5">
                        POPULAR
                      </span>
                      <div className="text-xs font-bold text-white leading-tight">{t('paywall.planWeekly')}</div>
                      <div className="text-sm font-black text-white mt-0.5">
                        {regionCode === 'KE' ? `KSh ${SUBSCRIPTION_PLANS.weekly.amountKes}` : activeRegion.prices.weekly}
                      </div>
                      <div className="text-[9px] text-zinc-400 mt-0.5 leading-tight">{t('paywall.planWeeklySub')}</div>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setSelectedPlan('monthly')}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        selectedPlan === 'monthly'
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="inline-block text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-bold mb-0.5">
                        30 DAYS
                      </span>
                      <div className="text-xs font-bold text-white leading-tight">{t('paywall.planMonthly')}</div>
                      <div className="text-sm font-black text-white mt-0.5">
                        {regionCode === 'KE' ? `KSh ${SUBSCRIPTION_PLANS.monthly.amountKes}` : activeRegion.prices.monthly}
                      </div>
                      <div className="text-[9px] text-zinc-400 mt-0.5 leading-tight">{t('paywall.planMonthlySub')}</div>
                    </button>
                  </div>
                  {regionCode !== 'KE' && (
                    <p className="mt-1 text-[10px] text-zinc-400">
                      {activeRegion.flag} {activeRegion.paymentMethodsLabel} · Settled at KSh {activePlan.amountKes} equivalent via Paystack.
                    </p>
                  )}
                </div>

                {/* Payment Channel Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {t('paywall.paymentMethodLabel')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setPaymentMethod('paystack');
                        setErrorMessage('');
                        setTimeout(() => {
                          const input = document.getElementById('paystack-email');
                          input?.focus();
                        }, 50);
                      }}
                      className={`p-2 rounded-xl border text-left flex items-start gap-2 transition-all cursor-pointer ${
                        paymentMethod === 'paystack'
                          ? 'bg-blue-950/40 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                          <span>{t('paywall.methodPaystack')}</span>
                          {paymentMethod === 'paystack' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">{activeRegion.paymentMethodsLabel}</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setPaymentMethod('mpesa');
                        setErrorMessage('');
                        setTimeout(() => {
                          const input = document.getElementById('mpesa-buy-phone');
                          input?.focus();
                        }, 50);
                      }}
                      className={`p-2 rounded-xl border text-left flex items-start gap-2 transition-all cursor-pointer ${
                        paymentMethod === 'mpesa'
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                          <span>{t('paywall.methodMpesa')}</span>
                          {paymentMethod === 'mpesa' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">Instant Kenya STK</div>
                      </div>
                    </button>
                  </div>
                </div>

                {paymentMethod === 'paystack' ? (
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label htmlFor="paystack-email" className="block text-xs font-semibold text-zinc-200">
                          {t('paywall.emailLabel')} <span className="text-amber-400">*</span>
                        </label>
                        <span className="text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {t('paywall.emailRequiredForCard')}
                        </span>
                      </div>
                      <input
                        id="paystack-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        placeholder="yourname@gmail.com"
                        value={email}
                        onChange={(e) => {
                          handleEmailChange(e.target.value);
                          if (errorMessage) setErrorMessage('');
                        }}
                        disabled={isBusy}
                        className={`w-full bg-zinc-900 border rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors ${
                          errorMessage && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
                            ? 'border-red-500 focus:border-red-400 ring-1 ring-red-500/30'
                            : 'border-zinc-700 focus:border-blue-500'
                        }`}
                      />
                      <p className="mt-1 text-[10px] text-zinc-400 leading-tight">
                        {t('paywall.emailCardHint')}
                      </p>
                    </div>

                    <div className="rounded-xl border border-blue-500/25 bg-blue-950/20 p-2 space-y-1">
                      <p className="text-[11px] text-zinc-300 flex items-start gap-1.5 leading-snug">
                        <ShieldCheck size={14} className="text-blue-400 shrink-0 mt-0.5" />
                        <span>{t('paywall.paystackHint')}</span>
                      </p>
                      <div className="flex items-center gap-1.5 pt-0.5 text-[9px] font-bold text-zinc-400">
                        <span className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">VISA</span>
                        <span className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">Mastercard</span>
                        <span className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">Amex</span>
                        <span className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-200">Apple Pay</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="mpesa-buy-phone" className="block text-xs font-semibold text-zinc-300 mb-1">
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
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                      <span>{t('paywall.promptHint')}</span>
                    </p>

                    {selectedPlan === 'monthly' && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 transition-all">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={autoRenewWithMpesa}
                            onChange={(e) => setAutoRenewWithMpesa(e.target.checked)}
                            disabled={isBusy}
                            className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-zinc-900 border-zinc-700 cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{t('paywall.autoRenewLabel')}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                              {t('paywall.autoRenewHint')}
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {errorMessage && (
                  <div role="alert" className="p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 space-y-2">
                    <p>{errorMessage}</p>
                    {errorMessage.toLowerCase().includes('expired') && (
                      <button
                        type="button"
                        onClick={() => handleExtendWatching()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow cursor-pointer"
                      >
                        <Sparkles size={13} />
                        <span>{t('paywall.extendWatching')}</span>
                      </button>
                    )}
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
                  className={`w-full py-3 rounded-xl ${
                    paymentMethod === 'paystack'
                      ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/50'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                  } disabled:bg-zinc-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer`}
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{paymentMethod === 'paystack' ? 'Opening Card Payment Form...' : t('paywall.sendingPrompt')}</span>
                    </>
                  ) : status === 'prompt_sent' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{paymentMethod === 'paystack' ? 'Redirecting to Card Form...' : t('paywall.waitingConfirm')}</span>
                    </>
                  ) : paymentMethod === 'paystack' ? (
                    <>
                      <CreditCard size={16} />
                      <span>{language === 'sw' ? `Lipa KSh ${activePlan.amountKes} kwa Kadi (Visa / Mastercard)` : `Pay KSh ${activePlan.amountKes} with Card (Visa / Mastercard)`}</span>
                    </>
                  ) : autoRenewWithMpesa && selectedPlan === 'monthly' ? (
                    t('paywall.payButtonAutoRenew', { amount: activePlan.amountKes })
                  ) : (
                    t('paywall.payButton', { amount: activePlan.amountKes })
                  )}
                </button>
              </form>
            ) : deviceConflict ? (
              <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-5 text-center space-y-3 animate-in fade-in zoom-in-95">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                  <Laptop className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Pass Active on Another Screen</h4>
                  <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                    Your TubeTV pass for <strong className="text-white">{phone}</strong> is currently playing on another screen.
                    TubeTV enforces a <strong>1-device policy</strong>.
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleRestore(undefined, true)}
                    className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-950/40"
                  >
                    {status === 'restoring' ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Logging out other screen...</span>
                      </>
                    ) : (
                      <>
                        <LogOut size={15} />
                        <span>Log out other device & watch here</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceConflict(false)}
                    className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : restoreExpiredInfo ? (
              <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-5 text-center space-y-3.5 animate-in fade-in zoom-in-95">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{t('paywall.passExpiredTitle')}</h4>
                  <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                    {t('paywall.passExpiredBody', { phone: restoreExpiredInfo.phone || phone })}
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleExtendWatching(restoreExpiredInfo.tier)}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                  >
                    <Sparkles size={14} />
                    <span>{t('paywall.extendWatching')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestoreExpiredInfo(null)}
                    className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Try another phone number
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => handleRestore(e, false)} className="space-y-4">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Enter the phone number you used to subscribe. If active on another device, you can switch playback to this screen.
                </p>

                <div>
                  <label htmlFor="restore-phone" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-emerald-400">
                      <Smartphone size={16} />
                    </div>
                    <input
                      id="restore-phone"
                      type="tel"
                      required
                      placeholder="0712 345 678"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      disabled={isBusy}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedRef(!showAdvancedRef)}
                    className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
                  >
                    {showAdvancedRef ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    <span>Have an M-Pesa receipt code or Paystack ref? (Optional)</span>
                  </button>

                  {showAdvancedRef && (
                    <div className="mt-2 animate-in fade-in duration-200">
                      <input
                        id="restore-reference"
                        type="text"
                        maxLength={32}
                        placeholder="e.g. QKH89X2LMS or TUBE_..."
                        value={receipt}
                        onChange={(e) => setReceipt(e.target.value.toUpperCase())}
                        disabled={isBusy}
                        className="w-full bg-zinc-900/80 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs font-mono uppercase text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>

                {errorMessage && (
                  <div role="alert" className="p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 space-y-2">
                    <p>{errorMessage}</p>
                    {errorMessage.toLowerCase().includes('expired') && (
                      <button
                        type="button"
                        onClick={() => handleExtendWatching()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow cursor-pointer"
                      >
                        <Sparkles size={13} />
                        <span>{t('paywall.extendWatching')}</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBusy || !phone.trim()}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  {status === 'restoring' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Checking active pass...</span>
                    </>
                  ) : (
                    <span>Restore Pass on This Device</span>
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
