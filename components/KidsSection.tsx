import React from 'react';
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
  const spotlight = videos[0] || null;
  const kidsSeries = videos.filter((v) => Boolean(seriesKey(v)));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Playful Kid-Safe Hero Header */}
      <section className="relative overflow-hidden rounded-3xl border border-sky-400/30 bg-gradient-to-br from-sky-950/90 via-indigo-950/80 to-emerald-950/70 p-6 md:p-10 shadow-2xl">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-sky-400/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 border border-sky-400/40 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-sky-200">
              <ShieldCheck size={14} className="text-emerald-300" />
              {language === 'sw' ? 'Salama kwa Watoto · GE' : 'Kid-Safe Zone · KFCB GE'}
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-400 text-zinc-950 shadow-lg shadow-amber-400/25 shrink-0">
                <Baby size={26} />
              </span>
              {language === 'sw' ? 'TubeTV Watoto' : 'TubeTV Kids'}
            </h1>

            <p className="text-sm md:text-base text-sky-100/90 max-w-2xl leading-relaxed">
              {language === 'sw'
                ? 'Katuni, nyimbo, hadithi za kiswahili na mafunzo ya kufurahisha yaliyothibitishwa kwa watoto wa rika zote.'
                : 'Cartoons, sing-alongs, Kenyan bedtime stories, and fun learning — curated and rated GE (General Exhibition) for young viewers.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {spotlight && (
                <button
                  type="button"
                  onClick={() => onPlay(spotlight, { autoPlay: true })}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 px-5 py-3 text-sm font-black shadow-lg shadow-amber-400/25 transition-all cursor-pointer"
                >
                  <Play size={16} fill="currentColor" />
                  {language === 'sw' ? 'Tazama Sasa' : 'Watch Featured'}
                </button>
              )}
              <button
                type="button"
                onClick={onBackHome}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white px-4 py-3 text-sm font-semibold transition-colors cursor-pointer"
              >
                {language === 'sw' ? 'Rudi Nyumbani' : 'Exit Kids Zone'}
              </button>
            </div>
          </div>

          {spotlight && (
            <div className="lg:col-span-5">
              <button
                type="button"
                onClick={() => onPlay(spotlight, { autoPlay: false })}
                className="group relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-sky-400/40 bg-zinc-900 shadow-2xl text-left"
              >
                <img
                  src={spotlight.thumbnail}
                  alt={spotlight.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 text-zinc-950 px-2.5 py-0.5 text-[11px] font-black">
                  <Sparkles size={11} /> GE SAFE
                </span>
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-sky-300">{spotlight.genre || spotlight.category}</p>
                    <p className="text-base font-black text-white line-clamp-1">{spotlight.title}</p>
                  </div>
                  <span className="w-10 h-10 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Kids Topic Filter Pills */}
      <div className="flex flex-wrap items-center gap-2.5">
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
              className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all border cursor-pointer ${
                active
                  ? 'bg-sky-400 text-zinc-950 border-sky-300 shadow-lg shadow-sky-400/20'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-sky-500/50 hover:text-white'
              }`}
            >
              {emoji}
              {cat}
            </button>
          );
        })}
      </div>

      {/* Kids Series Shelf */}
      {kidsSeries.length > 0 && (
        <SeriesCarousel
          title={language === 'sw' ? 'Mfululizo wa Watoto' : 'Kids Series'}
          videos={kidsSeries}
          watchLaterIds={watchLaterIds}
          onToggleWatchLater={onToggleWatchLater}
          isAuthenticated={isAuthenticated}
          onPlay={onPlay}
        />
      )}

      {/* Kids Video Grid */}
      {videos.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">
              {activeSubCategory === 'All'
                ? language === 'sw'
                  ? 'Video Zote za Watoto'
                  : 'All Kids Videos'
                : activeSubCategory}
            </h2>
            <span className="text-xs text-zinc-400 font-semibold">
              {videos.length} {videos.length === 1 ? 'title' : 'titles'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((video) => (
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
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-12 text-center space-y-3">
          <Film className="w-10 h-10 mx-auto text-sky-400/60" />
          <h3 className="text-lg font-bold text-white">
            {language === 'sw' ? 'Hakuna video za watoto hapa bado' : 'No Kids videos in this section yet'}
          </h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            {language === 'sw'
              ? 'Jaribu kuchagua sehemu nyingine au tazama video zote za watoto.'
              : 'Try another topic filter or view all available Kids videos.'}
          </p>
          {activeSubCategory !== 'All' && (
            <button
              type="button"
              onClick={() => onSelectSubCategory('All')}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold px-4 py-2 text-xs transition-colors"
            >
              {language === 'sw' ? 'Onyesha Zote' : 'Show All Kids Videos'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default KidsSection;
