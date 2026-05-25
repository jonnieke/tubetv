
import React, { useState, useRef, useEffect, memo } from 'react';
import { Play, Pause, Clock, Plus, Check, Volume2, VolumeX, Maximize, PictureInPicture, Settings, Loader2, Captions, Share2, Sparkles, Download, ThumbsUp, ThumbsDown, MessageCircle, ListVideo, Crown } from 'lucide-react';
import ShareSheet from './ShareSheet';
import { canNativeShare, nativeShare, buildShareUrl, buildShareText } from '../lib/share';
import { onThumbError } from '../lib/thumbnail';
import { Video, Caption } from '../types';
import { generateCaptions } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import { getProgress, saveProgress } from '../lib/watchProgress';
import { useResolvedQuality } from '../lib/networkQuality';
import { recordWatchTime, saveOffline, isOfflineSaved } from '../lib/dataTracker';
import { recordHistory } from '../lib/watchHistory';
import { getRating, toggleRating, Rating } from '../lib/videoRatings';
import { getCommentCount } from '../lib/videoComments';
import CommentsModal from './CommentsModal';
import { isInQueue, addToQueue, removeFromQueue as removeFromQueueLib } from '../lib/videoQueue';
import { recordPlay } from '../lib/pwa';
// HLS type only — runtime class is loaded lazily on first play
import type HlsType from 'hls.js';

// ─── Lazy HLS loader — fetches the class once, caches in module scope ─────────
let _HlsClass: typeof HlsType | undefined;
const loadHls = async (): Promise<typeof HlsType> => {
  if (!_HlsClass) {
    const mod = await import('hls.js');
    _HlsClass = mod.default as typeof HlsType;
  }
  return _HlsClass;
};

const recordView = async (videoId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('video_views').insert({
      video_id: videoId,
      viewer_id: user?.id ?? null,
    });
  } catch {
    // Non-fatal — analytics failure must never interrupt playback
  }
};

