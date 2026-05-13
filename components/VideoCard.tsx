
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Clock, Plus, Check, Volume2, VolumeX, Maximize, PictureInPicture, Settings, Loader2, Captions, Share2, Sparkles } from 'lucide-react';
import { Video, Caption } from '../types';
import { generateCaptions } from '../services/geminiService';
import { supabase } from '../lib/supabase';
import Hls from 'hls.js';

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
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isWatchLater = false,
  onToggleWatchLater,
  isSubscribed = false,
  onSubscribeRequest,
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
  
  // Caption States
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [showCaptions, setShowCaptions] = useState(false);
  const [currentCaption, setCurrentCaption] = useState<string>('');
  const [isLoadingCaptions, setIsLoadingCaptions] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  // Use a sample video for demonstration if video.url is missing
  const SAMPLE_VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4";
  const videoSrc = video.url || SAMPLE_VIDEO_URL;

  const qualities = ['Auto', '1080p', '720p', '480p'];

  // Initialize HLS
  useEffect(() => {
    const shouldPlay = isPlaying || isHoverPlay;
    
    if (shouldPlay && videoRef.current) {
        // If already attached and playing, just update muted state
        if (hlsRef.current && videoRef.current.src) {
           videoRef.current.muted = isHoverPlay && !isPlaying;
           return;
        }

        if (Hls.isSupported() && videoSrc.endsWith('.m3u8')) {
            if (hlsRef.current) hlsRef.current.destroy();
            
            const hls = new Hls();
            hls.loadSource(videoSrc);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
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
  }, [isPlaying, isHoverPlay, videoSrc]);

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

  const handleWhatsAppShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = encodeURIComponent(
      `👀 Watch "${video.title}" on Tube TV: ${window.location.origin}?v=${video.id}`
    );
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
      setCurrentTime(current);
      setDuration(total || 0);
      setProgress((current / total) * 100);

      updateCaptionForTime(current);
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

  return (
    <div
      ref={containerRef}
      className="group relative bg-zinc-900 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.04] hover:z-50 shadow-lg hover:shadow-2xl ring-1 ring-white/5 hover:ring-white/10"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setShowSettings(false);
      }}
    >
      <div className="relative aspect-video bg-black overflow-hidden">
        {!isPlaying && !isHoverPlay && !isBuffering ? (
          <>
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
            />

            {/* Always-visible bottom gradient + title overlay */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
              <div className="absolute bottom-7 left-2.5 right-10 hidden group-hover:block">
                <p className="text-white text-xs font-bold line-clamp-1 drop-shadow-lg">{video.title}</p>
              </div>
            </div>

            {/* Progress Bar Mock */}
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-zinc-800">
              <div className="h-full bg-red-600 w-1/3" />
            </div>

            {/* Duration Badge */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-[10px] px-1.5 py-0.5 rounded text-white font-medium flex items-center gap-1 pointer-events-none">
              <Clock size={9} />
              {video.duration}
            </div>

            {/* Trending badge */}
            {isTrending && (
              <div className="absolute top-2 right-2 pointer-events-none">
                <div className="bg-orange-600/90 text-[9px] font-black px-2 py-0.5 rounded-full text-white shadow flex items-center gap-1">
                  🔥 TRENDING
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

            {/* Hover Actions */}
            <div className={`absolute inset-0 flex items-center justify-center gap-3 transition-all duration-300 bg-black/40 backdrop-blur-[1px] ${
              !isPremiumLocked && isHovering ? 'opacity-100' : 'opacity-0'
            }`}>
               <button
                 onClick={togglePlay}
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
                 onClick={handleWhatsAppShare}
                 title="Share on WhatsApp"
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
              onEnded={() => {
                setIsPlaying(false);
                setIsHoverPlay(false);
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

      {/* Info panel */}
      <div className="p-3.5">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 group-hover:text-red-400 transition-colors">{video.title}</h3>
            {/* Hover description */}
            {video.description && (
              <p className="text-zinc-500 text-[11px] leading-relaxed mt-1 line-clamp-2 hidden group-hover:block transition-all">
                {video.description}
              </p>
            )}
            <p className="text-zinc-500 text-xs mt-1 flex items-center gap-1 truncate">
              <span className="truncate">{video.author}</span>
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
        </div>
      </div>
    </div>
  );
};

export default React.memo(VideoCard);
