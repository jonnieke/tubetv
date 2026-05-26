import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Search, Sparkles, Loader2, Play, BookmarkPlus, BookmarkCheck,
  Info, ChevronLeft, ChevronRight, Flame, Star, Clock, Volume2, VolumeX, History,
  X, CheckCircle, Crown, Zap,
  type LucideIcon,
} from 'lucide-react';
import SearchFilterBar, { DurationFilter, SearchSort, SearchFilters } from './SearchFilterBar';
import { Video, NavItem, ViewStateOrString, ViewState } from '../types';
import VideoCard from './VideoCard';
import VideoCarousel from './VideoCarousel';
import SeriesCarousel from './SeriesCarousel';
import CBCStudyMode from './CBCStudyMode';
import KilimoPanel from './KilimoPanel';
import ChurchHub from './ChurchHub';
import CreatorProfile from './CreatorProfile';
import SeriesTitlePage from './SeriesTitlePage';
import VideoPlayerPage from './VideoPlayerPage';
import CreatorLeaderboard from './CreatorLeaderboard';
import OfflineLibrary from './OfflineLibrary';
import DataBudgetPanel from './DataBudgetPanel';
import ContinueWatchingCarousel from './ContinueWatchingCarousel';
import WatchHistoryView from './WatchHistoryView';
import BridgesOfLoveCarousel from './BridgesOfLoveCarousel';
import { getCategoryAffinities, getWatchedIds } from '../lib/watchHistory';

