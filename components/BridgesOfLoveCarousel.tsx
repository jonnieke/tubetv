import React, { useRef } from 'react';
import { Play, ChevronLeft, ChevronRight, ChevronRight as ArrowRight, Heart } from 'lucide-react';
import { Video } from '../types';
import { onThumbError } from '../lib/thumbnail';

interface Props {
  videos: Video[];
  onSeriesClick: (title: string) => void;
  onVideoClick: (id: string) => void;
}

const SERIES_TITLE = 'Bridges of Love';

const BridgesOfLoveCarousel: React.FC<Props> = ({ videos, onSeriesClick, onVideoClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Find all Bridges of Love episodes, sort by episode number ascending
  const episodes = videos
    .filter(v => {
      const st = v.seriesTitle?.toLowerCase() ?? '';
      const t  = v.title?.toLowerCase() ?? '';
      return st.includes('bridges of love') || t.startsWith('bridges of love');
    })
    .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));

  if (episodes.length === 0) return null;

  // Show first 6 then a "View All" tile
  const visible = episodes.slice(0, 6);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8,
      behavior: 'smooth',
    });
  };

  return (
    <div className="mb-10 group/bol">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <div className="flex items-center gap-3">
          {/* Accent bar — warm rose/pink for a romance drama */}
          <div className="w-1 h-6 bg-gradient-to-b from-rose-500 to-pink-600 rounded-full flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black bg-rose-600/90 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">
                SERIES
              </span>
              <h2 className="text-lg md:text-xl font-black text-white leading-tight flex items-center gap-1.5">
                {SERIES_TITLE}
                <Heart size={14} className="text-rose-400 fill-rose-400" />
              </h2>
            </div>
            <p className="text-zinc-500 text-xs mt-0.5">
              {episodes.length} episode{episodes.length !== 1 ? 's' : ''} · Watch from Episode 1
            </p>
          </div>
        </div>

        {/* Scroll arrows + View All */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex gap-1 opacity-0 group-hover/bol:opacity-100 transition-opacity">
            <button
              onClick={() => scroll('left')}
              className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
            >
              <ChevronLeft size={14} className="text-white" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
            >
              <ChevronRight size={14} className="text-white" />
            </button>
          </div>
          <button
            onClick={() => onSeriesClick(SERIES_TITLE)}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors font-semibold group/sa"
          >
            View All
            <ArrowRight size={12} className="group-hover/sa:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ── Episode strip ── */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-4 md:px-0"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {visible.map((ep, idx) => (
          <EpisodeCard
            key={ep.id}
            video={ep}
            episodeNumber={idx + 1}
            onPlay={() => onVideoClick(ep.id)}
          />
        ))}

        {/* ── View All tile ── */}
        <button
          onClick={() => onSeriesClick(SERIES_TITLE)}
          className="flex-shrink-0 w-44 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 transition-all duration-200 hover:scale-[1.03] flex flex-col items-center justify-center gap-3 aspect-video text-center p-4"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="w-12 h-12 rounded-full bg-rose-600/20 border border-rose-500/30 flex items-center justify-center">
            <ArrowRight size={22} className="text-rose-400" />
          </div>
          <div>
            <p className="text-white text-xs font-black">View All Episodes</p>
            <p className="text-zinc-500 text-[10px] mt-0.5">{episodes.length} total</p>
          </div>
        </button>
      </div>
    </div>
  );
};

// ─── Episode card ─────────────────────────────────────────────────────────────

const EpisodeCard: React.FC<{
  video: Video;
  episodeNumber: number;
  onPlay: () => void;
}> = ({ video, episodeNumber, onPlay }) => {
  return (
    <button
      onClick={onPlay}
      className="flex-shrink-0 w-44 group/ep rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-rose-500/40 transition-all duration-200 hover:scale-[1.03] text-left"
      style={{ scrollSnapAlign: 'start' }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video">
        <img
          src={video.thumbnail}
          alt={video.title}
          onError={onThumbError}
          className="w-full h-full object-cover opacity-80 group-hover/ep:opacity-100 transition-opacity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Episode badge */}
        <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-[9px] font-black px-1.5 py-0.5 rounded text-white border border-white/10 tracking-wider">
          EP {episodeNumber}
        </div>

        {/* Duration */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-[9px] px-1.5 py-0.5 rounded text-zinc-300 font-medium">
            {video.duration}
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/ep:opacity-100 transition-opacity">
          <div className="w-9 h-9 rounded-full bg-rose-600/90 flex items-center justify-center shadow-lg shadow-rose-900/40">
            <Play size={14} className="text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest mb-0.5">
          Episode {episodeNumber}
        </p>
        <p className="text-white text-xs font-bold line-clamp-2 leading-snug">{video.title}</p>
      </div>
    </button>
  );
};

export default BridgesOfLoveCarousel;
