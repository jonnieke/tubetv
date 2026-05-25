import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pause, Clock, BookOpen, Eye, Volume2, VolumeX, Maximize } from 'lucide-react';
import type HlsType from 'hls.js';
import { Video } from '../types';
import { onThumbError } from '../lib/thumbnail';
import { saveProgress } from '../lib/watchProgress';

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

const fmtTime = (s: number) => {
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

// ── Inline HLS player ─────────────────────────────────────────────────────────

const EpisodePlayer: React.FC<{ episode: Video; onEnded: () => void }> = ({ episode, onEnded }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef   = useRef<HlsType | null>(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [isMuted,   setIsMuted]     = useState(false);
  const [progress,  setProgress]    = useState(0);
  const [duration,  setDuration]    = useState(0);
  const [buffered,  setBuffered]    = useState(0);

  // Load HLS stream whenever episode changes
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !episode.url) return;

    let hls: HlsType | null = null;

    const attach = async () => {
      const Hls = (await import('hls.js')).default as typeof HlsType;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(episode.url!);
        hls.attachMedia(vid);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          vid.play().catch(() => {});
        });
      } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        vid.src = episode.url!;
        vid.play().catch(() => {});
      }
    };

    attach();

    return () => {
      hls?.destroy();
      hlsRef.current = null;
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
    };
  }, [episode.url]);

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setProgress(vid.currentTime);
    setDuration(vid.duration || 0);
    // Update buffered
    if (vid.buffered.length > 0) setBuffered(vid.buffered.end(vid.buffered.length - 1));
    // Save progress
    if (vid.duration > 0) saveProgress(episode.id, vid.currentTime, vid.duration);
  };

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play(); } else { vid.pause(); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const vid = videoRef.current;
    if (!vid || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    vid.currentTime = ratio * duration;
  };

  const toggleFullscreen = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else vid.requestFullscreen?.();
  };

  return (
    <div className="relative w-full bg-black aspect-video group/player">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
        playsInline
      />

      {/* Controls overlay */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 pointer-events-none">

        {/* Progress bar */}
        <div
          className="w-full px-3 mb-2 cursor-pointer pointer-events-auto"
          onClick={seek}
        >
          <div className="relative h-1 bg-white/20 rounded-full">
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
              style={{ width: duration ? `${(buffered / duration) * 100}%` : '0%' }}
            />
            {/* Played */}
            <div
              className="absolute inset-y-0 left-0 bg-red-500 rounded-full"
              style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-3 px-3 pb-3 pointer-events-auto">
          <button onClick={togglePlay} className="text-white hover:text-red-400 transition-colors">
            {isPlaying
              ? <Pause size={20} className="fill-current" />
              : <Play  size={20} className="fill-current ml-0.5" />
            }
          </button>
          <button onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; setIsMuted(m => !m); }}
            className="text-white hover:text-red-400 transition-colors">
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <span className="text-white/70 text-xs tabular-nums flex-1">
            {fmtTime(progress)} / {fmtTime(duration)}
          </span>
          <button onClick={toggleFullscreen} className="text-white hover:text-red-400 transition-colors">
            <Maximize size={16} />
          </button>
        </div>
      </div>

      {/* Big play button when paused */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center pointer-events-auto"
        >
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30 hover:bg-white/30 hover:scale-110 transition-all">
            <Play size={26} fill="white" className="text-white ml-1" />
          </div>
        </button>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const SeriesTitlePage: React.FC<Props> = ({
  seriesTitle,
  videos,
  watchLaterIds,
  onToggleWatchLater,
  onBack,
}) => {
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

  const [activeSeason,   setActiveSeason]   = useState(seasonNumbers[0] ?? 1);
  const [playingEpisode, setPlayingEpisode] = useState<Video | null>(null);

  const seasonEpisodes = episodes.filter(e => (e.season ?? 1) === activeSeason);
  const meta = episodes[0];
  const totalViews = episodes.reduce((s, e) => s + (e.views ?? 0), 0);

  // Auto-advance to next episode on end
  const handleEnded = () => {
    if (!playingEpisode) return;
    const idx = seasonEpisodes.findIndex(e => e.id === playingEpisode.id);
    if (idx >= 0 && idx < seasonEpisodes.length - 1) {
      setPlayingEpisode(seasonEpisodes[idx + 1]);
    } else {
      setPlayingEpisode(null);
    }
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

      {/* ── Player or Backdrop ────────────────────────────────────────────── */}
      {playingEpisode ? (
        <div className="relative bg-black">
          {/* Back button over player */}
          <button
            onClick={() => setPlayingEpisode(null)}
            className="absolute top-3 left-3 z-10 flex items-center gap-1.5 text-white/80 hover:text-white bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium border border-white/10 hover:border-white/30 transition-colors"
          >
            <ArrowLeft size={13} /> {seriesTitle}
          </button>

          <EpisodePlayer episode={playingEpisode} onEnded={handleEnded} />

          {/* Now playing label */}
          <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800">
            <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-semibold">Now Playing</p>
            <p className="text-white font-bold text-sm mt-0.5">{playingEpisode.title}</p>
            {playingEpisode.season != null && playingEpisode.episode != null && (
              <p className="text-zinc-500 text-xs mt-0.5">
                Season {playingEpisode.season} · Episode {playingEpisode.episode}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Backdrop hero when nothing is playing */
        <div className="relative w-full h-[45vh] md:h-[55vh] overflow-hidden">
          <img
            src={meta?.thumbnail}
            alt={seriesTitle}
            onError={onThumbError}
            className="w-full h-full object-cover scale-105 blur-[2px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 to-transparent" />

          <button
            onClick={onBack}
            className="absolute top-4 left-4 md:top-6 md:left-8 flex items-center gap-2 text-white/80 hover:text-white bg-black/40 backdrop-blur px-3 py-1.5 rounded-full text-sm font-medium border border-white/10 hover:border-white/30 transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-8">
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

            <div className="flex items-center gap-4 mb-4 text-zinc-400 text-sm">
              {meta?.author && meta.author !== 'Tube Creator' && (
                <span className="font-medium text-zinc-300">{meta.author}</span>
              )}
              <span className="flex items-center gap-1.5"><Eye size={12} /> {formatViews(totalViews)}</span>
            </div>

            {meta?.description && (
              <p className="text-zinc-300 text-sm leading-relaxed max-w-2xl line-clamp-2 mb-5">
                {meta.description}
              </p>
            )}

            {seasonEpisodes[0] && (
              <button
                onClick={() => setPlayingEpisode(seasonEpisodes[0])}
                className="flex items-center gap-3 bg-white text-black font-black px-8 py-3 rounded text-sm md:text-base hover:bg-zinc-100 transition-all shadow-2xl active:scale-[0.97]"
              >
                <Play size={18} fill="black" /> Play S{activeSeason} E1
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Episode list ─────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-6">

        {/* Season tabs */}
        {seasonNumbers.length > 1 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mr-1">Season</span>
            {seasonNumbers.map(s => (
              <button
                key={s}
                onClick={() => { setActiveSeason(s); setPlayingEpisode(null); }}
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
            const isSaved   = watchLaterIds.includes(ep.id);
            const isActive  = playingEpisode?.id === ep.id;
            return (
              <div
                key={ep.id}
                onClick={() => setPlayingEpisode(ep)}
                className={`group flex items-center gap-4 p-3 md:p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  isActive
                    ? 'bg-zinc-800 border-red-600/50 shadow-lg shadow-red-900/10'
                    : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                {/* Episode number / playing indicator */}
                <div className="w-9 text-center flex-shrink-0">
                  {isActive
                    ? <div className="w-4 h-4 mx-auto flex items-end justify-center gap-[2px]">
                        <div className="w-[3px] bg-red-500 animate-bounce rounded-full" style={{ height: '60%', animationDelay: '0ms' }} />
                        <div className="w-[3px] bg-red-500 animate-bounce rounded-full" style={{ height: '100%', animationDelay: '150ms' }} />
                        <div className="w-[3px] bg-red-500 animate-bounce rounded-full" style={{ height: '40%', animationDelay: '75ms' }} />
                      </div>
                    : <span className="text-zinc-600 group-hover:text-zinc-400 font-bold text-sm transition-colors">
                        {ep.episode ?? idx + 1}
                      </span>
                  }
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
                    <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30">
                      <Play size={13} fill="white" className="text-white ml-0.5" />
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
                  <h3 className={`font-bold text-sm md:text-base line-clamp-1 transition-colors ${isActive ? 'text-red-400' : 'text-white group-hover:text-red-400'}`}>
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

                {/* Save */}
                <button
                  onClick={e => { e.stopPropagation(); onToggleWatchLater(ep.id); }}
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all border text-xs font-black ${
                    isSaved ? 'bg-red-600/20 border-red-600/40 text-red-400' : 'border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-300'
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
