import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, Share2, Music2, Volume2, VolumeX, Play, Check, Lock, Sparkles, ExternalLink } from 'lucide-react';
import { ShortVideo } from '../types';
import { MOCK_SHORTS } from '../constants';
import type Hls from 'hls.js';
import { loadHls } from '../lib/hlsLoader';
import { buildHlsConfig } from '../lib/hlsConfig';
import { shouldSaveData } from '../lib/network';
import { usePlayback } from '../contexts/PlaybackContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  MAX_DAILY_FREE_SHORTS,
  getFreeShortsStatus,
  recordFreeShortView,
} from '../lib/shortsLimit';
import { fetchActiveSponsorAds, type SponsorAd } from '../lib/sponsorAds';

interface ShortsPlayerProps {
  shorts?: ShortVideo[];
  initialShortId?: string;
  hasActivePass?: boolean;
  onRequestPass?: () => void;
  onExit: () => void;
}

const ShortsPlayer: React.FC<ShortsPlayerProps> = ({
  shorts = MOCK_SHORTS,
  initialShortId,
  hasActivePass = false,
  onRequestPass,
  onExit,
}) => {
  const { t, language } = useLanguage();
  const { preferences } = usePlayback();
  const dataSaver = shouldSaveData(preferences.dataSaver);
  const [activeId, setActiveId] = useState<string | null>(initialShortId || (shorts[0]?.id ?? null));
  const [shortsBlocked, setShortsBlocked] = useState<boolean>(false);
  const [remainingFree, setRemainingFree] = useState<number>(() => getFreeShortsStatus().remainingToday);
  const [adPool, setAdPool] = useState<SponsorAd[]>([]);
  const [inFeedAd, setInFeedAd] = useState<SponsorAd | null>(null);
  const [adSkipCountdown, setAdSkipCountdown] = useState<number>(0);
  const isInitialScrollDoneRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasActivePass) {
      setShortsBlocked(false);
      setInFeedAd(null);
      return;
    }
    let mounted = true;
    void fetchActiveSponsorAds().then((ads) => {
      if (mounted) setAdPool(ads);
    });
    return () => {
      mounted = false;
    };
  }, [hasActivePass]);

  useEffect(() => {
    if (hasActivePass || !activeId) return;
    const res = recordFreeShortView(activeId);
    setRemainingFree(res.remainingToday);
    if (!res.allowed) {
      setShortsBlocked(true);
      setInFeedAd(null);
      return;
    }
    setShortsBlocked(false);
    if (res.shouldShowSponsorAd && adPool.length > 0) {
      const ad = adPool[Math.floor(Math.random() * adPool.length)] || adPool[0];
      setInFeedAd(ad);
      setAdSkipCountdown(5);
    }
  }, [activeId, hasActivePass, adPool]);

  useEffect(() => {
    if (!inFeedAd || adSkipCountdown <= 0) return;
    const timer = setTimeout(() => setAdSkipCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [inFeedAd, adSkipCountdown]);

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
        {!hasActivePass && (
          <span className="ml-auto rounded-full border border-amber-500/30 bg-black/70 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
            {remainingFree}/{MAX_DAILY_FREE_SHORTS} free left
          </span>
        )}
      </div>

      {/* Daily Free Shorts Cap Paywall Overlay */}
      {shortsBlocked && !hasActivePass && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/92 backdrop-blur-md p-6">
          <div className="max-w-sm w-full rounded-2xl border border-amber-500/35 bg-zinc-950 p-6 text-center space-y-4 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <Lock size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">
                {language === 'sw' ? 'Umefikia kikomo cha Shorts bure leo' : 'Daily Free Shorts Limit Reached'}
              </h2>
              <p className="mt-1.5 text-xs text-zinc-300 leading-relaxed">
                {language === 'sw'
                  ? `Umetazama Shorts ${MAX_DAILY_FREE_SHORTS} bure leo. Fungua Shorts zisizo na kikomo, Micro-Dramas na Filamu bila matangazo kwa shilingi 10 tu kwa siku.`
                  : `You've watched your ${MAX_DAILY_FREE_SHORTS} free Shorts today. Unlock unlimited, ad-free Shorts, Micro-Dramas & Movies for only 10 bob daily.`}
              </p>
            </div>
            {onRequestPass && (
              <button
                type="button"
                onClick={onRequestPass}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs py-3 transition cursor-pointer"
              >
                <Sparkles size={14} />
                <span>{language === 'sw' ? 'Fungua Vyote · KSh 10 / Siku' : 'Unlock Unlimited · KSh 10 Daily'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onExit}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs py-2.5 transition cursor-pointer"
            >
              {t('shorts.back')}
            </button>
          </div>
        </div>
      )}

      {/* In-Feed Sponsor Ad Overlay (every 5th free Short when active ads exist) */}
      {inFeedAd && !shortsBlocked && !hasActivePass && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/95 p-4">
          <div className="relative w-full max-w-[420px] rounded-2xl overflow-hidden border border-amber-500/40 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/90 border-b border-zinc-800">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                Sponsored · {inFeedAd.advertiserName}
              </span>
              {adSkipCountdown > 0 ? (
                <span className="text-[10px] font-bold text-zinc-400">Continue in {adSkipCountdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setInFeedAd(null)}
                  className="rounded-md bg-white text-black px-2.5 py-0.5 text-[10px] font-extrabold cursor-pointer"
                >
                  Skip Ad →
                </button>
              )}
            </div>
            <div className="aspect-[9/14] max-h-[60vh] w-full bg-black flex items-center justify-center">
              <video
                src={inFeedAd.videoUrl}
                data-ad-player="true"
                autoPlay
                playsInline
                controls={false}
                onEnded={() => setInFeedAd(null)}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="p-3 flex flex-wrap items-center justify-between gap-2 bg-zinc-900/90">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{inFeedAd.title}</p>
                {onRequestPass && (
                  <button
                    type="button"
                    onClick={() => {
                      setInFeedAd(null);
                      onRequestPass();
                    }}
                    className="text-[10px] font-semibold text-amber-300 hover:underline cursor-pointer"
                  >
                    Remove ads · KSh 10 daily pass
                  </button>
                )}
              </div>
              {inFeedAd.clickUrl && (
                <a
                  href={inFeedAd.clickUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 text-[11px] font-extrabold"
                >
                  <span>Learn more</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
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
            isActive={activeId === short.id && !shortsBlocked && !inFeedAd}
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

          const hls = new Hls(buildHlsConfig({ dataSaver, profile: 'short' }));
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
      if (!nextMuted) {
        videoRef.current.volume = 0.35;
      }
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
      {short.thumbnail && (
        <img
          src={short.thumbnail}
          alt=""
          aria-hidden="true"
          loading={isActive ? 'eager' : 'lazy'}
          decoding="async"
          className="shorts-art-backdrop"
        />
      )}
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
