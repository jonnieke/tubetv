import React, { useMemo, useRef } from 'react';
import { Eye, Play, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { Video } from '../types';
import { onThumbError } from '../lib/thumbnail';

interface Props {
  videos: Video[];
  onCreatorClick: (name: string) => void;
}

interface CreatorCard {
  name: string;
  totalViews: number;
  videoCount: number;
  /** Top 3 videos by views — used for the thumbnail mosaic */
  topVideos: Video[];
}

const RANK_BADGE = [
  'bg-yellow-400 text-zinc-900',   // #1
  'bg-zinc-300 text-zinc-900',    // #2
  'bg-amber-600 text-white',      // #3
];

const formatViews = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)}K`
  : String(n);

// ── Thumbnail mosaic — shows up to 3 of the creator's videos ─────────────────

const Mosaic: React.FC<{ videos: Video[] }> = ({ videos }) => {
  const [a, b, c] = videos;

  if (!a) return <div className="w-full h-full bg-zinc-800" />;

  if (videos.length === 1) return (
    <img
      src={a.thumbnail} alt={a.title}
      onError={onThumbError}
      className="w-full h-full object-cover"
    />
  );

  if (videos.length === 2) return (
    <div className="flex h-full gap-px">
      <img src={a.thumbnail} alt={a.title} onError={onThumbError}
        className="w-1/2 h-full object-cover" />
      <img src={b.thumbnail} alt={b.title} onError={onThumbError}
        className="w-1/2 h-full object-cover" />
    </div>
  );

  // 3+ videos: large left, two stacked right
  return (
    <div className="flex h-full gap-px">
      <img src={a.thumbnail} alt={a.title} onError={onThumbError}
        className="w-2/3 h-full object-cover" />
      <div className="w-1/3 flex flex-col gap-px">
        <img src={b.thumbnail} alt={b.title} onError={onThumbError}
          className="w-full h-1/2 object-cover" />
        <img src={c.thumbnail} alt={c.title} onError={onThumbError}
          className="w-full h-1/2 object-cover" />
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const CreatorLeaderboard: React.FC<Props> = ({ videos, onCreatorClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const creators = useMemo<CreatorCard[]>(() => {
    const map = new Map<string, { views: number; count: number; vids: Video[] }>();
    videos.forEach(v => {
      if (!v.author || v.author === 'Tube Creator') return;
      const entry = map.get(v.author) ?? { views: 0, count: 0, vids: [] };
      entry.views += v.views ?? 0;
      entry.count++;
      entry.vids.push(v);
      map.set(v.author, entry);
    });
    return Array.from(map.entries())
      .map(([name, s]) => ({
        name,
        totalViews: s.views,
        videoCount: s.count,
        topVideos: s.vids.sort((a, b) => b.views - a.views).slice(0, 3),
      }))
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 12);
  }, [videos]);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.7 : scrollLeft + clientWidth * 0.7,
      behavior: 'smooth',
    });
  };

  if (creators.length === 0) return null;

  return (
    <div className="mb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-7 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-full flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <Trophy size={15} className="text-yellow-400" />
              <h2 className="text-xl font-black text-white">Top Creators</h2>
            </div>
            <p className="text-zinc-500 text-xs mt-0.5">Kenya's most-watched channels on Tube TV</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center border border-zinc-700 transition-colors"
          >
            <ChevronLeft size={16} className="text-white" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center border border-zinc-700 transition-colors"
          >
            <ChevronRight size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* Horizontal scroll row */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth px-4 md:px-0 pb-1"
        style={{ touchAction: 'pan-x' }}
      >
        {creators.map((creator, i) => (
          <button
            key={creator.name}
            onClick={() => onCreatorClick(creator.name)}
            className="group relative flex-shrink-0 w-[200px] md:w-[220px] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all duration-200 cursor-pointer text-left"
          >
            {/* Thumbnail mosaic */}
            <div className="relative w-full aspect-video overflow-hidden">
              <Mosaic videos={creator.topVideos} />

              {/* Gradient overlay — heavier at bottom for legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30 pointer-events-none" />

              {/* Rank badge */}
              <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shadow-lg ${
                i < 3 ? RANK_BADGE[i] : 'bg-black/60 backdrop-blur text-zinc-300 border border-white/10'
              }`}>
                {i + 1}
              </div>

              {/* Video count chip */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur text-zinc-300 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border border-white/10">
                <Play size={8} className="fill-current" />
                {creator.videoCount}
              </div>

              {/* Hover play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30 shadow-xl">
                  <Play size={14} className="fill-white text-white ml-0.5" />
                </div>
              </div>
            </div>

            {/* Info strip */}
            <div className="px-3 py-2.5">
              <p className="text-white font-bold text-sm leading-tight line-clamp-1 group-hover:text-red-400 transition-colors">
                {creator.name}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-zinc-500 text-[11px]">
                <Eye size={9} className="flex-shrink-0" />
                <span>{formatViews(creator.totalViews)} views</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CreatorLeaderboard;
