import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Share2, MessageCircle, BookmarkPlus, BookmarkCheck, Eye, Calendar,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import type HlsType from 'hls.js';
import { Video } from '../types';
import { onThumbError } from '../lib/thumbnail';
import { saveProgress, getProgress } from '../lib/watchProgress';
import ShareSheet from './ShareSheet';
import CommentsModal from './CommentsModal';

interface Props {
  video: Video;
  startAt?: number;
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onBack: () => void;
  onVideoClick: (id: string) => void;
  isAuthenticated: boolean;
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

// ── HLS Player ────────────────────────────────────────────────────────────────

const Player: React.FC<{ video: Video; startAt?: number; onEnded?: () => void }> = ({ video, startAt = 0, onEnded }) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const hlsRef    = useRef<HlsType | null>(null);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [isMuted,       setIsMuted]       = useState(false);
  const [volume,        setVolume]        = useState(1);
  const [showVolSlider, setShowVolSlider] = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [duration,      setDuration]      = useState(0);
  const [buffered,      setBuffered]      = useState(0);
  const [isFullscreen,  setIsFullscreen]  = useState(false);

  // Resume position: explicit startAt takes priority, else saved progress
  const resumeAt = startAt > 0 ? startAt : (getProgress(video.id)?.position ?? 0);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !video.url) return;
    let hls: HlsType | null = null;
    const attach = async () => {
      const Hls = (await import('hls.js')).default as typeof HlsType;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(video.url!);
        hls.attachMedia(vid);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (resumeAt > 0) vid.currentTime = resumeAt;
          vid.play().catch(() => {});
        });
      } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
        vid.src = video.url!;
        vid.addEventListener('loadedmetadata', () => {
          if (resumeAt > 0) vid.currentTime = resumeAt;
        }, { once: true });
        vid.play().catch(() => {});
      }
    };
    attach();
    return () => { hls?.destroy(); hlsRef.current = null; vid.pause(); vid.removeAttribute('src'); vid.load(); };
  }, [video.url]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.paused ? vid.play() : vid.pause();
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.muted || vid.volume === 0) {
      const restore = volume > 0 ? volume : 1;
      vid.muted = false; vid.volume = restore;
      setIsMuted(false); setVolume(restore);
    } else {
      vid.muted = true; setIsMuted(true);
    }
  };

  const changeVolume = (v: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.volume = v; vid.muted = v === 0;
    setVolume(v); setIsMuted(v === 0);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const vid = videoRef.current;
    if (!vid || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    vid.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else container.requestFullscreen?.();
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setProgress(vid.currentTime);
    setDuration(vid.duration || 0);
    if (vid.buffered.length > 0) setBuffered(vid.buffered.end(vid.buffered.length - 1));
    if (vid.duration > 0) saveProgress(video.id, vid.currentTime, vid.duration);
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

      {/* Click-to-pause overlay */}
      <div className="absolute inset-0 cursor-pointer" onClick={togglePlay} />

      {/* Controls */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 pointer-events-none">
        {/* Seek bar */}
        <div className="w-full px-4 mb-2 pointer-events-auto cursor-pointer" onClick={e => { e.stopPropagation(); seek(e); }}>
          <div className="relative h-1 hover:h-1.5 transition-all bg-white/20 rounded-full">
            <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: duration ? `${(buffered / duration) * 100}%` : '0%' }} />
            <div className="absolute inset-y-0 left-0 bg-red-500 rounded-full" style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }} />
          </div>
        </div>

        {/* Button row */}
        <div className="flex items-center gap-3 px-4 pb-4 pointer-events-auto">
          <button onClick={e => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-red-400 transition-colors">
            {isPlaying ? <Pause size={22} className="fill-current" /> : <Play size={22} className="fill-current ml-0.5" />}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2" onMouseEnter={() => setShowVolSlider(true)} onMouseLeave={() => setShowVolSlider(false)}>
            <button onClick={e => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-red-400 transition-colors">
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${showVolSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'}`} onClick={e => e.stopPropagation()}>
              <input type="range" min={0} max={1} step={0.02} value={isMuted ? 0 : volume}
                onChange={e => changeVolume(parseFloat(e.target.value))}
                className="w-full h-1 accent-red-500 cursor-pointer" />
            </div>
          </div>

          <span className="text-white/70 text-xs tabular-nums flex-1">{fmtTime(progress)} / {fmtTime(duration)}</span>

          <button onClick={e => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-red-400 transition-colors">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>

      {/* Centre play icon when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30">
            <Play size={32} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const VideoPlayerPage: React.FC<Props> = ({
  video, startAt = 0, videos, watchLaterIds, onToggleWatchLater, onBack, onVideoClick, isAuthenticated,
}) => {
  const [showShare,    setShowShare]    = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const isSaved = watchLaterIds.includes(video.id);

  // Related: same category, exclude current
  const related = useMemo(() =>
    videos
      .filter(v => v.id !== video.id && v.category === video.category)
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 12),
    [video, videos]
  );

  // Scroll to top when video changes
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [video.id]);

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">

      {/* ── Player ── */}
      <div className="w-full bg-black sticky top-0 z-30">
        <Player video={video} startAt={startAt} />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4 flex flex-col lg:flex-row gap-6">

        {/* ── Main column ── */}
        <div className="flex-1 min-w-0">

          {/* Back */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>

          {/* Title */}
          <h1 className="text-white font-black text-xl md:text-2xl leading-tight mb-2">
            {video.title}
          </h1>

          {/* Meta strip */}
          <div className="flex flex-wrap items-center gap-3 text-zinc-500 text-sm mb-4">
            <span className="flex items-center gap-1.5"><Eye size={13} /> {formatViews(video.views)} views</span>
            {video.dateUploaded && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                {new Date(video.dateUploaded).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            )}
            {video.category && (
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-medium">
                {video.category}
              </span>
            )}
            {video.isPremium && (
              <span className="px-2 py-0.5 rounded-full bg-purple-600/20 border border-purple-600/30 text-purple-300 text-xs font-bold">PREMIUM</span>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <button
              onClick={() => onToggleWatchLater(video.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-all ${
                isSaved
                  ? 'bg-red-600/20 border-red-600/40 text-red-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'
              }`}
            >
              {isSaved ? <BookmarkCheck size={15} /> : <BookmarkPlus size={15} />}
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => setShowShare(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-all"
            >
              <Share2 size={15} /> Share
            </button>
            <button
              onClick={() => setShowComments(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-all ${
                showComments
                  ? 'bg-zinc-700 border-zinc-600 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'
              }`}
            >
              <MessageCircle size={15} /> Comments
            </button>
          </div>

          {/* Author */}
          {video.author && video.author !== 'Tube Creator' && (
            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-black text-white text-sm flex-shrink-0">
                {video.author.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-bold text-sm">{video.author}</p>
                <p className="text-zinc-500 text-xs">Creator</p>
              </div>
            </div>
          )}

          {/* Description */}
          {video.description && (
            <div className="mb-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <p className={`text-zinc-300 text-sm leading-relaxed ${showFullDesc ? '' : 'line-clamp-3'}`}>
                {video.description}
              </p>
              <button
                onClick={() => setShowFullDesc(v => !v)}
                className="flex items-center gap-1 text-zinc-500 hover:text-white text-xs mt-2 transition-colors"
              >
                {showFullDesc ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
              </button>
            </div>
          )}

          {/* Comments section */}
          {showComments && (
            <div className="mb-6">
              <CommentsModal
                videoId={video.id}
                videoTitle={video.title}
                onClose={() => setShowComments(false)}
              />
            </div>
          )}
        </div>

        {/* ── Related sidebar ── */}
        {related.length > 0 && (
          <div className="lg:w-80 xl:w-96 flex-shrink-0">
            <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-3 px-1">Up Next</h2>
            <div className="space-y-3">
              {related.map(v => (
                <div
                  key={v.id}
                  onClick={() => onVideoClick(v.id)}
                  className="group flex gap-3 cursor-pointer hover:bg-zinc-900/60 rounded-xl p-2 transition-colors border border-transparent hover:border-zinc-800"
                >
                  <div className="relative w-36 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                    <img src={v.thumbnail} alt={v.title} onError={onThumbError}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <Play size={14} fill="white" className="text-white" />
                    </div>
                    {v.duration && (
                      <div className="absolute bottom-1 right-1 bg-black/80 text-[9px] text-zinc-300 px-1 py-0.5 rounded">
                        {v.duration}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-white text-xs font-bold line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                      {v.title}
                    </p>
                    {v.author && v.author !== 'Tube Creator' && (
                      <p className="text-zinc-500 text-[10px] mt-1 truncate">{v.author}</p>
                    )}
                    <p className="text-zinc-600 text-[10px] mt-0.5">{formatViews(v.views)} views</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Share sheet */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowShare(false)}>
          <div onClick={e => e.stopPropagation()}>
            <ShareSheet videoId={video.id} title={video.title} thumbnail={video.thumbnail} onClose={() => setShowShare(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayerPage;
