import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, X } from 'lucide-react';
import { getYouTubeEmbedUrl, publicMediaUrl } from '../lib/mediaUrl';

interface TrailerModalProps {
  url: string;
  title: string;
  onClose: () => void;
  onWatchFull?: () => void;
  watchLabel?: string;
}

export const TrailerModal: React.FC<TrailerModalProps> = ({
  url,
  title,
  onClose,
  onWatchFull,
  watchLabel = 'Watch Now',
}) => {
  const safeUrl = publicMediaUrl(url);
  const embedUrl = getYouTubeEmbedUrl(safeUrl);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!safeUrl || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Trailer for ${title}`}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Official Trailer</span>
            <h2 className="text-sm sm:text-base font-bold text-white truncate">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trailer"
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`${title} Trailer`}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <video src={safeUrl} controls autoPlay playsInline className="h-full w-full object-contain" />
          )}
        </div>

        {onWatchFull && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-zinc-900/70 border-t border-zinc-800/80">
            <span className="text-xs text-zinc-400">Ready to watch the full story on TubeTV?</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onWatchFull();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-bold text-white transition-colors"
            >
              <Play size={13} fill="currentColor" />
              <span>{watchLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
