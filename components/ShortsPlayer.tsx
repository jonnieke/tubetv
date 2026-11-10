import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, Share2, Music2, Volume2, VolumeX, Play, Check } from 'lucide-react';
import { ShortVideo } from '../types';
import { MOCK_SHORTS } from '../constants';
import type Hls from 'hls.js';
import { loadHls } from '../lib/hlsLoader';
import { shouldSaveData } from '../lib/network';
import { usePlayback } from '../contexts/PlaybackContext';
import { useLanguage } from '../contexts/LanguageContext';

interface ShortsPlayerProps {
  shorts?: ShortVideo[];
  initialShortId?: string;
  onExit: () => void;
}

const ShortsPlayer: React.FC<ShortsPlayerProps> = ({
  shorts = MOCK_SHORTS,
  initialShortId,
  onExit,
}) => {
  const { t } = useLanguage();
  const { preferences } = usePlayback();
  const dataSaver = shouldSaveData(preferences.dataSaver);
  const [activeId, setActiveId] = useState<string | null>(initialShortId || (shorts[0]?.id ?? null));
  const isInitialScrollDoneRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialShortId) {
      isInitialScrollDoneRef.current = false;
      return;
    }
    if (!containerRef.current || isInitialScrollDoneRef.current) return;
    const target = containerRef.current.querySelector(`[data-id="${CSS.escape ? CSS.escape(initialShortId) : initialShortId}"]`) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      setActiveId(initialShortId);
      isInitialScrollDoneRef.current = true;
    }
  }, [initialShortId, shorts]);

  useEffect(() => {
    const options = {
      root: containerRef.current,
      threshold: 0.6,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-id');
          if (id) setActiveId(id);
        }
      });
    }, options);

    const frame = requestAnimationFrame(() => {
      const elements = containerRef.current?.querySelectorAll('.short-item-wrapper');
      elements?.forEach((el) => observer.observe(el));
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [shorts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current || shorts.length === 0) return;
      const currentIndex = shorts.findIndex((s) => s.id === activeId);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, shorts.length - 1);
        const target = containerRef.current.querySelector(`[data-id="${shorts[nextIndex].id}"]`) as HTMLElement | null;
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        const target = containerRef.current.querySelector(`[data-id="${shorts[prevIndex].id}"]`) as HTMLElement | null;
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (e.key === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeId, shorts, onExit]);

  const resolvedActiveIndex = Math.max(
    0,
    shorts.findIndex((s) => s.id === activeId),
  );

  return (
    <div className="shorts-stage w-full flex justify-center bg-black overflow-hidden relative">
      <div className="shorts-stage-heading">
        <button type="button" onClick={onExit} aria-label={t('shorts.back')}>
          <ArrowLeft size={21} />
        </button>
        <span>
          Shorts <i>by TubeTV</i>
        </span>
      </div>
      <div
        ref={containerRef}
        className="shorts-feed h-full w-full md:w-[450px] overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth"
      >
        {shorts.length === 0 && (
          <div className="shorts-empty">
            <p className="cinema-card-kicker">SHORTS</p>
            <h1>{t('shorts.emptyTitle')}</h1>
            <p>{t('shorts.emptyBody')}</p>
            <button type="button" className="cinema-secondary" onClick={onExit}>
              {t('shorts.back')}
            </button>
          </div>
        )}
        {shorts.map((short, index) => (
          <ShortItem
            key={short.id}
            short={short}
            isActive={activeId === short.id}
            isNearby={Math.abs(index - resolvedActiveIndex) <= 1}
            dataSaver={dataSaver}
            videoSrc={short.videoUrl}
          />
        ))}
      </div>
    </div>
  );
};

interface ShortItemProps {
  short: ShortVideo;
  isActive: boolean;
  isNearby: boolean;
  dataSaver: boolean;
  videoSrc: string;
}

