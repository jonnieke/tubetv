import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Check, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  isPushSupported,
  getPushPermissionState,
  subscribeToPushNotifications,
} from '../lib/pushNotifications';
import { trackEvent } from '../lib/analytics';

interface Props {
  seriesTitle?: string;
  onSubscribed?: () => void;
  inline?: boolean;
}

export default function PushNotificationPrompt({ seriesTitle, onSubscribed, inline }: Props) {
  const { language } = useLanguage();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    setSupported(true);
    const state = getPushPermissionState();
    setPermission(state);

    try {
      const isDismissed = localStorage.getItem('tubetv_push_prompt_dismissed');
      if (isDismissed) setDismissed(true);
    } catch {
      // Ignore storage error
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    const result = await subscribeToPushNotifications();
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setPermission('granted');
      trackEvent('push_notifications_enabled', { seriesTitle: seriesTitle || 'all' });
      onSubscribed?.();
      setTimeout(() => setDismissed(true), 3500);
    } else {
      setPermission(getPushPermissionState());
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('tubetv_push_prompt_dismissed', 'true');
    } catch {
      // Ignore storage error
    }
  };

  if (!supported || permission === 'granted' || permission === 'denied' || dismissed) {
    return null;
  }

  if (inline) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-xs">
        <div className="flex items-center gap-2 text-zinc-300">
          <Bell size={15} className="text-amber-400 shrink-0" />
          <span>
            {language === 'sw'
              ? `Pokea taarifa vipindi vipya vinapotoka${seriesTitle ? ` vya ${seriesTitle}` : ''}`
              : `Get alerts when new episodes${seriesTitle ? ` of ${seriesTitle}` : ''} drop`}
          </span>
        </div>
        <button
          type="button"
          onClick={handleEnable}
          disabled={loading}
          className="shrink-0 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1 text-xs transition-colors disabled:opacity-50"
        >
          {loading
            ? (language === 'sw' ? 'Inawasha...' : 'Enabling...')
            : success
            ? (language === 'sw' ? 'Imewashwa ✓' : 'Enabled ✓')
            : (language === 'sw' ? 'Washa' : 'Enable')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-red-950/80 via-zinc-900 to-amber-950/40 p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-red-600 text-white shadow-md shadow-red-950/50">
            {success ? <Check size={18} /> : <BellRing size={18} className="animate-bounce" />}
          </div>
          <div>
            <h4 className="font-bold text-sm text-white">
              {success
                ? (language === 'sw' ? 'Taarifa Zimewashwa!' : 'Alerts Enabled!')
                : (language === 'sw' ? 'Usiwahi Kukosa Kipindi Kipya' : 'Never Miss a New Episode')}
            </h4>
            <p className="text-xs text-zinc-300 mt-0.5 leading-snug">
              {success
                ? (language === 'sw' ? 'Utapokea ujumbe pindi kipindi kipya kikitolewa.' : "You'll be notified on your device when new stories drop.")
                : (language === 'sw'
                    ? `Washa taarifa za simu upokee ujumbe pindi kipindi kipya kinapotolewa.`
                    : `Get instant alerts when new micro-dramas and episodes are released.`)}
            </p>
          </div>
        </div>

        {!success && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss notifications prompt"
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {!success && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-semibold text-zinc-400 hover:text-white px-2 py-1"
          >
            {language === 'sw' ? 'Hapana' : 'Not now'}
          </button>
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold px-3.5 py-1.5 text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Bell size={12} />
            {loading
              ? (language === 'sw' ? 'Inawasha...' : 'Enabling...')
              : (language === 'sw' ? 'Washa Taarifa' : 'Enable Alerts')}
          </button>
        </div>
      )}
    </div>
  );
}
