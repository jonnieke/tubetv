import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Music2, ExternalLink, Volume2, VolumeX, Play, Sparkles } from 'lucide-react';
import { ShortVideo, Video } from '../types';
import { MOCK_SHORTS } from '../constants';
import Hls from 'hls.js';
import ShortsComments from './ShortsComments';

// Sample vertical-friendly videos for demo purposes
const SAMPLE_VIDEOS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
];

interface ShortsPlayerProps {
  shorts?: ShortVideo[];
  recommendedVideos?: Video[];
  onLoginRequest?: () => void;
}

const ShortsPlayer: React.FC<ShortsPlayerProps> = ({
  shorts = MOCK_SHORTS,
  recommendedVideos = [],
  onLoginRequest
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build feed: inject recommended shorts every 3 regular shorts
  const feed = useMemo<ShortVideo[]>(() => {
    const recShorts: ShortVideo[] = recommendedVideos.map(v => ({
      id: `rec-${v.id}`,
      url: v.thumbnail,
      title: v.title,
      author: v.author,
      description: v.description || '',
      category: v.category,
      likes: Math.floor(v.views / 10) + 12,
      comments: Math.floor(v.views / 100) + 2,
      videoUrl: v.url,
      isRecommended: true,
    }));

    if (recShorts.length === 0) return shorts;

    const result: ShortVideo[] = [];
    shorts.forEach((s, i) => {
      result.push(s);
      // Insert a recommended short after every 3rd regular short
      if ((i + 1) % 3 === 0 && recShorts.length > 0) {
        result.push(recShorts[(Math.floor(i / 3)) % recShorts.length]);
      }
    });
    return result;
  }, [shorts, recommendedVideos]);

  useEffect(() => {
    const options = {
      root: containerRef.current,
      threshold: 0.6, // Video must be 60% visible to be considered active
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.getAttribute('data-id'));
        }
      });
    }, options);

    const elements = containerRef.current?.querySelectorAll('.short-item-wrapper');
    elements?.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [feed]);

  // Set initial active ID if none
  useEffect(() => {
    if (!activeId && feed.length > 0) {
      setActiveId(feed[0].id);
    }
  }, [activeId, feed]);

  return (
    <div className="h-[calc(100vh-64px)] md:h-screen w-full flex justify-center bg-black overflow-hidden relative">
      <div
        ref={containerRef}
        className="h-full w-full md:w-[450px] overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth"
      >
        {feed.map((short, index) => (
            <ShortItem
              key={short.id}
              short={short}
              isActive={activeId === short.id}
              videoSrc={short.videoUrl || SAMPLE_VIDEOS[index % SAMPLE_VIDEOS.length]}
              onLoginRequest={onLoginRequest}
            />
        ))}
      </div>
    </div>
  );
};

interface ShortItemProps {
    short: ShortVideo;
    isActive: boolean;
    videoSrc: string;
    onLoginRequest?: () => void;
}

