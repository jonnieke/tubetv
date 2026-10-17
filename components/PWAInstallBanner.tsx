import React, { useState, useEffect } from 'react';
import {
  initPWA,
  isRunningStandalone,
  onInstallAvailabilityChange,
  promptPWAInstall,
} from '../lib/pwa';

export const PWAInstallBanner: React.FC = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    initPWA();

    // If running already installed standalone, don't show prompt
    if (isRunningStandalone()) {
      return;
    }

    // Check if dismissed in last 7 days
    const dismissedAt = localStorage.getItem('tubetv_pwa_dismissed_at');
    if (dismissedAt) {
      const daysSinceDismiss = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < 7) {
        return;
      }
    }

    setIsDismissed(false);

    const unsubscribe = onInstallAvailabilityChange((available) => {
      setCanInstall(available);
    });

    return unsubscribe;
  }, []);

  const handleInstallClick = async () => {
    const outcome = await promptPWAInstall();
    if (outcome === 'accepted') {
      setIsDismissed(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('tubetv_pwa_dismissed_at', Date.now().toString());
  };

  if (!canInstall || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-16 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-40 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-fade-in">
      <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center font-black text-white shrink-0 text-sm shadow-md shadow-red-600/30">
        TV
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-white tracking-tight">Install TubeTV App</h4>
        <p className="text-[11px] text-zinc-400 line-clamp-1">
          Save mobile data & stream microdramas faster
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-sm"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md text-zinc-500 hover:text-white transition"
          aria-label="Dismiss app install banner"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
