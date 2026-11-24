import React from 'react';
import { ArrowRight, Clapperboard, Film, Smartphone, Sparkles } from 'lucide-react';
import type { Video } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { publicMediaUrl } from '../lib/mediaUrl';

interface LandingCrossCtaProps {
  target: 'cinema' | 'micro-dramas';
  previewVideos?: Video[];
  totalCount?: number;
  onSwitch: () => void;
}

const LandingCrossCta: React.FC<LandingCrossCtaProps> = ({
  target,
  previewVideos = [],
  totalCount,
  onSwitch,
}) => {
  const { language } = useLanguage();
  const isSw = language === 'sw';
  const isToCinema = target === 'cinema';

  const thumbs = previewVideos
    .filter((v) => Boolean(v.seriesPosterUrl || v.thumbnail))
    .slice(0, 3);

  const badgeText = isToCinema
    ? isSw
      ? 'TUBETV CINEMA · FILAMU NA TAMTHILIA'
      : 'TUBETV CINEMA · LONG FORMAT'
    : isSw
      ? 'TUBETV MICRO DRAMAS · DAKIKA 1'
      : 'TUBETV MICRO DRAMAS · VERTICAL 9:16';

  const heading = isToCinema
    ? isSw
      ? 'Unataka Filamu na Tamthilia zisizo na kikomo? Bofya hapa!'
      : 'Want unlimited Movies & Series? Click here!'
    : isSw
      ? 'Unataka Micro Dramas za kusisimua? Bofya hapa!'
      : 'Want addictive Micro Dramas? Click here!';

  const description = isToCinema
    ? isSw
      ? 'Fungua filamu kamili za Kenya, tamthilia ndefu, School Flix, Watoto na Originals — zote kwa pasi moja.'
      : 'Switch to full-length Kenyan Movies, Drama Series, School Flix, Kids & Originals — all unlocked with one pass.'
    : isSw
      ? 'Tazama tamthilia fupi za simu zenye msisimko — Kipindi cha 1 na 2 ni bure kwa kila kipindi.'
      : 'Binge bite-sized 1-minute vertical Kenyan dramas built for your phone — Episodes 1 & 2 free on every show.';

  const ctaLabel = isToCinema
    ? isSw
      ? 'Fungua Filamu & Tamthilia'
      : 'Explore Movies & Series'
    : isSw
      ? 'Tazama Micro Dramas'
      : 'Explore Micro Dramas';

  return (
    <section
      aria-label={isToCinema ? 'Switch to Movies and Series landing page' : 'Switch to Micro Dramas landing page'}
      className="my-6 md:my-8"
    >
      <button
        type="button"
        onClick={onSwitch}
        className={`group relative w-full overflow-hidden rounded-2xl border text-left transition-all duration-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
          isToCinema
            ? 'border-amber-500/35 bg-gradient-to-r from-[#1a1207] via-[#170c0e] to-[#0d0d12] hover:border-amber-400/70 shadow-xl shadow-black/40'
            : 'border-rose-500/35 bg-gradient-to-r from-[#1c0910] via-[#150a14] to-[#0d0d12] hover:border-rose-400/70 shadow-xl shadow-black/40'
        }`}
      >
        {/* Ambient radial accent */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl transition-opacity duration-300 opacity-30 group-hover:opacity-50 ${
            isToCinema ? 'bg-amber-500' : 'bg-rose-600'
          }`}
        />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 p-6 sm:p-8 md:p-9">
          {/* Left Copy & CTA */}
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider border ${
                  isToCinema
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}
              >
                {isToCinema ? <Clapperboard size={12} /> : <Smartphone size={12} />}
                <span>{badgeText}</span>
              </span>
              {typeof totalCount === 'number' && totalCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                  <Sparkles size={11} className={isToCinema ? 'text-amber-400' : 'text-rose-400'} />
                  {totalCount.toLocaleString()}+ {isToCinema ? (isSw ? 'filamu & vipindi' : 'titles') : (isSw ? 'vipindi' : 'episodes')}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-[2rem] font-black tracking-tight text-white leading-tight">
              {heading}
            </h2>

            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              {description}
            </p>

            <div className="pt-1">
              <span
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white shadow-lg transition-transform duration-200 group-hover:translate-x-0.5 ${
                  isToCinema
                    ? 'bg-gradient-to-r from-amber-500 to-red-600 shadow-amber-900/30'
                    : 'bg-gradient-to-r from-rose-600 to-red-600 shadow-rose-900/30'
                }`}
              >
                {isToCinema ? <Film size={16} /> : <Smartphone size={16} />}
                <span>{ctaLabel}</span>
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </div>
          </div>

          {/* Right Preview Poster Fan */}
          {thumbs.length > 0 && (
            <div className="hidden sm:flex items-center -space-x-4 pr-2 shrink-0" aria-hidden="true">
              {thumbs.map((item, idx) => {
                const src = publicMediaUrl(item.seriesPosterUrl || item.thumbnail);
                const tilt = idx === 0 ? '-rotate-6 translate-y-1' : idx === 2 ? 'rotate-6 translate-y-1' : 'z-10 scale-105';
                return (
                  <div
                    key={item.id}
                    className={`relative overflow-hidden rounded-xl border border-white/15 bg-zinc-900 shadow-2xl transition-transform duration-300 group-hover:scale-105 ${tilt} ${
                      isToCinema ? 'w-32 aspect-video' : 'w-20 aspect-[9/14]'
                    }`}
                  >
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </button>
    </section>
  );
};

export default LandingCrossCta;
