import React, { useState, useRef } from 'react';
import { Play, Zap, VolumeX } from 'lucide-react';
import { ShortVideo } from '../types';

interface ShortsShelfProps {
    shorts: ShortVideo[];
    onShortClick: () => void;
}

const ShortItem: React.FC<{ short: ShortVideo; onShortClick: () => void; index: number }> = ({ short, onShortClick, index }) => {
    const [isHovering, setIsHovering] = useState(false);
    const [shouldPlay, setShouldPlay] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Sample video for preview (vertical-ish aspect ratio content)
    // Using a reliable sample video that mimics vertical content
    const PREVIEW_VIDEO = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

    const handleMouseEnter = () => {
        setIsHovering(true);
        // Delay playback to avoid triggering while just scrolling past
        timerRef.current = setTimeout(() => {
            setShouldPlay(true);
        }, 600); 
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
        setShouldPlay(false);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    };

    return (
        <div 
            onClick={onShortClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="flex-shrink-0 w-[160px] md:w-[200px] h-[280px] md:h-[350px] relative rounded-xl overflow-hidden cursor-pointer group snap-start ring-1 ring-white/10 shadow-lg bg-zinc-900"
            style={{ animationDelay: `${index * 50}ms` }}
        >
             {/* Video Layer - Only renders when shouldPlay is true */}
             {shouldPlay ? (
                <div className="absolute inset-0 z-10 animate-in fade-in duration-500 bg-black">
                    <video
                        ref={videoRef}
                        src={short.videoUrl || PREVIEW_VIDEO}
                        className="w-full h-full object-contain opacity-80"
                        autoPlay
                        muted
                        loop
                        playsInline
                    />
                     {/* Mute Icon indicator */}
                    <div className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white/80 backdrop-blur-sm z-20">
                         <VolumeX size={14} />
                    </div>
                </div>
             ) : (
                /* Image Layer */
                <img 
                    src={short.url} 
                    alt={short.description} 
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110 absolute inset-0 z-0"
                />
             )}
            
            {/* Gradient Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90 transition-opacity z-20 pointer-events-none ${shouldPlay ? 'opacity-60' : 'opacity-80 group-hover:opacity-90'}`} />
            
            {/* Play Icon on Hover (Only show if not playing yet) */}
            {!shouldPlay && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform scale-50 group-hover:scale-100 z-30 pointer-events-none">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-xl">
                        <Play className="w-5 h-5 text-white fill-current ml-1" />
                        </div>
                </div>
            )}

            {/* Metadata */}
            <div className="absolute bottom-0 left-0 p-3 w-full transform transition-transform duration-300 translate-y-2 group-hover:translate-y-0 z-30 pointer-events-none">
                {short.isAd && (
                    <span className="bg-yellow-500 text-black px-1.5 rounded text-[10px] font-bold mb-1 inline-block">AD</span>
                )}
                <p className="text-white font-bold text-sm line-clamp-1 leading-tight drop-shadow-md">
                    {short.title || short.description}
                </p>
                {short.description && short.title && short.description !== short.title && (
                    <p className="text-zinc-300 text-xs line-clamp-2 leading-snug mt-0.5 drop-shadow">
                        {short.description}
                    </p>
                )}
                <p className="text-zinc-500 text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(short.likes / 1000).toFixed(1)}K likes
                </p>
            </div>
        </div>
    );
};

const ShortsShelf: React.FC<ShortsShelfProps> = ({ shorts, onShortClick }) => {
    return (
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center justify-between mb-4 px-1">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2 group cursor-pointer" onClick={onShortClick}>
                    <span className="text-red-500 text-2xl group-hover:scale-125 transition-transform"><Zap className="fill-current" /></span> 
                    Shorts & Stories
                </h2>
                <button 
                  onClick={onShortClick}
                  className="text-zinc-400 text-sm hover:text-white transition-colors font-medium"
                >
                    View All
                </button>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x scroll-pl-4">
                {shorts.map((short, index) => (
                    <ShortItem key={short.id} short={short} onShortClick={onShortClick} index={index} />
                ))}
            </div>
        </div>
    );
};

export default ShortsShelf;