import React, { useRef, useEffect, useState } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Music2, ExternalLink, Volume2, VolumeX, Play } from 'lucide-react';
import { ShortVideo } from '../types';
import { MOCK_SHORTS } from '../constants';

// Sample vertical-friendly videos for demo purposes
const SAMPLE_VIDEOS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
];

interface ShortsPlayerProps {
  shorts?: ShortVideo[];
}

const ShortsPlayer: React.FC<ShortsPlayerProps> = ({ shorts = MOCK_SHORTS }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, []);

  // Set initial active ID if none
  useEffect(() => {
    if (!activeId && shorts.length > 0) {
      setActiveId(shorts[0].id);
    }
  }, [activeId, shorts]);

  return (
    <div className="h-[calc(100vh-64px)] md:h-screen w-full flex justify-center bg-black overflow-hidden relative">
      <div 
        ref={containerRef}
        className="h-full w-full md:w-[450px] overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth"
      >
        {shorts.map((short, index) => (
          <ShortItem 
            key={short.id} 
            short={short} 
            isActive={activeId === short.id}
            videoSrc={short.videoUrl || SAMPLE_VIDEOS[index % SAMPLE_VIDEOS.length]}
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
}

const ShortItem: React.FC<ShortItemProps> = ({ short, isActive, videoSrc }) => {
    const [liked, setLiked] = useState(false);
    const [isMuted, setIsMuted] = useState(true); // Default to muted for better autoplay support
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Sync play/pause with active state
    useEffect(() => {
        if (isActive) {
            const playPromise = videoRef.current?.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        setIsPlaying(true);
                    })
                    .catch((error) => {
                        console.log("Autoplay prevented:", error);
                        // If autoplay prevented, ensure muted and try again
                        if (videoRef.current) {
                            videoRef.current.muted = true;
                            setIsMuted(true);
                            videoRef.current.play()
                                .then(() => setIsPlaying(true))
                                .catch(e => console.error("Playback failed even after mute:", e));
                        }
                    });
            }
        } else {
            videoRef.current?.pause();
            setIsPlaying(false);
            if (videoRef.current) {
                videoRef.current.currentTime = 0; // Reset loop when scrolling away
            }
        }
    }, [isActive]);

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

    return (
        <div 
            className="short-item-wrapper snap-start h-full w-full relative bg-zinc-900 border-b border-zinc-800 flex items-center justify-center overflow-hidden"
            data-id={short.id}
            onClick={togglePlay}
        >
            {/* Video Player */}
            <video
                ref={videoRef}
                src={videoSrc}
                className="absolute inset-0 w-full h-full object-contain"
                loop
                muted={isMuted}
                playsInline
                poster={short.url} // Use the image as a poster
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
                        <button onClick={(e) => e.stopPropagation()} className="p-3 rounded-full bg-zinc-800/50 backdrop-blur-md text-white hover:bg-zinc-700/50 transition-colors">
                            <MessageCircle className="w-8 h-8" />
                        </button>
                        <span className="text-xs font-medium">{short.comments}</span>
                    </div>

                    <button onClick={(e) => e.stopPropagation()} className="p-3 rounded-full bg-zinc-800/50 backdrop-blur-md text-white hover:bg-zinc-700/50 transition-colors">
                        <Share2 className="w-8 h-8" />
                    </button>

                     <button onClick={(e) => e.stopPropagation()} className="p-3 rounded-full bg-zinc-800/50 backdrop-blur-md text-white hover:bg-zinc-700/50 transition-colors">
                        <MoreHorizontal className="w-8 h-8" />
                    </button>
                </div>

                {/* Bottom Info */}
                <div className="max-w-[80%] space-y-3 pb-4 pointer-events-auto">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-bold text-sm">
                            {short.author[1].toUpperCase()}
                        </div>
                        <h3 className="font-bold text-lg hover:underline cursor-pointer">{short.author}</h3>
                        {!short.isAd && <button className="text-xs bg-white text-black px-3 py-1 rounded-full font-bold ml-2">Subscribe</button>}
                    </div>
                    
                    <p className="text-sm md:text-base text-zinc-100 line-clamp-2">
                        {short.description}
                    </p>

                    {short.isAd && (
                         <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                            Shop Now <ExternalLink size={16} />
                         </button>
                    )}

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