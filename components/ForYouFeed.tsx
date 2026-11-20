import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Flame,
  Heart,
  ListVideo,
  Play,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type Hls from 'hls.js';
import type { Video } from '../types';
import { compareEpisodes, isMicroDrama, seriesKey } from '../lib/series';
import { getFreeEpisodeCount } from '../lib/monetization';
import { loadHls } from '../lib/hlsLoader';
import { resolveAuthorizedPlaybackUrl } from '../lib/subscriptions';
import { shouldSaveData } from '../lib/network';
import { usePlayback } from '../contexts/PlaybackContext';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchEpisodeEngagement, toggleEpisodeLike } from '../lib/engagement';
import { trackEvent } from '../lib/analytics';
import { publicMediaUrl } from '../lib/mediaUrl';

export interface ForYouSeriesHook {
  opener: Video;
  episodeCount: number;
  totalViews: number;
}

export function buildForYouFeedItems(videos: Video[]): ForYouSeriesHook[] {
  const grouped = new Map<string, Video[]>();
  const microVideos = videos.filter(isMicroDrama);
  const source = microVideos.length > 0 ? microVideos : videos.filter((v) => Boolean(v.seriesTitle || v.episode));

  for (const video of source) {
    const key = seriesKey(video) || video.id;
    const list = grouped.get(key) || [];
    list.push(video);
    grouped.set(key, list);
  }

  const hooks: ForYouSeriesHook[] = [];
  for (const list of grouped.values()) {
    const sorted = [...list].sort(compareEpisodes);
    const opener = sorted[0];
    if (!opener) continue;
    const totalViews = sorted.reduce((sum, ep) => sum + (ep.views || 0), 0);
    hooks.push({
      opener,
      episodeCount: sorted.length,
      totalViews,
    });
  }

  // Sort by highest engagement/views first so the strongest viral hook leads
  return hooks.sort((a, b) => b.totalViews - a.totalViews);
}

interface ForYouFeedProps {
  videos: Video[];
  watchLaterIds: string[];
  hasActivePass: boolean;
  onWatchSeries: (video: Video) => void;
  onToggleWatchLater: (videoId: string) => void;
  onShare: (video: Video) => void;
  onOpenDiscover: () => void;
}

