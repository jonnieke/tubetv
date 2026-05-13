import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Clock, Star, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Video } from '../types';

interface SeriesCarouselProps {
  title?: string;
  videos: Video[];
  onToggleWatchLater: (id: string) => void;
  watchLaterIds: string[];
  isAuthenticated: boolean;
  onSubscribeRequest?: () => void;
}

// ─── Group videos into series ────────────────────────────────────────────────

interface Episode extends Video {}

interface SeriesGroup {
  seriesTitle: string;
  seasons: Record<number, Episode[]>;
  thumbnail: string;
  genre?: string;
  author: string;
  totalEpisodes: number;
  totalViews: number;
  latestYear?: number;
}

function groupIntoSeries(videos: Video[]): { series: SeriesGroup[]; standalone: Video[] } {
  const seriesMap: Record<string, SeriesGroup> = {};
  const standalone: Video[] = [];

  for (const v of videos) {
    if (v.seriesTitle) {
      const key = v.seriesTitle.toLowerCase().trim();
      if (!seriesMap[key]) {
        seriesMap[key] = {
          seriesTitle: v.seriesTitle,
          seasons: {},
          thumbnail: v.thumbnail,
          genre: v.genre,
          author: v.author,
          totalEpisodes: 0,
          totalViews: 0,
          latestYear: v.productionYear,
        };
      }
      const sg = seriesMap[key];
      const season = v.season ?? 1;
      if (!sg.seasons[season]) sg.seasons[season] = [];
      sg.seasons[season].push(v);
      sg.totalEpisodes++;
      sg.totalViews += v.views ?? 0;
      if (v.productionYear && (!sg.latestYear || v.productionYear > sg.latestYear)) sg.latestYear = v.productionYear;
    } else if (v.season && v.episode) {
      // Has season/episode but no explicit seriesTitle — use category as group key
      const key = `${v.category}-auto`;
      if (!seriesMap[key]) {
        seriesMap[key] = {
          seriesTitle: `${v.category} Series`,
          seasons: {},
          thumbnail: v.thumbnail,
          genre: v.genre,
          author: v.author,
          totalEpisodes: 0,
          totalViews: 0,
        };
      }
      const sg = seriesMap[key];
      const season = v.season ?? 1;
      if (!sg.seasons[season]) sg.seasons[season] = [];
      sg.seasons[season].push(v);
      sg.totalEpisodes++;
      sg.totalViews += v.views ?? 0;
    } else {
      standalone.push(v);
    }
  }

  // Sort episodes within each season
  for (const sg of Object.values(seriesMap)) {
    for (const eps of Object.values(sg.seasons)) {
      eps.sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));
    }
  }

  const series = Object.values(seriesMap).sort((a, b) => b.totalViews - a.totalViews);
  return { series, standalone };
}

// ─── Series Card ─────────────────────────────────────────────────────────────

interface SeriesCardProps {
  sg: SeriesGroup;
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  isAuthenticated: boolean;
  onSubscribeRequest?: () => void;
}

