
import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { onThumbError } from '../lib/thumbnail';
import { Video } from '../types';

interface Props {
  nextEpisode: Video;
  onPlay: () => void;
  onCancel: () => void;
  /** Countdown seconds, default 10 */
  seconds?: number;
}

const NextEpisodeCountdown: React.FC<Props> = ({
  nextEpisode,
  onPlay,
  onCancel,
  seconds = 10,
}) => {
  const [remaining, setRemaining] = useState(seconds);
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;

  useEffect(() => {
    if (remaining <= 0) {
      onPlayRef.current();
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  // SVG progress ring
  const RADIUS = 20;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const progress = ((seconds - remaining) / seconds) * CIRCUMFERENCE;

  return (
    <div className="fixed bottom-24 right-6 z-[200] w-72 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-zinc-800">
        <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Next Episode</span>
        <button onClick={onCancel} className="text-zinc-500 hover:text-white transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Thumbnail + info */}
      <div className="flex gap-3 px-4 py-3">
        <div className="relative flex-shrink-0 w-24 rounded-lg overflow-hidden bg-zinc-800 aspect-video">
          <img src={nextEpisode.thumbnail} alt="" onError={onThumbError} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {nextEpisode.seriesTitle && (
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wide truncate">
              {nextEpisode.seriesTitle}
            </p>
          )}
          {nextEpisode.episode && (
            <p className="text-zinc-400 text-[10px] font-mono">
              S{nextEpisode.season ?? 1} · E{nextEpisode.episode}
            </p>
          )}
          <p className="text-white font-bold text-xs leading-snug line-clamp-2 mt-0.5">
            {nextEpisode.title}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        {/* Countdown ring + Play Now */}
        <button
          onClick={onPlay}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-black rounded-xl transition-all active:scale-[0.98]"
        >
          <div className="relative w-6 h-6 flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 48 48" className="-rotate-90">
              <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
              <circle
                cx="24" cy="24" r={RADIUS}
                fill="none"
                stroke="white"
                strokeWidth="4"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE - progress}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white leading-none">
              {remaining}
            </span>
          </div>
          Play Now <ChevronRight size={14} />
        </button>

        <button
          onClick={onCancel}
          className="px-3 py-2.5 text-zinc-400 hover:text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default NextEpisodeCountdown;
