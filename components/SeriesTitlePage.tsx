import React, { useState, useMemo } from 'react';
import { ArrowLeft, Play, Clock, BookOpen, Eye, Star } from 'lucide-react';
import { Video } from '../types';
import { onThumbError } from '../lib/thumbnail';

interface Props {
  seriesTitle: string;
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onBack: () => void;
}

const formatViews = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
  : String(n);

const SeriesTitlePage: React.FC<Props> = ({
  seriesTitle,
  videos,
  watchLaterIds,
  onToggleWatchLater,
  onBack,
}) => {
  // All episodes for this series
  const episodes = useMemo(() =>
    videos
      .filter(v => v.seriesTitle?.toLowerCase().trim() === seriesTitle.toLowerCase().trim())
      .sort((a, b) => {
        if ((a.season ?? 1) !== (b.season ?? 1)) return (a.season ?? 1) - (b.season ?? 1);
        return (a.episode ?? 0) - (b.episode ?? 0);
      }),
    [videos, seriesTitle]
  );

  const seasonNumbers = useMemo(() =>
    [...new Set(episodes.map(e => e.season ?? 1))].sort((a, b) => a - b),
    [episodes]
  );

  const [activeSeason, setActiveSeason] = useState(seasonNumbers[0] ?? 1);

  const seasonEpisodes = episodes.filter(e => (e.season ?? 1) === activeSeason);

  // Pick best metadata from the episode set
  const meta = episodes[0];
  const totalViews = episodes.reduce((s, e) => s + (e.views ?? 0), 0);

  const playEpisode = (videoId: string) => {
    // Navigate home first so VideoCards are mounted, then fire playback
    onBack();
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('tube-deep-link', { detail: { videoId, timestamp: 0 } })
      );
      setTimeout(() => {
        document.getElementById(`video-${videoId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }, 300);
  };

  if (episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-500">
        <BookOpen size={40} className="mb-4 opacity-40" />
        <p className="text-lg font-bold">Series not found</p>
        <button onClick={onBack} className="mt-4 text-sm text-red-500 hover:text-red-400 flex items-center gap-2">
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* ── Backdrop hero ──────────────────────────────────────────────────── */}
      <div className="relative w-full h-[45vh] md:h-[55vh] overflow-hidden">
        <img
          src={meta?.thumbnail}
          alt={seriesTitle}
          onError={onThumbError}
          className="w-full h-full object-cover scale-105 blur-[2px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 to-transparent" />

        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 md:top-6 md:left-8 flex items-center gap-2 text-white/80 hover:text-white bg-black/40 backdrop-blur px-3 py-1.5 rounded-full text-sm font-medium transition-colors border border-white/10 hover:border-white/30"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* Series info overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-8">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="bg-red-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">Series</span>
            {meta?.genre && (
              <span className="text-zinc-300 text-[10px] bg-white/10 border border-white/15 px-2.5 py-1 rounded-full">{meta.genre}</span>
            )}
            {meta?.productionYear && (
              <span className="text-zinc-400 text-[10px]">{meta.productionYear}</span>
            )}
            <span className="text-zinc-400 text-[10px] flex items-center gap-1">
              <BookOpen size={9} /> {seasonNumbers.length} {seasonNumbers.length === 1 ? 'Season' : 'Seasons'} · {episodes.length} Episodes
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3 drop-shadow-2xl">
            {seriesTitle}
          </h1>

          <div className="flex items-center gap-4 mb-4 text-zinc-400 text-sm flex-wrap">
            {meta?.author && meta.author !== 'Tube Creator' && (
              <span className="font-medium text-zinc-300">{meta.author}</span>
            )}
            <span className="flex items-center gap-1.5">
              <Eye size={12} /> {formatViews(totalViews)} views
            </span>
          </div>

          {meta?.description && (
            <p className="text-zinc-300 text-sm md:text-base leading-relaxed max-w-2xl line-clamp-2 mb-5">
              {meta.description}
            </p>
          )}

          {/* Primary play button — plays E1 of active season */}
          {seasonEpisodes[0] && (
            <button
              onClick={() => playEpisode(seasonEpisodes[0].id)}
              className="flex items-center gap-3 bg-white text-black font-black px-8 py-3 rounded text-sm md:text-base hover:bg-zinc-100 transition-all shadow-2xl active:scale-[0.97]"
            >
              <Play size={18} fill="black" /> Play S{activeSeason} E1
            </button>
          )}
        </div>
      </div>

      {/* ── Episode list ───────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-6">

        {/* Season tabs */}
        {seasonNumbers.length > 1 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mr-1">Season</span>
            {seasonNumbers.map(s => (
              <button
                key={s}
                onClick={() => setActiveSeason(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all border ${
                  activeSeason === s
                    ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/30'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Episode rows */}
        <div className="space-y-2">
          {seasonEpisodes.map((ep, idx) => {
            const isSaved = watchLaterIds.includes(ep.id);
            return (
              <div
                key={ep.id}
                onClick={() => playEpisode(ep.id)}
                className="group flex items-center gap-4 p-3 md:p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-600 cursor-pointer transition-all duration-200"
              >
                {/* Episode number */}
                <div className="w-9 text-center flex-shrink-0">
                  <span className="text-zinc-600 group-hover:text-zinc-400 font-bold text-sm transition-colors">
                    {ep.episode ?? idx + 1}
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="relative w-32 md:w-40 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                  <img
                    src={ep.thumbnail}
                    alt={ep.title}
                    onError={onThumbError}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30">
                      <Play size={14} fill="white" className="text-white ml-0.5" />
                    </div>
                  </div>
                  {ep.duration && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-[9px] text-zinc-300 px-1.5 py-0.5 rounded font-medium">
                      {ep.duration}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-sm md:text-base line-clamp-1 group-hover:text-red-400 transition-colors">
                    {ep.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-zinc-500 text-xs flex-wrap">
                    <span className="flex items-center gap-1"><Clock size={9} /> {ep.duration}</span>
                    <span className="flex items-center gap-1"><Eye size={9} /> {formatViews(ep.views ?? 0)}</span>
                    {ep.isPremium && (
                      <span className="bg-purple-600/20 text-purple-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-purple-600/30">PREMIUM</span>
                    )}
                  </div>
                  {ep.description && (
                    <p className="text-zinc-500 text-xs mt-1.5 line-clamp-2 hidden md:block leading-relaxed">
                      {ep.description}
                    </p>
                  )}
                </div>

                {/* Save button */}
                <button
                  onClick={e => { e.stopPropagation(); onToggleWatchLater(ep.id); }}
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all border text-xs font-black ${
                    isSaved
                      ? 'bg-red-600/20 border-red-600/40 text-red-400'
                      : 'border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-300'
                  }`}
                  title={isSaved ? 'Remove from Watch List' : 'Save to Watch List'}
                >
                  {isSaved ? '✓' : '+'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SeriesTitlePage;
