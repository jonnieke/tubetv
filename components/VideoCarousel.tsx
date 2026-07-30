
import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Video } from '../types';
import VideoCard from './VideoCard';

interface VideoCarouselProps {
  title: string;
  videos: Video[];
  onToggleWatchLater: (id: string) => void;
  watchLaterIds: string[];
  isAuthenticated: boolean;
}

const VideoCarousel: React.FC<VideoCarouselProps> = ({ 
  title, 
  videos, 
  onToggleWatchLater, 
  watchLaterIds,
  isAuthenticated 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (videos.length === 0) return null;

  return (
    <div className="mb-12 group/carousel relative">
      <h2 className="text-2xl font-bold text-white mb-4 px-4 md:px-0 flex items-center justify-between">
        {title}
        <span className="text-sm text-zinc-500 font-normal hover:text-white cursor-pointer transition-colors">View All</span>
      </h2>
      
      <div className="relative">
        {/* Scroll Buttons */}
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-black/60 p-2 rounded-full text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black -ml-4 backdrop-blur-md border border-white/10 hidden md:block"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth px-4 md:px-0 pb-6"
        >
          {videos.map((video) => (
            <div key={video.id} className="min-w-[280px] md:min-w-[320px] w-[280px] md:w-[320px]">
              <VideoCard 
                video={video}
                isWatchLater={watchLaterIds.includes(video.id)}
                onToggleWatchLater={onToggleWatchLater}
                isSubscribed={isAuthenticated}
              />
            </div>
          ))}
        </div>

        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-40 bg-black/60 p-2 rounded-full text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black -mr-4 backdrop-blur-md border border-white/10 hidden md:block"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};

export default VideoCarousel;
