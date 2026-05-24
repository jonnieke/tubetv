
import React, { useState, useEffect } from 'react';
import { Play, Pause, X, ArrowUp } from 'lucide-react';
import { onThumbError } from '../lib/thumbnail';

export interface NowPlayingInfo {
  videoId: string;
  title: string;
  thumbnail?: string;
  isPlaying: boolean;
}

declare global {
  interface WindowEventMap {
    'tube-now-playing': CustomEvent<NowPlayingInfo | null>;
    'tube-video-control': CustomEvent<{ videoId: string; action: 'play' | 'pause' }>;
  }
}

const NowPlayingBar: React.FC = () => {
  const [info, setInfo] = useState<NowPlayingInfo | null>(null);

  useEffect(() => {
    const handler = (e: CustomEvent<NowPlayingInfo | null>) => {
      setInfo(e.detail);
    };
    window.addEventListener('tube-now-playing', handler);
    return () => window.removeEventListener('tube-now-playing', handler);
  }, []);

  if (!info) return null;

  const handleJump = () => {
    // Scroll the card back into view and dismiss the bar
    const el = document.getElementById(`video-${info.videoId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // The IntersectionObserver in VideoCard will clear the bar once it's visible again
  };

  const handleTogglePlay = () => {
    window.dispatchEvent(
      new CustomEvent('tube-video-control', {
        detail: { videoId: info.videoId, action: info.isPlaying ? 'pause' : 'play' },
      })
    );
    setInfo(prev => prev ? { ...prev, isPlaying: !prev.isPlaying } : null);
  };

  const handleClose = () => {
    window.dispatchEvent(
      new CustomEvent('tube-video-control', {
        detail: { videoId: info.videoId, action: 'pause' },
      })
    );
    setInfo(null);
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 left-0 right-0 md:left-auto md:right-4 md:w-80 z-[150] px-3 md:px-0 animate-in slide-in-from-bottom-2 duration-300">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex items-center gap-3 px-3 py-2.5">
        {/* Thumbnail */}
        <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
          {info.thumbnail ? (
            <img src={info.thumbnail} alt={info.title} onError={onThumbError} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-700" />
          )}
          {/* Playing indicator */}
          {info.isPlaying && (
            <div className="absolute inset-0 flex items-end justify-center pb-1 gap-0.5">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="w-0.5 bg-red-500 rounded-full animate-pulse"
                  style={{ height: `${6 + i * 3}px`, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate">{info.title}</p>
          <p className="text-zinc-500 text-[10px]">Now playing</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleTogglePlay}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
            title={info.isPlaying ? 'Pause' : 'Play'}
          >
            {info.isPlaying
              ? <Pause size={14} className="text-white fill-white" />
              : <Play size={14} className="text-white fill-white ml-0.5" />}
          </button>

          <button
            onClick={handleJump}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-red-600/20 hover:border-red-500/30 border border-transparent flex items-center justify-center transition-colors"
            title="Jump to video"
          >
            <ArrowUp size={14} className="text-red-400" />
          </button>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
            title="Close"
          >
            <X size={14} className="text-zinc-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NowPlayingBar;
