import type { HlsConfig } from 'hls.js';

export type HlsProfile = 'standard' | 'short' | 'preview';

/**
 * Shared hls.js configuration tuned for fast first-frame startup and minimal
 * rebuffering on variable mobile (3G/4G) and Kenyan ISP connections.
 *
 * Key anti-buffering choices:
 * - startLevel: 0            -> Instant startup on lowest rung, then ramp up.
 * - abrBandWidthUpFactor: 0.55 -> Conservative step-up prevents jumping to 1080p
 *                               after one fast segment and immediately stalling.
 * - maxStarvationDelay: 2    -> Proactively drops bitrate before buffer empties.
 * - fragLoadingTimeOut: 20s  -> Avoids aborting slow mobile segments mid-download.
 */
export function buildHlsConfig(options: {
  dataSaver?: boolean;
  profile?: HlsProfile;
} = {}): Partial<HlsConfig> {
  const { dataSaver = false, profile = 'standard' } = options;

  if (profile === 'preview') {
    return {
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 6,
      maxBufferLength: 8,
      maxMaxBufferLength: 15,
      maxBufferSize: 8 * 1000 * 1000,
      maxBufferHole: 0.5,
      capLevelToPlayerSize: true,
      startLevel: 0,
      abrEwmaDefaultEstimate: 450_000,
      abrBandWidthFactor: 0.8,
      abrBandWidthUpFactor: 0.5,
      maxStarvationDelay: 2,
      maxLoadingDelay: 2,
      fragLoadingTimeOut: 15_000,
      fragLoadingMaxRetry: 4,
    };
  }

  if (profile === 'short') {
    return {
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 10,
      maxBufferLength: dataSaver ? 10 : 18,
      maxMaxBufferLength: dataSaver ? 20 : 35,
      maxBufferSize: (dataSaver ? 12 : 24) * 1000 * 1000,
      maxBufferHole: 0.5,
      nudgeOffset: 0.2,
      nudgeMaxRetry: 8,
      capLevelToPlayerSize: true,
      startLevel: 0,
      abrEwmaDefaultEstimate: dataSaver ? 350_000 : 500_000,
      abrBandWidthFactor: 0.8,
      abrBandWidthUpFactor: 0.55,
      abrEwmaFastVoD: 3,
      abrEwmaSlowVoD: 9,
      maxStarvationDelay: 2,
      maxLoadingDelay: 2,
      fragLoadingTimeOut: 20_000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 500,
      levelLoadingTimeOut: 12_000,
      manifestLoadingTimeOut: 12_000,
    };
  }

  return {
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 15,
    maxBufferLength: dataSaver ? 15 : 25,
    maxMaxBufferLength: dataSaver ? 30 : 60,
    maxBufferSize: (dataSaver ? 15 : 35) * 1000 * 1000,
    maxBufferHole: 0.5,
    nudgeOffset: 0.2,
    nudgeMaxRetry: 8,
    capLevelToPlayerSize: true,
    startLevel: 0,
    abrEwmaDefaultEstimate: dataSaver ? 350_000 : 500_000,
    abrBandWidthFactor: 0.8,
    abrBandWidthUpFactor: 0.55,
    abrEwmaFastVoD: 3,
    abrEwmaSlowVoD: 9,
    maxStarvationDelay: 2,
    maxLoadingDelay: 2,
    fragLoadingTimeOut: 20_000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 500,
    levelLoadingTimeOut: 12_000,
    manifestLoadingTimeOut: 12_000,
  };
}
