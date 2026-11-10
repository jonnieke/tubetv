import React, { useEffect, useRef, useState } from 'react';
import { Play, Zap, VolumeX } from 'lucide-react';
import type Hls from 'hls.js';
import { ShortVideo } from '../types';
import { loadHls } from '../lib/hlsLoader';
import { shouldSaveData } from '../lib/network';
import { usePlayback } from '../contexts/PlaybackContext';
import { useLanguage } from '../contexts/LanguageContext';

interface ShortsShelfProps {
  shorts: ShortVideo[];
  onShortClick: (shortId?: string) => void;
}

const ShortItem: React.FC<{
  short: ShortVideo;
  onShortClick: (shortId: string) => void;
  index: number;
  dataSaver: boolean;
}> = ({ short, onShortClick, index, dataSaver }) => {
  const [shouldPlay, setShouldPlay] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const handleMouseEnter = () => {
    if (dataSaver || !short.videoUrl) return;
    timerRef.current = setTimeout(() => {
      setShouldPlay(true);
    }, 650);
  };

  const handleMouseLeave = () => {
    setShouldPlay(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const videoEl = videoRef.current;

    if (!shouldPlay || !videoEl || !short.videoUrl) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const src = short.videoUrl;
    const isHls = /\.m3u8(\?|$)/i.test(src);
    const hasMse =
      typeof window !== 'undefined' &&
      ('MediaSource' in window || 'ManagedMediaSource' in (window as unknown as Record<string, unknown>));

    if (isHls && !hasMse && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = src;
      videoEl.play().catch(() => setShouldPlay(false));
      return;
    }

    if (isHls) {
      void loadHls().then((Hls) => {
        if (cancelled || !videoRef.current) return;
        if (!Hls.isSupported()) {
          videoRef.current.src = src;
          videoRef.current.play().catch(() => setShouldPlay(false));
          return;
        }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 5,
          maxBufferLength: 8,
          maxMaxBufferLength: 15,
          maxBufferSize: 8 * 1000 * 1000,
          capLevelToPlayerSize: true,
          abrEwmaDefaultEstimate: 500_000,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled || !videoRef.current) {
            hls.destroy();
            return;
          }
          // Cap preview to lowest / <= 360p short-edge level to conserve bandwidth
          const lowIndex = hls.levels.reduce((best, lvl, idx) => {
            const edge = lvl.width && lvl.height ? Math.min(lvl.width, lvl.height) : lvl.height || 0;
            return edge > 0 && edge <= 360 ? idx : best;
          }, -1);
          if (lowIndex >= 0) hls.currentLevel = lowIndex;
          videoRef.current.play().catch(() => setShouldPlay(false));
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal || cancelled) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }
          hls.destroy();
          if (hlsRef.current === hls) hlsRef.current = null;
        });
      });
    } else {
      videoEl.src = src;
      videoEl.play().catch(() => setShouldPlay(false));
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [shouldPlay, short.videoUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  return (
    <button
      type="button"
      aria-label={`Open short: ${short.description}`}
      onClick={() => onShortClick(short.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      className="flex-shrink-0 w-[160px] md:w-[200px] h-[280px] md:h-[350px] relative rounded-xl overflow-hidden cursor-pointer group snap-start ring-1 ring-white/10 shadow-lg bg-zinc-900 text-left"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {shouldPlay ? (
        <div className="absolute inset-0 z-10 animate-in fade-in duration-500 bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-contain opacity-85"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white/80 backdrop-blur-sm z-20">
            <VolumeX size={14} />
          </div>
        </div>
      ) : (
        <img
          src={short.thumbnail}
          alt={short.description}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110 absolute inset-0 z-0"
        />
      )}

      <div
        className={`absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90 transition-opacity z-20 pointer-events-none ${
          shouldPlay ? 'opacity-60' : 'opacity-80 group-hover:opacity-90'
        }`}
      />

      {!shouldPlay && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform scale-50 group-hover:scale-100 z-30 pointer-events-none">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-xl">
            <Play className="w-5 h-5 text-white fill-current ml-1" />
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 p-3 w-full transform transition-transform duration-300 translate-y-2 group-hover:translate-y-0 z-30 pointer-events-none">
        <p className="text-white font-bold text-sm line-clamp-2 leading-tight mb-1 drop-shadow-md">
          {short.description}
        </p>
        <p className="text-zinc-300 text-xs font-medium flex items-center gap-1">
          {short.isAd ? (
            <span className="bg-yellow-500 text-black px-1.5 rounded text-[10px] font-bold">AD</span>
          ) : (
            short.author
          )}
        </p>
      </div>
    </button>
  );
};

const ShortsShelf: React.FC<ShortsShelfProps> = ({ shorts, onShortClick }) => {
  const { t } = useLanguage();
  const { preferences } = usePlayback();
  const dataSaver = shouldSaveData(preferences.dataSaver);

  return (
    <div className="mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 group">
          <span className="text-red-500 text-2xl group-hover:scale-125 transition-transform">
            <Zap className="fill-current" />
          </span>
          {t('shelf.shorts')}
        </h2>
        <button
          type="button"
          onClick={() => onShortClick()}
          className="text-zinc-400 text-sm hover:text-white transition-colors font-medium"
        >
          {t('shelf.viewAll')}
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x scroll-pl-4">
        {shorts.map((short, index) => (
          <ShortItem key={short.id} short={short} onShortClick={onShortClick} index={index} dataSaver={dataSaver} />
        ))}
      </div>
    </div>
  );
};

export default ShortsShelf;
