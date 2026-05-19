
import React, { useRef } from 'react';
import { Play, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { getAllProgress, WatchRecord } from '../lib/watchProgress';
import { Video } from '../types';

interface Props {
  videos: Video[];
}

const ContinueWatchingCarousel: React.FC<Props> = ({ videos }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const progress = getAllProgress(); // 5–95%, sorted newest first
  const items = progress
    .map(rec => {
      const video = videos.find(v => v.id === rec.videoId);
      return video ? { video, rec } : null;
    })
    .filter((x): x is { video: Video; rec: WatchRecord } => x !== null)
    .slice(0, 10);

  if (items.length === 0) return null;

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8,
      behavior: 'smooth',
    });
  };

  const resume = (videoId: string, position: number) => {
    window.dispatchEvent(
      new CustomEvent('tube-deep-link', { detail: { videoId, timestamp: position } })
    );
    // Scroll the matching card into view if it exists in the DOM
    setTimeout(() => {
      const el = document.querySelector(`[data-video-id="${videoId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="mb-8 group/cw">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-4 md:px-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          <span className="text-white font-black text-sm tracking-wide">Continue Watching</span>
          <span className="text-zinc-600 text-xs">{items.length} video{items.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover/cw:opacity-100 transition-opacity">
          <button onClick={() => scroll('left')}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors">
            <ChevronLeft size={14} className="text-white" />
          </button>
          <button onClick={() => scroll('right')}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors">
            <ChevronRight size={14} className="text-white" />
          </button>
        </div>
      </div>

      {/* Scroll track */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-4 md:px-0"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {items.map(({ video, rec }) => (
          <button
            key={video.id}
            onClick={() => resume(video.id, rec.position)}
            className="flex-shrink-0 w-52 group/item relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition-all duration-200 hover:scale-[1.03] text-left"
            style={{ scrollSnapAlign: 'start' }}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover opacity-80 group-hover/item:opacity-100 transition-opacity"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-amber-500/90 flex items-center justify-center shadow-lg">
                  <Play size={16} className="text-black fill-black ml-0.5" />
                </div>
              </div>

              {/* Duration + position */}
              <div className="absolute bottom-2 right-2 bg-black/80 text-[9px] px-1.5 py-0.5 rounded text-zinc-300 font-medium">
                {fmtTime(rec.position)} / {video.duration}
              </div>

              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-zinc-700">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${rec.percent}%` }}
                />
              </div>
            </div>

            {/* Info */}
            <div className="p-2.5">
              <p className="text-white text-xs font-bold line-clamp-2 leading-snug">{video.title}</p>
              <p className="text-zinc-500 text-[10px] mt-0.5 truncate">{video.author}</p>
              <p className="text-amber-400/80 text-[10px] mt-1 font-semibold">{rec.percent}% watched</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ContinueWatchingCarousel;
