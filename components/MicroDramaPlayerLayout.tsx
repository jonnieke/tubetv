import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, ChevronRight, Heart, Lock, Play, Share2, Sparkles } from 'lucide-react';
import type { Video } from '../types';
import { buildComingSoonSchedule, isNewEpisode } from '../lib/series';

interface MicroDramaPlayerLayoutProps {
  activeVideo: Video;
  episodes: Video[];
  hasActivePass: boolean;
  isWatchLater: boolean;
  modalAutoPlay: boolean;
  language: string;
  isLocked: (video: Video) => boolean;
  onSelectEpisode: (video: Video) => void;
  onStartPlayback: () => void;
  onToggleWatchLater: (videoId: string) => void;
  onShare: (video: Video) => void;
  onOpenTrailer?: (url: string) => void;
  onClose: () => void;
  playerSlot: React.ReactNode;
}

const PAGE_SIZE = 30;
const LIKED_STORAGE_KEY = 'tubetv_liked_videos_v1';

function readLikedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(LIKED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const MicroDramaPlayerLayout: React.FC<MicroDramaPlayerLayoutProps> = ({
  activeVideo,
  episodes,
  isWatchLater,
  modalAutoPlay,
  language,
  isLocked,
  onSelectEpisode,
  onStartPlayback,
  onToggleWatchLater,
  onShare,
  onOpenTrailer,
  onClose,
  playerSlot,
}) => {
  const [plotExpanded, setPlotExpanded] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [likedIds, setLikedIds] = useState<string[]>(() => (typeof window !== 'undefined' ? readLikedIds() : []));

  useEffect(() => {
    try {
      window.localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(likedIds));
    } catch {}
  }, [likedIds]);

  const isLiked = likedIds.includes(activeVideo.id);
  const baseLikes = Math.max(0, Math.round((activeVideo.views || 0) * 0.15));
  const likeCount = baseLikes + (isLiked ? 1 : 0);
  const toggleLike = () => {
    setLikedIds((prev) =>
      prev.includes(activeVideo.id) ? prev.filter((id) => id !== activeVideo.id) : [...prev, activeVideo.id],
    );
  };

  const activeIdx = Math.max(
    0,
    episodes.findIndex((ep) => ep.id === activeVideo.id),
  );
  const defaultRangeStart = Math.floor(activeIdx / PAGE_SIZE) * PAGE_SIZE;
  const [rangeStart, setRangeStart] = useState(defaultRangeStart);

  const pageCount = Math.max(1, Math.ceil(episodes.length / PAGE_SIZE));
  const safeStart = rangeStart < episodes.length ? rangeStart : 0;
  const visibleEpisodes =
    episodes.length > PAGE_SIZE ? episodes.slice(safeStart, safeStart + PAGE_SIZE) : episodes;

  const upcomingSlots = useMemo(() => buildComingSoonSchedule(episodes, 60), [episodes]);

  const seriesName = activeVideo.seriesTitle || activeVideo.title;
  const epNum = activeVideo.episode || activeIdx + 1;
  const plotText =
    activeVideo.episodeSynopsis ||
    activeVideo.description ||
    activeVideo.seriesSynopsis ||
    '';

  const pills = useMemo(() => {
    const raw: string[] = [];
    if (activeVideo.genre) {
      activeVideo.genre.split(',').forEach((g) => {
        const clean = g.trim();
        if (clean) raw.push(clean);
      });
    }
    if (activeVideo.contentRating && activeVideo.contentRating !== 'UNRATED') {
      raw.push(activeVideo.contentRating);
    }
    raw.push('Micro Drama');
    if (activeVideo.author) raw.push(activeVideo.author);
    (activeVideo.tags || []).forEach((t) => {
      const clean = t.trim();
      if (clean && !raw.some((x) => x.toLowerCase() === clean.toLowerCase())) {
        raw.push(clean);
      }
    });
    return raw.slice(0, 6);
  }, [activeVideo]);

  const firstEp = episodes[0];

  return (
    <div
      className="relative w-full max-w-6xl max-h-[94dvh] overflow-y-auto lg:overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#0b0b0e] text-white shadow-2xl grid grid-cols-1 lg:grid-cols-[minmax(320px,430px)_1fr]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Left: Vertical 9:16 Stage */}
      <div className="relative flex items-center justify-center bg-[#060608] p-2 sm:p-5 lg:border-r lg:border-zinc-800/80">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to browsing"
          className="absolute top-3 left-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/90 border border-zinc-700/80 text-white hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="w-full max-w-[270px] sm:max-w-[340px] lg:max-w-[360px] mx-auto rounded-xl overflow-hidden shadow-2xl border border-zinc-800/70 bg-black">
          {playerSlot}
        </div>
      </div>

      {/* Right: Metadata, Actions & Numbered Episode Grid */}
      <div className="flex flex-col lg:max-h-[94dvh] lg:overflow-y-auto bg-[#101014] p-5 sm:p-6 space-y-5">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400 flex-wrap">
          <button type="button" onClick={onClose} className="hover:text-white transition-colors">
            Home
          </button>
          <span>/</span>
          <span className="text-zinc-300 truncate max-w-[180px]">{seriesName}</span>
          <span>/</span>
          <span className="text-white font-semibold">Episode {epNum}</span>
        </nav>

        {/* Title */}
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-snug">
            Episode {epNum} - {seriesName}
            {activeVideo.title && activeVideo.title !== seriesName ? ` · ${activeVideo.title}` : ''}
          </h1>
        </div>

        {/* Plot */}
        {plotText && (
          <div className="space-y-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {language === 'sw' ? `Muhtasari wa Kipindi ${epNum}` : `Plot of Episode ${epNum}`}
            </h2>
            <p className={`text-sm leading-relaxed text-zinc-300 ${plotExpanded ? '' : 'line-clamp-2'}`}>
              {plotText}
            </p>
            {plotText.length > 110 && (
              <button
                type="button"
                onClick={() => setPlotExpanded((v) => !v)}
                className="text-xs font-bold text-white hover:text-red-400 transition-colors"
              >
                {plotExpanded ? 'Less' : 'More'}
              </button>
            )}
          </div>
        )}

        {/* Tag Pills */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pills.map((pill) => (
              <span
                key={pill}
                className="rounded-full bg-zinc-800/90 border border-zinc-700/70 px-3 py-1 text-xs font-medium text-zinc-200"
              >
                {pill}
              </span>
            ))}
          </div>
        )}

        {/* Action Row */}
        <div className="grid grid-cols-4 gap-2 border-y border-zinc-800/80 py-3">
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={isLiked}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
              isLiked ? 'text-rose-400 bg-rose-500/10' : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
            }`}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            <span>{formatCompactCount(likeCount)}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleWatchLater(activeVideo.id)}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
              isWatchLater ? 'text-red-400 bg-red-500/10' : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
            }`}
          >
            <Bookmark size={18} fill={isWatchLater ? 'currentColor' : 'none'} />
            <span>{isWatchLater ? 'Saved' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={() => onShare(activeVideo)}
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-colors"
          >
            <Share2 size={18} />
            <span>Share</span>
          </button>

          {!modalAutoPlay ? (
            <button
              type="button"
              onClick={onStartPlayback}
              className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors"
            >
              <Play size={18} fill="currentColor" />
              <span>Watch</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => firstEp && onSelectEpisode(firstEp)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-colors"
            >
              <Sparkles size={18} className="text-amber-400" />
              <span>Ep {firstEp?.episode || 1}</span>
            </button>
          )}
        </div>

        {/* Episode Range Tabs + All Episodes */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              {Array.from({ length: pageCount }).map((_, idx) => {
                const start = idx * PAGE_SIZE;
                const end = Math.min(start + PAGE_SIZE, episodes.length);
                const active = !showComingSoon && safeStart === start;
                return (
                  <button
                    key={start}
                    type="button"
                    onClick={() => {
                      setShowComingSoon(false);
                      setRangeStart(start);
                    }}
                    className={`text-sm font-bold transition-colors pb-1 border-b-2 ${
                      active
                        ? 'text-white border-red-500'
                        : 'text-zinc-400 border-transparent hover:text-zinc-200'
                    }`}
                  >
                    {start + 1} - {end}
                  </button>
                );
              })}
              {upcomingSlots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowComingSoon((v) => !v)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${
                    showComingSoon
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  Coming Soon ({upcomingSlots.length})
                </button>
              )}
            </div>

            {firstEp && (
              <button
                type="button"
                onClick={() => {
                  setShowComingSoon(false);
                  setRangeStart(0);
                  onSelectEpisode(firstEp);
                }}
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                <span>All Episodes ({episodes.length})</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          {!showComingSoon ? (
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {activeVideo.seriesTrailerUrl && safeStart === 0 && onOpenTrailer && (
                <button
                  type="button"
                  onClick={() => onOpenTrailer(activeVideo.seriesTrailerUrl!)}
                  className="relative h-12 rounded-lg border border-zinc-800 bg-zinc-900/90 hover:border-zinc-600 text-xs font-bold text-zinc-200 flex items-center justify-center transition-colors"
                >
                  Trailer
                </button>
              )}
              {visibleEpisodes.map((ep) => {
                const locked = isLocked(ep);
                const isCurrent = ep.id === activeVideo.id;
                const isNew = isNewEpisode(ep);
                return (
                  <button
                    key={ep.id}
                    type="button"
                    aria-current={isCurrent ? 'true' : undefined}
                    onClick={() => onSelectEpisode(ep)}
                    className={`relative h-12 rounded-lg border text-sm font-bold flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'bg-red-600/20 border-red-500 text-red-400 shadow-sm shadow-red-600/20'
                        : 'bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:border-zinc-600 hover:text-white'
                    }`}
                  >
                    <span>{ep.episode || 1}</span>
                    {locked && (
                      <Lock
                        size={11}
                        className="absolute top-1.5 right-1.5 text-zinc-400"
                        aria-label="Locked"
                      />
                    )}
                    {isNew && !locked && (
                      <span
                        className="absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400"
                        title="New"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
              {upcomingSlots.map((slot) => (
                <div
                  key={`${slot.season}-${slot.episode}`}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs"
                >
                  <div className="font-bold text-white">
                    S{slot.season} · Ep {slot.episode}
                  </div>
                  <div className="text-[11px] text-amber-300/90 mt-0.5">{slot.releaseDate}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
