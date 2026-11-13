import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Lock,
  Clock,
  Plus,
  Check,
  Volume2,
  VolumeX,
  Maximize,
  PictureInPicture,
  Settings,
  Loader2,
  Captions,
  Share2,
  Tv,
  Download,
} from 'lucide-react';
import { Video } from '../types';
import { CONTENT_RATING_ENFORCED } from '../constants';
import type Hls from 'hls.js';
import { loadHls } from '../lib/hlsLoader';
import { usePlayback } from '../contexts/PlaybackContext';
import { useLanguage } from '../contexts/LanguageContext';
import { canWatchContent, normalizeContentRating, ratingDescription } from '../lib/contentRating';
import { isLongFormatVideo, isVideoLocked, LONG_FORMAT_PREVIEW_SECONDS } from '../lib/monetization';
import { resolveAuthorizedPlaybackUrl } from '../lib/subscriptions';
import { isVideoSavedOffline, removeOfflineVideo, saveVideoForOfflineCommute } from '../lib/offlineCache';
import { trackEvent } from '../lib/analytics';
import { shouldSaveData } from '../lib/network';
import CatalogueArtwork from './CatalogueArtwork';

interface VideoCardProps {
  video: Video;
  nextEpisode?: Video;
  onNextEpisode?: () => void;
  isWatchLater?: boolean;
  onToggleWatchLater?: (id: string) => void;
  autoPlay?: boolean;
  playerOnly?: boolean;
  onPlay?: () => void;
  isLocked?: (video: Video) => boolean;
}

type SafariVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitSupportsPresentationMode?: boolean;
  webkitPresentationMode?: string;
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture') => void;
  webkitShowPlaybackTargetPicker?: () => void;
  remote?: {
    prompt: () => Promise<void>;
    state?: string;
  };
};

