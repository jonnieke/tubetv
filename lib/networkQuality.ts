import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QualityMode = 'auto' | 'hd' | '360p';
export type NetworkType = 'wifi' | 'cellular' | 'unknown';
export type EffectiveType = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';

export interface NetworkStatus {
  type: NetworkType;
  effectiveType: EffectiveType;
  saveData: boolean;
  /** false on browsers that don't support the Network Information API (Safari) */
  isSupported: boolean;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tube_quality_mode';

export const getStoredQualityMode = (): QualityMode => {
  try { return (localStorage.getItem(STORAGE_KEY) as QualityMode) || 'auto'; }
  catch { return 'auto'; }
};

const storeQualityMode = (mode: QualityMode): void => {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
};

// ─── Event bus ────────────────────────────────────────────────────────────────
// Using a custom window event means BandwidthToggle and VideoCard stay
// decoupled — no prop drilling through carousel / shelf layers.

export const EVENT = 'tube-quality-change';

export const applyQualityMode = (mode: QualityMode): void => {
  storeQualityMode(mode);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
};

// ─── Network detection ────────────────────────────────────────────────────────

const readConnection = (): NetworkStatus => {
  const conn: any =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;

  if (!conn) return { type: 'unknown', effectiveType: 'unknown', saveData: false, isSupported: false };

  const raw: string = conn.type || '';
  const type: NetworkType =
    raw === 'wifi' || raw === 'ethernet' ? 'wifi' :
    raw === 'cellular' ? 'cellular' : 'unknown';

  const effectiveType: EffectiveType = conn.effectiveType || 'unknown';

  return { type, effectiveType, saveData: !!conn.saveData, isSupported: true };
};

/** What quality to actually stream given the mode + detected network. */
export const resolveQuality = (mode: QualityMode, net: NetworkStatus): 'hd' | '360p' => {
  if (mode === 'hd')   return 'hd';
  if (mode === '360p') return '360p';

  // auto: honour OS save-data flag first
  if (net.saveData)           return '360p';
  if (net.type === 'wifi')    return 'hd';
  if (net.type === 'cellular') return '360p';

  // Fallback on effectiveType when connection.type is unavailable
  if (net.effectiveType === '4g')  return 'hd';
  if (['3g', '2g', 'slow-2g'].includes(net.effectiveType)) return '360p';

  return 'hd'; // safe default when nothing is detectable
};

// ─── React hooks ─────────────────────────────────────────────────────────────

/** Subscribe to live network status changes. */
export const useNetworkStatus = (): NetworkStatus => {
  const [status, setStatus] = useState<NetworkStatus>(readConnection);

  useEffect(() => {
    const conn: any =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (!conn) return;
    const refresh = () => setStatus(readConnection());
    conn.addEventListener('change', refresh);
    return () => conn.removeEventListener('change', refresh);
  }, []);

  return status;
};

/**
 * Subscribe to the user's chosen quality mode + the event bus.
 * Returns the stored mode and the network-resolved effective quality.
 */
export const useResolvedQuality = (): {
  mode: QualityMode;
  resolved: 'hd' | '360p';
  network: NetworkStatus;
} => {
  const [mode, setMode] = useState<QualityMode>(getStoredQualityMode);
  const network = useNetworkStatus();

  useEffect(() => {
    const handler = (e: Event) => setMode((e as CustomEvent<QualityMode>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  return { mode, resolved: resolveQuality(mode, network), network };
};
