import React from 'react';
import type { Video } from '../types';
import VideoCard from './VideoCard';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  videos: Video[];
}

/** Live presentation uses only published catalogue records and measured views. */
const LiveSection: React.FC<Props> = ({ videos }) => {
  const { language, t } = useLanguage();
  const live = videos.filter((video) => video.category === 'Live' || video.category === 'Live Recording');
  return (
    <section className="mx-auto max-w-7xl px-5 py-9 md:px-9" aria-label="Live on TubeTV">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[.24em] text-red-400">{t('live.now')}</p>
        <h1 className="mt-2 font-serif text-4xl text-[#f4ecdd]">
          {language === 'sw' ? 'Matangazo ya moja kwa moja na matukio' : 'Live stories and events'}
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          {language === 'sw'
            ? 'Tazama chaneli zilizothibitishwa na rekodi za matukio mubashara.'
            : 'Watch verified live channels and published event recordings.'}
        </p>
      </div>
      {live.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {live.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
          {language === 'sw'
            ? 'Hakuna matangazo ya moja kwa moja kwa sasa.'
            : 'No live channels or recordings are available right now.'}
        </div>
      )}
    </section>
  );
};

export default LiveSection;
