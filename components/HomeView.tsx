import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Search, Sparkles, Loader2, Play, BookmarkPlus, BookmarkCheck,
  Info, ChevronLeft, ChevronRight, Flame, Star, Clock, Volume2, VolumeX, History,
} from 'lucide-react';
import { Video, NavItem, ViewStateOrString, ViewState } from '../types';
import VideoCard from './VideoCard';
import VideoCarousel from './VideoCarousel';
import SeriesCarousel from './SeriesCarousel';
import ShortsShelf from './ShortsShelf';
import { getAllProgress } from '../lib/watchProgress';
import type { ShortVideo } from '../types';
import Hls from 'hls.js';

const PREVIEW_FALLBACK = 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface HomeViewProps {
  videos: Video[];
  filteredVideos: Video[];
  realShorts: ShortVideo[];
  isLoadingVideos: boolean;
  isRealContent: boolean;
  currentView: ViewStateOrString;
  heroIndex: number;
  setHeroIndex: (i: number) => void;
  searchQuery: string;
  searchInput: string;
  activeSubCategory: string;
  setActiveSubCategory: (cat: string) => void;
  currentSubCategories: string[];
  watchLater: string[];
  toggleWatchLater: (id: string) => void;
  isAuthenticated: boolean;
  recommendedVideos: Video[];
  isRecLoading: boolean;
  navItems: NavItem[];
  setCurrentView: (v: ViewStateOrString) => void;
  setShowLogin: (v: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Top 10 Row
// ─────────────────────────────────────────────────────────────────────────────

const Top10Row: React.FC<{
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
}> = ({ videos, watchLaterIds, onToggleWatchLater }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const top10 = videos.slice(0, 10);
  if (top10.length === 0) return null;

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.7 : scrollLeft + clientWidth * 0.7,
      behavior: 'smooth',
    });
  };

  return (
    <div className="mb-10 group/top10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-red-600 rounded-full flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <Flame size={15} className="text-orange-500" />
              <h2 className="text-lg md:text-xl font-black text-white">Top 10 in Kenya</h2>
            </div>
            <p className="text-zinc-500 text-xs mt-0.5">What Kenyans are watching right now</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => scroll('left')}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-white transition-colors opacity-0 group-hover/top10:opacity-100">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => scroll('right')}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-white transition-colors opacity-0 group-hover/top10:opacity-100">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />
        <div ref={scrollRef} className="flex overflow-x-auto no-scrollbar scroll-smooth px-4 md:px-0 pb-3">
          {top10.map((video, rank) => (
            <Top10Card
              key={video.id}
              video={video}
              rank={rank + 1}
              isSaved={watchLaterIds.includes(video.id)}
              onToggleWatchLater={onToggleWatchLater}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const Top10Card: React.FC<{
  video: Video;
  rank: number;
  isSaved: boolean;
  onToggleWatchLater: (id: string) => void;
}> = ({ video, rank, isSaved, onToggleWatchLater }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex items-end flex-shrink-0 mr-1 cursor-pointer group/t10"
      style={{ minWidth: 160, width: 160 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Giant rank number */}
      <span
        className="absolute left-0 bottom-0 z-0 font-black leading-none select-none pointer-events-none transition-opacity duration-300"
        style={{
          fontSize: 130,
          WebkitTextStroke: rank <= 3 ? '3px rgba(239,68,68,0.55)' : '3px rgba(82,82,91,0.55)',
          WebkitTextFillColor: 'transparent',
          lineHeight: '0.85',
          fontFamily: '"Arial Black", "Arial Bold", Gadget, sans-serif',
          opacity: hovered ? 0.6 : 1,
        }}
      >
        {rank}
      </span>

      {/* Portrait thumbnail */}
      <div className="relative z-10 ml-12 w-[100px] rounded-xl overflow-hidden bg-zinc-800 shadow-2xl flex-shrink-0"
           style={{ aspectRatio: '2/3' }}>
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover/t10:scale-105"
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
        />
        {/* Hover overlay */}
        <div className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={() => document.getElementById(`video-${video.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="w-10 h-10 bg-white/25 backdrop-blur rounded-full flex items-center justify-center border border-white/30 hover:bg-white/40 transition-colors"
          >
            <Play size={14} className="fill-white text-white ml-0.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onToggleWatchLater(video.id); }}
            className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
              isSaved ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
            }`}
          >
            {isSaved ? <BookmarkCheck size={12} /> : <BookmarkPlus size={12} />}
          </button>
        </div>

        {/* Bottom title strip */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6">
          <p className="text-white text-[9px] font-bold line-clamp-2 leading-tight">{video.title}</p>
        </div>

        {/* #1 crown */}
        {rank === 1 && (
          <div className="absolute top-1.5 right-1.5 text-xs">👑</div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// New This Week — individual hover-play card
// ─────────────────────────────────────────────────────────────────────────────

const NewThisWeekCard: React.FC<{
  video: Video;
  isBig: boolean;
  isSaved: boolean;
  onToggleWatchLater: (id: string) => void;
  onPlay: (id: string) => void;
}> = ({ video, isBig, isSaved, onToggleWatchLater, onPlay }) => {
  const [hoverPlaying, setHoverPlaying] = useState(false);
  const [videoReady, setVideoReady]     = useState(false);
  const [muted, setMuted]               = useState(true);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const hlsRef    = useRef<Hls | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const src = video.url || PREVIEW_FALLBACK;

  // Start / stop hover preview
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (hoverPlaying) {
      vid.muted = true; // always start muted (autoplay policy)
      setMuted(true);

      if (Hls.isSupported() && src.endsWith('.m3u8')) {
        if (!hlsRef.current) {
          const hls = new Hls({ startLevel: -1, maxBufferLength: 10 });
          hls.loadSource(src);
          hls.attachMedia(vid);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            vid.play().catch(() => setHoverPlaying(false));
          });
          hlsRef.current = hls;
        } else {
          vid.play().catch(() => setHoverPlaying(false));
        }
      } else {
        if (!vid.src) vid.src = src;
        vid.play().catch(() => setHoverPlaying(false));
      }
    } else {
      vid.pause();
      setVideoReady(false);
      setMuted(true);
    }
  }, [hoverPlaying, src]);

  // Sync mute toggle to video element
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Cleanup HLS on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    hlsRef.current?.destroy();
  }, []);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setHoverPlaying(true), 450);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHoverPlaying(false);
  };

  const isLive = hoverPlaying && videoReady;

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden cursor-pointer shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.015] ${isBig ? 'col-span-2' : ''}`}
      style={{ aspectRatio: isBig ? '16/7' : '16/9' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onPlay(video.id)}
    >
      {/* Static thumbnail — fades out once video is ready */}
      <img
        src={video.thumbnail}
        alt={video.title}
        className={`absolute inset-0 w-full h-full object-cover bg-zinc-800 transition-opacity duration-700 ${isLive ? 'opacity-0' : 'opacity-100'}`}
        onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
      />

      {/* Muted preview video */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isLive ? 'opacity-100' : 'opacity-0'}`}
        playsInline
        loop
        preload="none"
        onCanPlay={() => setVideoReady(true)}
      />

      {/* Cinematic gradient — slightly lighter when playing */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent transition-opacity duration-500 ${isLive ? 'opacity-70' : 'opacity-100'}`} />

      {/* ── Top-left badge: NEW → PLAYING ── */}
      <div className="absolute top-2.5 left-2.5 z-10">
        {isLive ? (
          <span className="flex items-center gap-1.5 text-[9px] font-black bg-red-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wide shadow-lg">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            Playing
          </span>
        ) : (
          <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide shadow">
            NEW
          </span>
        )}
      </div>

      {/* ── Top-right: unmute button (shown while playing) ── */}
      {isLive && (
        <button
          onClick={e => { e.stopPropagation(); setMuted(m => !m); }}
          className="absolute top-2.5 right-2.5 z-10 w-7 h-7 bg-black/60 backdrop-blur border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
      )}

      {/* ── Top-right: save button (shown on hover when NOT playing) ── */}
      {!isLive && (
        <button
          onClick={e => { e.stopPropagation(); onToggleWatchLater(video.id); }}
          className={`absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center border transition-all opacity-0 group-hover:opacity-100 ${
            isSaved
              ? 'bg-green-500/20 border-green-500/50 text-green-400'
              : 'bg-black/50 border-white/20 text-white hover:bg-white/20'
          }`}
        >
          {isSaved ? <BookmarkCheck size={12} /> : <BookmarkPlus size={12} />}
        </button>
      )}

      {/* ── Bottom info strip ── */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        {video.genre && (
          <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold">{video.genre}</span>
        )}
        <p className={`text-white font-black leading-tight line-clamp-1 ${isBig ? 'text-base md:text-lg' : 'text-sm'}`}>
          {video.title}
        </p>
        {video.description && (
          <p className="text-zinc-300 text-[10px] line-clamp-1 leading-snug mt-0.5">{video.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1 text-zinc-400 text-[10px]">
          <Clock size={9} />
          <span>{video.duration}</span>
          {isLive && !muted && (
            <span className="ml-auto flex items-center gap-1 text-emerald-400">
              <Volume2 size={9} /> Sound on
            </span>
          )}
        </div>
      </div>

      {/* ── Centre play ring — only before hover-play kicks in ── */}
      {!isLive && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30 shadow-xl">
            <Play size={16} className="fill-white text-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// New This Week strip
// ─────────────────────────────────────────────────────────────────────────────

const NewThisWeek: React.FC<{
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onPlay: (id: string) => void;
}> = ({ videos, watchLaterIds, onToggleWatchLater, onPlay }) => {
  const featured = videos.slice(0, 4);
  if (featured.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">NEW</span>
              <h2 className="text-lg md:text-xl font-black text-white">New This Week</h2>
            </div>
            <p className="text-zinc-500 text-xs mt-0.5">Hover to preview · click to watch</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 md:px-0">
        {featured.map((video, i) => (
          <NewThisWeekCard
            key={video.id}
            video={video}
            isBig={i === 0}
            isSaved={watchLaterIds.includes(video.id)}
            onToggleWatchLater={onToggleWatchLater}
            onPlay={onPlay}
          />
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Genre Mood Row  (large cinematic cards, one per genre)
// ─────────────────────────────────────────────────────────────────────────────

const GENRE_MOODS = [
  { label: 'Drama',       emoji: '🎭', gradient: 'from-blue-950 to-indigo-950',   accent: '#3b82f6' },
  { label: 'Comedy',      emoji: '😂', gradient: 'from-orange-950 to-amber-950',  accent: '#f97316' },
  { label: 'Education',   emoji: '📚', gradient: 'from-emerald-950 to-teal-950',  accent: '#10b981' },
  { label: 'Faith',       emoji: '🙏', gradient: 'from-amber-950 to-yellow-950',  accent: '#f59e0b' },
  { label: 'Action',      emoji: '💥', gradient: 'from-red-950 to-rose-950',      accent: '#ef4444' },
  { label: 'Documentary', emoji: '🎙️', gradient: 'from-zinc-900 to-zinc-950',    accent: '#a1a1aa' },
];

const GenreMoodRow: React.FC<{ videos: Video[]; onNavigate: () => void }> = ({ videos, onNavigate }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4 px-4 md:px-0">
        <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full flex-shrink-0" />
        <div>
          <h2 className="text-lg md:text-xl font-black text-white">Browse by Mood</h2>
          <p className="text-zinc-500 text-xs mt-0.5">Pick what you feel like watching</p>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto no-scrollbar px-4 md:px-0 pb-2">
        {GENRE_MOODS.map(mood => {
          const genreVideo = videos.find(v =>
            v.genre?.toLowerCase().includes(mood.label.toLowerCase()) ||
            v.tags?.some(t => t.toLowerCase().includes(mood.label.toLowerCase())) ||
            v.category.toLowerCase().includes(mood.label.toLowerCase())
          );
          return (
            <button
              key={mood.label}
              onClick={onNavigate}
              className={`group relative flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer border border-white/[0.06] hover:border-white/20 transition-all duration-300 hover:scale-[1.04] shadow-xl`}
              style={{ minWidth: 140, width: 140, aspectRatio: '4/5', background: `linear-gradient(135deg, var(--from) 0%, var(--to) 100%)` }}
            >
              {/* Gradient bg */}
              <div className={`absolute inset-0 bg-gradient-to-br ${mood.gradient}`} />
              {/* Ambient glow */}
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 40% 60%, ${mood.accent}25 0%, transparent 65%)` }} />
              {/* Thumbnail if available */}
              {genreVideo && (
                <img
                  src={genreVideo.thumbnail}
                  alt={mood.label}
                  className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity"
                />
              )}
              {/* Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3">
                <span className="text-3xl">{mood.emoji}</span>
                <p className="text-white font-black text-sm text-center">{mood.label}</p>
              </div>
              {/* Hover caret */}
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight size={14} className="text-white/60" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hero auto-advance
// ─────────────────────────────────────────────────────────────────────────────

