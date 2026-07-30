type HlsConstructor = typeof import('hls.js').default;

let hlsPromise: Promise<HlsConstructor> | null = null;

export function loadHls(): Promise<HlsConstructor> {
  if (!hlsPromise) {
    hlsPromise = import('hls.js/light').then((module) => module.default as HlsConstructor);
  }
  return hlsPromise;
}
