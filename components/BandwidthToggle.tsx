import React, { useState, useEffect } from 'react';
import { Wifi, Signal, ZapOff, Zap, Gauge } from 'lucide-react';
import {
  QualityMode,
  getStoredQualityMode,
  applyQualityMode,
  useNetworkStatus,
  resolveQuality,
} from '../lib/networkQuality';

// ─── Option config ─────────────────────────────────────────────────────────────

const OPTIONS: { value: QualityMode; label: string; desc: string }[] = [
  { value: '360p', label: '360p', desc: 'Save data' },
  { value: 'auto', label: 'Auto', desc: 'Smart'     },
  { value: 'hd',   label: 'HD',   desc: 'Best'      },
];

// ─── Component ────────────────────────────────────────────────────────────────

const BandwidthToggle: React.FC = () => {
  const [mode, setMode] = useState<QualityMode>(getStoredQualityMode);
  const [showTooltip, setShowTooltip] = useState(false);
  const network = useNetworkStatus();

  // Keep local state in sync when another component calls applyQualityMode
  useEffect(() => {
    const handler = (e: Event) => setMode((e as CustomEvent<QualityMode>).detail);
    window.addEventListener('tube-quality-change', handler);
    return () => window.removeEventListener('tube-quality-change', handler);
  }, []);

  const handleChange = (m: QualityMode) => {
    setMode(m);
    applyQualityMode(m);
  };

  // Derived display values
  const resolved = resolveQuality(mode, network);
  const isWifi = network.type === 'wifi';
  const isCellular = network.type === 'cellular';

  const networkLabel =
    isWifi ? 'WiFi' :
    isCellular ? (network.effectiveType !== 'unknown' ? network.effectiveType.toUpperCase() : '4G') :
    network.isSupported ? network.effectiveType.toUpperCase() : null;

  const NetworkIcon = isWifi ? Wifi : Signal;
  const networkColor =
    isWifi ? 'text-blue-400' :
    isCellular ? 'text-green-400' : 'text-zinc-500';

  const autoStatusText =
    mode === 'auto' && networkLabel
      ? `${networkLabel} · ${resolved === 'hd' ? 'HD' : '360p'}`
      : null;

  const ModeIcon =
    mode === '360p' ? ZapOff :
    mode === 'hd'   ? Gauge  : Zap;

  return (
    <div className="relative flex items-center gap-1.5 flex-shrink-0">

      {/* Network indicator dot + label */}
      {network.isSupported && (
        <div className={`flex items-center gap-1 ${networkColor} opacity-70`}
          title={`Network: ${network.type}${networkLabel ? ` (${networkLabel})` : ''}`}>
          <NetworkIcon size={12} strokeWidth={2.5} />
          {autoStatusText && (
            <span className="hidden md:block text-[10px] font-semibold leading-none tracking-wide">
              {autoStatusText}
            </span>
          )}
        </div>
      )}

      {/* 3-way pill toggle */}
      <div
        className="relative flex items-center bg-zinc-800/90 border border-zinc-700/60 rounded-full p-0.5 backdrop-blur-sm cursor-pointer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {OPTIONS.map(opt => {
          const isActive = mode === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              aria-pressed={isActive}
              className={`relative px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors duration-150 leading-none
                ${isActive ? 'text-black' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              {/* Sliding active pill */}
              {isActive && (
                <span
                  className={`absolute inset-0 rounded-full transition-all duration-200 ${
                    opt.value === '360p' ? 'bg-green-400' :
                    opt.value === 'hd'   ? 'bg-white' :
                    'bg-sky-400'
                  }`}
                />
              )}
              <span className="relative">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tooltip on hover */}
      {showTooltip && (
        <div className="absolute bottom-full mb-2 right-0 bg-zinc-900 border border-zinc-700 rounded-xl p-3 w-48 shadow-2xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 mb-2.5">
            <ModeIcon size={14} className={
              mode === '360p' ? 'text-green-400' :
              mode === 'hd'   ? 'text-white' : 'text-sky-400'
            } />
            <span className="text-white text-xs font-black">
              {mode === 'auto' ? 'Smart Auto' : mode === 'hd' ? 'HD Quality' : 'Save Data'}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px] text-zinc-400">
            {mode === 'auto' && (
              <>
                <p>Automatically picks quality based on your connection.</p>
                {network.isSupported && (
                  <div className="flex items-center gap-1.5 mt-2 text-zinc-300">
                    <NetworkIcon size={11} className={networkColor} />
                    <span>
                      {networkLabel ?? 'Unknown'} detected →{' '}
                      <span className={resolved === 'hd' ? 'text-white font-bold' : 'text-green-400 font-bold'}>
                        {resolved === 'hd' ? 'HD' : '360p'}
                      </span>
                    </span>
                  </div>
                )}
                {!network.isSupported && <p className="text-zinc-500">Network API unavailable in this browser.</p>}
              </>
            )}
            {mode === '360p' && <p>Streams at 360p to save mobile data. Best for 3G/4G.</p>}
            {mode === 'hd'   && <p>Forces HD streaming. Use on fast WiFi for best quality.</p>}
          </div>

          {/* Caret */}
          <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-zinc-900 border-r border-b border-zinc-700 rotate-45" />
        </div>
      )}
    </div>
  );
};

export default BandwidthToggle;
