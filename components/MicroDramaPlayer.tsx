import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  ListVideo,
  Share2,
  Heart,
  Plus,
  Check,
  Volume2,
  VolumeX,
  FastForward,
  RotateCcw,
  Sparkles,
  Loader2,
  MessageCircle,
  Clock,
  CheckCircle2,
  Zap
} from 'lucide-react';
import type { Video } from '../types';
import { compareEpisodes, isMicroDrama, seriesKey, isFreeVideo } from '../lib/series';
import { loadHls } from '../lib/hlsLoader';
import { usePlayback } from '../contexts/PlaybackContext';
import { shouldSaveData } from '../lib/network';
import { trackEvent } from '../lib/analytics';
import CatalogueArtwork from './CatalogueArtwork';
import MicroDramaPaywall from './MicroDramaPaywall';
import { checkEpisodeUnlocked } from '../services/paymentService';
import type Hls from 'hls.js';

interface MicroDramaPlayerProps {
  currentVideo: Video;
  allVideos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onPlayEpisode: (video: Video) => void;
  onClose: () => void;
  isAuthenticated?: boolean;
  onRequireLogin?: () => void;
}

export default function MicroDramaPlayer({
  currentVideo,
  allVideos,
  watchLaterIds,
  onToggleWatchLater,
  onPlayEpisode,
  onClose,
  isAuthenticated = false,
  onRequireLogin = () => {},
}: MicroDramaPlayerProps) {
  const { preferences, onProgress } = usePlayback();
  const effectiveDataSaver = shouldSaveData(preferences?.dataSaver ?? false);

  // Series & episodes computation
  const siblingEpisodes = useMemo(() => {
    const key = seriesKey(currentVideo);
    if (!key) return [currentVideo];
    return allVideos.filter((v) => seriesKey(v) === key).sort(compareEpisodes);
  }, [currentVideo, allVideos]);

  const currentIndex = useMemo(() => {
    return siblingEpisodes.findIndex((v) => v.id === currentVideo.id);
  }, [siblingEpisodes, currentVideo.id]);

  const prevEpisode = currentIndex > 0 ? siblingEpisodes[currentIndex - 1] : null;
  const nextEpisode = currentIndex >= 0 && currentIndex < siblingEpisodes.length - 1 ? siblingEpisodes[currentIndex + 1] : null;

  // Player state
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isFreeEpisode = isFreeVideo(currentVideo);
  const [isUnlocked, setIsUnlocked] = useState(isFreeEpisode);

  useEffect(() => {
    let active = true;
    if (isFreeEpisode) {
      setIsUnlocked(true);
      return;
    }
    checkEpisodeUnlocked(currentVideo.id).then((unlocked) => {
      if (active) setIsUnlocked(unlocked);
    });
    return () => {
      active = false;
    };
  }, [currentVideo.id, isFreeEpisode]);

  const [isLiked, setIsLiked] = useState(() => {
    try {
      const likes = JSON.parse(localStorage.getItem('tube_drama_likes') || '{}');
      return Boolean(likes[currentVideo.id]);
    } catch {
      return false;
    }
  });
  const [likeCount, setLikeCount] = useState(() => Math.floor(currentVideo.views * 0.12) + (isLiked ? 1 : 0));
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Micro-interaction & Polish State
  interface FloatingHeart {
    id: number;
    x: number;
    y: number;
  }
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [ephemeralIcon, setEphemeralIcon] = useState<'play' | 'pause' | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ephemeralTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHaptic = (pattern: number | number[] = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  const flashIcon = (type: 'play' | 'pause') => {
    setEphemeralIcon(type);
    if (ephemeralTimerRef.current) clearTimeout(ephemeralTimerRef.current);
    ephemeralTimerRef.current = setTimeout(() => setEphemeralIcon(null), 600);
  };

  // References
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefetchVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const prefetchHlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeEpRef = useRef<HTMLButtonElement>(null);
  const startAtRef = useRef<number>(performance.now());
  const firstFrameRecorded = useRef<boolean>(false);
  const prefetchTriggeredRef = useRef<boolean>(false);

  // Auto-scroll active episode into center view when drawer opens
  useEffect(() => {
    if (isDrawerOpen && activeEpRef.current) {
      setTimeout(() => {
        activeEpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    }
  }, [isDrawerOpen]);

  // Touch swipe handling
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // Playback Speed Toggle (1x -> 1.25x -> 1.5x -> 2x)
  const cyclePlaybackSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(15);
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
    showToast(`Speed: ${nextSpeed}x`);
  };

  // Like toggle
  const toggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isLiked;
    setIsLiked(nextState);
    triggerHaptic(nextState ? [20, 30, 20] : 15);
    setLikeCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    try {
      const likes = JSON.parse(localStorage.getItem('tube_drama_likes') || '{}');
      likes[currentVideo.id] = nextState;
      localStorage.setItem('tube_drama_likes', JSON.stringify(likes));
    } catch {}
    if (nextState) showToast('Added to liked dramas');
  };

  // WhatsApp / Diaspora Social Share
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/watch/${encodeURIComponent(currentVideo.id)}`;
    const title = currentVideo.seriesTitle || currentVideo.title;
    const epNum = currentVideo.episode || currentIndex + 1;
    const shareText = `Watch Episode ${epNum} of "${title}" on TubeTV! 🇰🇪✨\n${url}`;

    if (navigator.share) {
      navigator.share({ title: currentVideo.title, text: shareText, url }).catch(() => {});
    } else {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
      window.open(waUrl, '_blank');
      showToast('Opening WhatsApp...');
    }
  };

  // Navigate to Next / Prev Episode with clean state reset
  const goToNextEpisode = useCallback(() => {
    if (nextEpisode) {
      trackEvent('episode_next', {
        fromVideoId: currentVideo.id,
        toVideoId: nextEpisode.id,
        automatic: false,
      });
      onPlayEpisode(nextEpisode);
    }
  }, [nextEpisode, currentVideo.id, onPlayEpisode]);

  const goToPrevEpisode = useCallback(() => {
    if (prevEpisode) {
      onPlayEpisode(prevEpisode);
    }
  }, [prevEpisode, onPlayEpisode]);

  // Handle skip intro / outro
  const introEnd = currentVideo.introEndSeconds;
  const outroStart = currentVideo.outroStartSeconds;
  const canSkipIntro = Number.isFinite(introEnd) && Number(introEnd) > 0 && currentTime < Number(introEnd) - 1;
  const canSkipOutro = Number.isFinite(outroStart) && Number(outroStart) > 0 && duration > Number(outroStart) && currentTime >= Number(outroStart) - 1;

  const handleSkipIntro = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current && introEnd) {
      videoRef.current.currentTime = Number(introEnd);
      showToast('Intro skipped');
    }
  };

  // Keyboard controls for desktop binge-watching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDrawerOpen) {
        if (e.key === 'Escape') setIsDrawerOpen(false);
        return;
      }
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextEpisode();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevEpisode();
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      } else if (e.key === 'm') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, goToNextEpisode, goToPrevEpisode, onClose]);

  // Touch gesture listeners for vertical swipe (snap up/down)
  const onTouchStart = (e: React.TouchEvent) => {
    if (isDrawerOpen) return;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || isDrawerOpen) return;
    touchCurrentY.current = e.touches[0].clientY;
    const diff = touchCurrentY.current - touchStartY.current;
    // Bounded drag offset for rubber-band visual effect
    setSwipeOffset(Math.max(-120, Math.min(120, diff)));
  };

  const onTouchEnd = () => {
    if (touchStartY.current !== null && touchCurrentY.current !== null && !isDrawerOpen) {
      const diff = touchCurrentY.current - touchStartY.current;
      const threshold = 65; // px swipe sensitivity
      if (diff < -threshold && nextEpisode) {
        triggerHaptic(20);
        goToNextEpisode();
      } else if (diff > threshold && prevEpisode) {
        triggerHaptic(20);
        goToPrevEpisode();
      }
    }
    touchStartY.current = null;
    touchCurrentY.current = null;
    setSwipeOffset(0);
  };

  // HLS stream setup & playback
  const videoSrc = currentVideo.url || '';

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !videoSrc || !isUnlocked) return;

    firstFrameRecorded.current = false;
    prefetchTriggeredRef.current = false;
    startAtRef.current = performance.now();
    setIsBuffering(true);
    setCurrentTime(0);

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      if (!firstFrameRecorded.current) {
        firstFrameRecorded.current = true;
        const latency = Math.round(performance.now() - startAtRef.current);
        trackEvent('playback_first_frame', { videoId: currentVideo.id, latencyMs: latency });
      }
    };
    const onTimeUpdate = () => {
      if (!videoEl) return;
      const cur = videoEl.currentTime;
      const dur = videoEl.duration || 0;
      setCurrentTime(cur);
      setDuration(dur);

      if (onProgress) {
        onProgress(currentVideo.id, {
          positionSeconds: cur,
          durationSeconds: dur,
          completed: dur > 0 && cur >= dur - 2,
        });
      }

      // Pre-buffer next episode when at 65% duration (seamless microdrama cliffhanger bridge)
      if (dur > 0 && cur / dur >= 0.65 && !prefetchTriggeredRef.current && nextEpisode?.url) {
        prefetchTriggeredRef.current = true;
        if (nextEpisode.url.endsWith('.m3u8')) {
          void loadHls().then((Hls) => {
            if (Hls.isSupported() && prefetchVideoRef.current) {
              if (prefetchHlsRef.current) prefetchHlsRef.current.destroy();
              const preHls = new Hls({ maxBufferLength: 10, maxBufferSize: 2 * 1024 * 1024 });
              preHls.loadSource(nextEpisode.url!);
              preHls.attachMedia(prefetchVideoRef.current);
              prefetchHlsRef.current = preHls;
            }
          });
        }
      }
    };

    const onEnded = () => {
      trackEvent('playback_complete', { videoId: currentVideo.id });
      if (nextEpisode) {
        trackEvent('episode_next', { fromVideoId: currentVideo.id, toVideoId: nextEpisode.id, automatic: true });
        onPlayEpisode(nextEpisode);
      }
    };

    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('pause', onPause);
    videoEl.addEventListener('waiting', onWaiting);
    videoEl.addEventListener('playing', onPlaying);
    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('ended', onEnded);

    if (videoSrc.endsWith('.m3u8')) {
      void loadHls().then((Hls) => {
        if (!Hls.isSupported() || !videoRef.current) {
          if (videoRef.current) {
            videoRef.current.src = videoSrc;
            videoRef.current.play().catch(() => setIsPlaying(false));
          }
          return;
        }

        if (hlsRef.current) hlsRef.current.destroy();

        const hls = new Hls({
          capLevelToPlayerSize: true,
          startLevel: effectiveDataSaver ? 0 : -1,
          maxBufferLength: effectiveDataSaver ? 10 : 20,
          maxMaxBufferLength: effectiveDataSaver ? 20 : 40,
          maxBufferSize: (effectiveDataSaver ? 3 : 8) * 1024 * 1024,
          lowLatencyMode: true,
          backBufferLength: 10,
        });

        hls.loadSource(videoSrc);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        });

        hlsRef.current = hls;
      });
    } else {
      videoEl.src = videoSrc;
      videoEl.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }

    return () => {
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('pause', onPause);
      videoEl.removeEventListener('waiting', onWaiting);
      videoEl.removeEventListener('playing', onPlaying);
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      videoEl.removeEventListener('ended', onEnded);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (prefetchHlsRef.current) {
        prefetchHlsRef.current.destroy();
        prefetchHlsRef.current = null;
      }
    };
  }, [currentVideo.id, videoSrc, isUnlocked, effectiveDataSaver, nextEpisode, onPlayEpisode, onProgress]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Tap & Double-Tap (Double-tap = Like with heart animation; Single-tap = Play/Pause)
  const handleVideoAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const timeSinceLast = now - lastTapTimeRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (timeSinceLast < 300) {
      // Double tap -> Like
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      triggerHaptic([20, 45, 20]);

      const heartId = Date.now();
      setFloatingHearts((prev) => [...prev, { id: heartId, x, y }]);
      setTimeout(() => {
        setFloatingHearts((prev) => prev.filter((h) => h.id !== heartId));
      }, 900);

      if (!isLiked) {
        setIsLiked(true);
        setLikeCount((prev) => prev + 1);
        try {
          const likes = JSON.parse(localStorage.getItem('tube_drama_likes') || '{}');
          likes[currentVideo.id] = true;
          localStorage.setItem('tube_drama_likes', JSON.stringify(likes));
        } catch {}
      }
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
      tapTimerRef.current = setTimeout(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
          videoRef.current.pause();
          flashIcon('pause');
        } else {
          videoRef.current.play().catch(() => {});
          flashIcon('play');
        }
        triggerHaptic(12);
      }, 300);
    }
  };

  const isSaved = watchLaterIds.includes(currentVideo.id);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black select-none overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Background Ambient Blur for Desktop View */}
      <div
        className="hidden md:block absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 transform scale-110 pointer-events-none"
        style={{ backgroundImage: `url(${currentVideo.thumbnail})` }}
      />

      {/* Main 9:16 Vertical Phone Stage */}
      <div
        className="relative w-full h-[100dvh] md:max-w-[430px] md:h-[94dvh] md:rounded-2xl md:border md:border-zinc-800 bg-black flex flex-col justify-between overflow-hidden shadow-2xl transition-transform duration-100 ease-out"
        style={{ transform: `translateY(${swipeOffset}px)` }}
      >
        {/* Hidden pre-buffering video element for Episode N+1 */}
        <video ref={prefetchVideoRef} className="hidden" muted playsInline preload="auto" />

        {/* Video Element & Micro-interactions */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center cursor-pointer overflow-hidden" onClick={handleVideoAreaClick}>
          <video
            ref={videoRef}
            playsInline
            preload="auto"
            className="w-full h-full object-cover"
            poster={currentVideo.thumbnail}
          />

          {/* Buffering Indicator */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
                <span className="text-xs text-zinc-300 font-medium tracking-wide">Loading episode...</span>
              </div>
            </div>
          )}

          {/* Ephemeral Center Tap Icon (Play / Pause) */}
          {ephemeralIcon && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl animate-in zoom-in-50 fade-in duration-200">
                {ephemeralIcon === 'play' ? (
                  <Play className="w-10 h-10 fill-white ml-1" />
                ) : (
                  <Pause className="w-10 h-10 fill-white" />
                )}
              </div>
            </div>
          )}

          {/* Floating Double-Tap Hearts */}
          {floatingHearts.map((heart) => (
            <div
              key={heart.id}
              className="absolute pointer-events-none z-30 animate-in zoom-in-50 fade-out duration-700 -translate-x-1/2 -translate-y-1/2"
              style={{ left: heart.x, top: heart.y }}
            >
              <Heart className="w-20 h-20 text-red-500 fill-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]" />
            </div>
          ))}

          {/* Persistent Pause Overlay when explicitly paused */}
          {!isPlaying && !isBuffering && !ephemeralIcon && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-10">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white pl-1 shadow-lg animate-in zoom-in-75 duration-150">
                <Play className="w-8 h-8 fill-white" />
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Cliffhanger Bridge Cue: Swipe up for Next Episode */}
        {duration > 0 && currentTime / duration >= 0.80 && nextEpisode && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic(20);
              goToNextEpisode();
            }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce cursor-pointer border border-white/20"
          >
            <span>Next Ep. {nextEpisode.episode || currentIndex + 2} ⬆</span>
          </div>
        )}

        {/* TOP OVERLAY HEADER */}
        <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-safe">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Microdrama Player"
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Series Title & Episode Badge */}
          <div className="flex flex-col items-center max-w-[210px] text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-500 flex items-center gap-1">
              <Zap className="w-3 h-3 fill-red-500" />
              Micro Drama
            </span>
            <span className="text-sm font-semibold text-white truncate w-full">
              {currentVideo.seriesTitle || currentVideo.title}
            </span>
            <span className="text-[11px] text-zinc-400">
              Episode {currentVideo.episode || currentIndex + 1} of {siblingEpisodes.length}
            </span>
          </div>

          {/* Mute Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted((prev) => !prev);
            }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        {/* CUE ACTION: SKIP INTRO BUTTON */}
        {canSkipIntro && (
          <div className="absolute top-20 left-4 z-30 animate-in fade-in slide-in-from-left duration-200">
            <button
              onClick={handleSkipIntro}
              className="px-3.5 py-1.5 rounded-full bg-red-600/90 hover:bg-red-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg backdrop-blur-sm transition-all"
            >
              <FastForward className="w-3.5 h-3.5" /> Skip Intro
            </button>
          </div>
        )}

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-zinc-900/90 text-white text-xs font-medium border border-zinc-700 shadow-xl backdrop-blur-md animate-in fade-in duration-150">
            {toastMessage}
          </div>
        )}

        {/* RIGHT SIDE FLOATING ACTION BAR */}
        <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4">
          {/* Like Button */}
          <button
            type="button"
            onClick={toggleLike}
            className="flex flex-col items-center gap-1 group"
            aria-label="Like this episode"
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${isLiked ? 'bg-red-600 border-red-500 text-white scale-110' : 'bg-black/50 border-white/20 text-white hover:bg-white/20'}`}>
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-white' : ''}`} />
            </div>
            <span className="text-[11px] font-medium text-white text-shadow-sm">{likeCount}</span>
          </button>

          {/* Watch List Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatchLater(currentVideo.id);
              showToast(isSaved ? 'Removed from My List' : 'Saved to My List');
            }}
            className="flex flex-col items-center gap-1 group"
            aria-label={isSaved ? 'In Watch List' : 'Add to Watch List'}
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${isSaved ? 'bg-zinc-800 border-zinc-600 text-red-500' : 'bg-black/50 border-white/20 text-white hover:bg-white/20'}`}>
              {isSaved ? <Check className="w-5 h-5 text-red-400" /> : <Plus className="w-5 h-5" />}
            </div>
            <span className="text-[11px] font-medium text-white text-shadow-sm">Save</span>
          </button>

          {/* WhatsApp / Social Share */}
          <button
            type="button"
            onClick={handleShare}
            className="flex flex-col items-center gap-1 group"
            aria-label="Share drama episode"
          >
            <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all">
              <Share2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-white text-shadow-sm">Share</span>
          </button>

          {/* Playback Speed Pill */}
          <button
            type="button"
            onClick={cyclePlaybackSpeed}
            className="flex flex-col items-center gap-1 group"
            aria-label="Change playback speed"
          >
            <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold text-xs hover:bg-white/20 transition-all">
              {playbackSpeed}x
            </div>
            <span className="text-[10px] text-zinc-400">Speed</span>
          </button>
        </div>

        {/* DESKTOP PREV / NEXT CHEVRON BUTTONS (VISIBLE ON HOVER / DESKTOP) */}
        <div className="hidden md:flex flex-col gap-2 absolute left-3 bottom-28 z-20">
          <button
            disabled={!prevEpisode}
            onClick={(e) => {
              e.stopPropagation();
              goToPrevEpisode();
            }}
            aria-label="Previous episode"
            className="w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/20 transition-colors"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            disabled={!nextEpisode}
            onClick={(e) => {
              e.stopPropagation();
              goToNextEpisode();
            }}
            aria-label="Next episode"
            className="w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/20 transition-colors"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* BOTTOM METADATA & CONTROLS */}
        <div className="relative z-20 p-4 pb-safe bg-gradient-to-t from-black via-black/80 to-transparent">
          {/* Episode Info */}
          <div className="mb-3 max-w-[calc(100%-60px)]">
            <h2 className="text-base font-bold text-white leading-snug drop-shadow-md">
              {currentVideo.title}
            </h2>
            <p className="mt-1 text-xs text-zinc-300 line-clamp-2 leading-relaxed">
              {currentVideo.episodeSynopsis || currentVideo.description || 'Watch the next twist unfold in this Kenyan micro drama.'}
            </p>
          </div>

          {/* Episode Drawer Trigger & Progress */}
          <div className="flex items-center justify-between gap-3">
            {/* Open Drawer Pill */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDrawerOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shadow-md"
            >
              <ListVideo className="w-4 h-4 text-red-500" />
              <span>Episodes ({currentIndex + 1}/{siblingEpisodes.length})</span>
            </button>

            {/* Quick Next Episode Button */}
            {nextEpisode ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextEpisode();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-lg transition-transform active:scale-95"
              >
                <span>Ep. {nextEpisode.episode || currentIndex + 2}</span>
                <Play className="w-3.5 h-3.5 fill-white" />
              </button>
            ) : (
              <span className="text-[11px] text-zinc-500 italic">Season Finale</span>
            )}
          </div>

          {/* Continuous Progress Bar */}
          <div className="w-full bg-zinc-800 h-1 rounded-full mt-3 overflow-hidden cursor-pointer">
            <div
              className="bg-red-600 h-full transition-all duration-200"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* SLIDE-UP EPISODE DRAWER / BOTTOM SHEET */}
        {isDrawerOpen && (
          <div
            className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200"
            onClick={() => setIsDrawerOpen(false)}
          >
            <div
              className="bg-zinc-950 border-t border-zinc-800 rounded-t-3xl max-h-[75vh] flex flex-col w-full shadow-2xl animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Handle & Header */}
              <div className="flex flex-col items-center pt-3 pb-2 px-4 border-b border-zinc-900">
                <div className="w-10 h-1 bg-zinc-700 rounded-full mb-3" />
                <div className="w-full flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {currentVideo.seriesTitle || currentVideo.title}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Season {currentVideo.season || 1} · {siblingEpisodes.length} Episodes
                    </p>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1 rounded-full text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Episode List */}
              <div className="overflow-y-auto p-4 space-y-2.5 no-scrollbar">
                {siblingEpisodes.map((ep, idx) => {
                  const isCurrent = ep.id === currentVideo.id;
                  const epNum = ep.episode || idx + 1;

                  return (
                    <button
                      key={ep.id}
                      ref={isCurrent ? activeEpRef : undefined}
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onPlayEpisode(ep);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${isCurrent ? 'bg-red-950/40 border border-red-800/60 shadow-md shadow-red-900/30' : 'bg-zinc-900/60 border border-zinc-800/40 hover:bg-zinc-900'}`}
                    >
                      {/* Episode Poster with Now Playing Indicator */}
                      <div className="relative w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                        <CatalogueArtwork
                          src={ep.thumbnail}
                          className="w-full h-full object-cover"
                        />
                        {isCurrent && (
                          <div className="absolute inset-0 bg-red-600/50 flex items-center justify-center">
                            <Play className="w-5 h-5 fill-white text-white" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1 rounded bg-black/80 text-white">
                          {ep.duration || '2:00'}
                        </span>
                      </div>

                      {/* Episode Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[11px] font-bold ${isCurrent ? 'text-red-400' : 'text-zinc-400'}`}>
                            EPISODE {epNum}
                          </span>
                          {isFreeVideo(ep) && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-600/90 text-white font-black uppercase tracking-wider">
                              FREE
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-600 text-white font-semibold">
                              Playing
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white truncate">{ep.title}</h4>
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-snug">
                          {ep.episodeSynopsis || ep.description || 'Watch now on TubeTV.'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
        {/* PAYWALL OVERLAY FOR LOCKED EPISODES */}
        {!isUnlocked && (
          <MicroDramaPaywall
            video={currentVideo}
            isAuthenticated={isAuthenticated}
            onRequireLogin={onRequireLogin}
            onUnlocked={() => {
              setIsUnlocked(true);
              showToast('Episode unlocked! Enjoy the twist.');
            }}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