const ShortItem: React.FC<ShortItemProps> = ({ short, isActive, isNearby, dataSaver, videoSrc }) => {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const instanceIdRef = useRef(crypto.randomUUID());

  // Release HLS & media decoders when scrolled outside the 3-item window
  useEffect(() => {
    if (!isNearby && hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, [isNearby]);

  useEffect(() => {
    let cancelled = false;
    const videoEl = videoRef.current;
    if (!videoEl || !isNearby) return;

    if (isActive) {
      setHasPlaybackError(false);
      document.dispatchEvent(new CustomEvent('tubetv:player-start', { detail: instanceIdRef.current }));

      const isHls = /\.m3u8(\?|$)/i.test(videoSrc);
      const hasMse =
        typeof window !== 'undefined' &&
        ('MediaSource' in window || 'ManagedMediaSource' in (window as unknown as Record<string, unknown>));

      if (isHls && !hasMse && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = videoSrc;
        videoEl
          .play()
          .then(() => {
            if (!cancelled) setIsPlaying(true);
          })
          .catch(() => {
            if (!cancelled) setHasPlaybackError(true);
          });
      } else if (isHls) {
        void loadHls().then((Hls) => {
          if (cancelled || !videoRef.current) return;
          if (!Hls.isSupported()) {
            videoRef.current.src = videoSrc;
            videoRef.current
              .play()
              .then(() => {
                if (!cancelled) setIsPlaying(true);
              })
              .catch(() => {
                if (!cancelled) setHasPlaybackError(true);
              });
            return;
          }

          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 10,
            maxBufferLength: 15,
            maxMaxBufferLength: 30,
            maxBufferSize: 20 * 1000 * 1000,
            capLevelToPlayerSize: true,
            abrEwmaDefaultEstimate: 800_000,
            fragLoadingTimeOut: 15000,
            fragLoadingMaxRetry: 4,
          });
          hlsRef.current = hls;
          hls.loadSource(videoSrc);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled || !videoRef.current) {
              hls.destroy();
              return;
            }
            if (dataSaver) {
              const capped = hls.levels.reduce((best, lvl, idx) => {
                const edge = lvl.width && lvl.height ? Math.min(lvl.width, lvl.height) : lvl.height || 0;
                const bestEdge =
                  best >= 0
                    ? hls.levels[best].width && hls.levels[best].height
                      ? Math.min(hls.levels[best].width, hls.levels[best].height)
                      : hls.levels[best].height || 0
                    : 0;
                return edge > 0 && edge <= 360 && (best < 0 || edge > bestEdge) ? idx : best;
              }, -1);
              if (capped >= 0) hls.currentLevel = capped;
            }
            videoRef.current
              .play()
              .then(() => {
                if (!cancelled) setIsPlaying(true);
              })
              .catch(() => {
                if (!cancelled) setIsPlaying(false);
              });
          });
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (!data.fatal || cancelled) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
              return;
            }
            setHasPlaybackError(true);
            setIsPlaying(false);
            hls.destroy();
            if (hlsRef.current === hls) hlsRef.current = null;
          });
        });
      } else {
        if (!videoEl.src || videoEl.src !== videoSrc) {
          videoEl.src = videoSrc;
        }
        videoEl
          .play()
          .then(() => {
            if (!cancelled) setIsPlaying(true);
          })
          .catch(() => {
            if (!cancelled) setIsPlaying(false);
          });
      }
    } else {
      videoEl.pause();
      setIsPlaying(false);
      videoEl.currentTime = 0;
      if (hlsRef.current) {
        hlsRef.current.stopLoad();
      }
    }

    return () => {
      cancelled = true;
    };
  }, [isActive, isNearby, dataSaver, videoSrc]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const deepUrl = `${window.location.origin}/?view=SHORTS&short=${encodeURIComponent(short.id)}`;
    const shareData = {
      title: 'Watch this on TubeTV',
      text: short.description,
      url: deepUrl,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => undefined);
    } else if (navigator.clipboard) {
      void navigator.clipboard.writeText(deepUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div
      className="short-item-wrapper snap-start h-full w-full relative bg-zinc-900 border-b border-zinc-800 flex items-center justify-center overflow-hidden"
      data-id={short.id}
      onClick={togglePlay}
    >
      {short.thumbnail && <img src={short.thumbnail} alt="" aria-hidden="true" className="shorts-art-backdrop" />}
      {isNearby && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          loop
          muted={isMuted}
          playsInline
          poster={short.thumbnail}
          preload={isActive ? 'auto' : 'metadata'}
          onError={() => {
            setHasPlaybackError(true);
            setIsPlaying(false);
          }}
        />
      )}
      {hasPlaybackError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black px-8 text-center">
          <p className="text-sm text-zinc-300">This short is temporarily unavailable.</p>
        </div>
      )}

      {!isPlaying && !hasPlaybackError && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none bg-black/20">
          <div className="bg-black/40 p-4 rounded-full backdrop-blur-sm">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
      )}

      {short.isAd && (
        <div className="shorts-sponsored absolute bg-yellow-500/90 text-black font-bold px-2 py-1 text-xs rounded uppercase tracking-wider z-20">
          Sponsored
        </div>
      )}

      <div className="shorts-mute absolute z-20">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute short' : 'Mute short'}
          className="p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      <div className="shorts-content absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90 flex flex-col justify-end z-10 pointer-events-none">
        <div className="shorts-actions absolute flex flex-col items-center gap-1 pointer-events-auto">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share short"
            className="p-3 rounded-full bg-zinc-800/50 backdrop-blur-md text-white hover:bg-zinc-700/50 transition-colors pointer-events-auto"
          >
            {copied ? <Check className="w-7 h-7 text-emerald-400" /> : <Share2 className="w-8 h-8" />}
          </button>
        </div>

        <div className="shorts-caption space-y-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-bold text-sm">
              {short.author.replace(/^@/, '').charAt(0).toUpperCase() || 'T'}
            </div>
            <h3 className="font-bold text-lg">{short.author}</h3>
          </div>

          <p className="text-sm md:text-base text-zinc-100 line-clamp-2">{short.description}</p>

          {!short.isAd && (
            <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-800/40 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
              <Music2 size={14} className="animate-spin-slow" />
              <span>Original Sound - {short.author}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShortsPlayer;
