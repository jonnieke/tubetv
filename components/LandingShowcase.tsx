import React, { Suspense, lazy, useMemo, useRef } from 'react';
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Flame,
  Globe,
  KeyRound,
  Play,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Video } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { detectDefaultRegion, REGIONAL_PRICING } from '../lib/subscriptions';
import CatalogueArtwork from './CatalogueArtwork';

const VideoCard = lazy(() => import('./VideoCard'));

interface PassRibbonProps {
  hasActivePass: boolean;
  onUnlockPass: () => void;
}

export const LandingPassRibbon: React.FC<PassRibbonProps> = () => {
  return null;
};

interface TopTenCarouselProps {
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
}

export const TopTenCarousel: React.FC<TopTenCarouselProps> = ({
  videos,
  watchLaterIds,
  onToggleWatchLater,
}) => {
  const { language } = useLanguage();
  const rowRef = useRef<HTMLDivElement>(null);

  const topTen = useMemo(() => {
    return [...videos]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10);
  }, [videos]);

  if (topTen.length === 0) return null;

  const scrollRow = (dir: 'left' | 'right') => {
    if (!rowRef.current) return;
    const delta = dir === 'left' ? -640 : 640;
    rowRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <section className="landing-video-carousel mb-9" aria-label="Top 10 on TubeTV Today">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400">
            <Flame size={16} />
          </span>
          <div>
            <h2 className="text-xl md:text-2xl font-serif text-white leading-tight">
              {language === 'sw' ? '10 Bora Kwenye TubeTV Leo' : 'Top 10 in Kenya & Diaspora Today'}
            </h2>
            <p className="text-[11px] text-zinc-400">
              {language === 'sw'
                ? 'Bofya mara moja kuona maelezo · Bofya mara mbili kutazama filamu moja kwa moja'
                : 'Hover for 30s preview · Single-click for details · Double-click to stream immediately'}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Scroll Top 10 left"
            onClick={() => scrollRow('left')}
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Scroll Top 10 right"
            onClick={() => scrollRow('right')}
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="flex gap-5 overflow-x-auto no-scrollbar pb-3 pt-1 scroll-smooth"
      >
        {topTen.map((video, idx) => (
          <div
            key={video.id}
            className="relative flex items-end shrink-0 group/rank pl-7 sm:pl-9"
          >
            {/* Stylized Giant Rank Number */}
            <span
              aria-hidden="true"
              className="pointer-events-none select-none absolute left-0 bottom-4 z-0 font-serif font-black text-6xl sm:text-7xl leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white/55 via-red-500/35 to-zinc-950 drop-shadow-[0_2px_10px_rgba(229,9,35,0.3)] transition-transform duration-300 group-hover/rank:scale-110"
              style={{ WebkitTextStroke: '1.5px rgba(255,255,255,0.38)' }}
            >
              {idx + 1}
            </span>
            <div className="relative z-10 w-[235px] sm:w-[265px]">
              <Suspense fallback={<div className="aspect-video rounded-lg bg-zinc-900 animate-pulse" />}>
                <VideoCard
                  video={video}
                  isWatchLater={watchLaterIds.includes(video.id)}
                  onToggleWatchLater={onToggleWatchLater}
                />
              </Suspense>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

interface CreatorSpotlightProps {
  videos: Video[];
  onSelectVideo: (video: Video, options?: { autoPlay?: boolean }) => void;
  onApplyToPublish?: () => void;
}

export const CreatorOriginalsSpotlight: React.FC<CreatorSpotlightProps> = ({
  videos,
  onSelectVideo,
  onApplyToPublish,
}) => {
  const { language } = useLanguage();

  const spotlightVideos = useMemo(() => {
    return videos.slice(0, 3);
  }, [videos]);

  if (spotlightVideos.length === 0) return null;

  const featuredCreator = spotlightVideos[0]?.author || 'TubeTV Originals';

  return (
    <section
      aria-label="Creator Originals Spotlight"
      className="my-10 rounded-2xl border border-zinc-800/90 bg-gradient-to-br from-zinc-900 via-zinc-950 to-red-950/30 p-5 md:p-7 shadow-2xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-5 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300">
            <Award size={13} />
            {language === 'sw' ? 'Watayarishaji wa Kiafrika' : 'Kenyan & Pan-African Creators'}
          </div>
          <h2 className="text-2xl md:text-3xl font-serif text-white leading-tight">
            {language === 'sw'
              ? `Hadithi Halisi kutoka ${featuredCreator} na Studio za Kenya`
              : `Original Cinema by ${featuredCreator} & Independent Studios`}
          </h2>
          <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
            {language === 'sw'
              ? 'Kila pasi ya TubeTV huwalipa watayarishaji wa filamu moja kwa moja (asilimia 60 ya mgao wa mapato ya jumla kupitia M-Pesa na Benki).'
              : 'Every TubeTV Pass directly funds African filmmakers and storytellers — with 60% net revenue share and automated M-Pesa & bank royalty payouts.'}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onApplyToPublish && (
              <button
                type="button"
                onClick={onApplyToPublish}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 text-xs font-bold transition cursor-pointer"
              >
                <Play size={14} fill="currentColor" />
                {language === 'sw' ? 'Omba Kuchapisha Filamu Yako' : 'Apply to Publish Your Film'}
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <ShieldCheck size={14} className="text-emerald-400" />
              {language === 'sw' ? 'Malipo ya Uwazi ya M-Pesa' : 'Verified Royalty Ledger'}
            </span>
          </div>
        </div>

        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {spotlightVideos.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onSelectVideo(item, { autoPlay: false })}
              onDoubleClick={() => onSelectVideo(item, { autoPlay: true })}
              className="group relative flex flex-col text-left rounded-xl overflow-hidden bg-zinc-900/90 border border-zinc-800 hover:border-red-500/50 transition"
            >
              <div className="aspect-video w-full relative overflow-hidden bg-zinc-800">
                <CatalogueArtwork
                  src={item.thumbnail}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                  <Play size={10} fill="currentColor" />
                  {item.duration || 'HD'}
                </span>
              </div>
              <div className="p-3">
                <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                  {item.seriesTitle || item.title}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-400 truncate">
                  {item.author} · {item.genre || item.category}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
