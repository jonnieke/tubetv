
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Lock, Clock, Plus, Check, Volume2, VolumeX, Maximize, PictureInPicture, Settings, Loader2, Captions, Share2, Sparkles } from 'lucide-react';
import { Video } from '../types';
import { CONTENT_RATING_ENFORCED } from '../constants';
import type Hls from 'hls.js';
import { loadHls } from '../lib/hlsLoader';
import { usePlayback } from '../contexts/PlaybackContext';
import { canWatchContent, normalizeContentRating, ratingDescription } from '../lib/contentRating';
import { trackEvent } from '../lib/analytics';
import { shouldSaveData } from '../lib/network';
import { isFreeVideo } from '../lib/series';
import CatalogueArtwork from './CatalogueArtwork';

interface VideoCardProps {
  video: Video;
  nextEpisode?: Video;
  onNextEpisode?: () => void;
  isWatchLater?: boolean;
  onToggleWatchLater?: (id: string) => void;
  autoPlay?: boolean;
  playerOnly?: boolean;
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  nextEpisode,
  onNextEpisode,
  isWatchLater = false,
  onToggleWatchLater,
  autoPlay = false,
  playerOnly = false,
}) => {
  const { preferences, getProgress, onProgress, onEnded } = usePlayback();
  const contentRating = normalizeContentRating(video.contentRating);
  const isUnratedAllowedInTest = !CONTENT_RATING_ENFORCED && contentRating === 'UNRATED';
  const isRatingLocked = !isUnratedAllowedInTest && !canWatchContent(contentRating, preferences.maximumRating);
  const savedProgress = getProgress(video.id);
  const effectiveDataSaver = shouldSaveData(preferences.dataSaver);
  const preferredQuality = effectiveDataSaver ? '360p' : preferences.quality === 'auto' ? 'Auto' : preferences.quality;
  const [isPlaying, setIsPlaying] = useState(autoPlay && !isRatingLocked);
  const [isHovering, setIsHovering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isPiP, setIsPiP] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState(preferredQuality);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [isHoverPlay, setIsHoverPlay] = useState(false);
  const hoverTimerRef = useRef<any>(null);
  const lastClickTimeRef = useRef<number>(0);
  const lastProgressSaveRef = useRef(0);
  const startAtRef = useRef(performance.now());
  const startedRef = useRef(false);
  const firstFrameRef = useRef(false);
  const bufferAtRef = useRef<number | null>(null);
  const playerInstanceRef = useRef(crypto.randomUUID());
  const [showCaptions, setShowCaptions] = useState(preferences.captions);
  const introEnd = video.introEndSeconds;
  const outroStart = video.outroStartSeconds;
  const canSkipIntro = isPlaying && !isHoverPlay && Number.isFinite(introEnd) && Number(introEnd) > 0 && (duration <= 0 || Number(introEnd) < duration) && currentTime < Number(introEnd) - 1;
  const canSkipOutro = isPlaying && !isHoverPlay && Number.isFinite(outroStart) && Number(outroStart) > 0 && duration > Number(outroStart) + 1 && currentTime >= Number(outroStart) && currentTime < duration - 1;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  const hlsRef = useRef<Hls | null>(null);
  
  useEffect(() => {
    setQuality(preferredQuality);
  }, [preferredQuality]);

  useEffect(() => {
    setShowCaptions(preferences.captions);
    const track = videoRef.current?.textTracks[0];
    if (track) track.mode = preferences.captions ? 'showing' : 'hidden';
  }, [preferences.captions]);

  const videoSrc = video.url || '';

  const qualities = ['Auto', '1080p', '720p', '480p'];

  // Initialize HLS
  useEffect(() => {
    const shouldPlay = !isRatingLocked && (isPlaying || isHoverPlay);
    if (shouldPlay && !videoSrc) {
      setIsPlaying(false);
      setIsHoverPlay(false);
      return;
    }
    
    if (shouldPlay && videoRef.current) {
        // If already attached and playing, just update muted state
        if (hlsRef.current && videoRef.current.src) {
           videoRef.current.muted = isHoverPlay && !isPlaying;
           return;
        }

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
            
            const hls = new Hls();
            hls.loadSource(videoSrc);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const targetQuality = effectiveDataSaver ? '360p' : quality;
            if (targetQuality !== 'Auto') {
              const targetHeight = Number.parseInt(targetQuality, 10);
              const matchingLevel = hls.levels.reduce((best, level, index) => (
                level.height <= targetHeight && (best < 0 || level.height > hls.levels[best].height)
                  ? index : best
              ), -1);
              if (matchingLevel >= 0) hls.currentLevel = matchingLevel;
            }
                if (videoRef.current) {
                  videoRef.current.muted = isHoverPlay && !isPlaying;
                  videoRef.current.play().catch(() => {
                    setIsPlaying(false);
                    setIsHoverPlay(false);
                  });
                }
            });
            hlsRef.current = hls;
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data.fatal) return;
              setPlaybackError(true);
              setIsPlaying(false);
              setIsHoverPlay(false);
              trackEvent('playback_error', { videoId: video.id, transport: 'hls', category: video.category });
              hls.destroy();
            });
            });
        } else {
             // Native playback for MP4 or if HLS natively supported (Safari)
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
          // Clear src to allow re-init on next play if needed
          // videoRef.current.src = ""; 
        }
    }

    // We don't destroy on every effect run, only on unmount
  }, [isPlaying, isHoverPlay, videoSrc, isRatingLocked]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
        }
    };
  }, []);

  // Netflix-style Hover Play logic
  useEffect(() => {
    if (isHovering && !isPlaying && !isRatingLocked && !effectiveDataSaver) {
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
  }, [isHovering, isPlaying, isRatingLocked, effectiveDataSaver]);

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
  const toggleCaptions = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !showCaptions;
    setShowCaptions(newState);
    const track = videoRef.current?.textTracks[0];
    if (track) track.mode = newState ? 'showing' : 'hidden';
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isPlaying) {
      setPlaybackError(false);
      startAtRef.current = performance.now();
      startedRef.current = true;
      trackEvent('playback_start', { videoId: video.id, category: video.category, dataSaver: effectiveDataSaver });
    }
    setIsPlaying(!isPlaying);
  };

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const legacyText = encodeURIComponent(
      `👀 Watch "${video.title}" on Tube TV: ${window.location.origin}?v=${video.id}`
    );
    void legacyText;
    const text = encodeURIComponent(`Watch "${video.title}" on TubeTV: ${window.location.origin}/watch/${encodeURIComponent(video.id)}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
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
        } else if (video.webkitEnterFullscreen) {
          // Critical fallback for iOS Safari which only supports fullscreen on the video element
          video.webkitEnterFullscreen();
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
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setCurrentTime(current);
      setDuration(total || 0);
      setProgress((current / total) * 100);
      if (!isHoverPlay && total > 0 && current - lastProgressSaveRef.current >= 10) {
        lastProgressSaveRef.current = current;
        onProgress(video.id, {
          positionSeconds: current,
          durationSeconds: total,
          completed: current / total >= 0.95,
        });
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current || !savedProgress || savedProgress.completed) return;
    const resumeAt = Math.min(savedProgress.positionSeconds, Math.max(0, videoRef.current.duration - 2));
    if (resumeAt > 5) videoRef.current.currentTime = resumeAt;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setProgress(value);
    if (videoRef.current) {
      const newTime = (value / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
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

  return (
    <div 
      ref={containerRef}
      className={`group relative overflow-hidden ${playerOnly ? '' : 'catalogue-video-card'}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setShowSettings(false);
      }}
    >
      <div className={`relative ${video.seriesFormat === "micro-drama" || video.category === "Micro Dramas" ? "aspect-[9/16]" : "aspect-video"} bg-black overflow-hidden`}>
        {!isPlaying && !isHoverPlay && !isBuffering ? (
          <>
            <CatalogueArtwork src={video.thumbnail} className="catalogue-video-art w-full h-full object-cover" />
            
            {/* Duration Badge */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-xs px-1.5 py-0.5 rounded text-white font-medium flex items-center gap-1 pointer-events-none">
                <Clock size={10} />
                {video.duration}
            </div>

            {/* Selected Free Content Badge (Only free videos show a badge; premium shows no badge) */}
            {isFreeVideo(video) && (
              <div className="absolute top-2 left-2 rounded bg-emerald-600/95 px-2 py-0.5 text-[10px] font-black tracking-wider text-white shadow-md pointer-events-none z-10 uppercase flex items-center gap-1">
                <span>FREE</span>
              </div>
            )}

            <div className="absolute top-2 right-2 rounded bg-black/85 px-2 py-1 text-xs font-bold text-white">
              {contentRating}
            </div>

            {isRatingLocked && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/85 p-5 text-center">
                <Lock className="h-7 w-7 text-red-400" />
                <p className="font-bold">Unavailable for this profile</p>
                <p className="text-xs text-zinc-300">{ratingDescription(contentRating)}</p>
              </div>
            )}

            {/* Hover Actions (Initial Play) */}
            <div className={`catalogue-video-actions ${isRatingLocked ? 'catalogue-video-actions-locked' : ''}`}>
               <button 
                 onClick={togglePlay}
                 disabled={!videoSrc}
                 aria-label={videoSrc ? `Play ${video.title}` : `${video.title} is unavailable`}
                 className="catalogue-action-play disabled:cursor-not-allowed disabled:opacity-50"
               >
                   <Play fill="currentColor" className="w-5 h-5 ml-0.5" />
               </button>
               
               {onToggleWatchLater && (
                 <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatchLater(video.id);
                    }}
                    title={isWatchLater ? "Remove from Watch Later" : "Add to Watch Later"}
                    aria-label={isWatchLater ? `Remove ${video.title} from Watch Later` : `Add ${video.title} to Watch Later`}
                    className={`catalogue-action-secondary ${isWatchLater ? 'catalogue-action-saved' : ''}`}
                 >
                    {isWatchLater ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                 </button>
               )}

               {/* WhatsApp Share Button */}
               <button
                 onClick={handleWhatsAppShare}
                 title="Share on WhatsApp"
                 aria-label={`Share ${video.title} on WhatsApp`}
                 className="catalogue-action-secondary"
               >
                 <Share2 className="w-4 h-4" />
               </button>
            </div>
          </>
        ) : (
          <div className="relative w-full h-full">
            {(canSkipIntro || canSkipOutro) && <div className="absolute left-3 top-3 z-40 flex gap-2">
              {canSkipIntro && <button type="button" className="rounded-md border border-white/50 bg-black/80 px-3 py-2 text-xs font-semibold text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-red-500" onClick={event => { event.stopPropagation(); if (videoRef.current) videoRef.current.currentTime = Number(introEnd); }}>Skip intro</button>}
              {canSkipOutro && <button type="button" className="rounded-md border border-white/50 bg-black/80 px-3 py-2 text-xs font-semibold text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-red-500" onClick={event => {
                event.stopPropagation();
                if (nextEpisode && onNextEpisode) {
                  onProgress(video.id, { positionSeconds: duration, durationSeconds: duration, completed: true });
                  trackEvent('playback_complete', { videoId: video.id, watchSeconds: Math.round(currentTime), category: video.category, skippedOutro: true });
                  onNextEpisode();
                } else if (videoRef.current) videoRef.current.currentTime = Math.max(0, duration - 0.2);
              }}>{nextEpisode && onNextEpisode ? 'Play next episode' : 'Skip outro'}</button>}
            </div>}
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onWaiting={() => { if (firstFrameRef.current && bufferAtRef.current === null) bufferAtRef.current = performance.now(); setIsBuffering(true); }}
              onPlaying={() => {
                document.dispatchEvent(new CustomEvent('tubetv:player-start', {detail:playerInstanceRef.current}));
                setIsBuffering(false);
                if (bufferAtRef.current !== null) {
                  trackEvent('playback_buffer', { videoId: video.id, seconds: Math.round((performance.now() - bufferAtRef.current) / 1000) });
                  bufferAtRef.current = null;
                }
                if (isHoverPlay && !isPlaying) return;
                if (!startedRef.current) {
                  startedRef.current = true;
                  trackEvent('playback_start', { videoId: video.id, category: video.category, dataSaver: effectiveDataSaver });
                }
                if (!firstFrameRef.current) {
                  firstFrameRef.current = true;
                  trackEvent('playback_first_frame', { videoId: video.id, startupMs: Math.round(performance.now() - startAtRef.current), category: video.category });
                }
              }}
              onEnded={() => {
                setIsPlaying(false);
                setIsHoverPlay(false);
                const total = videoRef.current?.duration || duration;
                onProgress(video.id, {
                  positionSeconds: total,
                  durationSeconds: total,
                  completed: true,
                });
                if (!isHoverPlay) trackEvent('playback_complete', { videoId: video.id, watchSeconds: Math.round(total), category: video.category, seriesId: video.seriesId || '' });
                onEnded(video.id);
              }}
              onClick={handleVideoClick}
              muted={isHoverPlay && !isPlaying}
              autoPlay
              loop={isHoverPlay && !isPlaying}
              playsInline
              preload={effectiveDataSaver ? 'none' : 'metadata'}
              onError={() => {
                setPlaybackError(true);
                setIsPlaying(false);
                trackEvent('playback_error', { videoId: video.id, transport: videoSrc.endsWith('.m3u8') ? 'hls' : 'native', category: video.category });
              }}
              crossOrigin="anonymous" 
            >
              {video.captionsUrl && (
                <track kind="captions" src={video.captionsUrl} srcLang="en" label="English" />
              )}
            </video>

            {/* Buffering Indicator */}
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30 pointer-events-none">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
              </div>
            )}
            
            {playbackError && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 p-5 text-center">
                <p className="font-bold">This video could not load</p>
                <p className="mt-1 text-xs text-zinc-400">Check your connection and try again.</p>
                <button
                  onClick={() => { setPlaybackError(false); hlsRef.current?.destroy(); hlsRef.current = null; setIsPlaying(true); }}
                  className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:bg-zinc-200"
                >
                  Try again
                </button>
              </div>
            )}
            {/* Custom Controls Overlay */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pt-12 pb-3 transition-all duration-300 ease-out z-30 opacity-100 translate-y-0 ${isHovering ? 'md:opacity-100 md:translate-y-0' : 'md:opacity-0 md:translate-y-4'}`}>
              
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
                  <button onClick={togglePlay} className="text-white hover:text-red-500 transition-colors">
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

                   {/* Captions Toggle */}
                   <button 
                     onClick={toggleCaptions}
                     disabled={!video.captionsUrl}
                     aria-label={video.captionsUrl ? (showCaptions ? "Turn off captions" : "Turn on captions") : "Captions unavailable"}
                     className={`transition-colors relative disabled:cursor-not-allowed disabled:opacity-40 ${showCaptions ? 'text-red-500' : 'text-zinc-300 hover:text-white'}`}
                     title={video.captionsUrl ? (showCaptions ? "Turn off captions" : "Turn on captions") : "Captions unavailable"}
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
                         <div className="absolute bottom-8 right-0 bg-black/90 border border-zinc-800 rounded-lg p-2 min-w-[120px] shadow-xl animate-in fade-in zoom-in duration-200 z-50">
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

      {!playerOnly && <div className="catalogue-video-info">
        <p className="cinema-card-kicker">{video.category}{video.episode ? ` · Episode ${video.episode}` : ''}</p>
        <h3>{video.title}</h3>
        <p className="catalogue-video-creator">{video.author}</p>
      </div>}
    </div>
  );
};

export default VideoCard;
