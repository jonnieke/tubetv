import React, { useEffect, useState } from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { trackEvent } from '../lib/analytics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

export function canInstallPWA(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
  return !isStandalone && Boolean(globalDeferredPrompt);
}

export async function triggerPwaPrompt(): Promise<boolean> {
  if (!globalDeferredPrompt) return false;
  try {
    await globalDeferredPrompt.prompt();
    const choice = await globalDeferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      trackEvent('pwa_installed', { trigger: 'manual' });
      globalDeferredPrompt = null;
      return true;
    }
  } catch (err) {
    console.warn('PWA prompt error:', err);
  }
  return false;
}

export default function PWAInstallBanner() {
  const { language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

    setIsStandalone(standaloneMode);
    if (standaloneMode) return;

    // Check iOS Safari
    const userAgent = window.navigator.userAgent || '';
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(userAgent) &&
      !Boolean((window as unknown as { MSStream?: unknown }).MSStream);
    const isSafari =
      /Safari/.test(userAgent) &&
      !/Chrome|CriOS|FxiOS|EdgiOS/.test(userAgent);

    setIsIOS(isIOSDevice && isSafari);

    // Check dismiss cooldown
    try {
      const dismissedUntil = Number(localStorage.getItem('tubetv_pwa_dismissed_until') || 0);
      if (Date.now() < dismissedUntil) {
        setDismissed(true);
        return;
      }
      setDismissed(false);
    } catch {
      setDismissed(false);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      globalDeferredPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      setDismissed(false);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      trackEvent('pwa_installed', { trigger: 'automatic' });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShowIOSInstructions(false);
    try {
      // Dismiss for 7 days
      localStorage.setItem('tubetv_pwa_dismissed_until', String(Date.now() + 7 * 86_400_000));
    } catch {
      // Ignore storage error
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        trackEvent('pwa_installed', { trigger: 'banner' });
        setDismissed(true);
      }
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  if (isStandalone || dismissed) return null;

  // Only show if we either have a deferred prompt (Android/Desktop) or on iOS Safari
  if (!deferredPrompt && !isIOS) return null;

  return (
    <aside
      aria-label="Install TubeTV Application"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-zinc-950/95 p-4 shadow-2xl shadow-black/90 backdrop-blur-xl">
        {/* Glow ambient accent */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-red-600/30 to-amber-500/20 blur-2xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 text-white shadow-lg shadow-red-950/70 border border-amber-300/30">
              <span className="font-extrabold text-base tracking-tight">Tube</span>
              <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-400 p-0.5 text-zinc-950 shadow">
                <Smartphone size={10} />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-black text-sm text-white tracking-wide">
                  {language === 'sw' ? 'App ya TubeTV' : 'TubeTV App'}
                </h4>
                <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.2 text-[9px] font-black text-emerald-300 uppercase tracking-wider">
                  0 MB
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5 leading-snug">
                {language === 'sw'
                  ? 'Fungua skrini nzima na uangalie kwa haraka bila Play Store.'
                  : 'Full-screen player & instant access on your home screen.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close install prompt"
            className="shrink-0 rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {showIOSInstructions && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">
            <p className="font-bold flex items-center gap-1.5">
              <Share2 size={13} className="text-amber-400" />
              {language === 'sw' ? 'Jinsi ya kusakinisha kwenye iPhone:' : 'How to install on iPhone:'}
            </p>
            <ol className="mt-1.5 list-decimal list-inside space-y-1 text-zinc-300">
              <li>{language === 'sw' ? 'Bonyeza kitufe cha Share (chini ya Safari)' : 'Tap the Share button at the bottom of Safari'}</li>
              <li>{language === 'sw' ? 'Chagua "Add to Home Screen"' : 'Select "Add to Home Screen"'}</li>
            </ol>
          </div>
        )}

        <div className="mt-3.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            {language === 'sw' ? 'Baadaye' : 'Not now'}
          </button>

          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-4 py-1.5 text-xs font-black text-white shadow-md shadow-red-950/60 hover:from-red-500 hover:to-amber-500 active:scale-95 transition-all"
          >
            <Download size={13} />
            {isIOS
              ? (language === 'sw' ? 'Jinsi ya Kusakinisha' : 'How to Install')
              : (language === 'sw' ? 'Sakinisha (Bure)' : 'Install (0 MB)')}
          </button>
        </div>
      </div>
    </aside>
  );
}