const ForYouFeed: React.FC<ForYouFeedProps> = ({
  videos,
  watchLaterIds,
  hasActivePass,
  onWatchSeries,
  onToggleWatchLater,
  onShare,
  onOpenDiscover,
}) => {
  const { language } = useLanguage();
  const { preferences } = usePlayback();
  const dataSaver = shouldSaveData(preferences.dataSaver);

  const items = useMemo(() => buildForYouFeedItems(videos), [videos]);
  const [activeId, setActiveId] = useState<string | null>(() => items[0]?.opener.id ?? null);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (items.length > 0 && (!activeId || !items.some((i) => i.opener.id === activeId))) {
      setActiveId(items[0].opener.id);
    }
  }, [items, activeId]);

  useEffect(() => {
    if (!containerRef.current || items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-foryou-id');
            if (id) {
              setActiveId(id);
              trackEvent('foryou_impression', { videoId: id });
            }
          }
        }
      },
      { root: containerRef.current, threshold: 0.65 },
    );

    const frame = requestAnimationFrame(() => {
      const nodes = containerRef.current?.querySelectorAll('[data-foryou-id]');
      nodes?.forEach((node) => observer.observe(node));
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [items]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current || items.length === 0) return;
      const idx = items.findIndex((i) => i.opener.id === activeId);
      if (idx === -1) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const next = items[Math.min(idx + 1, items.length - 1)];
        const el = containerRef.current.querySelector(`[data-foryou-id="${next.opener.id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prev = items[Math.max(idx - 1, 0)];
        const el = containerRef.current.querySelector(`[data-foryou-id="${prev.opener.id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (e.key === 'Escape') {
        onOpenDiscover();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeId, items, onOpenDiscover]);

  const activeIdx = Math.max(
    0,
    items.findIndex((i) => i.opener.id === activeId),
  );

  return (
    <div className="relative h-[calc(100dvh-58px)] md:h-full w-full bg-black text-white flex justify-center overflow-hidden">
      {/* Floating Top Bar */}
      <div className="pointer-events-none absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-5 bg-gradient-to-b from-black/80 via-black/35 to-transparent">
        <button
          type="button"
          onClick={onOpenDiscover}
          aria-label="Back to Discover"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white hover:bg-black/80 transition"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-md border border-white/15 p-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold text-white">
            <Flame size={12} />
            {language === 'sw' ? 'Kwako' : 'For You'}
          </span>
          <button
            type="button"
            onClick={onOpenDiscover}
            className="rounded-full px-3 py-1 text-xs font-bold text-zinc-300 hover:text-white transition"
          >
            {language === 'sw' ? 'Gundua' : 'Discover'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsMuted((m) => !m)}
          aria-label={isMuted ? 'Unmute feed' : 'Mute feed'}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white hover:bg-black/80 transition"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="text-red-400" />}
        </button>
      </div>

      {/* Snap-Scroll Vertical Teaser Feed */}
      <div
        ref={containerRef}
        className="h-full w-full md:w-[440px] overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth"
      >
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/20 border border-red-500/40 text-red-400">
              <Sparkles size={26} />
            </div>
            <h1 className="text-xl font-black text-white">
              {language === 'sw' ? 'Drama Fupi Zinakuja Hivi Karibuni' : 'Micro Dramas Launching Soon'}
            </h1>
            <p className="text-sm text-zinc-400 max-w-xs">
              {language === 'sw'
                ? 'Vuta juu kutazama vipindi vya kwanza vya drama fupi za Kenya.'
                : 'Vertical Kenyan micro-drama hooks will autoplay here as soon as episodes are published.'}
            </p>
            <button
              type="button"
              onClick={onOpenDiscover}
              className="rounded-full bg-red-600 hover:bg-red-500 px-5 py-2.5 text-xs font-extrabold text-white transition"
            >
              {language === 'sw' ? 'Rudi Gundua' : 'Explore Catalogue'}
            </button>
          </div>
        ) : (
          items.map((item, idx) => (
            <ForYouCard
              key={item.opener.id}
              item={item}
              isActive={activeId === item.opener.id}
              isNearby={Math.abs(idx - activeIdx) <= 1}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((m) => !m)}
              dataSaver={dataSaver}
              hasActivePass={hasActivePass}
              isWatchLater={watchLaterIds.includes(item.opener.id)}
              language={language}
              onWatchSeries={() => {
                trackEvent('foryou_watch_series', {
                  videoId: item.opener.id,
                  seriesTitle: item.opener.seriesTitle || item.opener.title,
                });
                onWatchSeries(item.opener);
              }}
              onToggleWatchLater={() => onToggleWatchLater(item.opener.id)}
              onShare={() => onShare(item.opener)}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface ForYouCardProps {
  item: ForYouSeriesHook;
  isActive: boolean;
  isNearby: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  dataSaver: boolean;
  hasActivePass: boolean;
  isWatchLater: boolean;
  language: string;
  onWatchSeries: () => void;
  onToggleWatchLater: () => void;
  onShare: () => void;
}

const ForYouCard: React.FC<ForYouCardProps> = ({
  item,
  isActive,
  isNearby,
  isMuted,
  onToggleMute,
  dataSaver,
  hasActivePass,
  isWatchLater,
  language,
  onWatchSeries,
  onToggleWatchLater,
  onShare,
}) => {
  const { opener, episodeCount } = item;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const seriesName = opener.seriesTitle || opener.title;
  const freeEpCount = getFreeEpisodeCount(opener, episodeCount);
  const posterSrc = publicMediaUrl(opener.seriesPosterUrl) || publicMediaUrl(opener.thumbnail);
  const synopsis = opener.seriesSynopsis || opener.episodeSynopsis || opener.description || '';

  useEffect(() => {
    let active = true;
    if (isActive || isNearby) {
      fetchEpisodeEngagement(opener.id).then((res) => {
        if (!active) return;
        setIsLiked(res.isLiked);
        setLikeCount(res.likeCount);
      });
    }
    return () => {
      active = false;
    };
  }, [opener.id, isActive, isNearby]);

  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (!isActive || dataSaver) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    let cancelled = false;

    const startPlayback = async () => {
      const resolved = await resolveAuthorizedPlaybackUrl(opener.id, opener.url, false);
      if (cancelled) return;
      const streamUrl = resolved.url || opener.url;
      const el = videoRef.current;
      if (!el || !streamUrl) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      el.muted = isMuted;

      if (streamUrl.includes('.m3u8')) {
        if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = streamUrl;
          el.play().catch(() => {});
        } else {
          const HlsClass = await loadHls();
          if (cancelled || !videoRef.current) return;
          if (HlsClass && HlsClass.isSupported()) {
            const hls = new HlsClass({ enableWorker: true, maxBufferLength: 12 });
            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(el);
            hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
              if (!cancelled) {
                el.play().catch(() => {});
              }
            });
          }
        }
      } else {
        el.src = streamUrl;
        el.play().catch(() => {});
      }
    };

    void startPlayback();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
      }
      setIsPlaying(false);
    };
  }, [isActive, dataSaver, opener.id, opener.url]);

  const handleToggleLike = () => {
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    void toggleEpisodeLike(opener.id, next);
  };

  const handleVideoTap = () => {
    const el = videoRef.current;
    if (!el || dataSaver) {
      onWatchSeries();
      return;
    }
    if (isMuted) {
      onToggleMute();
      return;
    }
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  return (
    <section
      data-foryou-id={opener.id}
      aria-label={seriesName}
      className="relative h-full w-full snap-start shrink-0 bg-black overflow-hidden flex items-center justify-center"
    >
      {/* Background Poster */}
      {posterSrc && (
        <img
          src={posterSrc}
          alt={seriesName}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            isPlaying ? 'opacity-20' : 'opacity-100'
          }`}
        />
      )}

      {/* Vertical Teaser Stream */}
      {!dataSaver && (
        <video
          ref={videoRef}
          muted={isMuted}
          playsInline
          loop
          preload="metadata"
          onPlaying={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={handleVideoTap}
          className={`relative z-10 h-full w-full object-cover cursor-pointer transition-opacity duration-500 ${
            isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Tap to Play overlay when Data Saver is active */}
      {dataSaver && (
        <button
          type="button"
          onClick={onWatchSeries}
          aria-label={`Watch ${seriesName}`}
          className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-red-600/90 text-white shadow-2xl hover:bg-red-500 transition"
        >
          <Play size={28} fill="currentColor" className="ml-1" />
        </button>
      )}

      {/* Subtle Tap-for-Sound Pill when playing muted */}
      {isPlaying && isMuted && (
        <button
          type="button"
          onClick={onToggleMute}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/20 px-3 py-1 text-[11px] font-bold text-white animate-pulse"
        >
          <VolumeX size={13} />
          <span>{language === 'sw' ? 'Gusa kuwasha sauti' : 'Tap for sound'}</span>
        </button>
      )}

      {/* Right-Edge Action Rail */}
      <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={handleToggleLike}
          aria-pressed={isLiked}
          aria-label="Like series"
          className="flex flex-col items-center gap-0.5 text-white active:scale-90 transition"
        >
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md border ${
              isLiked
                ? 'bg-rose-600/30 border-rose-500/70 text-rose-400'
                : 'bg-black/55 border-white/15 text-white'
            }`}
          >
            <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
          </span>
          <span className="text-[10px] font-bold drop-shadow">{likeCount}</span>
        </button>

        <button
          type="button"
          onClick={onToggleWatchLater}
          aria-label={isWatchLater ? 'Saved to My List' : 'Save to My List'}
          className="flex flex-col items-center gap-0.5 text-white active:scale-90 transition"
        >
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md border ${
              isWatchLater
                ? 'bg-amber-500/25 border-amber-400/70 text-amber-300'
                : 'bg-black/55 border-white/15 text-white'
            }`}
          >
            <Bookmark size={19} fill={isWatchLater ? 'currentColor' : 'none'} />
          </span>
          <span className="text-[10px] font-bold drop-shadow">{isWatchLater ? 'Saved' : 'Save'}</span>
        </button>

        <button
          type="button"
          onClick={onShare}
          aria-label="Share on WhatsApp"
          className="flex flex-col items-center gap-0.5 text-white active:scale-90 transition"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white">
            <Share2 size={19} />
          </span>
          <span className="text-[10px] font-bold drop-shadow">Share</span>
        </button>

        <button
          type="button"
          onClick={onWatchSeries}
          aria-label="View all episodes"
          className="flex flex-col items-center gap-0.5 text-white active:scale-90 transition"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white">
            <ListVideo size={19} />
          </span>
          <span className="text-[10px] font-bold drop-shadow">{episodeCount} Eps</span>
        </button>
      </div>

      {/* Bottom Hook Copy + Primary CTA */}
      <div className="pointer-events-none absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-4 pt-16 pb-6 pr-16">
        <div className="pointer-events-auto space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
              <Flame size={10} />
              MICRO DRAMA
            </span>
            {!hasActivePass && freeEpCount > 0 && (
              <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                {language === 'sw' ? `Vipindi 1–${freeEpCount} Bure` : `Ep 1–${freeEpCount} Free`}
              </span>
            )}
            <span className="rounded bg-black/60 border border-white/15 px-2 py-0.5 text-[10px] font-bold text-zinc-200">
              {episodeCount} {episodeCount === 1 ? 'Ep' : 'Eps'}
            </span>
          </div>

          <h2 className="text-lg font-black tracking-tight text-white leading-tight drop-shadow">
            {seriesName}
          </h2>

          {synopsis && (
            <p className="text-xs leading-snug text-zinc-200 line-clamp-2 drop-shadow">{synopsis}</p>
          )}

          <button
            type="button"
            onClick={onWatchSeries}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-red-950/60 active:scale-[0.98] transition"
          >
            <Play size={14} fill="currentColor" />
            <span>
              {language === 'sw'
                ? `Tazama Mfululizo (${episodeCount} Vipindi)`
                : `Watch Full Series (${episodeCount} Eps)`}
            </span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default ForYouFeed;