const HERO_INTERVAL = 7000;

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const HomeView: React.FC<HomeViewProps> = ({
  videos,
  filteredVideos,
  realShorts,
  isLoadingVideos,
  isRealContent,
  currentView,
  heroIndex,
  setHeroIndex,
  searchQuery,
  searchInput,
  activeSubCategory,
  setActiveSubCategory,
  currentSubCategories,
  watchLater,
  toggleWatchLater,
  isAuthenticated,
  recommendedVideos,
  isRecLoading,
  navItems,
  setCurrentView,
  setShowLogin,
}) => {
  const [heroProgress, setHeroProgress] = useState(0);
  const showHero = currentView === ViewState.HOME && !searchQuery;

  // Continue Watching — join saved progress records with loaded videos
  const continueWatchingVideos = useMemo<Video[]>(() => {
    const records = getAllProgress(); // sorted newest-first, 5–95%
    return records
      .map(r => videos.find(v => v.id === r.videoId))
      .filter((v): v is Video => !!v)
      .slice(0, 12);
  }, [videos]);

  // Auto-advance hero
  useEffect(() => {
    if (!showHero) return;
    const featuredVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 5);
    if (featuredVideos.length <= 1) return;
    setHeroProgress(0);
    const TICK = 80;
    const steps = HERO_INTERVAL / TICK;
    let tick = 0;
    const timer = setInterval(() => {
      tick++;
      setHeroProgress((tick / steps) * 100);
      if (tick >= steps) {
        setHeroIndex((heroIndex + 1) % featuredVideos.length);
        tick = 0;
        setHeroProgress(0);
      }
    }, TICK);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroIndex, showHero, videos.length]);

  const getViewTitle = () => {
    const currentItem = navItems.find(i => i.id === currentView);
    if (currentItem && currentView !== ViewState.HOME) {
      return { title: currentItem.label, icon: currentItem.icon };
    }
    return null;
  };
  const viewHeader = getViewTitle();

  const showCarousels =
    currentView === ViewState.HOME &&
    !searchQuery &&
    (activeSubCategory === 'All' || activeSubCategory === 'Trending');

  const showOriginalsSeries =
    currentView === ViewState.ORIGINALS && !searchQuery && activeSubCategory === 'Series';

  const showOriginalsCarousels =
    currentView === ViewState.ORIGINALS &&
    !searchQuery &&
    (activeSubCategory === 'All' || activeSubCategory === 'Movies');

  const scrollToVideo = (id: string) =>
    document.getElementById(`video-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="pb-24">

      {/* ══════════════════════════════════════════════════════════════════
          NETFLIX-STYLE HERO BANNER
      ══════════════════════════════════════════════════════════════════ */}
      {showHero && (() => {
        const featuredVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 5);
        const activeIdx = heroIndex % featuredVideos.length;
        const hero = featuredVideos[activeIdx];
        if (!hero) return null;
        const isSaved = watchLater.includes(hero.id);

        return (
          <div className="relative w-full h-[72vh] md:h-[95vh] overflow-hidden select-none group/hero">

            {/* ── Crossfading background images ── */}
            {featuredVideos.map((v, i) => (
              <img
                key={v.id}
                src={v.thumbnail}
                alt=""
                aria-hidden="true"
                className={`absolute inset-0 w-full h-full object-cover ${i === activeIdx ? 'opacity-100' : 'opacity-0'}`}
                style={{
                  transform: i === activeIdx ? 'scale(1.06)' : 'scale(1)',
                  transition: 'opacity 1.2s ease, transform 9s ease',
                }}
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
              />
            ))}

            {/* ── Cinematic gradient layers ── */}
            {/* Heavy bottom-to-top — dissolves image into page */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none" />
            {/* Strong left-to-right — text legibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent pointer-events-none" />
            {/* Subtle top — nav area darkening */}
            <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
            {/* Extra bottom anchor */}
            <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black to-transparent pointer-events-none" />

            {/* ── Left nav arrow (appears on hover) ── */}
            <button
              onClick={() => { setHeroIndex((activeIdx - 1 + featuredVideos.length) % featuredVideos.length); setHeroProgress(0); }}
              className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 border border-white/15 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover/hero:opacity-100 transition-all duration-300 hover:bg-black/70 hover:border-white/40 hover:scale-105 active:scale-95"
              aria-label="Previous"
            >
              <ChevronLeft size={22} />
            </button>

            {/* ── Right nav arrow (appears on hover) ── */}
            <button
              onClick={() => { setHeroIndex((activeIdx + 1) % featuredVideos.length); setHeroProgress(0); }}
              className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 border border-white/15 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover/hero:opacity-100 transition-all duration-300 hover:bg-black/70 hover:border-white/40 hover:scale-105 active:scale-95"
              aria-label="Next"
            >
              <ChevronRight size={22} />
            </button>

            {/* ── Main content — bottom-left ── */}
            <div className="absolute bottom-0 left-0 px-6 md:px-14 pb-12 md:pb-20 z-10 w-full md:max-w-[600px] xl:max-w-[660px]">

              {/* TUBE ORIGINAL + category */}
              <div className="flex flex-wrap items-center gap-2.5 mb-5">
                <span className="text-[10px] font-black tracking-[0.22em] uppercase px-2.5 py-1 rounded-sm border"
                  style={{ color: '#e50914', borderColor: 'rgba(229,9,20,0.6)' }}>
                  TUBE ORIGINAL
                </span>
                {hero.category && (
                  <span className="text-zinc-400 text-[10px] font-semibold tracking-[0.18em] uppercase">
                    {hero.category}
                  </span>
                )}
                {hero.seriesTitle && hero.season != null && (
                  <span className="text-zinc-500 text-[10px] tracking-wide">· Season {hero.season}</span>
                )}
              </div>

              {/* Series parent label */}
              {hero.seriesTitle && (
                <p className="text-zinc-200 text-xs md:text-sm font-bold uppercase tracking-[0.14em] mb-2 drop-shadow">
                  {hero.seriesTitle}
                </p>
              )}

              {/* Main title */}
              <h1 className="font-black text-white leading-[0.9] tracking-tight drop-shadow-2xl mb-5 line-clamp-2"
                style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4.5rem)' }}>
                {hero.title}
              </h1>

              {/* Meta strip */}
              <div className="flex items-center gap-2.5 mb-5 flex-wrap">
                {hero.productionYear && (
                  <span className="text-zinc-300 text-sm font-medium">{hero.productionYear}</span>
                )}
                <span className="border border-zinc-500/80 text-zinc-300 text-[9px] font-black px-1.5 py-0.5 rounded-sm tracking-widest">HD</span>
                {hero.genre && (
                  <span className="text-zinc-400 text-sm">{hero.genre}</span>
                )}
                {hero.duration && (
                  <>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400 text-sm">{hero.duration}</span>
                  </>
                )}
              </div>

              {/* Description */}
              <p className="text-zinc-200 text-sm md:text-[0.95rem] leading-relaxed line-clamp-2 md:line-clamp-3 mb-8 max-w-[500px] drop-shadow">
                {hero.description || `Watch ${hero.title} — exclusive on Tube TV, Kenya's home for premium original content.`}
              </p>

              {/* CTA buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => scrollToVideo(hero.id)}
                  className="flex items-center gap-2.5 bg-white text-black font-bold px-7 md:px-9 py-3 md:py-3.5 rounded text-sm md:text-base hover:bg-zinc-100 transition-all shadow-2xl active:scale-[0.97] flex-shrink-0"
                >
                  <Play size={20} fill="black" className="flex-shrink-0" /> Play
                </button>
                <button
                  onClick={() => scrollToVideo(hero.id)}
                  className="flex items-center gap-2 bg-zinc-600/60 backdrop-blur-sm text-white font-semibold px-6 md:px-8 py-3 md:py-3.5 rounded text-sm md:text-base hover:bg-zinc-500/70 transition-all active:scale-[0.97] flex-shrink-0"
                >
                  <Info size={18} className="flex-shrink-0" /> More Info
                </button>
              </div>
            </div>

            {/* ── Bottom-right: bookmark + slide indicators (Netflix style) ── */}
            <div className="absolute bottom-6 md:bottom-10 right-5 md:right-8 z-10 flex flex-col items-end gap-4">
              {/* Bookmark */}
              <button
                onClick={() => toggleWatchLater(hero.id)}
                title={isSaved ? 'Remove from Watch Later' : 'Add to Watch Later'}
                className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all ${
                  isSaved ? 'border-white bg-white/10 text-white' : 'border-zinc-500 text-zinc-400 hover:border-white hover:text-white'
                }`}
              >
                {isSaved ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}
              </button>

              {/* Progress bars */}
              {featuredVideos.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {featuredVideos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setHeroIndex(i); setHeroProgress(0); }}
                      className="relative h-[3px] rounded-full overflow-hidden bg-white/25 transition-all duration-500 flex-shrink-0"
                      style={{ width: i === activeIdx ? 36 : 10 }}
                    >
                      {i === activeIdx && (
                        <div
                          className="absolute inset-y-0 left-0 bg-white rounded-full"
                          style={{ width: `${heroProgress}%` }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════
          REST OF PAGE — padded container
      ══════════════════════════════════════════════════════════════════ */}
      <div className="px-4 md:px-8 pt-8">

        {/* View header (category pages) */}
        {viewHeader && (
          <div className="mb-6 flex items-center gap-3">
            <div className="w-11 h-11 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700">
              {viewHeader.icon && <viewHeader.icon className="w-5 h-5 text-white" />}
            </div>
            <h1 className="text-3xl font-black text-white">{viewHeader.title}</h1>
          </div>
        )}

        {/* Sub-category pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-7 no-scrollbar sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-xl py-3 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-white/[0.04]">
          {currentSubCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveSubCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                activeSubCategory === cat
                  ? 'bg-white text-black shadow'
                  : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:border-zinc-600 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Shorts shelf */}
        {currentView === ViewState.HOME && !searchQuery && (
          <ShortsShelf shorts={realShorts} onShortClick={() => setCurrentView(ViewState.SHORTS)} />
        )}

        {/* Section heading (flat grid mode) */}
        {!showCarousels && !showOriginalsSeries && !showOriginalsCarousels && (
          <div className="mb-6 flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">
              {searchQuery
                ? `Results for "${searchInput}"`
                : activeSubCategory !== 'All'
                  ? activeSubCategory
                  : currentView === ViewState.HOME
                    ? 'Trending Now'
                    : 'Popular Videos'}
            </h2>
            {isRealContent ? (
              <span className="text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">LIVE</span>
            ) : !isLoadingVideos && (
              <span className="text-sm text-zinc-600">({filteredVideos.length})</span>
            )}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {(isLoadingVideos || (!isRealContent && videos.length === 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-zinc-900 rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-video bg-zinc-800" />
                <div className="p-3.5 space-y-2.5">
                  <div className="h-3.5 bg-zinc-800 rounded-full w-3/4" />
                  <div className="h-3 bg-zinc-800 rounded-full w-1/2" />
                  <div className="flex gap-2">
                    <div className="h-5 bg-zinc-800 rounded-full w-20" />
                    <div className="h-5 bg-zinc-800 rounded-full w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ HOME: Full Netflix layout ════════════════════════════════════ */}
        {!isLoadingVideos && showCarousels && (
          <div className="space-y-2 animate-in fade-in duration-500">

            {/* 1. New This Week — newest uploads from Bunny (API returns orderBy=date) */}
            <NewThisWeek
              videos={
                [...videos]
                  .sort((a, b) => {
                    if (a.dateUploaded && b.dateUploaded) {
                      return new Date(b.dateUploaded).getTime() - new Date(a.dateUploaded).getTime();
                    }
                    return 0; // preserve Bunny API order (already newest-first)
                  })
                  .slice(0, 4)
              }
              watchLaterIds={watchLater}
              onToggleWatchLater={toggleWatchLater}
              onPlay={scrollToVideo}
            />

            {/* 2. Top 10 in Kenya */}
            <Top10Row
              videos={[...videos].sort((a, b) => b.views - a.views).slice(0, 10)}
              watchLaterIds={watchLater}
              onToggleWatchLater={toggleWatchLater}
            />

            {/* 3. Continue Watching */}
            {continueWatchingVideos.length > 0 && (
              <VideoCarousel
                title="⏱ Continue Watching"
                subtitle="Pick up where you left off"
                accentColor="from-zinc-400 to-zinc-600"
                videos={continueWatchingVideos}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={true}
              />
            )}

            {/* 4. AI Picks — show recommendations when available, trending as fallback */}
            {isRecLoading && watchLater.length > 0 ? (
              <div className="flex items-center gap-3 py-5 px-2">
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
                <span className="text-zinc-500 text-sm">AI is personalising your feed…</span>
              </div>
            ) : (
              <VideoCarousel
                title="✨ Recommended For You"
                subtitle={recommendedVideos.length > 0 ? "Curated by AI based on your Watch List" : "Popular picks you might enjoy"}
                accentColor="from-purple-500 to-pink-500"
                videos={recommendedVideos.length > 0 ? recommendedVideos : [...videos].sort((a, b) => b.views - a.views).slice(10, 30)}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={true}
              />
            )}

            {/* 4. Trending Now */}
            <VideoCarousel
              title="🔥 Trending Now"
              subtitle="Kenya's most-watched this week"
              accentColor="from-red-500 to-orange-500"
              videos={[...videos].sort((a, b) => b.views - a.views).slice(0, 20)}
              watchLaterIds={watchLater}
              onToggleWatchLater={toggleWatchLater}
              isAuthenticated={true}
            />

            {/* 5. Series */}
            <SeriesCarousel
              title="📺 Series"
              videos={videos.filter(v => v.seriesTitle || (v.season && v.episode))}
              watchLaterIds={watchLater}
              onToggleWatchLater={toggleWatchLater}
              isAuthenticated={true}
              onSubscribeRequest={() => setShowLogin(true)}
            />

            {/* 6. Browse by Mood */}
            <GenreMoodRow videos={videos} onNavigate={() => setCurrentView(ViewState.ORIGINALS)} />

            {/* 7. Per-category rows */}
            {([
              { cat: 'Originals',  emoji: '🎬', accent: 'from-red-500 to-rose-500',      sub: 'Kenyan-made films & dramas' },
              { cat: 'Education',  emoji: '📚', accent: 'from-blue-500 to-cyan-500',      sub: 'CBC, KCSE & university content' },
              { cat: 'Farmers',    emoji: '🌱', accent: 'from-green-500 to-emerald-500',  sub: 'Modern farming & agribusiness' },
              { cat: 'Faith',      emoji: '🙏', accent: 'from-amber-500 to-yellow-500',   sub: 'Sermons, worship & devotion' },
              { cat: 'Kids',       emoji: '🧒', accent: 'from-indigo-500 to-violet-500',  sub: 'Safe & educational kids content' },
              { cat: 'Diaspora',   emoji: '🌍', accent: 'from-teal-500 to-sky-500',       sub: 'Content for Kenyans abroad' },
              { cat: 'Fashion',    emoji: '👗', accent: 'from-pink-500 to-rose-500',       sub: 'Style, trends & Kenyan fashion' },
              { cat: 'Wildlife',   emoji: '🦁', accent: 'from-yellow-500 to-orange-500',  sub: 'Safari, nature & conservation' },
            ] as const).map(({ cat, emoji, accent, sub }) => {
              const catVids = videos.filter(v => v.category === cat);
              if (catVids.length === 0) return null;
              return (
                <VideoCarousel
                  key={cat}
                  title={`${emoji} ${cat}`}
                  subtitle={sub}
                  accentColor={accent}
                  videos={catVids}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={true}
                />
              );
            })}

          </div>
        )}

        {/* ══ ORIGINALS: Series layout ════════════════════════════════════ */}
        {!isLoadingVideos && showOriginalsSeries && (
          <div className="space-y-2 animate-in fade-in duration-500">
            {['Swahili', 'Drama', 'Comedy', 'Thriller'].map(genre => {
              const gv = filteredVideos.filter(v => v.genre?.includes(genre) || v.tags?.includes(genre));
              if (gv.length === 0) return null;
              return (
                <SeriesCarousel
                  key={genre}
                  title={`📺 ${genre} Series`}
                  videos={gv}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={true}
                  onSubscribeRequest={() => setShowLogin(true)}
                />
              );
            })}
          </div>
        )}

        {/* ══ ORIGINALS: Genre carousels ══════════════════════════════════ */}
        {!isLoadingVideos && showOriginalsCarousels && (
          <div className="space-y-2 animate-in fade-in duration-500">
            {['Drama', 'Comedy', 'Documentary', 'Action', 'Swahili'].map(genre => {
              const gv = filteredVideos.filter(v => v.genre?.includes(genre) || v.tags?.includes(genre));
              if (gv.length === 0) return null;
              return (
                <VideoCarousel
                  key={genre}
                  title={`🎬 ${genre}`}
                  accentColor="from-red-500 to-orange-500"
                  videos={gv}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={true}
                />
              );
            })}
          </div>
        )}

        {/* ══ Flat grid (search / specific sub-category) ══════════════════ */}
        {!isLoadingVideos && !showCarousels && !showOriginalsSeries && !showOriginalsCarousels && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-in slide-in-from-bottom-4 duration-500">
              {filteredVideos.map(video => (
                <div id={`video-${video.id}`} key={video.id}>
                  <VideoCard
                    video={video}
                    isWatchLater={watchLater.includes(video.id)}
                    onToggleWatchLater={toggleWatchLater}
                    isSubscribed={true}
                    onSubscribeRequest={() => setShowLogin(true)}
                  />
                </div>
              ))}
            </div>

            {/* AI Recs block (HOME only, non-carousel state) */}
            {currentView === ViewState.HOME && !searchQuery && watchLater.length > 0 && (
              <div className="mt-14 animate-in fade-in duration-700">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 bg-purple-500/15 border border-purple-500/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Recommended For You</h2>
                    <p className="text-xs text-zinc-500">Based on your Watch List</p>
                  </div>
                </div>
                {isRecLoading ? (
                  <div className="flex items-center gap-3 py-10 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800 justify-center">
                    <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                    <span className="text-zinc-500 text-sm">AI is curating your feed…</span>
                  </div>
                ) : recommendedVideos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {recommendedVideos.map(video => (
                      <VideoCard
                        key={`rec-${video.id}`}
                        video={video}
                        isWatchLater={watchLater.includes(video.id)}
                        onToggleWatchLater={toggleWatchLater}
                        isSubscribed={true}
                        onSubscribeRequest={() => setShowLogin(true)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}

        {/* ══ Empty state ══════════════════════════════════════════════════ */}
        {!isLoadingVideos && filteredVideos.length === 0 && !showCarousels && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No videos found</h3>
            <p className="text-zinc-500 text-sm text-center max-w-xs">
              {currentView !== ViewState.HOME
                ? 'No content in this category yet. Check back soon!'
                : 'Try searching for something else or browse a different category.'}
            </p>
          </div>
        )}

      </div>{/* end padded container */}
    </div>
  );
};

export default HomeView;
