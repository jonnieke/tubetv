
/** Build the canonical deep-link URL for a video, optionally timestamped. */
export const buildShareUrl = (videoId: string, currentTime = 0): string => {
  const t = currentTime > 5 ? `&t=${Math.floor(currentTime)}` : '';
  return `${window.location.origin}?v=${videoId}${t}`;
};

/** Swahili share text used across all share targets. */
export const buildShareText = (title: string, url: string): string =>
  `Tazama "${title}" kwenye Tube TV 🇰🇪\n${url}`;

/** True when the browser supports the Web Share API (mobile / Chrome 89+). */
export const canNativeShare = (): boolean =>
  typeof navigator !== 'undefined' && 'share' in navigator;

/** Trigger the OS-native share sheet. Returns true if the user completed sharing. */
export const nativeShare = async (title: string, text: string, url: string): Promise<boolean> => {
  try {
    await navigator.share({ title, text, url });
    return true;
  } catch {
    return false;
  }
};

/** Open WhatsApp Web with the pre-filled share message. */
export const openWhatsApp = (text: string): void => {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
};

/** Open X (Twitter) intent with text + url. */
export const openTwitter = (text: string, url: string): void => {
  const params = new URLSearchParams({ text, url });
  window.open(`https://twitter.com/intent/tweet?${params}`, '_blank', 'noopener');
};

/** Open Facebook share dialog. */
export const openFacebook = (url: string): void => {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener');
};

/** Copy text to clipboard. Returns true on success. */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers: fallback execCommand
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
};