interface VideoCardProps {
  video: Video;
  isWatchLater?: boolean;
  onToggleWatchLater?: (id: string) => void;
  /** Whether the current user has an active premium subscription */
  isSubscribed?: boolean;
  /** Called when a locked video is clicked by a non-subscriber */
  onSubscribeRequest?: () => void;
  /** Navigate to a creator's channel page */
  onCreatorClick?: (name: string) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isWatchLater = false,
  onToggleWatchLater,
  isSubscribed = false,
  onSubscribeRequest,
  onCreatorClick,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isPiP, setIsPiP] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState('Auto');
  const [isBuffering, setIsBuffering] = useState(false);
  const [isHoverPlay, setIsHoverPlay] = useState(false);
  const hoverTimerRef = useRef<any>(null);
  const lastClickTimeRef = useRef<number>(0);
  const saveThrottleRef = useRef<number>(0);

  // Saved watch progress for this video (shown as progress bar on thumbnail)
  const [savedPercent, setSavedPercent] = useState<number>(() => getProgress(video.id)?.percent ?? 0);
  
  // Caption States
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [showCaptions, setShowCaptions] = useState(false);
  const [currentCaption, setCurrentCaption] = useState<string>('');
  const [isLoadingCaptions, setIsLoadingCaptions] = useState(false);

  const [isOffline, setIsOffline] = useState<boolean>(() => isOfflineSaved(video.id));
  const [isCaching, setIsCaching] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [rating, setRating] = useState<Rating>(() => getRating(video.id));
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(() => getCommentCount(video.id));
  const [inQueue, setInQueue] = useState(() => isInQueue(video.id));
  const [showShare, setShowShare] = useState(false);
  // Accumulates seconds played in this session for data tracking
  const watchSecondsRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply playback speed whenever it changes
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed, isPlaying]);
  const hlsRef = useRef<HlsType | null>(null);
  // Stores a pending seek-to timestamp arriving from a deep link before the video is ready
  const seekOnPlayRef = useRef<number>(0);

  // Global bandwidth preference — updates live via window event
  const { resolved: resolvedQuality } = useResolvedQuality();
  
  // Use a sample video for demonstration if video.url is missing
  const SAMPLE_VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4";
  const videoSrc = video.url || SAMPLE_VIDEO_URL;

  const qualities = ['Auto', '1080p', '720p', '480p'];

  // Apply the global quality preference to an HLS instance
  const applyHlsQuality = (hls: HlsType, q: 'hd' | '360p') => {
    if (q === 'hd') {
      hls.currentLevel = -1; // adaptive — let HLS.js pick best
      return;
    }
    // Find highest level with height ≤ 360, or fall back to level 0 (lowest)
    const levels = hls.levels;
    if (!levels.length) return;
    let best = 0;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i].height <= 360) best = i;
    }
    hls.currentLevel = best;
  };

  // When quality preference changes while HLS is already playing, re-apply
  useEffect(() => {
    if (hlsRef.current && (isPlaying || isHoverPlay)) {
      applyHlsQuality(hlsRef.current, resolvedQuality);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedQuality]);

  // Initialize HLS — HLS.js is loaded lazily on first play (deferred bundle)
  useEffect(() => {
    const shouldPlay = isPlaying || isHoverPlay;

    if (shouldPlay && videoRef.current) {
        // If already attached and playing, just update muted state
        if (hlsRef.current && videoRef.current.src) {
           videoRef.current.muted = isHoverPlay && !isPlaying;
           return;
        }

        if (videoSrc.endsWith('.m3u8')) {
          // Load HLS.js lazily — the 161 KB chunk is fetched only on first play
          loadHls().then(HlsClass => {
            if (!videoRef.current) return;
            if (HlsClass.isSupported()) {
              if (hlsRef.current) hlsRef.current.destroy();
              const hls = new HlsClass();
              hls.loadSource(videoSrc);
              hls.attachMedia(videoRef.current);
              hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
                applyHlsQuality(hls, resolvedQuality);
                if (videoRef.current) {
                  videoRef.current.muted = isHoverPlay && !isPlaying;
                  videoRef.current.play().catch(() => {
                    setIsPlaying(false);
                    setIsHoverPlay(false);
                  });
                }
              });
              hlsRef.current = hls;
            } else {
              // HLS natively supported (Safari)
              videoRef.current.src = videoSrc;
              videoRef.current.muted = isHoverPlay && !isPlaying;
              videoRef.current.play().catch(() => { setIsPlaying(false); setIsHoverPlay(false); });
            }
          });
        } else {
             // Native playback for MP4
             if (!videoRef.current.src || videoRef.current.src !== videoSrc) {
               videoRef.current.src = videoSrc;
             }
             videoRef.current.muted = isHoverPlay && !isPlaying;
             videoRef.current.play().catch(() => {
               setIsPlaying(false);
               setIsHoverPlay(false);
             });
        }
    } else {
        if (videoRef.current) {
          videoRef.current.pause();
        }
    }

    // We don't destroy on every effect run, only on unmount
  }, [isPlaying, isHoverPlay, videoSrc]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      // Record partial watch if the user got past 5%
      const prog = getProgress(video.id);
      if (prog && prog.percent >= 5) {
        recordHistory(
          { videoId: video.id, title: video.title, thumbnail: video.thumbnail, author: video.author, duration: video.duration, category: video.category },
          false,
        );
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link: auto-play + seek when App.tsx dispatches tube-deep-link for this video
  useEffect(() => {
    const onDeepLink = (e: Event) => {
      const { videoId, timestamp } = (e as CustomEvent<{ videoId: string; timestamp: number }>).detail;
      if (videoId !== video.id) return;
      seekOnPlayRef.current = timestamp;
      setIsPlaying(true);
      recordView(video.id);
    };
    window.addEventListener('tube-deep-link', onDeepLink);
    return () => window.removeEventListener('tube-deep-link', onDeepLink);
  }, [video.id]);

  // Now-Playing Bar: emit tube-now-playing when video scrolls out of viewport while playing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && isPlaying) {
          window.dispatchEvent(new CustomEvent('tube-now-playing', {
            detail: { videoId: video.id, title: video.title, thumbnail: video.thumbnail, isPlaying: true },
          }));
        } else if (entry.isIntersecting) {
          // Back in viewport — clear the bar
          window.dispatchEvent(new CustomEvent('tube-now-playing', { detail: null }));
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isPlaying, video.id, video.title, video.thumbnail]);

  // tube-video-control: play/pause proxy from NowPlayingBar
  useEffect(() => {
    const handler = (e: Event) => {
      const { videoId, action } = (e as CustomEvent<{ videoId: string; action: 'play' | 'pause' }>).detail;
      if (videoId !== video.id) return;
      if (action === 'pause') setIsPlaying(false);
      else setIsPlaying(true);
    };
    window.addEventListener('tube-video-control', handler);
    return () => window.removeEventListener('tube-video-control', handler);
  }, [video.id]);

  // Netflix-style Hover Play logic
  useEffect(() => {
    if (isHovering && !isPlaying) {
      hoverTimerRef.current = setTimeout(() => {
        setIsHoverPlay(true);
      }, 600); // Delay to avoid accidental plays while scrolling
    } else if (!isHovering) {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setIsHoverPlay(false);
    }

    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, [isHovering, isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);

    video.addEventListener('enterpictureinpicture', onEnterPiP);
    video.addEventListener('leavepictureinpicture', onLeavePiP);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP);
      video.removeEventListener('leavepictureinpicture', onLeavePiP);
    };
  }, [isPlaying]); 

  // Handle Captions Toggle
  const toggleCaptions = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Toggle UI state
    const newState = !showCaptions;
    setShowCaptions(newState);

    // If enabling and we don't have captions yet, fetch them
    if (newState && captions.length === 0) {
      setIsLoadingCaptions(true);
      const generated = await generateCaptions(video.title, video.category);
      setCaptions(generated);
      setIsLoadingCaptions(false);
    }
  };

  // Whether this card is locked behind a premium gate
  const isPremiumLocked = video.isPremium && !isSubscribed;

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPremiumLocked) {
      onSubscribeRequest?.();
      return;
    }
    const starting = !isPlaying;
    setIsPlaying(starting);
    // Record a view the first time the user intentionally plays
    if (starting) recordView(video.id);
  };

  // Seek to a stored timestamp once the video has enough data
  const handleCanPlay = () => {
    if (seekOnPlayRef.current > 0 && videoRef.current) {
      videoRef.current.currentTime = seekOnPlayRef.current;
      seekOnPlayRef.current = 0;
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const t = isPlaying && currentTime > 5 ? Math.floor(currentTime) : 0;
    const url = buildShareUrl(video.id, t);
    const text = buildShareText(video.title, url);
    // Try the OS native share sheet first (mobile)
    if (canNativeShare()) {
      const shared = await nativeShare(video.title, text, url);
      if (shared) return;
    }
    // Fall back to our custom share sheet
    setShowShare(true);
  };

  const togglePiP = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && videoRef.current.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
      } else if ((videoRef.current as any).webkitSupportsPresentationMode && typeof (videoRef.current as any).webkitSetPresentationMode === "function") {
        // iOS Safari support
        const currentMode = (videoRef.current as any).webkitPresentationMode;
        (videoRef.current as any).webkitSetPresentationMode(currentMode === "picture-in-picture" ? "inline" : "picture-in-picture");
      } else {
        console.warn("PiP not supported on this device/browser.");
      }
    } catch (error) {
      console.error("PiP failed:", error);
    }
  };

  const toggleFullScreen = async (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    try {
      // Standard API
      if (!document.fullscreenElement && 
          !(document as any).webkitFullscreenElement && 
          !(document as any).mozFullScreenElement && 
          !(document as any).msFullscreenElement) {
        
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          await (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          await (container as any).msRequestFullscreen();
        } else if ((video as any).webkitEnterFullscreen) {
          // Critical fallback for iOS Safari which only supports fullscreen on the video element
          (video as any).webkitEnterFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error("Fullscreen toggle failed:", error);
    }
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const DOUBLE_CLICK_DELAY = 300;

    if (now - lastClickTimeRef.current < DOUBLE_CLICK_DELAY) {
      // Double click detected
      toggleFullScreen();
      lastClickTimeRef.current = 0; // Reset
    } else {
      // Single click - toggle play
      lastClickTimeRef.current = now;
      if (isPremiumLocked) {
        onSubscribeRequest?.();
      } else {
        setIsPlaying(!isPlaying);
      }
    }
  };

  const updateCaptionForTime = (time: number) => {
    if (showCaptions && captions.length > 0) {
      const active = captions.find(c => time >= c.start && time <= c.end);
      setCurrentCaption(active ? active.text : '');
    } else {
      setCurrentCaption('');
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      // Accumulate watch seconds for data tracking (exclude seeks backward)
      if (lastTimeRef.current > 0 && current > lastTimeRef.current && current - lastTimeRef.current < 3) {
        watchSecondsRef.current += current - lastTimeRef.current;
      }
      lastTimeRef.current = current;
      // Flush to data tracker every 30 seconds of real watch time
      if (watchSecondsRef.current >= 30) {
        recordWatchTime(video.id, video.title, watchSecondsRef.current, quality);
        watchSecondsRef.current = 0;
      }
      setCurrentTime(current);
      setDuration(total || 0);
      const pct = (current / total) * 100;
      setProgress(pct);
      setSavedPercent(pct);
      updateCaptionForTime(current);

      // Persist to localStorage at most once every 5 seconds
      const now = Date.now();
      if (now - saveThrottleRef.current > 5000) {
        saveProgress(video.id, current, total);
        saveThrottleRef.current = now;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setProgress(value);
    if (videoRef.current) {
      const newTime = (value / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      // Immediate caption update for better scrubbing experience
      updateCaptionForTime(newTime);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const handleQualityChange = (q: string) => {
    setQuality(q);
    setShowSettings(false);
    
    if (isPlaying && hlsRef.current) {
      setIsBuffering(true);
      
      if (q !== 'Auto') {
          // Extract the height (e.g. "720" from "720p")
          const targetHeight = parseInt(q);
          // Find the HLS level that matches this height
          const levelIndex = hlsRef.current.levels.findIndex(l => l.height === targetHeight);
          if (levelIndex !== -1) {
              hlsRef.current.currentLevel = levelIndex;
          }
      } else {
          hlsRef.current.currentLevel = -1; // -1 enables automatic adaptive bitrate
      }

      setTimeout(() => {
        setIsBuffering(false);
      }, 1000);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Category → colour mapping for badges
  const CATEGORY_COLORS: Record<string, string> = {
    Originals:  'bg-red-600/20 text-red-400 border-red-500/20',
    Education:  'bg-blue-600/20 text-blue-400 border-blue-500/20',
    Farmers:    'bg-green-600/20 text-green-400 border-green-500/20',
    Live:       'bg-purple-600/20 text-purple-400 border-purple-500/20',
    Faith:      'bg-amber-600/20 text-amber-400 border-amber-500/20',
    Diaspora:   'bg-teal-600/20 text-teal-400 border-teal-500/20',
    Shorts:     'bg-rose-600/20 text-rose-400 border-rose-500/20',
    Kids:       'bg-indigo-600/20 text-indigo-400 border-indigo-500/20',
  };
  const catClass = CATEGORY_COLORS[video.category] ?? 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30';
  const isTrending = (video.views ?? 0) >= 50000;

  // Simulate live viewer count — deterministic so it doesn't flicker on re-render
  const watchingCount = (() => {
    if (!video.views || video.views < 500) return 0;
    const base = Math.floor(video.views * 0.0018);
    const seed = video.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const jitter = Math.floor((seed % 9) * Math.max(1, base * 0.12));
    return Math.max(2, base + jitter);
  })();

  return (
    <div
      ref={containerRef}
      className="group relative bg-zinc-900 rounded-xl overflow-hidden transition-all duration-300 [@media(hover:hover)]:hover:scale-[1.04] [@media(hover:hover)]:hover:z-50 shadow-lg [@media(hover:hover)]:hover:shadow-2xl ring-1 ring-white/5 [@media(hover:hover)]:hover:ring-white/10 will-change-transform"
      style={{ contain: 'layout style paint' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setShowSettings(false);
      }}
    >
      <div
        className="relative aspect-video bg-black overflow-hidden cursor-pointer"
        onClick={() => window.dispatchEvent(new CustomEvent('tube-open-player', { detail: { videoId: video.id } }))}
      >
        {!isPlaying && !isHoverPlay && !isBuffering ? (
          <>
            <img
              src={video.thumbnail}
              alt={video.title}
              loading="lazy"
              decoding="async"
              onError={onThumbError}
              className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
            />

            {/* Always-visible bottom gradient + title overlay */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
              <div className="absolute bottom-7 left-2.5 right-10 hidden group-hover:block">
                <p className="text-white text-xs font-bold line-clamp-1 drop-shadow-lg">{video.title}</p>
              </div>
            </div>

            {/* Watch progress bar — only shown when partially watched */}
            {savedPercent > 2 && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-700/80">
                <div className="h-full bg-red-500 transition-none" style={{ width: `${savedPercent}%` }} />
              </div>
            )}

            {/* Duration Badge */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-[10px] px-1.5 py-0.5 rounded text-white font-medium flex items-center gap-1 pointer-events-none">
              <Clock size={9} />
              {video.duration}
            </div>

            {/* Trending badge */}
            {isTrending && (
              <div className="absolute top-2 right-2 pointer-events-none">
                <div className="bg-orange-600/90 text-[9px] font-black px-2 py-0.5 rounded-full text-white shadow">
                  TRENDING
                </div>
              </div>
            )}

            {/* Watching now badge */}
            {watchingCount > 0 && !isTrending && (
              <div className="absolute top-2 right-2 pointer-events-none">
                <div className="flex items-center gap-1 bg-black/70 backdrop-blur text-[9px] font-bold px-2 py-0.5 rounded-full text-white border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  {watchingCount.toLocaleString()} watching
                </div>
              </div>
            )}

            {/* Premium Badge */}
            {video.isPremium && (
              <div className="absolute top-2 left-2 pointer-events-none">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-lg flex items-center gap-1 opacity-90">
                  <Sparkles size={10} /> PREMIUM
                </div>
              </div>
            )}

            {/* Episode badge (for series) */}
            {video.episode && (
              <div className="absolute top-2 left-2 pointer-events-none">
                <div className="bg-black/70 backdrop-blur text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 text-zinc-300">
                  S{video.season ?? 1} E{video.episode}
                </div>
              </div>
            )}

            {/* Premium locked overlay — shown on hover when content is gated */}
            {isPremiumLocked && isHovering && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 backdrop-blur-sm z-10 animate-in fade-in duration-200">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center mb-0.5">
                  <Crown size={20} className="text-amber-400" />
                </div>
                <p className="text-white text-[11px] font-black tracking-wide uppercase">Premium Content</p>
                <button
                  onClick={e => { e.stopPropagation(); onSubscribeRequest?.(); }}
                  className="mt-1 flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black text-[11px] font-black rounded-full shadow-lg shadow-amber-900/30 transition-all active:scale-95"
                >
                  <Sparkles size={10} /> Unlock Premium
                </button>
              </div>
            )}

            {/* Hover Actions */}
            <div className={`absolute inset-0 flex items-center justify-center gap-3 transition-all duration-300 bg-black/40 backdrop-blur-[1px] ${
              !isPremiumLocked && isHovering ? 'opacity-100' : 'opacity-0'
            }`}>
               <button
                 onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('tube-open-player', { detail: { videoId: video.id } })); }}
                 className={`bg-white text-black rounded-full p-2.5 hover:scale-110 transition-transform shadow-xl ${isHovering ? 'scale-100' : 'scale-50'}`}
               >
                   <Play fill="black" className="w-5 h-5 ml-0.5" />
               </button>

               {onToggleWatchLater && (
                 <button
                    onClick={(e) => { e.stopPropagation(); onToggleWatchLater(video.id); }}
                    title={isWatchLater ? "Remove from Watch Later" : "Add to Watch Later"}
                    className={`rounded-full p-2.5 border-2 transition-all hover:scale-110 shadow-xl ${isHovering ? 'scale-100' : 'scale-50'}
                      ${isWatchLater
                        ? 'bg-black/50 border-green-500 text-green-500 hover:bg-green-500 hover:text-white'
                        : 'bg-black/50 border-white text-white hover:bg-white hover:text-black'
                      }`}
                 >
                    {isWatchLater ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                 </button>
               )}

               <button
                 onClick={handleShare}
                 title="Share"
                 className={`rounded-full p-2.5 border-2 border-green-500 bg-black/50 text-green-500 hover:bg-green-500 hover:text-white transition-all hover:scale-110 shadow-xl ${isHovering ? 'scale-100' : 'scale-50'}`}
               >
                 <Share2 className="w-4 h-4" />
               </button>
            </div>
          </>
        ) : (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              onTimeUpdate={handleTimeUpdate}
              onCanPlay={handleCanPlay}
              onEnded={() => {
                if (watchSecondsRef.current > 0) {
                  recordWatchTime(video.id, video.title, watchSecondsRef.current, quality);
                  watchSecondsRef.current = 0;
                }
                recordHistory(
                  { videoId: video.id, title: video.title, thumbnail: video.thumbnail, author: video.author, duration: video.duration, category: video.category },
                  true,
                );
                clearProgress(video.id);
                setSavedPercent(0);
                setIsPlaying(false);
                setIsHoverPlay(false);
                // Track plays for PWA prompt
                recordPlay();
                // Signal queue manager to advance
                window.dispatchEvent(new CustomEvent('tube-video-ended', { detail: { videoId: video.id } }));
              }}
              onClick={handleVideoClick}
              muted={isHoverPlay && !isPlaying}
              autoPlay
              loop={isHoverPlay && !isPlaying}
              playsInline
              preload="auto"
              crossOrigin="anonymous"
            />
            
            {/* Captions Overlay */}
            {showCaptions && currentCaption && (
              <div className="absolute bottom-16 left-0 right-0 text-center pointer-events-none z-20 px-4 transition-opacity duration-300">
                 <span className="inline-block bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm md:text-base leading-snug shadow-lg backdrop-blur-md font-medium tracking-wide">
                    {currentCaption}
                 </span>
              </div>
            )}

            {/* Loading Indicator for Captions */}
            {isLoadingCaptions && showCaptions && (
               <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-xs text-white flex items-center gap-2 backdrop-blur-md animate-pulse z-20">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating AI Captions...
               </div>
            )}

            {/* Buffering Indicator */}
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30 pointer-events-none">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
              </div>
            )}
            
            {/* Custom Controls Overlay */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pt-12 pb-3 transition-all duration-500 ease-out z-30 ${isHovering ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              
              {/* Seek Bar */}
              <div className="group/seek w-full h-1 bg-zinc-600 rounded-full mb-3 relative cursor-pointer hover:h-2 transition-all">
                 <input 
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                 />
                 <div 
                    className="h-full bg-red-600 rounded-full relative"
                    style={{ width: `${progress}%` }}
                 >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full scale-0 group-hover/seek:scale-100 transition-transform shadow" />
                 </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-3">
                  <button onClick={togglePlay} className="text-white hover:text-red-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -ml-1">
                    {isPlaying && !isBuffering ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>
                  
                  <div className="flex items-center gap-2 group/volume">
                    <button onClick={toggleMute} className="text-white hover:text-zinc-300">
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.1" 
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
                     onClick={async e => {
                       e.stopPropagation();
                       if (isOffline || isCaching) return;
                       // Save metadata to localStorage immediately
                       saveOffline({ id: video.id, title: video.title, thumbnail: video.thumbnail, author: video.author, duration: video.duration, category: video.category, savedAt: Date.now() });
                       setIsOffline(true);
                       // Attempt to cache the actual video file via Service Worker
                       if (video.url && navigator.serviceWorker?.controller) {
                         setIsCaching(true);
                         const onMsg = (ev: MessageEvent) => {
                           if (ev.data?.videoId === video.id && (ev.data?.type === 'VIDEO_CACHED' || ev.data?.type === 'VIDEO_CACHE_ERROR')) {
                             setIsCaching(false);
                             navigator.serviceWorker.removeEventListener('message', onMsg);
                           }
                         };
                         navigator.serviceWorker.addEventListener('message', onMsg);
                         navigator.serviceWorker.controller.postMessage({ type: 'CACHE_VIDEO', videoUrl: video.url, videoId: video.id });
                         // Safety timeout: stop spinner after 60s regardless
                         setTimeout(() => { setIsCaching(false); navigator.serviceWorker.removeEventListener('message', onMsg); }, 60000);
                       }
                     }}
                     className={`transition-colors ${isOffline ? 'text-blue-400' : isCaching ? 'text-amber-400 animate-pulse' : 'text-white hover:text-zinc-300'}`}
                     title={isOffline ? 'Saved offline' : isCaching ? 'Saving...' : 'Save for offline'}
                   >
                     {isOffline ? <Check size={18} /> : isCaching ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                   </button>

                   {/* Captions Toggle */}
                   <button 
                     onClick={toggleCaptions}
                     className={`transition-colors relative ${showCaptions ? 'text-red-500' : 'text-zinc-300 hover:text-white'}`}
                     title={showCaptions ? "Turn off Captions" : "Turn on AI Captions"}
                   >
                      <Captions size={18} />
                      {showCaptions && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full"></span>
                      )}
                   </button>

                   {/* Settings / Quality */}
                   <div className="relative">
                     <button 
                       onClick={(e) => {
                           e.stopPropagation();
                           setShowSettings(!showSettings);
                       }}
                       className={`transition-transform hover:rotate-45 ${showSettings ? 'text-white rotate-45' : 'text-zinc-300 hover:text-white'}`}
                       title="Settings"
                     >
                        <Settings size={18} />
                     </button>
                     
                     {showSettings && (
                         <div className="absolute bottom-8 right-0 bg-black/90 border border-zinc-800 rounded-lg p-2 min-w-[140px] shadow-xl animate-in fade-in zoom-in duration-200 z-50">
                             <div className="text-xs font-bold text-zinc-400 mb-2 px-2 uppercase tracking-wider">Quality</div>
                             {qualities.map(q => (
                                 <button
                                    key={q}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleQualityChange(q);
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs text-white hover:bg-zinc-800 rounded flex items-center justify-between group/item"
                                 >
                                     <span>{q}</span>
                                     {quality === q && <Check size={12} className="text-red-500" />}
                                 </button>
                             ))}
                             <div className="border-t border-zinc-800 mt-2 pt-2">
                               <div className="text-xs font-bold text-zinc-400 mb-2 px-2 uppercase tracking-wider">Speed</div>
                               {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                                 <button
                                   key={s}
                                   onClick={e => { e.stopPropagation(); setPlaybackSpeed(s); setShowSettings(false); }}
                                   className="w-full text-left px-2 py-1.5 text-xs text-white hover:bg-zinc-800 rounded flex items-center justify-between"
                                 >
                                   <span>{s === 1 ? 'Normal' : `${s}×`}</span>
                                   {playbackSpeed === s && <Check size={12} className="text-red-500" />}
                                 </button>
                               ))}
                             </div>
                         </div>
                     )}
                   </div>

                   {/* Picture in Picture */}
                   <button 
                     onClick={togglePiP}
                     className={`${isPiP ? 'text-red-500' : 'text-zinc-300 hover:text-white'} transition-colors`}
                     title="Picture in Picture"
                   >
                      <PictureInPicture size={18} />
                   </button>

                   <button 
                    onClick={toggleFullScreen}
                    className="text-white hover:text-zinc-300" 
                    title="Full Screen"
                   >
                      <Maximize size={18} />
                   </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="p-3.5">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            {video.seriesTitle && video.episode && (
              <span className="inline-flex items-center text-[9px] font-black tracking-wider bg-zinc-800 border border-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                {video.season ? `S${video.season}·E${video.episode}` : `EP${video.episode}`}
              </span>
            )}
          </div>
          <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 group-hover:text-red-400 transition-colors">{video.title}</h3>
            {/* Hover description */}
            {video.description && (
              <p className="text-zinc-500 text-[11px] leading-relaxed mt-1 line-clamp-2 hidden group-hover:block transition-all">
                {video.description}
              </p>
            )}
            <p className="text-zinc-500 text-xs mt-1 flex items-center gap-1 truncate">
              <span
                className={`truncate ${onCreatorClick && video.author && video.author !== 'Tube Creator' ? 'hover:text-white cursor-pointer underline-offset-2 hover:underline transition-colors' : ''}`}
                onClick={e => {
                  if (onCreatorClick && video.author && video.author !== 'Tube Creator') {
                    e.stopPropagation();
                    onCreatorClick(video.author);
                  }
                }}
              >{video.author}</span>
              {video.productionYear && (
                <><span className="text-zinc-700 flex-shrink-0">·</span><span className="text-zinc-600 flex-shrink-0">{video.productionYear}</span></>
              )}
            </p>
          </div>
          <button className="text-zinc-600 hover:text-white flex-shrink-0 p-1 -mt-0.5 transition-colors" title="More options">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${catClass}`}>{video.category}</span>
          <span className="text-zinc-700 text-[10px]">·</span>
          <span className="text-zinc-500 text-[10px]">
            {video.views >= 1000000
              ? `${(video.views / 1000000).toFixed(1)}M`
              : `${(video.views / 1000).toFixed(1)}K`} views
          </span>
          {quality !== 'Auto' && (
            <span className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded-full border border-red-800/30">{quality}</span>
          )}
          {/* Like / dislike / comments */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={e => { e.stopPropagation(); setRating(toggleRating(video.id, 'like')); }}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${rating === 'like' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-zinc-600 hover:text-green-400 hover:bg-green-500/10'}`}
              title="Like"
            >
              <ThumbsUp size={10} className={rating === 'like' ? 'fill-green-400' : ''} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setRating(toggleRating(video.id, 'dislike')); }}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${rating === 'dislike' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-zinc-600 hover:text-red-400 hover:bg-red-500/10'}`}
              title="Dislike"
            >
              <ThumbsDown size={10} className={rating === 'dislike' ? 'fill-red-400' : ''} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setShowComments(true); }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-zinc-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
              title="Comments"
            >
              <MessageCircle size={10} />
              {commentCount > 0 && <span>{commentCount}</span>}
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                if (inQueue) {
                  removeFromQueueLib(video.id);
                  setInQueue(false);
                } else {
                  addToQueue({ id: video.id, title: video.title, thumbnail: video.thumbnail, author: video.author, duration: video.duration });
                  setInQueue(true);
                }
              }}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${inQueue ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-zinc-600 hover:text-orange-400 hover:bg-orange-500/10'}`}
              title={inQueue ? 'Remove from queue' : 'Add to queue'}
            >
              <ListVideo size={10} />
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-zinc-600 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
              title="Share"
            >
              <Share2 size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* Share sheet */}
      {showShare && (
        <ShareSheet
          videoId={video.id}
          title={video.title}
          thumbnail={video.thumbnail}
          currentTime={currentTime}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Comments modal — portal-like, rendered outside the card */}
      {showComments && (
        <CommentsModal
          videoId={video.id}
          videoTitle={video.title}
          onClose={() => { setShowComments(false); setCommentCount(getCommentCount(video.id)); }}
        />
      )}
    </div>
  );
};

export default React.memo(VideoCard);