const levelShortEdge = (level: { width?: number; height?: number }): number => {
  if (level.width && level.height) return Math.min(level.width, level.height);
  return level.height || 0;
};

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  nextEpisode,
  onNextEpisode,
  isWatchLater = false,
  onToggleWatchLater,
  autoPlay = false,
  playerOnly = false,
  onPlay,
  isLocked: propIsLocked,
}) => {
  const { t } = useLanguage();
  const {
    preferences,
    getProgress,
    onProgress,
    onEnded,
    hasActivePass = false,
    isLocked,
    onRequireUnlock,
    onOpenSettings,
    onSelectVideo,
  } = usePlayback();
  const contentRating = normalizeContentRating(video.contentRating);
  const isUnratedAllowedInTest = !CONTENT_RATING_ENFORCED && contentRating === 'UNRATED' && preferences.maximumRating === '16';
  const isRatingLocked = !isUnratedAllowedInTest && !canWatchContent(contentRating, preferences.maximumRating);
  const locked = propIsLocked ? propIsLocked(video) : isLocked ? isLocked(video) : isVideoLocked(video, false);
  const requiresThirtySecondPaywall = !hasActivePass && isLongFormatVideo(video);

  const savedProgress = getProgress(video.id);
  const effectiveDataSaver = shouldSaveData(preferences.dataSaver);
  const preferredQuality = effectiveDataSaver ? '360p' : preferences.quality === 'auto' ? 'Auto' : preferences.quality;

  const canAutoStart = Boolean(autoPlay && !isRatingLocked && !locked);
  const [isPlaying, setIsPlaying] = useState(canAutoStart);
  const [hasActivatedPlayback, setHasActivatedPlayback] = useState(
    Boolean(canAutoStart && !isRatingLocked && !locked),
  );
  const [authorizedSrc, setAuthorizedSrc] = useState<string>(video.url || '');
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState<number>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('tubetv_player_volume');
        if (stored !== null) {
          const parsed = parseFloat(stored);
          if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
            return parsed;
          }
        }
      }
    } catch {
      // fallback
    }
    return 0.35;
  });
  const [isPiP, setIsPiP] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState(preferredQuality);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [isHoverPlay, setIsHoverPlay] = useState(false);

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const lastProgressSaveRef = useRef(0);
  const startAtRef = useRef(performance.now());
  const startedRef = useRef(false);
  const firstFrameRef = useRef(false);
  const bufferAtRef = useRef<number | null>(null);
  const playerInstanceRef = useRef(crypto.randomUUID());
  const authFetchedRef = useRef<string | null>(null);
  const qualifiedViewFiredRef = useRef<boolean>(false);

  const [showCaptions, setShowCaptions] = useState(preferences.captions);
  const [captionLang, setCaptionLang] = useState<'en' | 'sw' | 'fr' | 'off'>(preferences.captions ? 'en' : 'off');
  const [savedOffline, setSavedOffline] = useState<boolean>(() => isVideoSavedOffline(video.id));
  const [savingOffline, setSavingOffline] = useState<boolean>(false);
  const introEnd = video.introEndSeconds;
  const outroStart = video.outroStartSeconds;
  const canSkipIntro =
    isPlaying &&
    !isHoverPlay &&
    Number.isFinite(introEnd) &&
    Number(introEnd) > 0 &&
    (duration <= 0 || Number(introEnd) < duration) &&
    currentTime < Number(introEnd) - 1;
  const canSkipOutro =
    isPlaying &&
    !isHoverPlay &&
    Number.isFinite(outroStart) &&
    Number(outroStart) > 0 &&
    duration > Number(outroStart) + 1 &&
    currentTime >= Number(outroStart) &&
    currentTime < duration - 1;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const rawVideoSrc = video.url || '';
  const activeVideoSrc = authorizedSrc || rawVideoSrc;
  const isBunnyGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(video.id);
  const hasPlayableSource = Boolean(rawVideoSrc || authorizedSrc || isBunnyGuid);
  const qualities = ['Auto', '1080p', '720p', '480p', '360p'];

  useEffect(() => {
    setAuthorizedSrc(video.url || '');
    authFetchedRef.current = null;
    qualifiedViewFiredRef.current = false;
    setSavedOffline(isVideoSavedOffline(video.id));
  }, [video.id, video.url]);

  useEffect(() => {
    const syncOffline = () => setSavedOffline(isVideoSavedOffline(video.id));
    window.addEventListener('tubetv:offline-updated', syncOffline);
    window.addEventListener('tubetv:pass-updated', syncOffline);
    return () => {
      window.removeEventListener('tubetv:offline-updated', syncOffline);
      window.removeEventListener('tubetv:pass-updated', syncOffline);
    };
  }, [video.id]);

  const handleToggleOfflineSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (locked || requiresThirtySecondPaywall) {
      onRequireUnlock?.(video);
      return;
    }
    if (savedOffline) {
      await removeOfflineVideo(video.id);
      setSavedOffline(false);
      return;
    }
    try {
      setSavingOffline(true);
      await saveVideoForOfflineCommute(video);
      setSavedOffline(true);
    } catch {
      onRequireUnlock?.(video);
    } finally {
      setSavingOffline(false);
    }
  };

  useEffect(() => {
    const pauseOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail === playerInstanceRef.current) return;
      setIsPlaying(false);
      setIsHoverPlay(false);
      videoRef.current?.pause();
    };
    document.addEventListener('tubetv:player-start', pauseOther);
    return () => document.removeEventListener('tubetv:player-start', pauseOther);
  }, []);

  useEffect(() => {
    setQuality(preferredQuality);
  }, [preferredQuality]);

  useEffect(() => {
    setShowCaptions(preferences.captions);
    const track = videoRef.current?.textTracks[0];
    if (track) track.mode = preferences.captions ? 'showing' : 'hidden';
  }, [preferences.captions]);

  // Auto-hide touch controls after 3.5s during active playback
  const bumpControlsVisibility = () => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isPlaying && !showSettings) {
      controlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    }
  };

  useEffect(() => {
    if (!isPlaying || showSettings) {
      setControlsVisible(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      return;
    }
    controlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3500);
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [isPlaying, showSettings]);

  // Authorize playback URL when full, modal, or hover playback activates
  useEffect(() => {
    if ((!hasActivatedPlayback && !isHoverPlay && !playerOnly) || isRatingLocked || locked) return;
    if (authFetchedRef.current === video.id) return;
    authFetchedRef.current = video.id;

    if (!authorizedSrc && !video.url) {
      setIsAuthorizing(true);
    }
    const requiresEntitlement = isVideoLocked(video, false);
    void resolveAuthorizedPlaybackUrl(video.id, video.url, requiresEntitlement)
      .then((res) => {
        setIsAuthorizing(false);
        if (res.locked) {
          setIsPlaying(false);
          setIsHoverPlay(false);
          setHasActivatedPlayback(false);
          onRequireUnlock?.(video);
          return;
        }
        if (res.url) {
          if (hlsRef.current && res.url !== authorizedSrc) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          setAuthorizedSrc(res.url);
        } else if (!video.url) {
          authFetchedRef.current = 'failed';
        }
      })
      .catch(() => {
        authFetchedRef.current = 'failed';
        setIsAuthorizing(false);
      });
  }, [hasActivatedPlayback, isHoverPlay, playerOnly, isRatingLocked, locked, video, authorizedSrc, onRequireUnlock]);

  // Attach and control media playback without unmounting on pause
  useEffect(() => {
    let cancelled = false;

    if (isRatingLocked || locked) {
      setIsPlaying(false);
      setIsHoverPlay(false);
      setHasActivatedPlayback(false);
      videoRef.current?.pause();
      return;
    }

    const shouldPlay = isPlaying || isHoverPlay;
    if (shouldPlay && !activeVideoSrc) {
      if (isAuthorizing || (isBunnyGuid && authFetchedRef.current !== 'failed')) {
        // Wait for resolveAuthorizedPlaybackUrl to finish populating authorizedSrc
        return;
      }
      setIsPlaying(false);
      setIsHoverPlay(false);
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (!shouldPlay) {
      videoEl.pause();
      if (!hasActivatedPlayback) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        setIsBuffering(false);
      }
      return;
    }

    const wantMuted = isHoverPlay && !isPlaying ? true : isMuted;
    videoEl.muted = wantMuted;
    videoEl.volume = volume;

    // Resume already-initialized stream instead of re-creating HLS on pause -> play!
    if (hlsRef.current) {
      hlsRef.current.startLoad();
      videoEl.play().catch(() => {
        if (!cancelled) {
          setIsPlaying(false);
          setIsHoverPlay(false);
        }
      });
      return;
    }

    const isHlsPlaylist = /\.m3u8(\?|$)/i.test(activeVideoSrc);
    const hasMse =
      typeof window !== 'undefined' &&
      ('MediaSource' in window || 'ManagedMediaSource' in (window as unknown as Record<string, unknown>));

    if (isHlsPlaylist && !hasMse && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari / iOS HLS path without downloading hls.js
      if (videoEl.src !== activeVideoSrc) {
        videoEl.src = activeVideoSrc;
      }
      videoEl.play().catch(() => {
        if (!cancelled) {
          setIsPlaying(false);
          setIsHoverPlay(false);
        }
      });
      return;
    }

    if (isHlsPlaylist) {
      void loadHls().then((Hls) => {
        if (cancelled || !videoRef.current) return;
        const currentEl = videoRef.current;

        if (!Hls.isSupported()) {
          currentEl.src = activeVideoSrc;
          currentEl.play().catch(() => {
            if (!cancelled) {
              setIsPlaying(false);
              setIsHoverPlay(false);
            }
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
          backBufferLength: 15,
          maxBufferLength: effectiveDataSaver ? 15 : 30,
          maxMaxBufferLength: effectiveDataSaver ? 30 : 60,
          maxBufferSize: (effectiveDataSaver ? 12 : 30) * 1000 * 1000,
          maxBufferHole: 0.5,
          nudgeOffset: 0.2,
          nudgeMaxRetry: 5,
          capLevelToPlayerSize: true,
          abrEwmaDefaultEstimate: effectiveDataSaver ? 350_000 : 600_000,
          startLevel: 0,
          fragLoadingTimeOut: 12000,
          fragLoadingMaxRetry: 4,
          levelLoadingTimeOut: 8000,
          manifestLoadingTimeOut: 8000,
        });
        hlsRef.current = hls;
        hls.loadSource(activeVideoSrc);
        hls.attachMedia(currentEl);
        hls.on(Hls.Events.BUFFER_STALLED, () => {
          hls.startLoad();
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled || !videoRef.current) {
            hls.destroy();
            return;
          }
          const targetQuality = effectiveDataSaver ? '360p' : quality;
          if (targetQuality !== 'Auto') {
            const targetRes = Number.parseInt(targetQuality, 10);
            const matchingLevel = hls.levels.reduce((best, level, index) => {
              const res = levelShortEdge(level);
              const bestRes = best >= 0 ? levelShortEdge(hls.levels[best]) : 0;
              return res > 0 && res <= targetRes && (best < 0 || res > bestRes) ? index : best;
            }, -1);
            if (matchingLevel >= 0) {
              if (effectiveDataSaver) {
                hls.autoLevelCapping = matchingLevel;
              } else {
                hls.currentLevel = matchingLevel;
              }
            } else if (effectiveDataSaver && hls.levels.length > 0) {
              hls.autoLevelCapping = 0;
            }
          }
          videoRef.current.muted = isHoverPlay && !isPlaying ? true : isMuted;
          videoRef.current.play().catch(() => {
            if (!cancelled) {
              setIsPlaying(false);
              setIsHoverPlay(false);
            }
          });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || cancelled) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.warn('HLS network error, recovering stream...', data);
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.warn('HLS media error, recovering stream...', data);
            hls.recoverMediaError();
            return;
          }
          setPlaybackError(true);
          setIsPlaying(false);
          setIsHoverPlay(false);
          trackEvent('playback_error', { videoId: video.id, transport: 'hls', category: video.category });
          hls.destroy();
          if (hlsRef.current === hls) hlsRef.current = null;
        });
      });
    } else {
      if (!videoEl.src || videoEl.src !== activeVideoSrc) {
        videoEl.src = activeVideoSrc;
      }
      videoEl.play().catch(() => {
        if (!cancelled) {
          setIsPlaying(false);
          setIsHoverPlay(false);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [isPlaying, isHoverPlay, isAuthorizing, activeVideoSrc, isRatingLocked, locked]);

  useEffect(() => {
    if (autoPlay && !isRatingLocked && !locked) {
      setHasActivatedPlayback(true);
      setIsPlaying(true);
    }
  }, [autoPlay, isRatingLocked, locked]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (cardClickTimerRef.current) clearTimeout(cardClickTimerRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Hover preview only for unlocked catalogue cards before user explicitly plays/pauses
  useEffect(() => {
    if (
      isHovering &&
      !playerOnly &&
      !hasActivatedPlayback &&
      !isPlaying &&
      !isRatingLocked &&
      !locked &&
      !effectiveDataSaver
    ) {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        setIsHoverPlay(true);
      }, 650);
    } else {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      if (!isHovering && !hasActivatedPlayback && !isPlaying) {
        setIsHoverPlay(false);
        setIsBuffering(false);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      }
    }

    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, [isHovering, playerOnly, hasActivatedPlayback, isPlaying, isRatingLocked, locked, effectiveDataSaver]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);

    videoEl.addEventListener('enterpictureinpicture', onEnterPiP);
    videoEl.addEventListener('leavepictureinpicture', onLeavePiP);

    return () => {
      videoEl.removeEventListener('enterpictureinpicture', onEnterPiP);
      videoEl.removeEventListener('leavepictureinpicture', onLeavePiP);
    };
  }, [hasActivatedPlayback]);

  const toggleCaptions = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !showCaptions;
    setShowCaptions(newState);
    setCaptionLang(newState ? (captionLang === 'off' ? 'en' : captionLang) : 'off');
    const tracks = videoRef.current?.textTracks;
    if (tracks && tracks.length > 0) {
      for (let i = 0; i < tracks.length; i += 1) {
        tracks[i].mode = newState && i === 0 ? 'showing' : 'hidden';
      }
    }
  };

  const handleSelectCaptionLanguage = (lang: 'en' | 'sw' | 'fr' | 'off') => {
    setCaptionLang(lang);
    const enable = lang !== 'off';
    setShowCaptions(enable);
    const tracks = videoRef.current?.textTracks;
    if (tracks && tracks.length > 0) {
      for (let i = 0; i < tracks.length; i += 1) {
        const match = tracks[i].language === lang || (i === 0 && enable);
        tracks[i].mode = enable && match ? 'showing' : 'hidden';
      }
    }
  };

  const stopCardHoverPreview = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHoverPlay(false);
    setIsPlaying(false);
    videoRef.current?.pause();
  };

  const handleCatalogueCardDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRatingLocked) return;
    if (locked) {
      onRequireUnlock?.(video);
      return;
    }
    if (!playerOnly && onSelectVideo) {
      if (cardClickTimerRef.current) {
        clearTimeout(cardClickTimerRef.current);
        cardClickTimerRef.current = null;
      }
      lastClickTimeRef.current = 0;
      stopCardHoverPreview();
      onSelectVideo(video, { autoPlay: true });
    }
  };

  const handleCatalogueCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRatingLocked) return;
    if (locked) {
      onRequireUnlock?.(video);
      return;
    }

    if (!playerOnly && onSelectVideo) {
      const now = Date.now();
      if (now - lastClickTimeRef.current < 320) {
        if (cardClickTimerRef.current) {
          clearTimeout(cardClickTimerRef.current);
          cardClickTimerRef.current = null;
        }
        lastClickTimeRef.current = 0;
        stopCardHoverPreview();
        onSelectVideo(video, { autoPlay: true });
        return;
      }

      lastClickTimeRef.current = now;
      if (cardClickTimerRef.current) {
        clearTimeout(cardClickTimerRef.current);
      }
      cardClickTimerRef.current = setTimeout(() => {
        cardClickTimerRef.current = null;
        stopCardHoverPreview();
        onSelectVideo(video, { autoPlay: false });
      }, 220);
      return;
    }

    togglePlay(e);
  };

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isRatingLocked) return;
    if (locked) {
      onRequireUnlock?.(video);
      return;
    }

    if (!isPlaying) {
      document.dispatchEvent(new CustomEvent('tubetv:player-start', { detail: playerInstanceRef.current }));
      setPlaybackError(false);
      setIsHoverPlay(false);
      setHasActivatedPlayback(true);
      if (!startedRef.current) {
        startAtRef.current = performance.now();
        startedRef.current = true;
        trackEvent('playback_start', { videoId: video.id, category: video.category, dataSaver: effectiveDataSaver });
      }
      setIsPlaying(true);
      onPlay?.();
      bumpControlsVisibility();
    } else {
      setIsPlaying(false);
      setControlsVisible(true);
    }
  };

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = encodeURIComponent(
      `Watch "${video.title}" on TubeTV: ${window.location.origin}/watch/${encodeURIComponent(video.id)}`,
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
  };

  const handleCastToTv = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const videoEl = videoRef.current as SafariVideoElement | null;
    if (!videoEl) return;

    try {
      if (typeof videoEl.webkitShowPlaybackTargetPicker === 'function') {
        videoEl.webkitShowPlaybackTargetPicker();
        return;
      }
      if (videoEl.remote && typeof videoEl.remote.prompt === 'function') {
        await videoEl.remote.prompt();
        return;
      }
    } catch (err) {
      console.warn('Cast / AirPlay prompt closed or unavailable:', err);
    }
  };

  const togglePiP = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const videoEl = videoRef.current as SafariVideoElement | null;
    if (!videoEl) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && videoEl.requestPictureInPicture) {
        await videoEl.requestPictureInPicture();
      } else if (videoEl.webkitSupportsPresentationMode && typeof videoEl.webkitSetPresentationMode === 'function') {
        const currentMode = videoEl.webkitPresentationMode;
        videoEl.webkitSetPresentationMode(currentMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
      }
    } catch (error) {
      console.error('PiP failed:', error);
    }
  };

  const toggleFullScreen = async (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    const container = containerRef.current;
    const videoEl = videoRef.current as SafariVideoElement | null;
    if (!container || !videoEl) return;

    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => Promise<void>;
      };
      const el = container as HTMLDivElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };

      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (typeof videoEl.webkitEnterFullscreen === 'function') {
          videoEl.webkitEnterFullscreen();
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error);
    }
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (locked) {
      onRequireUnlock?.(video);
      return;
    }

    if (!playerOnly && onSelectVideo) {
      handleCatalogueCardClick(e);
      return;
    }

    const now = Date.now();
    if (now - lastClickTimeRef.current < 300) {
      lastClickTimeRef.current = 0;
      if (!isPlaying) {
        togglePlay(e);
      } else {
        void toggleFullScreen();
      }
      return;
    }
    lastClickTimeRef.current = now;

    // On touch screens, if controls are hidden while playing, tap reveals controls first
    const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (isCoarsePointer && isPlaying && !controlsVisible) {
      bumpControlsVisibility();
      return;
    }

    if (!isPlaying) {
      togglePlay(e);
      return;
    }

    setIsPlaying(false);
  };

  const saveCurrentProgress = (completedOverride?: boolean) => {
    if (isHoverPlay || !videoRef.current) return;
    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration;
    if (!Number.isFinite(total) || total <= 0 || current <= 0) return;
    lastProgressSaveRef.current = current;
    onProgress(video.id, {
      positionSeconds: current,
      durationSeconds: total,
      completed: completedOverride ?? current / total >= 0.95,
    });
  };

  const triggerThirtySecondPaywall = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      try {
        videoRef.current.currentTime = 0;
      } catch {
        // Ignore seek error
      }
    }
    setCurrentTime(0);
    setProgress(0);
    setIsPlaying(false);
    setIsHoverPlay(false);
    setHasActivatedPlayback(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    onRequireUnlock?.(video);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration;

    // Enforce 30-second free preview for all long-format videos on both hover-play and click-to-play
    if (requiresThirtySecondPaywall && current >= LONG_FORMAT_PREVIEW_SECONDS) {
      triggerThirtySecondPaywall();
      return;
    }

    setCurrentTime(current);
    setDuration(total || 0);
    setProgress(total > 0 ? (current / total) * 100 : 0);
    if (!isHoverPlay && total > 0 && Math.abs(current - lastProgressSaveRef.current) >= 10) {
      saveCurrentProgress();
    }

    // Share of Play: 30-Second Minimum Qualified View (QV)
    if (!isHoverPlay && !qualifiedViewFiredRef.current && current >= 30) {
      qualifiedViewFiredRef.current = true;
      trackEvent('qualified_view', {
        videoId: video.id,
        author: video.author || 'Creator',
        seriesTitle: video.seriesTitle || '',
        episode: video.episode || 1,
        category: video.category,
        watchSeconds: Math.round(current),
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tubetv:qualified-view', {
            detail: { videoId: video.id, author: video.author, watchSeconds: Math.round(current) },
          })
        );
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
    if (!videoRef.current || !savedProgress || savedProgress.completed) return;
    if (requiresThirtySecondPaywall && savedProgress.positionSeconds >= LONG_FORMAT_PREVIEW_SECONDS - 2) {
      videoRef.current.currentTime = 0;
      return;
    }
    const resumeAt = Math.min(savedProgress.positionSeconds, Math.max(0, videoRef.current.duration - 2));
    if (resumeAt > 5) videoRef.current.currentTime = resumeAt;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    bumpControlsVisibility();
    if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
      const newTime = (value / 100) * videoRef.current.duration;
      if (requiresThirtySecondPaywall && newTime >= LONG_FORMAT_PREVIEW_SECONDS) {
        triggerThirtySecondPaywall();
        return;
      }
      setProgress(value);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted) {
        videoRef.current.volume = volume || 0.35;
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = parseFloat(e.target.value);
    setVolume(val);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tubetv_player_volume', String(val));
      }
    } catch {
      // ignore
    }
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleQualityChange = (q: string) => {
    setQuality(q);
    setShowSettings(false);

    if (hlsRef.current) {
      setIsBuffering(true);
      if (q !== 'Auto') {
        const targetRes = parseInt(q, 10);
        const matchingIndex = hlsRef.current.levels.reduce((best, level, index) => {
          const res = levelShortEdge(level);
          const bestRes = best >= 0 ? levelShortEdge(hlsRef.current!.levels[best]) : 0;
          return res > 0 && res <= targetRes && (best < 0 || res > bestRes) ? index : best;
        }, -1);
        if (matchingIndex !== -1) {
          hlsRef.current.currentLevel = matchingIndex;
        }
      } else {
        hlsRef.current.currentLevel = -1;
      }

      setTimeout(() => {
        setIsBuffering(false);
      }, 600);
    }
  };

  const formatTime = (time: number) => {
    if (!Number.isFinite(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const isActivelyPlaying = hasActivatedPlayback || isPlaying;
  const isActivelyHoveringPreview = isHovering && isHoverPlay;
  const showVideoStage =
    !isRatingLocked && !locked && (isActivelyPlaying || isActivelyHoveringPreview);

  return (
    <div
      ref={containerRef}
      onClick={!playerOnly && onSelectVideo ? handleCatalogueCardClick : undefined}
      onDoubleClick={!playerOnly && onSelectVideo ? handleCatalogueCardDoubleClick : undefined}
      className={`group relative overflow-hidden ${playerOnly ? '' : 'catalogue-video-card cursor-pointer'}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseMove={() => {
        if (isHovering && isPlaying) bumpControlsVisibility();
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        setShowSettings(false);
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        if (!hasActivatedPlayback && !isPlaying) {
          setIsHoverPlay(false);
          setIsBuffering(false);
          setIsAuthorizing(false);
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          if (videoRef.current) {
            videoRef.current.pause();
            try {
              videoRef.current.currentTime = 0;
            } catch {
              // Ignore pause/seek error
            }
          }
        }
      }}
    >
      <div
        className={`relative ${
          video.seriesFormat === 'micro-drama' || video.category === 'Micro Dramas' ? 'aspect-[9/16]' : 'aspect-video'
        } bg-black overflow-hidden`}
      >
        {!showVideoStage ? (
          <div
            onClick={playerOnly ? togglePlay : (!playerOnly && onSelectVideo ? handleCatalogueCardClick : undefined)}
            onDoubleClick={playerOnly ? togglePlay : (!playerOnly && onSelectVideo ? handleCatalogueCardDoubleClick : undefined)}
            className={`w-full h-full relative ${playerOnly ? 'cursor-pointer' : ''}`}
          >
            <CatalogueArtwork src={video.thumbnail} className="catalogue-video-art w-full h-full object-cover" />

            {/* Duration Badge */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-xs px-1.5 py-0.5 rounded text-white font-medium flex items-center gap-1 pointer-events-none">
              <Clock size={10} />
              {video.duration}
            </div>

            <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
              <div className="rounded bg-black/85 px-2 py-1 text-xs font-bold text-white">{contentRating}</div>
            </div>

            {isRatingLocked && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/85 p-5 text-center">
                <Lock className="h-7 w-7 text-red-400" />
                <p className="font-bold text-white">{t('player.ratingLockedTitle')}</p>
                <p className="text-xs text-zinc-300">{ratingDescription(contentRating)}</p>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSettings();
                    }}
                    className="mt-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
                  >
                    {t('player.openSettings')}
                  </button>
                )}
              </div>
            )}

            {/* Hover / Tap Actions */}
            <div
              onClick={playerOnly ? togglePlay : (!playerOnly && onSelectVideo ? handleCatalogueCardClick : undefined)}
              onDoubleClick={playerOnly ? togglePlay : (!playerOnly && onSelectVideo ? handleCatalogueCardDoubleClick : undefined)}
              className={`catalogue-video-actions ${playerOnly || (!playerOnly && onSelectVideo) ? 'cursor-pointer' : ''} ${
                isRatingLocked ? 'catalogue-video-actions-locked' : ''
              } ${playerOnly ? '!opacity-100 flex items-center justify-center' : ''}`}
            >
              <button
                type="button"
                onClick={playerOnly ? togglePlay : (!playerOnly && onSelectVideo ? handleCatalogueCardClick : togglePlay)}
                onDoubleClick={playerOnly ? togglePlay : (!playerOnly && onSelectVideo ? handleCatalogueCardDoubleClick : undefined)}
                disabled={!hasPlayableSource && !locked}
                aria-label={
                  locked
                    ? `${t('player.unlockWithMpesa')}: ${video.title}`
                    : hasPlayableSource
                      ? `Play ${video.title}`
                      : `${video.title} is unavailable`
                }
                className={
                  playerOnly
                    ? 'flex h-16 w-16 items-center justify-center rounded-full bg-red-600/90 hover:bg-red-600 text-white shadow-2xl hover:scale-110 transition-transform cursor-pointer'
                    : 'catalogue-action-play disabled:cursor-not-allowed disabled:opacity-50'
                }
              >
                {locked ? <Lock className="w-6 h-6" /> : <Play fill="currentColor" className="w-6 h-6 ml-0.5" />}
              </button>

              {!playerOnly && onToggleWatchLater && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWatchLater(video.id);
                  }}
                  title={isWatchLater ? 'Remove from Watch Later' : 'Add to Watch Later'}
                  aria-label={
                    isWatchLater ? `Remove ${video.title} from Watch Later` : `Add ${video.title} to Watch Later`
                  }
                  className={`catalogue-action-secondary ${isWatchLater ? 'catalogue-action-saved' : ''}`}
                >
                  {isWatchLater ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
              )}

              {!playerOnly && (
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  title="Share on WhatsApp"
                  aria-label={`Share ${video.title} on WhatsApp`}
                  className="catalogue-action-secondary"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full">
            {requiresThirtySecondPaywall && (isPlaying || isHoverPlay) && (
              <div className="absolute right-3 top-3 z-40 pointer-events-none">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black shadow-lg">
                  <Lock size={10} />
                  Preview · {Math.max(1, Math.ceil(LONG_FORMAT_PREVIEW_SECONDS - currentTime))}s left
                </span>
              </div>
            )}

            {(canSkipIntro || canSkipOutro) && (
              <div className="absolute left-3 top-3 z-40 flex gap-2">
                {canSkipIntro && (
                  <button
                    type="button"
                    className="rounded-md border border-white/50 bg-black/80 px-3 py-2 text-xs font-semibold text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-red-500"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (requiresThirtySecondPaywall && Number(introEnd) >= LONG_FORMAT_PREVIEW_SECONDS) {
                        triggerThirtySecondPaywall();
                        return;
                      }
                      if (videoRef.current) videoRef.current.currentTime = Number(introEnd);
                    }}
                  >
                    Skip intro
                  </button>
                )}
                {canSkipOutro && (
                  <button
                    type="button"
                    className="rounded-md border border-white/50 bg-black/80 px-3 py-2 text-xs font-semibold text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-red-500"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (nextEpisode && onNextEpisode) {
                        onProgress(video.id, { positionSeconds: duration, durationSeconds: duration, completed: true });
                        trackEvent('playback_complete', {
                          videoId: video.id,
                          watchSeconds: Math.round(currentTime),
                          category: video.category,
                          skippedOutro: true,
                        });
                        onNextEpisode();
                      } else if (videoRef.current) {
                        videoRef.current.currentTime = Math.max(0, duration - 0.2);
                      }
                    }}
                  >
                    {nextEpisode && onNextEpisode ? 'Play next episode' : 'Skip outro'}
                  </button>
                )}
              </div>
            )}

            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              poster={video.thumbnail}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPause={() => {
                saveCurrentProgress();
              }}
              onWaiting={() => {
                if (hlsRef.current) {
                  hlsRef.current.startLoad();
                }
                if (firstFrameRef.current && bufferAtRef.current === null) bufferAtRef.current = performance.now();
                if (isPlaying || (isHovering && isHoverPlay)) {
                  setIsBuffering(true);
                }
              }}
              onPlaying={() => {
                document.dispatchEvent(new CustomEvent('tubetv:player-start', { detail: playerInstanceRef.current }));
                setIsBuffering(false);
                onPlay?.();
                if (bufferAtRef.current !== null) {
                  trackEvent('playback_buffer', {
                    videoId: video.id,
                    seconds: Math.round((performance.now() - bufferAtRef.current) / 1000),
                  });
                  bufferAtRef.current = null;
                }
                if (isHoverPlay && !isPlaying) return;
                if (!startedRef.current) {
                  startedRef.current = true;
                  trackEvent('playback_start', {
                    videoId: video.id,
                    category: video.category,
                    dataSaver: effectiveDataSaver,
                  });
                }
                if (!firstFrameRef.current) {
                  firstFrameRef.current = true;
                  trackEvent('playback_first_frame', {
                    videoId: video.id,
                    startupMs: Math.round(performance.now() - startAtRef.current),
                    category: video.category,
                  });
                }
              }}
              onEnded={() => {
                setIsPlaying(false);
                setIsHoverPlay(false);
                setControlsVisible(true);
                const total = videoRef.current?.duration || duration;
                onProgress(video.id, {
                  positionSeconds: total,
                  durationSeconds: total,
                  completed: true,
                });
                if (!isHoverPlay) {
                  trackEvent('playback_complete', {
                    videoId: video.id,
                    watchSeconds: Math.round(total),
                    category: video.category,
                    seriesId: video.seriesId || '',
                  });
                  // If short video completed without reaching 30s threshold, award Qualified View on full completion
                  if (!qualifiedViewFiredRef.current && (total >= 15 || total >= (duration || 0) * 0.9)) {
                    qualifiedViewFiredRef.current = true;
                    trackEvent('qualified_view', {
                      videoId: video.id,
                      author: video.author || 'Creator',
                      seriesTitle: video.seriesTitle || '',
                      episode: video.episode || 1,
                      category: video.category,
                      watchSeconds: Math.round(total),
                    });
                  }
                }
                onEnded(video.id);
              }}
              onClick={handleVideoClick}
              muted={isHoverPlay && !isPlaying ? true : isMuted}
              autoPlay
              loop={isHoverPlay && !isPlaying}
              playsInline
              preload={playerOnly || isPlaying ? 'auto' : effectiveDataSaver ? 'none' : 'metadata'}
              onError={() => {
                setPlaybackError(true);
                setIsPlaying(false);
                trackEvent('playback_error', {
                  videoId: video.id,
                  transport: /\.m3u8(\?|$)/i.test(activeVideoSrc) ? 'hls' : 'native',
                  category: video.category,
                });
              }}
              crossOrigin={video.captionsUrl ? 'anonymous' : undefined}
            >
              {video.captionsUrl && <track kind="captions" src={video.captionsUrl} srcLang="en" label="English" />}
            </video>

            {/* Paused Center Resume Button */}
            {!isPlaying && !isHoverPlay && !playbackError && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label={`Play ${video.title}`}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 transition-opacity cursor-pointer"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600/90 hover:bg-red-600 text-white shadow-2xl hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                </span>
              </button>
            )}

            {/* Buffering / Authorizing Indicator */}
            {(isBuffering || isAuthorizing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30 pointer-events-none">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
              </div>
            )}

            {playbackError && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 p-5 text-center">
                <p className="font-bold text-white">This video could not load</p>
                <p className="mt-1 text-xs text-zinc-400">Check your connection and try again.</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlaybackError(false);
                    hlsRef.current?.destroy();
                    hlsRef.current = null;
                    authFetchedRef.current = null;
                    setHasActivatedPlayback(true);
                    setIsPlaying(true);
                  }}
                  className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:bg-zinc-200"
                >
                  {t('common.tryAgain')}
                </button>
              </div>
            )}

            {/* Custom Controls Overlay (only in modal/full player; on catalogue cards, keep card surface clickable) */}
            {(playerOnly || !onSelectVideo) && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pt-12 pb-3 transition-all duration-300 ease-out z-30 ${
                controlsVisible || !isPlaying
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-3 pointer-events-none'
              } ${
                isHovering || !isPlaying
                  ? 'md:opacity-100 md:translate-y-0 md:pointer-events-auto'
                  : 'md:opacity-0 md:translate-y-4 md:pointer-events-none'
              }`}
            >
              {/* Seek Bar */}
              <div className="group/seek w-full h-1.5 bg-zinc-600 rounded-full mb-3 relative cursor-pointer hover:h-2 transition-all">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  aria-label="Seek video"
                  value={Number.isFinite(progress) ? progress : 0}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div
                  className="h-full bg-red-600 rounded-full relative"
                  style={{ width: `${Math.min(100, Math.max(0, progress || 0))}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full scale-0 group-hover/seek:scale-100 transition-transform shadow" />
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="text-white hover:text-red-500 transition-colors"
                  >
                    {isPlaying && !isBuffering ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                  </button>

                  <div className="flex items-center gap-2 group/volume">
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                      className="text-white hover:text-zinc-300"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      aria-label="Volume"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-0 overflow-hidden group-hover/volume:w-16 transition-all duration-300 h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>

                  <span className="text-xs text-zinc-300 font-medium font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {onToggleWatchLater && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchLater(video.id);
                      }}
                      className={`transition-colors ${isWatchLater ? 'text-green-500' : 'text-white hover:text-zinc-300'}`}
                      title="Watch Later"
                    >
                      {isWatchLater ? <Check size={18} /> : <Plus size={18} />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleCaptions}
                    disabled={!video.captionsUrl}
                    aria-label={
                      video.captionsUrl ? (showCaptions ? 'Turn off captions' : 'Turn on captions') : 'Captions unavailable'
                    }
                    className={`transition-colors relative disabled:cursor-not-allowed disabled:opacity-40 ${
                      showCaptions ? 'text-red-500' : 'text-zinc-300 hover:text-white'
                    }`}
                    title={
                      video.captionsUrl ? (showCaptions ? 'Turn off captions' : 'Turn on captions') : 'Captions unavailable'
                    }
                  >
                    <Captions size={18} />
                    {showCaptions && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full" />
                    )}
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettings(!showSettings);
                      }}
                      className={`transition-transform hover:rotate-45 ${
                        showSettings ? 'text-white rotate-45' : 'text-zinc-300 hover:text-white'
                      }`}
                      title="Quality"
                      aria-label="Quality settings"
                    >
                      <Settings size={18} />
                    </button>

                    {showSettings && (
                      <div className="absolute bottom-8 right-0 bg-black/95 border border-zinc-800 rounded-lg p-2 min-w-[155px] shadow-xl animate-in fade-in zoom-in duration-200 z-50">
                        <div className="text-[10px] font-bold text-zinc-400 mb-1.5 px-2 uppercase tracking-wider">Quality</div>
                        {qualities.map((q) => (
                          <button
                            type="button"
                            key={q}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQualityChange(q);
                            }}
                            className="w-full text-left px-2 py-1 text-xs text-white hover:bg-zinc-800 rounded flex items-center justify-between"
                          >
                            <span>{q}</span>
                            {quality === q && <Check size={12} className="text-red-500" />}
                          </button>
                        ))}
                        <div className="border-t border-zinc-800 my-1.5" />
                        <div className="text-[10px] font-bold text-zinc-400 mb-1 px-2 uppercase tracking-wider">Subtitles</div>
                        {[
                          { id: 'off', label: 'Off' },
                          { id: 'en', label: 'English' },
                          { id: 'sw', label: 'Kiswahili' },
                          { id: 'fr', label: 'Français' },
                        ].map((sub) => (
                          <button
                            type="button"
                            key={sub.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCaptionLanguage(sub.id as 'en' | 'sw' | 'fr' | 'off');
                            }}
                            className="w-full text-left px-2 py-1 text-xs text-white hover:bg-zinc-800 rounded flex items-center justify-between"
                          >
                            <span>{sub.label}</span>
                            {captionLang === sub.id && <Check size={12} className="text-emerald-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleOfflineSave}
                    disabled={savingOffline}
                    className={`transition-colors ${
                      savedOffline ? 'text-emerald-400' : 'text-zinc-300 hover:text-white'
                    }`}
                    title={savedOffline ? 'Saved for Offline Commute (Click to remove)' : 'Save Offline for Commute'}
                    aria-label={savedOffline ? 'Remove offline video' : 'Save video for offline commute'}
                  >
                    {savingOffline ? (
                      <Loader2 size={17} className="animate-spin text-emerald-400" />
                    ) : (
                      <Download size={17} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCastToTv}
                    className="text-zinc-300 hover:text-white transition-colors"
                    title="Cast to TV / AirPlay"
                    aria-label="Cast to TV or AirPlay"
                  >
                    <Tv size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={togglePiP}
                    className={`${isPiP ? 'text-red-500' : 'text-zinc-300 hover:text-white'} transition-colors`}
                    title="Picture in Picture"
                    aria-label="Picture in Picture"
                  >
                    <PictureInPicture size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={toggleFullScreen}
                    className="text-white hover:text-zinc-300"
                    title="Full Screen"
                    aria-label="Full Screen"
                  >
                    <Maximize size={18} />
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
        )}
      </div>

      {!playerOnly && (
        <div
          onClick={onSelectVideo ? handleCatalogueCardClick : undefined}
          onDoubleClick={onSelectVideo ? handleCatalogueCardDoubleClick : undefined}
          className={`catalogue-video-info ${onSelectVideo ? 'cursor-pointer' : ''}`}
        >
          <p className="cinema-card-kicker">
            {video.category}
            {video.genre ? ` · ${video.genre}` : ''}
            {video.episode ? ` · Episode ${video.episode}` : ''}
          </p>
          <h3>{video.title}</h3>
          <p className="catalogue-video-creator">{video.author}</p>
        </div>
      )}
    </div>
  );
};

export default VideoCard;
