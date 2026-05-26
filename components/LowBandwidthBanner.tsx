import React, { useState } from 'react';
import { Wifi, X, Zap } from 'lucide-react';
import { useResolvedQuality, applyQualityMode } from '../lib/networkQuality';

/**
 * Auto-shows when we detect a slow connection (2G / 3G / saveData flag).
 * Lets the user switch to Data Saver mode with one tap, or dismiss.
 */
const LowBandwidthBanner: React.FC = () => {
  const { mode, network } = useResolvedQuality();
  const [dismissed, setDismissed] = useState(false);

  const isSlow =
    network.saveData ||
    network.effectiveType === '2g' ||
    network.effectiveType === 'slow-2g' ||
    network.effectiveType === '3g';

  // Don't show if: already in 360p mode, dismissed, or connection is fine
  if (!isSlow || mode === '360p' || dismissed) return null;

  return (
    <div className="mx-4 md:mx-0 mb-4 flex items-center gap-3 bg-amber-950/60 border border-amber-600/30 rounded-xl px-4 py-3 backdrop-blur-sm">
      <Wifi size={16} className="text-amber-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-amber-300 text-xs font-bold">Slow connection detected</p>
        <p className="text-amber-400/70 text-[11px] mt-0.5">
          Switch to Data Saver for faster loading and lower data use.
        </p>
      </div>
      <button
        onClick={() => { applyQualityMode('360p'); setDismissed(true); }}
        className="flex-shrink-0 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black px-3 py-1.5 rounded-lg transition-colors"
      >
        <Zap size={11} />
        Data Saver
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-amber-600 hover:text-amber-400 transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default LowBandwidthBanner;