// ─────────────────────────────────────────────────────────────────────────────
// Interest → category mapping (matches OnboardingQuiz interest IDs)
// ─────────────────────────────────────────────────────────────────────────────
const INTEREST_TO_CATEGORY: Record<string, string[]> = {
  kilimo:    ['Farmers'],
  faith:     ['Faith'],
  education: ['Education'],
  comedy:    ['Comedy', 'Entertainment'],
  drama:     ['Drama', 'Originals', 'Movies', 'Series'],
  sports:    ['Sports'],
  music:     ['Music'],
  kids:      ['Kids'],
  wildlife:  ['Wildlife'],
  fashion:   ['Fashion'],
  business:  ['Business', 'Finance'],
  news:      ['News'],
};
import BandwidthToggle from './BandwidthToggle';
import type { ShortVideo } from '../types';
import Hls from 'hls.js';
import { onThumbError } from '../lib/thumbnail';

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
  isAdmin?: boolean;
  isPremium?: boolean;
  recommendedVideos: Video[];
  isRecLoading: boolean;
  navItems: NavItem[];
  setCurrentView: (v: ViewStateOrString) => void;
  setShowLogin: (v: boolean) => void;
  onPremiumClick?: () => void;
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
          onError={onThumbError}
        />
        {/* Hover overlay */}
        <div className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('tube-open-player', { detail: { videoId: video.id } }))}
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

        {/* #1 badge */}
        {rank === 1 && (
          <div className="absolute top-1.5 right-1.5">
            <Crown size={11} className="text-amber-400 drop-shadow" />
          </div>
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
      onClick={() => window.dispatchEvent(new CustomEvent('tube-open-player', { detail: { videoId: video.id } }))}
    >
      {/* Static thumbnail — fades out once video is ready */}
      <img
        src={video.thumbnail}
        alt={video.title}
        className={`absolute inset-0 w-full h-full object-cover bg-zinc-800 transition-opacity duration-700 ${isLive ? 'opacity-0' : 'opacity-100'}`}
        onError={onThumbError}
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
                  onError={e => { e.currentTarget.style.opacity = '0'; }} // decorative bg — hide on error is intentional
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
// Welcome Banner — shown once per session to unauthenticated visitors
// ─────────────────────────────────────────────────────────────────────────────

const WelcomeBanner: React.FC<{ onSignUp: () => void; onSignIn: () => void }> = ({ onSignUp, onSignIn }) => {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('tube_welcome_dismissed') === '1'; } catch { return false; }
  });
  if (dismissed) return null;
  const dismiss = () => {
    try { sessionStorage.setItem('tube_welcome_dismissed', '1'); } catch {}
    setDismissed(true);
  };

  return (
    <div className="mx-4 md:mx-0 mb-6 rounded-2xl overflow-hidden border border-zinc-700/50 relative animate-in fade-in slide-in-from-top-3 duration-500">
      {/* Kenyan flag stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 flex flex-col">
        <div className="flex-1 bg-[#006600]" />
        <div className="flex-1 bg-[#CC0001]" />
        <div className="flex-1 bg-black" />
      </div>
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 pl-5 pr-4 py-4 md:py-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Left: copy */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-2xl leading-none">🇰🇪</span>
              <h3 className="text-white font-black text-lg leading-tight">Karibu TubeKenya!</h3>
              <span className="hidden sm:inline text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Beta</span>
            </div>
            <p className="text-zinc-300 text-sm leading-relaxed">
              Burudani bora zaidi ya Kenya — filamu, elimu, kilimo, imani na zaidi.{' '}
              <span className="text-zinc-500">Stream local content anywhere, any device.</span>
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {[
                'Free to browse',
                'Kenyan-made content',
                'Data-saving 360p mode',
                'New uploads daily',
              ].map(f => (
                <span key={f} className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <CheckCircle size={11} className="text-green-400 flex-shrink-0" /> {f}
                </span>
              ))}
            </div>
          </div>
          {/* Right: CTAs */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onSignIn}
              className="px-4 py-2 text-sm font-semibold text-white border border-zinc-600 rounded-xl hover:border-zinc-400 transition-colors"
            >
              Ingia
            </button>
            <button
              onClick={onSignUp}
              className="px-5 py-2 text-sm font-black bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors shadow-lg shadow-red-900/30"
            >
              Jiunge Bure
            </button>
            <button onClick={dismiss} className="p-1.5 text-zinc-600 hover:text-white transition-colors flex-shrink-0">
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Premium upsell strip
// ─────────────────────────────────────────────────────────────────────────────

const PremiumStrip: React.FC<{ onSignUp: () => void }> = ({ onSignUp }) => (
  <div
    onClick={onSignUp}
    className="relative rounded-2xl overflow-hidden cursor-pointer group mb-2"
    role="button"
  >
    <div className="absolute inset-0 bg-gradient-to-r from-amber-950 via-zinc-900 to-zinc-950" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(245,158,11,0.15),transparent_60%)]" />
    <div className="relative flex items-center gap-4 px-5 md:px-8 py-4 md:py-5">
      <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/30 transition-colors">
        <Crown size={20} className="text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-black text-sm md:text-base">Pata Ndovu Premium</p>
        <p className="text-zinc-400 text-xs md:text-sm truncate">
          Tazama maudhui yote bila kikwazo · HD · Bila matangazo
          <span className="hidden sm:inline"> · Lipa na M-Pesa</span>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Zap size={14} className="text-amber-400" />
        <span className="text-amber-400 text-xs font-black uppercase tracking-wider group-hover:text-amber-300 transition-colors">
          Jaribu Sasa →
        </span>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Category & Genre metadata maps
// ─────────────────────────────────────────────────────────────────────────────

/** Categories that already have elevated (hand-crafted) carousel rows */
const ELEVATED_CATS = new Set(['Farmers', 'Faith', 'Education']);

const CAT_META: Record<string, { emoji: string; accent: string; sub: string }> = {
  Originals:    { emoji: '🎬', accent: 'from-red-500 to-rose-500',       sub: 'Kenyan-made films & dramas' },
  Movies:       { emoji: '🎞️', accent: 'from-red-600 to-orange-500',    sub: 'Full-length feature films' },
  Series:       { emoji: '📺', accent: 'from-violet-500 to-purple-500',  sub: 'Binge-worthy episodic content' },
  Kids:         { emoji: '🧒', accent: 'from-indigo-500 to-violet-500',  sub: 'Salama na ya kuvutia · Safe & fun' },
  Diaspora:     { emoji: '✈️', accent: 'from-teal-500 to-sky-500',       sub: 'Kwa Wakenya nje · Kenyans abroad' },
  Fashion:      { emoji: '👗', accent: 'from-pink-500 to-rose-500',       sub: 'Mitindo ya Kenya · Style & trends' },
  Wildlife:     { emoji: '🦁', accent: 'from-yellow-500 to-orange-500',  sub: 'Safari, asili na uhifadhi' },
  Live:         { emoji: '📡', accent: 'from-rose-500 to-red-600',       sub: 'Moja kwa moja · Live broadcasts' },
  Trending:     { emoji: '🔥', accent: 'from-orange-500 to-red-500',     sub: 'Kinachoendelea · What\'s hot' },
  News:         { emoji: '📰', accent: 'from-slate-500 to-zinc-600',     sub: 'Habari za leo · Today\'s news' },
  Sports:       { emoji: '⚽', accent: 'from-lime-500 to-green-600',     sub: 'Michezo · Sports & athletics' },
  Music:        { emoji: '🎵', accent: 'from-purple-500 to-pink-500',    sub: 'Muziki wa Kenya · Kenyan music' },
  Comedy:       { emoji: '😂', accent: 'from-orange-400 to-amber-500',   sub: 'Masihara · Laughs & light entertainment' },
  Health:       { emoji: '🏥', accent: 'from-emerald-500 to-teal-500',  sub: 'Afya · Health & wellness' },
  Business:     { emoji: '💼', accent: 'from-blue-600 to-indigo-600',   sub: 'Biashara · Business & finance' },
  Technology:   { emoji: '💻', accent: 'from-cyan-500 to-blue-500',     sub: 'Teknolojia · Tech & innovation' },
  Travel:       { emoji: '🗺️', accent: 'from-sky-500 to-cyan-500',      sub: 'Safari · Travel & exploration' },
  Food:         { emoji: '🍲', accent: 'from-amber-600 to-orange-600',  sub: 'Chakula · Food & cooking' },
};

const GENRE_META: Record<string, { emoji: string; accent: string; sub: string }> = {
  Drama:        { emoji: '🎭', accent: 'from-blue-500 to-indigo-500',   sub: 'Kenyan stories & human drama' },
  Comedy:       { emoji: '😂', accent: 'from-orange-500 to-amber-500',  sub: 'Masihara · Laughs & light entertainment' },
  Documentary:  { emoji: '🎙️', accent: 'from-zinc-500 to-slate-600',   sub: 'Hadithi za kweli · Real stories' },
  Action:       { emoji: '💥', accent: 'from-red-500 to-orange-600',    sub: 'Vitendo · Thrills & adventure' },
  Thriller:     { emoji: '🔪', accent: 'from-gray-700 to-zinc-800',     sub: 'Wasiwasi · Suspense & edge-of-seat' },
  Romance:      { emoji: '💕', accent: 'from-pink-500 to-rose-400',     sub: 'Mapenzi · Love & relationships' },
  Horror:       { emoji: '👻', accent: 'from-purple-900 to-zinc-900',   sub: 'Kutisha · Scary & supernatural' },
  Swahili:      { emoji: '🗣️', accent: 'from-green-600 to-teal-600',   sub: 'Filamu za Kiswahili' },
  Animation:    { emoji: '🎨', accent: 'from-violet-500 to-purple-500', sub: 'Cartoons & animated content' },
  Musical:      { emoji: '🎵', accent: 'from-cyan-500 to-blue-500',     sub: 'Nyimbo · Music-driven stories' },
  'Sci-Fi':     { emoji: '🚀', accent: 'from-sky-600 to-indigo-700',   sub: 'Science fiction & future worlds' },
  Historical:   { emoji: '🏺', accent: 'from-stone-600 to-amber-800',  sub: 'Historia · Kenya\'s past on screen' },
  Family:       { emoji: '👨‍👩‍👧', accent: 'from-emerald-500 to-teal-500', sub: 'Familia · For the whole family' },
  Crime:        { emoji: '🔍', accent: 'from-slate-700 to-zinc-900',    sub: 'Uhalifu · Crime & investigation' },
  Fantasy:      { emoji: '🧙', accent: 'from-purple-600 to-violet-700', sub: 'Kuchochea · Magical worlds' },
};

/** Fallback styling for unknown categories/genres */
const fallbackMeta = (name: string) => ({
  accent: 'from-zinc-500 to-zinc-700',
  sub: name,
});

/** Curated genre carousels shown on the home feed, in display order */
const GENRE_CAROUSELS = [
  'Drama', 'Action', 'Comedy', 'Romance', 'Faith',
  'Documentary', 'Thriller', 'Family', 'Horror', 'Swahili', 'Music',
];

/**
 * True if a video belongs to a genre. Matches flexibly against the
 * genre metaTag, the tags array, AND the category — case-insensitive —
 * so genre rows still populate even when genre tags aren't perfectly set.
 */
const videoMatchesGenre = (v: Video, genre: string): boolean => {
  const g = genre.toLowerCase();
  if (v.genre?.toLowerCase() === g) return true;
  if (v.category?.toLowerCase() === g) return true;
  if (v.tags?.some(t => t.toLowerCase() === g)) return true;
  return false;
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
  isAdmin = false,
  isPremium = false,
  recommendedVideos,
  isRecLoading,
  navItems,
  setCurrentView,
  setShowLogin,
  onPremiumClick,
}) => {
  // Admin / subscribers get full unrestricted access to all content
  const hasFullAccess = isAdmin || isAuthenticated || isPremium;

  // ─── Search secondary filters ──────────────────────────────────────────────
  const DEFAULT_FILTERS: SearchFilters = { duration: '', sort: 'relevant', category: '' };
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  // Reset secondary filters whenever the search query changes
  useEffect(() => { setSearchFilters(DEFAULT_FILTERS); }, [searchQuery]);

  /** Parse a duration string like "5:32" or "1:23:45" → total seconds */
  const parseDuration = (dur: string): number => {
    const parts = dur.split(':').map(Number).reverse();
    return (parts[0] || 0) + (parts[1] || 0) * 60 + (parts[2] || 0) * 3600;
  };

  /** filteredVideos with secondary search filters + sort applied */
  const displayVideos = useMemo(() => {
    if (!searchQuery) return filteredVideos;
    let result = [...filteredVideos];

    // Duration filter
    if (searchFilters.duration) {
      result = result.filter(v => {
        const secs = parseDuration(v.duration || '');
        if (searchFilters.duration === 'short')  return secs > 0 && secs < 300;
        if (searchFilters.duration === 'medium') return secs >= 300 && secs <= 1200;
        if (searchFilters.duration === 'long')   return secs > 1200;
        return true;
      });
    }

    // Category filter
    if (searchFilters.category) {
      result = result.filter(v => v.category === searchFilters.category);
    }

    // Sort
    if (searchFilters.sort === 'views') {
      result = [...result].sort((a, b) => b.views - a.views);
    } else if (searchFilters.sort === 'newest') {
      result = [...result].sort((a, b) => {
        if (a.dateUploaded && b.dateUploaded) return new Date(b.dateUploaded).getTime() - new Date(a.dateUploaded).getTime();
        return 0;
      });
    }
    // 'relevant' keeps App.tsx order (already relevance-sorted by substring match)

    return result;
  }, [filteredVideos, searchQuery, searchFilters]);

  /** Unique categories in the current unfiltered search results (for category chips) */
  const searchCategories = useMemo(() => {
    if (!searchQuery) return [];
    const counts: Record<string, number> = {};
    filteredVideos.forEach(v => { counts[v.category] = (counts[v.category] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [filteredVideos, searchQuery]);

  const [heroProgress, setHeroProgress] = useState(0);
  // Hide hero when user has drilled into a sort-mode pill (New Releases / Most Watched)
  const showHero = currentView === ViewState.HOME && !searchQuery &&
    activeSubCategory !== 'New Releases' && activeSubCategory !== 'Most Watched';

  // "For You" — personalized row based on onboarding quiz interests + watch history affinities
  const forYouVideos = useMemo<Video[]>(() => {
    // Collect target categories from onboarding quiz
    const quizInterests: string[] = (() => {
      try { return JSON.parse(localStorage.getItem('tube_interests') || '[]'); } catch { return []; }
    })();
    const quizCats = new Set<string>(
      quizInterests.flatMap(id => INTEREST_TO_CATEGORY[id] || [])
    );

    // Merge with top watch-history category affinities
    getCategoryAffinities().forEach(c => quizCats.add(c));

    if (quizCats.size === 0) return [];

    // Filter videos that match any of the target categories; exclude already-watched
    const watched = getWatchedIds();
    const matched = videos
      .filter(v => quizCats.has(v.category) && !watched.has(v.id))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    return matched;
  }, [videos]);


  // Dynamic categories — all unique category values found in the library,
  // sorted by number of videos desc, with elevated cats excluded (they appear above)
  const dynamicCategories = useMemo(() => {
    const BAD_CATS = new Set(['Uncategorized', 'uncategorized', '', 'undefined', 'null']);
    const counts: Record<string, number> = {};
    videos.forEach(v => { if (v.category) counts[v.category] = (counts[v.category] || 0) + 1; });
    return Object.entries(counts)
      .filter(([cat]) => !ELEVATED_CATS.has(cat) && !BAD_CATS.has(cat))
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
  }, [videos]);

  // Genre carousels — curated list filtered to those that actually have content,
  // plus any extra genre tags found in the data that aren't already curated
  const genreCarousels = useMemo(() => {
    const curated = GENRE_CAROUSELS.filter(g => videos.some(v => videoMatchesGenre(v, g)));
    const extra = Array.from(new Set(
      videos.map(v => v.genre).filter((g): g is string => !!g)
    )).filter(g => !GENRE_CAROUSELS.some(c => c.toLowerCase() === g.toLowerCase()));
    return [...curated, ...extra];
  }, [videos]);

  // Auto-advance hero
  useEffect(() => {
    if (!showHero) return;
    // Admin-pinned videos first (up to 5), fill remainder with top-by-views
    const pinned = videos.filter(v => v.featured);
    const byViews = videos.filter(v => !v.featured).sort((a, b) => b.views - a.views);
    const featuredVideos = [...pinned, ...byViews].slice(0, 5);
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

  // Home sort-mode pills
  const HOME_SORT_PILLS = ['All', 'Trending', 'New Releases', 'Most Watched'] as const;
  type HomeSortPill = typeof HOME_SORT_PILLS[number];
  const isHomeSortPill = (s: string): s is HomeSortPill => (HOME_SORT_PILLS as readonly string[]).includes(s);

  const showCarousels =
    currentView === ViewState.HOME &&
    !searchQuery &&
    (activeSubCategory === 'All' || activeSubCategory === 'Trending' || activeSubCategory === '');

  const showNewReleases =
    currentView === ViewState.HOME && !searchQuery && activeSubCategory === 'New Releases';

  const showMostWatched =
    currentView === ViewState.HOME && !searchQuery && activeSubCategory === 'Most Watched';

  // Sorted video lists for sort-mode grids
  const newReleasesVideos = showNewReleases
    ? [...videos].sort((a, b) => {
        if (a.dateUploaded && b.dateUploaded) return new Date(b.dateUploaded).getTime() - new Date(a.dateUploaded).getTime();
        if (a.dateUploaded) return -1;
        if (b.dateUploaded) return 1;
        return 0;
      })
    : [];

  const mostWatchedVideos = showMostWatched
    ? [...videos].sort((a, b) => b.views - a.views)
    : [];

  const showOriginalsSeries =
    currentView === ViewState.ORIGINALS && !searchQuery && activeSubCategory === 'Series';

  const showOriginalsCarousels =
    currentView === ViewState.ORIGINALS &&
    !searchQuery &&
    (activeSubCategory === 'All' || activeSubCategory === 'Movies');

  /** Open the dedicated player page for a video */
  const playVideo = (id: string) => onVideoOpen(id);

  const onCreatorClick = (name: string) => setCurrentView(`creator:${name}`);
  const onSeriesClick  = (title: string) => setCurrentView(`series:${title}`);
  const onVideoOpen    = (id: string)    => setCurrentView(`watch:${id}`);

  // Listen for tube-open-player fired by any video click
  useEffect(() => {
    const handler = (e: Event) => {
      const { videoId, timestamp } = (e as CustomEvent<{ videoId: string; timestamp?: number }>).detail;
      if (videoId) setCurrentView(`watch:${videoId}${timestamp ? `@${Math.floor(timestamp)}` : ''}`);
    };
    window.addEventListener('tube-open-player', handler);
    return () => window.removeEventListener('tube-open-player', handler);
  }, [setCurrentView]);

  // ─── Watch history view ──────────────────────────────────────────────────────
  if (currentView === ViewState.HISTORY) {
    return <WatchHistoryView />;
  }

  // ─── Offline library view ────────────────────────────────────────────────────
  if (currentView === ViewState.OFFLINE) {
    return (
      <div className="pb-24 px-4 md:px-8 pt-4">
        <DataBudgetPanel />
        <OfflineLibrary />
      </div>
    );
  }

  // ─── Creator profile view — early render before all carousel logic ─────────
  if (typeof currentView === 'string' && currentView.startsWith('creator:')) {
    const creatorName = currentView.slice(8);
    return (
      <div className="pb-24 px-4 md:px-8 pt-4">
        <CreatorProfile
          name={creatorName}
          videos={videos}
          watchLaterIds={watchLater}
          onToggleWatchLater={toggleWatchLater}
          onSubscribeRequest={() => setShowLogin(true)}
          onBack={() => setCurrentView(ViewState.HOME)}
          onCreatorClick={onCreatorClick}
        />
      </div>
    );
  }

  // ─── Watch page ──────────────────────────────────────────────────────────────
  if (typeof currentView === 'string' && currentView.startsWith('watch:')) {
    const raw = currentView.slice(6);
    const atIdx = raw.indexOf('@');
    const videoId  = atIdx >= 0 ? raw.slice(0, atIdx) : raw;
    const startAt  = atIdx >= 0 ? parseInt(raw.slice(atIdx + 1)) || 0 : 0;
    const video = videos.find(v => v.id === videoId);
    if (video) {
      return (
        <VideoPlayerPage
          video={video}
          startAt={startAt}
          videos={videos}
          watchLaterIds={watchLater}
          onToggleWatchLater={toggleWatchLater}
          onBack={() => setCurrentView(ViewState.HOME)}
          onVideoClick={onVideoOpen}
          isAuthenticated={isAuthenticated}
        />
      );
    }
  }

  // ─── Series title page ───────────────────────────────────────────────────────
  if (typeof currentView === 'string' && currentView.startsWith('series:')) {
    const title = currentView.slice(7);
    return (
      <SeriesTitlePage
        seriesTitle={title}
        videos={videos}
        watchLaterIds={watchLater}
        onToggleWatchLater={toggleWatchLater}
        onBack={() => setCurrentView(ViewState.HOME)}
      />
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="pb-24">

      {/* ══════════════════════════════════════════════════════════════════
          NETFLIX-STYLE HERO BANNER
      ══════════════════════════════════════════════════════════════════ */}
      {showHero && (() => {
        // Admin-pinned videos first, then fill with the latest uploads so the
        // hero always surfaces fresh content rather than old high-view counts.
        const pinned = videos.filter(v => v.featured);
        const byDate = videos
          .filter(v => !v.featured)
          .sort((a, b) => {
            const da = a.dateUploaded ? new Date(a.dateUploaded).getTime() : 0;
            const db = b.dateUploaded ? new Date(b.dateUploaded).getTime() : 0;
            return db - da; // newest first
          });
        const featuredVideos = [...pinned, ...byDate].slice(0, 5);
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
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={i === 0 ? 'high' : 'low'}
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
                  onClick={() => hero.seriesTitle ? onSeriesClick(hero.seriesTitle) : playVideo(hero.id)}
                  className="flex items-center gap-2.5 bg-white text-black font-bold px-7 md:px-9 py-3 md:py-3.5 rounded text-sm md:text-base hover:bg-zinc-100 transition-all shadow-2xl active:scale-[0.97] flex-shrink-0"
                >
                  <Play size={20} fill="black" className="flex-shrink-0" /> {hero.seriesTitle ? 'View Series' : 'Play'}
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

        {/* Sub-category pills + bandwidth toggle */}
        <div className="flex items-center gap-2 pb-2 mb-7 sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-xl py-3 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-white/[0.04]">
          {/* Scrollable pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0">
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
          {/* Bandwidth / quality toggle — always visible on the right */}
          <BandwidthToggle />
        </div>

        {/* ── Welcome banner (unauthenticated, HOME only) ── */}
        {currentView === ViewState.HOME && !isAuthenticated && !searchQuery && (
          <WelcomeBanner onSignUp={() => setShowLogin(true)} onSignIn={() => setShowLogin(true)} />
        )}

        {/* Continue Watching */}
        {currentView === ViewState.HOME && !searchQuery && (
          <div className="px-4 md:px-8">
            <ContinueWatchingCarousel videos={videos} />
          </div>
        )}

        {/* Search filter bar — only in search mode */}
        {!isLoadingVideos && searchQuery && (
          <SearchFilterBar
            searchQuery={searchQuery}
            resultCount={displayVideos.length}
            totalCount={filteredVideos.length}
            categories={searchCategories}
            filters={searchFilters}
            onChange={partial => setSearchFilters(prev => ({ ...prev, ...partial }))}
            onReset={() => setSearchFilters(DEFAULT_FILTERS)}
          />
        )}

        {/* Section heading (flat grid mode) — hidden for views with dedicated UI, and hidden in search mode (bar replaces it) */}
        {!searchQuery && !showCarousels && !showOriginalsSeries && !showOriginalsCarousels &&
          !(currentView === ViewState.EDUCATION && !searchQuery) &&
          !(currentView === ViewState.FAITH && !searchQuery) && (
          <div className="mb-6 flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">
              {activeSubCategory !== 'All'
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
          <>
          <div className="space-y-2 animate-in fade-in duration-500">

            {/* ── RETURNING USERS: resume & personalisation (hidden for new visitors) ── */}

            {/* For You — quiz interests + watch history (only when meaningful) */}
            {forYouVideos.length >= 3 && (
              <VideoCarousel
                title="For You"
                subtitle="Based on your interests"
                accentColor="from-rose-500 to-pink-500"
                videos={forYouVideos}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={hasFullAccess}
              />
            )}

            {/* ── SOCIAL PROOF: what Kenya is watching ── */}

            {/* Top 10 in Kenya */}
            <Top10Row
              videos={[...videos].sort((a, b) => b.views - a.views).slice(0, 10)}
              watchLaterIds={watchLater}
              onToggleWatchLater={toggleWatchLater}
            />

            {/* New This Week — freshness signal */}
            <NewThisWeek
              videos={
                [...videos]
                  .sort((a, b) => {
                    if (a.dateUploaded && b.dateUploaded) {
                      return new Date(b.dateUploaded).getTime() - new Date(a.dateUploaded).getTime();
                    }
                    return 0;
                  })
                  .slice(0, 4)
              }
              watchLaterIds={watchLater}
              onToggleWatchLater={toggleWatchLater}
              onPlay={playVideo}
            />

            {/* ── BRIDGES OF LOVE: featured series spotlight ── */}
            <BridgesOfLoveCarousel
              videos={videos}
              onSeriesClick={onSeriesClick}
              onVideoClick={onVideoOpen}
            />

            {/* ── KENYA'S IDENTITY: the three pillars unique to this platform ── */}

            {(() => { const v = videos.filter(x => x.category === 'Farmers'); return v.length > 0 && (
              <VideoCarousel
                title="Kilimo"
                subtitle="Kilimo cha kisasa · Modern farming & agribusiness"
                accentColor="from-green-500 to-emerald-500"
                videos={v}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={hasFullAccess}
              />
            ); })()}

            {(() => { const v = videos.filter(x => x.category === 'Faith'); return v.length > 0 && (
              <VideoCarousel
                title="Imani"
                subtitle="Mahubiri, ibada na sala · Sermons, worship & devotion"
                accentColor="from-amber-500 to-yellow-500"
                videos={v}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={hasFullAccess}
              />
            ); })()}

            {(() => { const v = videos.filter(x => x.category === 'Education'); return v.length > 0 && (
              <VideoCarousel
                title="Elimu"
                subtitle="CBC, KCSE na chuo kikuu · Kenyan curriculum"
                accentColor="from-blue-500 to-cyan-500"
                videos={v}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={hasFullAccess}
              />
            ); })()}

            {/* ── MOVIES ── */}

            {(() => {
              const movieVids = videos.filter(v => v.category === 'Movies' || v.category === 'Originals');
              return movieVids.length > 0 ? (
                <VideoCarousel
                  title="Movies"
                  subtitle="Kenyan-made films & dramas"
                  accentColor="from-red-600 to-orange-500"
                  videos={movieVids}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={hasFullAccess}
                />
              ) : null;
            })()}

            {/* ── SERIES: episodic content grouped by show ── */}

            {(() => {
              const seriesVids = videos.filter(v => v.seriesTitle || (v.season != null && v.episode != null));
              return seriesVids.length > 0 ? (
                <SeriesCarousel
                  title="Series"
                  videos={seriesVids}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={hasFullAccess}
                  onSubscribeRequest={onPremiumClick ?? (() => setShowLogin(true))}
                  onSeriesClick={onSeriesClick}
                />
              ) : null;
            })()}

            {/* AI Picks — only when Gemini has actual results */}
            {isRecLoading && watchLater.length > 0 ? (
              <div className="flex items-center gap-3 py-5 px-2">
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
                <span className="text-zinc-500 text-sm">AI is personalising your feed…</span>
              </div>
            ) : recommendedVideos.length > 0 ? (
              <VideoCarousel
                title="Recommended For You"
                subtitle="Curated by AI based on your Watch List"
                accentColor="from-purple-500 to-pink-500"
                videos={recommendedVideos}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={true}
              />
            ) : null}

            {/* ── UPSELL: shown after user has seen the content value ── */}
            {!hasFullAccess && (
              <PremiumStrip onSignUp={onPremiumClick ?? (() => setShowLogin(true))} />
            )}

          </div>

          {/* Top Creators leaderboard — below carousel feed on HOME */}
          {currentView === ViewState.HOME && !searchQuery && (
            <div className="mt-4">
              <CreatorLeaderboard videos={videos} onCreatorClick={onCreatorClick} />
            </div>
          )}
          </>
        )}

        {/* ══ ORIGINALS: Series layout — dynamic by genre ═════════════════ */}
        {!isLoadingVideos && showOriginalsSeries && (
          <div className="space-y-2 animate-in fade-in duration-500">
            {genreCarousels.map(genre => {
              const gv = filteredVideos.filter(v => videoMatchesGenre(v, genre) && (v.seriesTitle || (v.season && v.episode)));
              if (gv.length === 0) return null;
              return (
                <SeriesCarousel
                  key={genre}
                  title={`${genre} Series`}
                  videos={gv}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={hasFullAccess}
                  onSubscribeRequest={() => setShowLogin(true)}
                  onSeriesClick={onSeriesClick}
                />
              );
            })}
            {/* Fallback if no genre tags — show all series */}
            {genreCarousels.length === 0 && (() => {
              const gv = filteredVideos.filter(v => v.seriesTitle || (v.season && v.episode));
              return gv.length > 0 ? (
                <SeriesCarousel
                  title="All Series"
                  videos={gv}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={hasFullAccess}
                  onSubscribeRequest={() => setShowLogin(true)}
                  onSeriesClick={onSeriesClick}
                />
              ) : null;
            })()}
          </div>
        )}

        {/* ══ ORIGINALS: Genre carousels — fully dynamic ══════════════════ */}
        {!isLoadingVideos && showOriginalsCarousels && (
          <div className="space-y-2 animate-in fade-in duration-500">
            {genreCarousels.map(genre => {
              const gv = filteredVideos.filter(v => videoMatchesGenre(v, genre));
              if (gv.length === 0) return null;
              const { accent, sub } = GENRE_META[genre] ?? fallbackMeta(genre);
              return (
                <VideoCarousel
                  key={genre}
                  title={genre}
                  subtitle={sub}
                  accentColor={accent}
                  videos={gv}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={hasFullAccess}
                />
              );
            })}
            {/* Fallback if no genre tags */}
            {genreCarousels.length === 0 && (
              <VideoCarousel
                title="All Films"
                subtitle="Kenyan-made films & dramas"
                accentColor="from-red-500 to-orange-500"
                videos={filteredVideos}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={hasFullAccess}
              />
            )}
          </div>
        )}

        {/* ══ HOME: New Releases sorted grid ══════════════════════════════ */}
        {!isLoadingVideos && showNewReleases && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-7 bg-gradient-to-b from-sky-400 to-blue-600 rounded-full flex-shrink-0" />
              <div>
                <h2 className="text-xl font-black text-white">New Releases</h2>
                <p className="text-zinc-500 text-xs mt-0.5">Latest uploads, freshest first</p>
              </div>
            </div>
            {newReleasesVideos.length === 0 ? (
              <p className="text-zinc-600 text-sm py-10 text-center">No videos yet — check back soon.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {newReleasesVideos.map(video => (
                  <div id={`video-${video.id}`} key={video.id}>
                    <VideoCard
                      video={video}
                      isWatchLater={watchLater.includes(video.id)}
                      onToggleWatchLater={toggleWatchLater}
                      isSubscribed={hasFullAccess}
                      onSubscribeRequest={() => setShowLogin(true)}
                      onCreatorClick={onCreatorClick}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ HOME: Most Watched sorted grid ═══════════════════════════════ */}
        {!isLoadingVideos && showMostWatched && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-7 bg-gradient-to-b from-orange-400 to-red-600 rounded-full flex-shrink-0" />
              <div>
                <h2 className="text-xl font-black text-white">Most Watched</h2>
                <p className="text-zinc-500 text-xs mt-0.5">All-time most viewed on Tube TV</p>
              </div>
            </div>
            {mostWatchedVideos.length === 0 ? (
              <p className="text-zinc-600 text-sm py-10 text-center">No videos yet — check back soon.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {mostWatchedVideos.map((video, i) => (
                  <div id={`video-${video.id}`} key={video.id} className="relative">
                    {/* Rank badge for top 10 */}
                    {i < 10 && (
                      <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-red-600 text-white text-xs font-black flex items-center justify-center shadow-lg">
                        {i + 1}
                      </div>
                    )}
                    <VideoCard
                      video={video}
                      isWatchLater={watchLater.includes(video.id)}
                      onToggleWatchLater={toggleWatchLater}
                      isSubscribed={hasFullAccess}
                      onSubscribeRequest={() => setShowLogin(true)}
                      onCreatorClick={onCreatorClick}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ Flat grid (search / specific sub-category) ══════════════════ */}
        {!isLoadingVideos && !showCarousels && !showOriginalsSeries && !showOriginalsCarousels && !showNewReleases && !showMostWatched && (
          <>
            {/* ── Education: CBC Study Mode ── */}
            {currentView === ViewState.EDUCATION && !searchQuery && (
              <CBCStudyMode
                videos={videos.filter(v => v.category === 'Education')}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                onSubscribeRequest={() => setShowLogin(true)}
              />
            )}

            {/* ── Farmers: Kilimo market panel above the grid ── */}
            {currentView === ViewState.FARMERS && !searchQuery && (
              <KilimoPanel />
            )}

            {/* ── Faith: Church Hub ── */}
            {currentView === ViewState.FAITH && !searchQuery && (
              <ChurchHub
                videos={videos.filter(v => v.category === 'Faith')}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                onSubscribeRequest={() => setShowLogin(true)}
              />
            )}

            {/* Standard flat grid — used for search results, sub-category filters, and
                non-special views. Education/Faith handle their own grids above. */}
            {(searchQuery || (currentView !== ViewState.EDUCATION && currentView !== ViewState.FAITH)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-in slide-in-from-bottom-4 duration-500">
              {displayVideos.map(video => (
                <div id={`video-${video.id}`} key={video.id}>
                  <VideoCard
                    video={video}
                    isWatchLater={watchLater.includes(video.id)}
                    onToggleWatchLater={toggleWatchLater}
                    isSubscribed={true}
                    onSubscribeRequest={() => setShowLogin(true)}
                    onCreatorClick={onCreatorClick}
                  />
                </div>
              ))}
            </div>
            )}

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
                        onCreatorClick={onCreatorClick}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}

        {/* ══ Empty state ══════════════════════════════════════════════════ */}
        {!isLoadingVideos && displayVideos.length === 0 && !showCarousels &&
          !(currentView === ViewState.EDUCATION && !searchQuery) &&
          !(currentView === ViewState.FAITH && !searchQuery) && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No videos found</h3>
            <p className="text-zinc-500 text-sm text-center max-w-xs">
              {searchQuery && (searchFilters.duration || searchFilters.category)
                ? 'No results match your filters. Try adjusting the duration or category.'
                : currentView !== ViewState.HOME
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
