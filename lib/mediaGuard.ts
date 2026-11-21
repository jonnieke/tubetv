/**
 * Global media playback guard:
 *  1. Immediately pauses all <video>/<audio> elements whenever a blocking overlay
 *     (PaywallModal / AuthModal) is open, and intercepts late-starting HLS `play`
 *     events so nothing can ever play behind the paywall.
 *  2. Immediately pauses all <video>/<audio> elements when the user navigates away
 *     from TubeTV (`visibilitychange` -> hidden or `pagehide`).
 */

let overlayBlocked = false;

export function isMediaBlocked(): boolean {
  if (overlayBlocked) return true;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return true;
  }
  return false;
}

export function pauseAllPageMedia(): void {
  if (typeof document === 'undefined') return;
  const mediaNodes = document.querySelectorAll<HTMLMediaElement>('video, audio');
  mediaNodes.forEach((node) => {
    try {
      if (!node.paused) {
        node.pause();
      }
    } catch {
      // Ignore media pause errors on detached elements
    }
  });
}

export function setOverlayMediaBlocked(blocked: boolean): void {
  overlayBlocked = blocked;
  if (blocked) {
    pauseAllPageMedia();
  }
}

export function installGlobalMediaGuard(): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      pauseAllPageMedia();
    }
  };

  const onPageHide = () => {
    pauseAllPageMedia();
  };

  // Capture-phase `play` listener catches any late-resolving HLS/autoPlay video
  // trying to start behind an open paywall or while the tab is hidden.
  const onMediaPlayCapture = (event: Event) => {
    if (!isMediaBlocked()) return;
    const target = event.target as HTMLMediaElement | null;
    if (target && typeof target.pause === 'function') {
      try {
        target.pause();
      } catch {
        // Ignore
      }
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('play', onMediaPlayCapture, true);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('play', onMediaPlayCapture, true);
  };
}
