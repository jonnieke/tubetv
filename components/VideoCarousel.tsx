import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Video } from '../types';
import VideoCard from './VideoCard';

interface VideoCarouselProps {
  title: string;
  subtitle?: string;
  accentColor?: string; // tailwind gradient stop, e.g. 'from-red-500 to-orange-500'
  videos: Video[];
  onToggleWatchLater: (id: string) => void;
  watchLaterIds: string[];
  isAuthenticated: boolean;
  cardWidth?: number; // px, default 300
}

const VideoCarousel: React.FC<VideoCarouselProps> = ({
  title,
  subtitle,
  accentColor = 'from-red-500 to-orange-500',
  videos,
  onToggleWatchLater,
  watchLaterIds,
  isAuthenticated,
  cardWidth = 300,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75,
      behavior: 'smooth',
    });
  };

  if (videos.length === 0) return null;

  return (
    <div className="mb-10 group/carousel relative">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <div className="flex items-center gap-3">
          <div className={`w-1 h-6 bg-gradient-to-b ${accentColor} rounded-full flex-shrink-0`} />
          <div>
            <h2 className="text-lg md:text-xl font-black text-white leading-tight">{title}</h2>
            {subtitle && <p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <button className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors group/see">
          See All
          <ChevronRight size={12} className="group-hover/see:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <div className="relative">
        {/* Left fade + scroll button */}
        <div className="absolute left-0 top-0 bottom-6 w-16 bg-gradient-to-r from-zinc-950 to-transparent z-20 pointer-events-none hidden md:block rounded-l-xl" />
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-8 h-8 bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 rounded-full flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-all -ml-4 shadow-xl hidden md:flex backdrop-blur"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth px-4 md:px-0 pb-3"
          style={{ touchAction: 'pan-x' }}
        >
          {videos.map(video => (
            <div
              key={video.id}
              id={`video-${video.id}`}
              style={{ minWidth: cardWidth, width: cardWidth }}
              className="flex-shrink-0"
            >
              <VideoCard
                video={video}
                isWatchLater={watchLaterIds.includes(video.id)}
                onToggleWatchLater={onToggleWatchLater}
                isSubscribed={isAuthenticated}
              />
            </div>
          ))}
        </div>

        {/* Right fade + scroll button */}
        <div className="absolute right-0 top-0 bottom-6 w-16 bg-gradient-to-l from-zinc-950 to-transparent z-20 pointer-events-none hidden md:block rounded-r-xl" />
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-8 h-8 bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 rounded-full flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-all -mr-4 shadow-xl hidden md:flex backdrop-blur"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(VideoCarousel);