const ShortItem: React.FC<ShortItemProps> = ({ short, isActive, videoSrc, onLoginRequest }) => {
    const [liked, setLiked] = useState(false);
    const [isMuted, setIsMuted] = useState(true); // Default to muted for better autoplay support
    const [isPlaying, setIsPlaying] = useState(false);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    // Sync play/pause with active state
    useEffect(() => {
        if (!videoRef.current) return;

        if (isActive) {
            // Initialize HLS if needed
            if (Hls.isSupported() && videoSrc.endsWith('.m3u8')) {
                if (hlsRef.current) hlsRef.current.destroy();
                
                const hls = new Hls();
                hls.loadSource(videoSrc);
                hls.attachMedia(videoRef.current);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoRef.current?.play().then(() => setIsPlaying(true)).catch(e => console.error("HLS Play failed:", e));
                });
                hlsRef.current = hls;
            } else if (!videoRef.current.src || videoRef.current.src !== videoSrc) {
                // Native playback
                videoRef.current.src = videoSrc;
                videoRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error("Native Play failed:", e));
            } else {
                videoRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error("Resume Play failed:", e));
            }
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
            videoRef.current.currentTime = 0;
            
            // We keep HLS attached to avoid re-buffering on small scrolls, 
            // but for shorts we might want to destroy to save resources
        }
    }, [isActive, videoSrc]);

    // Cleanup HLS on unmount
    useEffect(() => {
        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }
        };
    }, []);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
            } else {
                videoRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const shareData = {
            title: 'Watch this on Tube TV',
            text: short.description,
            url: window.location.href,
        };

        if (navigator.share) {
            navigator.share(shareData).catch(console.error);
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    };

    const handleComment = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsCommentsOpen(true);
    };

    return (
        <div 
            className="short-item-wrapper snap-start h-full w-full relative bg-zinc-900 border-b border-zinc-800 flex items-center justify-center overflow-hidden"
            data-id={short.id}
            onClick={togglePlay}
        >
            {/* Video Player */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain"
                loop
                muted={isMuted}
                playsInline
                poster={short.url}
            />

            {/* Play/Pause Center Indicator */}
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none bg-black/20">
                    <div className="bg-black/40 p-4 rounded-full backdrop-blur-sm">
                        <Play className="w-8 h-8 text-white fill-white" />
                    </div>
                </div>
            )}
            
            {/* Ad Overlay */}
            {short.isAd && (
                <div className="absolute top-4 right-4 bg-yellow-500/90 text-black font-bold px-2 py-1 text-xs rounded uppercase tracking-wider z-20">
                    Sponsored
                </div>
            )}

            {/* Mute Button */}
            <div className="absolute top-4 left-4 z-20">
                 <button 
                    onClick={toggleMute}
                    className="p-2 bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
                 >
                     {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                 </button>
            </div>

            {/* Content Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90 flex flex-col justify-end p-6 z-10 pointer-events-none">
                
                {/* Right Side Actions (Pointer events enabled for buttons) */}
                <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 pointer-events-auto">
                    <div className="flex flex-col items-center gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
                            className={`p-3 rounded-full bg-zinc-800/50 backdrop-blur-md transition-all active:scale-90 ${liked ? 'text-red-500' : 'text-white'}`}
                        >
                            <Heart className={`w-8 h-8 ${liked ? 'fill-current' : ''}`} />
                        </button>
                        <span className="text-xs font-medium">{liked ? short.likes + 1 : short.likes}</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <button onClick={handleComment} className="p-3 rounded-full bg-zinc-800/50 backdrop-blur-md text-white hover:bg-zinc-700/50 transition-colors pointer-events-auto">
                            <MessageCircle className="w-8 h-8" />
                        </button>
                        <span className="text-xs font-medium">{short.comments}</span>
                    </div>

                    <button onClick={handleShare} className="p-3 rounded-full bg-zinc-800/50 backdrop-blur-md text-white hover:bg-zinc-700/50 transition-colors pointer-events-auto">
                        <Share2 className="w-8 h-8" />
                    </button>

                     <button onClick={(e) => e.stopPropagation()} className="p-3 rounded-full bg-zinc-800/50 backdrop-blur-md text-white hover:bg-zinc-700/50 transition-colors">
                        <MoreHorizontal className="w-8 h-8" />
                    </button>
                </div>

                {/* Bottom Info */}
                <div className="max-w-[80%] space-y-2 pb-4 pointer-events-auto">
                    {/* Category + Recommended badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {short.isRecommended && (
                            <span className="flex items-center gap-1 text-[10px] font-black bg-gradient-to-r from-violet-600 to-purple-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wide shadow">
                                <Sparkles size={9} /> For You
                            </span>
                        )}
                        {short.category && (
                            <span className="text-[10px] font-bold bg-white/15 backdrop-blur text-white px-2.5 py-0.5 rounded-full border border-white/20">
                                {short.category}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h3 className="font-black text-lg leading-tight line-clamp-2">
                        {short.title || short.description}
                    </h3>

                    {/* Description — only shown if different from title */}
                    {short.description && short.title && short.description !== short.title && (
                        <p className="text-sm text-zinc-300 line-clamp-2">
                            {short.description}
                        </p>
                    )}

                    {!short.isAd && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onLoginRequest?.(); }}
                            className="text-xs bg-white text-black px-4 py-1.5 rounded-full font-bold pointer-events-auto"
                        >
                            Subscribe
                        </button>
                    )}

                    {short.isAd && (
                        <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                            Shop Now <ExternalLink size={16} />
                        </button>
                    )}

                    {!short.isAd && (
                        <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-800/40 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
                            <Music2 size={14} className="animate-spin-slow" />
                            <span>Original Sound — Tube TV</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Comments Overlay */}
            <ShortsComments 
                isOpen={isCommentsOpen} 
                onClose={() => setIsCommentsOpen(false)} 
                shortId={short.id}
                commentCount={short.comments}
            />
        </div>
    );
};

export default ShortsPlayer;