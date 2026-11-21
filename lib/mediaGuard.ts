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

export function pauseAllPageMedia(includeAdPlayers = false): void {
  if (typeof document === 'undefined') return;
  const mediaNodes = document.querySelectorAll<HTMLMediaElement>('video, audio');
  mediaNodes.forEach((node) => {
    if (!includeAdPlayers && typeof node.getAttribute === 'function' && node.getAttribute('data-ad-player') === 'true') {
      return;
    }
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
    pauseAllPageMedia(false);
  }
}

export function installGlobalMediaGuard(): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      pauseAllPageMedia(true);
    }
  };

  const onPageHide = () => {
    pauseAllPageMedia(true);
  };

  // Capture-phase `play` listener catches any late-resolving HLS/autoPlay video
  // trying to start behind an open paywall or while the tab is hidden.
  const onMediaPlayCapture = (event: Event) => {
    const target = event.target as HTMLMediaElement | null;
    if (!target || typeof target.pause !== 'function') return;
    const isAdPlayer = target.getAttribute('data-ad-player') === 'true';
    const hidden = document.visibilityState === 'hidden';
    if (hidden || (overlayBlocked && !isAdPlayer)) {
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