const SeriesCard: React.FC<SeriesCardProps> = ({
  sg,
  watchLaterIds,
  onToggleWatchLater,
  isAuthenticated,
  onSubscribeRequest,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeSeason, setActiveSeason] = useState<number>(
    Math.min(...Object.keys(sg.seasons).map(Number))
  );

  const seasonNumbers = Object.keys(sg.seasons).map(Number).sort((a, b) => a - b);
  const episodes = sg.seasons[activeSeason] || [];
  const firstEp = episodes[0];

  return (
    <div className="min-w-[300px] md:min-w-[340px] w-[300px] md:w-[340px] flex-shrink-0">
      <div className={`bg-zinc-900 border rounded-2xl overflow-hidden transition-all duration-300 ${expanded ? 'border-red-600/40 shadow-lg shadow-red-900/10' : 'border-zinc-800 hover:border-zinc-600'}`}>
        {/* Poster / Hero */}
        <div className="relative aspect-video group cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <img
            src={sg.thumbnail}
            alt={sg.seriesTitle}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 bg-zinc-800"
            onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30">
              <Play className="w-6 h-6 text-white ml-1" fill="white" />
            </div>
          </div>

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex gap-1.5">
            <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Series</span>
            {sg.genre && <span className="bg-black/60 text-zinc-300 text-[9px] px-2 py-0.5 rounded-full border border-white/10">{sg.genre}</span>}
          </div>

          {/* Season count */}
          <div className="absolute bottom-2.5 right-2.5">
            <span className="bg-black/70 backdrop-blur text-white text-[10px] px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1">
              <BookOpen size={9} />
              {seasonNumbers.length} {seasonNumbers.length === 1 ? 'Season' : 'Seasons'} · {sg.totalEpisodes} Eps
            </span>
          </div>

          {/* Expand indicator */}
          <div className="absolute bottom-2.5 left-2.5">
            {expanded ? <ChevronUp size={14} className="text-zinc-300" /> : <ChevronDown size={14} className="text-zinc-400" />}
          </div>
        </div>

        {/* Series Info */}
        <div className="p-3.5">
          <h3 className="font-bold text-white text-sm line-clamp-1">{sg.seriesTitle}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-zinc-500 text-[10px]">{sg.author}</span>
            {sg.latestYear && <span className="text-zinc-600 text-[10px]">· {sg.latestYear}</span>}
            <span className="text-zinc-600 text-[10px]">· {(sg.totalViews / 1000).toFixed(0)}K views</span>
          </div>

          {/* Season tabs */}
          {seasonNumbers.length > 1 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {seasonNumbers.map(s => (
                <button
                  key={s}
                  onClick={() => setActiveSeason(s)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border ${
                    activeSeason === s
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  S{String(s).padStart(2, '0')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expanded Episode List */}
        {expanded && (
          <div className="border-t border-zinc-800 max-h-72 overflow-y-auto no-scrollbar">
            {episodes.map((ep, idx) => {
              const isSaved = watchLaterIds.includes(ep.id);
              return (
                <div
                  key={ep.id}
                  className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-zinc-800/60 transition-colors group/ep cursor-pointer border-b border-zinc-800/40 last:border-0"
                  onClick={() => {
                    document.getElementById(`video-${ep.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  {/* Ep number */}
                  <div className="w-7 h-7 bg-zinc-800 group-hover/ep:bg-red-600/20 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-zinc-400 group-hover/ep:text-red-400 transition-colors border border-zinc-700 group-hover/ep:border-red-600/40">
                    {ep.episode ?? idx + 1}
                  </div>

                  {/* Thumbnail */}
                  <div className="relative w-16 h-9 rounded overflow-hidden flex-shrink-0 bg-zinc-800">
                    <img src={ep.thumbnail} alt={ep.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/ep:opacity-100 bg-black/50 transition-opacity">
                      <Play size={12} className="text-white" fill="white" />
                    </div>
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium line-clamp-1">{ep.title}</p>
                    <p className="text-zinc-500 text-[10px] flex items-center gap-1 mt-0.5">
                      <Clock size={8} />{ep.duration}
                      {ep.isPremium && <span className="ml-1 bg-purple-600/30 text-purple-300 px-1 rounded text-[9px] border border-purple-600/30">PREMIUM</span>}
                    </p>
                  </div>

                  {/* Save */}
                  <button
                    onClick={e => { e.stopPropagation(); onToggleWatchLater(ep.id); }}
                    className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-xs transition-colors ${isSaved ? 'bg-red-600/20 text-red-400' : 'text-zinc-600 hover:text-zinc-300'}`}
                    title={isSaved ? 'Remove from Watch List' : 'Add to Watch List'}
                  >
                    {isSaved ? '✓' : '+'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Carousel ────────────────────────────────────────────────────────────

const SeriesCarousel: React.FC<SeriesCarouselProps> = ({
  title = '📺 Series',
  videos,
  onToggleWatchLater,
  watchLaterIds,
  isAuthenticated,
  onSubscribeRequest,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { series, standalone } = groupIntoSeries(videos);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({ left: dir === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75, behavior: 'smooth' });
  };

  if (series.length === 0) {
    return (
      <div className="mb-12 group/carousel relative px-4 md:px-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-7 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-zinc-500 text-xs mt-0.5">No series available yet. Add them in the Content Manager.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-12 group/carousel relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 px-4 md:px-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-7 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-zinc-500 text-xs mt-0.5">{series.length} series · click to expand episodes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => scroll('left')} className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white border border-zinc-700 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => scroll('right')} className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white border border-zinc-700 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable Row */}
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth px-4 md:px-0 pb-2">
        {series.map(sg => (
          <SeriesCard
            key={sg.seriesTitle}
            sg={sg}
            watchLaterIds={watchLaterIds}
            onToggleWatchLater={onToggleWatchLater}
            isAuthenticated={isAuthenticated}
            onSubscribeRequest={onSubscribeRequest}
          />
        ))}
      </div>

      {/* Standalone originals note */}
      {standalone.length > 0 && (
        <p className="text-zinc-600 text-xs mt-3 px-4 md:px-0">
          +{standalone.length} standalone videos in Originals
        </p>
      )}
    </div>
  );
};

export default React.memo(SeriesCarousel);
