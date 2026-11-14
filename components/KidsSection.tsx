import React, { useMemo } from 'react';
import { Sparkles, Play, ShieldCheck, Baby, Film } from 'lucide-react';
import { Video } from '../types';
import VideoCard from './VideoCard';
import SeriesCarousel from './SeriesCarousel';
import { useLanguage } from '../contexts/LanguageContext';
import { seriesKey } from '../lib/series';

interface KidsSectionProps {
  videos: Video[];
  activeSubCategory: string;
  subCategories: string[];
  onSelectSubCategory: (cat: string) => void;
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  isAuthenticated: boolean;
  onPlay: (video: Video, options?: { autoPlay?: boolean }) => void;
  onBackHome: () => void;
}

const KidsSection: React.FC<KidsSectionProps> = ({
  videos,
  activeSubCategory,
  subCategories,
  onSelectSubCategory,
  watchLaterIds,
  onToggleWatchLater,
  isAuthenticated,
  onPlay,
  onBackHome,
}) => {
  const { language } = useLanguage();

  // Separate series episodes from standalone titles so each series is represented
  // by a single main show card (all episodes open inside it) instead of cluttering the grid.
  const { seriesVideos, standaloneVideos, spotlight } = useMemo(() => {
    const seriesList: Video[] = [];
    const standaloneList: Video[] = [];
    for (const v of videos) {
      if (seriesKey(v)) seriesList.push(v);
      else standaloneList.push(v);
    }
    return {
      seriesVideos: seriesList,
      standaloneVideos: standaloneList,
      spotlight: seriesList[0] || standaloneList[0] || null,
    };
  }, [videos]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Warm, Welcoming Kid-Safe Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-300/20 bg-gradient-to-br from-[#181c2e] via-[#1b1829] to-[#231917] p-5 md:p-8 shadow-xl">
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-16 w-64 h-64 rounded-full bg-sky-400/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 border border-amber-300/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              <ShieldCheck size={13} className="text-emerald-300" />
              {language === 'sw' ? 'Salama kwa Watoto · GE' : 'Safe & Warm · KFCB GE Rated'}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 text-zinc-950 shadow-md shrink-0">
                <Baby size={22} />
              </span>
              {language === 'sw' ? 'Karibu TubeTV Watoto' : 'Welcome to TubeTV Kids'}
            </h1>

            <p className="text-sm text-zinc-200/90 max-w-xl leading-relaxed">
              {language === 'sw'
                ? 'Katuni, nyimbo na hadithi za kufurahisha zilizopangwa vizuri kwa ajili ya watoto. Chagua mfululizo au video hapa chini.'
                : 'Warm, kid-safe cartoons, songs, and Kenyan stories — neatly organized by show so young viewers can jump straight in.'}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {spotlight && (
                <button
                  type="button"
                  onClick={() => onPlay(spotlight, { autoPlay: !seriesKey(spotlight) })}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 px-5 py-2.5 text-sm font-black shadow-md transition-colors cursor-pointer"
                >
                  <Play size={15} fill="currentColor" />
                  {seriesKey(spotlight)
                    ? language === 'sw'
                      ? 'Fungua Mfululizo'
                      : 'Open Featured Show'
                    : language === 'sw'
                      ? 'Tazama Sasa'
                      : 'Watch Featured'}
                </button>
              )}
              <button
                type="button"
                onClick={onBackHome}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer"
              >
                {language === 'sw' ? 'Rudi Nyumbani' : 'Back to Home'}
              </button>
            </div>
          </div>

          {spotlight && (
            <div className="lg:col-span-5">
              <button
                type="button"
                onClick={() => onPlay(spotlight, { autoPlay: false })}
                className="group relative w-full aspect-video rounded-2xl overflow-hidden border border-amber-300/30 bg-zinc-900 shadow-lg text-left"
              >
                <img
                  src={spotlight.seriesPosterUrl || spotlight.thumbnail}
                  alt={spotlight.seriesTitle || spotlight.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-400 text-zinc-950 px-2.5 py-0.5 text-[10px] font-black">
                  <Sparkles size={10} /> GE SAFE
                </span>
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-amber-200">{spotlight.genre || spotlight.category}</p>
                    <p className="text-sm sm:text-base font-black text-white truncate">
                      {spotlight.seriesTitle || spotlight.title}
                    </p>
                  </div>
                  <span className="w-9 h-9 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shrink-0 shadow group-hover:scale-110 transition-transform">
                    <Play size={16} fill="currentColor" className="ml-0.5" />
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Clean, Compact Topic Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {subCategories.map((cat) => {
          const emoji =
            cat === 'All'
              ? '✨ '
              : cat === 'Cartoons'
                ? '🎨 '
                : cat === 'Learning'
                  ? '📚 '
                  : cat === 'Songs'
                    ? '🎵 '
                    : cat === 'Stories'
                      ? '📖 '
                      : '';
          const active = activeSubCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectSubCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all border cursor-pointer ${
                active
                  ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-sm'
                  : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:border-amber-400/50 hover:text-white'
              }`}
            >
              {emoji}
              {cat}
            </button>
          );
        })}
      </div>

      {/* Main Shows & Series (1 card per series — click to open all episodes) */}
      {seriesVideos.length > 0 && (
        <SeriesCarousel
          title={language === 'sw' ? 'Vipindi na Mfululizo' : 'Kids Shows & Series'}
          videos={seriesVideos}
          watchLaterIds={watchLaterIds}
          onToggleWatchLater={onToggleWatchLater}
          isAuthenticated={isAuthenticated}
          onPlay={onPlay}
          uniformAspect="video"
        />
      )}

      {/* Standalone Kids Videos (excludes series episodes to keep the grid clean) */}
      {standaloneVideos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <h2 className="text-lg font-black text-white">
              {seriesVideos.length > 0
                ? language === 'sw'
                  ? 'Video Nyingine za Watoto'
                  : 'More Kids Videos'
                : activeSubCategory === 'All'
                  ? language === 'sw'
                    ? 'Video Zote za Watoto'
                    : 'All Kids Videos'
                  : activeSubCategory}
            </h2>
            <span className="text-xs text-zinc-400 font-semibold">
              {standaloneVideos.length} {standaloneVideos.length === 1 ? 'title' : 'titles'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {standaloneVideos.map((video) => (
              <div key={video.id}>
                <VideoCard
                  video={video}
                  isWatchLater={watchLaterIds.includes(video.id)}
                  onToggleWatchLater={onToggleWatchLater}
                  onSelectVideo={onPlay}
                  uniformAspect="video"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friendly Empty State */}
      {videos.length === 0 && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-10 text-center space-y-3">
          <Film className="w-10 h-10 mx-auto text-amber-300/60" />
          <h3 className="text-lg font-bold text-white">
            {language === 'sw' ? 'Hakuna video za watoto hapa bado' : 'No Kids videos in this topic yet'}
          </h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            {language === 'sw'
              ? 'Jaribu kuchagua sehemu nyingine au tazama video zote za watoto.'
              : 'Try another topic filter or view all available Kids shows and videos.'}
          </p>
          {activeSubCategory !== 'All' && (
            <button
              type="button"
              onClick={() => onSelectSubCategory('All')}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold px-4 py-2 text-xs transition-colors"
            >
              {language === 'sw' ? 'Onyesha Zote' : 'Show All Kids Content'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default KidsSection;
