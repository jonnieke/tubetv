import React, { useMemo, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, ListVideo, Play } from 'lucide-react';
import type { Video } from '../types';
import { compareEpisodes, getSeriesEntryEpisode, isMicroDrama, seriesKey } from '../lib/series';
import { getFreeEpisodeCount } from '../lib/monetization';
import { publicMediaUrl } from '../lib/mediaUrl';
import { useLanguage } from '../contexts/LanguageContext';
import CatalogueArtwork from './CatalogueArtwork';
import SeriesDetails from './SeriesDetails';

interface Props {
  title?: string;
  videos: Video[];
  onToggleWatchLater: (id: string) => void;
  watchLaterIds: string[];
  isAuthenticated?: boolean;
  onPlay: (video: Video) => void;
  uniformAspect?: 'video';
  maxSeries?: number;
}

function formatCompactViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

const SeriesCard: React.FC<{
  episodes: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onPlay: (video: Video) => void;
  onDetails: () => void;
  forceVideoAspect?: boolean;
}> = ({
  episodes,
  watchLaterIds,
  onToggleWatchLater,
  onPlay,
  onDetails,
  forceVideoAspect = false,
}) => {
  const { language } = useLanguage();
  const first = episodes[0];
  const { entryEpisode, newEpisodes, hasNewBatch } = getSeriesEntryEpisode(episodes);
  const hasSeparateNewBatch = hasNewBatch && entryEpisode.id !== first.id;
  const synopsis = episodes.find((episode) => episode.seriesSynopsis)?.seriesSynopsis;
  const portrait = isMicroDrama(first);
  const poster = episodes.map((episode) => publicMediaUrl(episode.seriesPosterUrl)).find(Boolean);
  const useVertical = !forceVideoAspect && (portrait || Boolean(poster));
  const totalViews = episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
  const isSaved = watchLaterIds.includes(entryEpisode.id) || watchLaterIds.includes(first.id);

  if (portrait && !forceVideoAspect) {
    const ratingChip = first.contentRating && first.contentRating !== 'UNRATED' ? first.contentRating : null;
    const genreChip = first.genre ? first.genre.split(',')[0].trim() : null;
    const metaLine = [genreChip, language === 'sw' ? 'Tamthilia Fupi' : 'Micro Drama', ratingChip, `${episodes.length} Ep`]
      .filter(Boolean)
      .join(' | ');

    return (
      <article className="cinema-series-vertical group/card relative snap-start shrink-0 w-[152px] sm:w-[195px] md:w-[225px] rounded-2xl transition-all duration-300 md:hover:scale-[1.04] md:hover:z-30 md:hover:bg-[#17171f] md:hover:shadow-2xl md:hover:ring-1 md:hover:ring-zinc-700/80 p-1.5 -m-1.5">
        <button
          type="button"
          onClick={() => onPlay(entryEpisode)}
          aria-label={`Watch ${first.seriesTitle || first.title} from episode ${entryEpisode.episode || 1}`}
          className={`relative block w-full ${poster ? 'aspect-[2/3]' : 'aspect-[9/16]'} overflow-hidden rounded-xl bg-zinc-900 text-left shadow-lg`}
        >
          <CatalogueArtwork
            src={poster || first.thumbnail}
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

          {hasNewBatch ? (
            <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-950 shadow">
              NEW{hasSeparateNewBatch ? ` · ${newEpisodes.length} Ep` : ''}
            </span>
          ) : totalViews >= 50 ? (
            <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow">
              Hot
            </span>
          ) : null}

          {(() => {
            const freeCount = getFreeEpisodeCount(first, episodes.length);
            if (freeCount <= 0) return null;
            return (
              <span className="absolute top-2.5 right-2.5 z-10 rounded-md bg-black/75 backdrop-blur-sm border border-emerald-400/40 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-300 shadow">
                {language === 'sw' ? `1–${freeCount} Bure` : `Ep 1–${freeCount} Free`}
              </span>
            );
          })()}

          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-bold text-white/95">
            <span className="rounded bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-200">
              {hasSeparateNewBatch ? `Ep ${entryEpisode.episode || 1}` : `${episodes.length} Eps`}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[11px] font-bold">
              <Play size={10} fill="currentColor" />
              {totalViews > 0 ? formatCompactViews(totalViews) : `${episodes.length} Ep`}
            </span>
          </div>
        </button>

        <div className="pt-2.5 px-1 pb-1">
          <h3 className="text-sm sm:text-[15px] font-bold text-white line-clamp-1 group-hover/card:text-red-400 transition-colors">
            {first.seriesTitle || first.title}
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-400 line-clamp-1">{metaLine}</p>

          {/* Expanded hover details on desktop, compact action bar on mobile */}
          <div className="mt-2 space-y-2.5 md:max-h-0 md:opacity-0 md:overflow-hidden md:group-hover/card:max-h-40 md:group-hover/card:opacity-100 transition-all duration-300">
            {synopsis && <p className="text-xs leading-relaxed text-zinc-300 line-clamp-2">{synopsis}</p>}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => onPlay(entryEpisode)}
                aria-label={`Play ${first.seriesTitle || first.title}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 transition-colors shadow"
              >
                <Play size={15} fill="currentColor" className="ml-0.5" />
              </button>
              <button
                type="button"
                onClick={() => onToggleWatchLater(entryEpisode.id)}
                aria-label={isSaved ? 'Remove from Watch Later' : 'Save to Watch Later'}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  isSaved
                    ? 'border-red-500 bg-red-600/20 text-red-400'
                    : 'border-zinc-700 bg-zinc-800/90 text-zinc-200 hover:border-zinc-500 hover:text-white'
                }`}
              >
                <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={onDetails}
                className="series-details-trigger flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/90 px-3 text-[11px] font-bold text-zinc-200 hover:border-zinc-500 hover:text-white transition-colors"
                aria-label={`Synopsis and episodes for ${first.seriesTitle || first.title}`}
              >
                <ListVideo size={13} />
                <span>{hasSeparateNewBatch ? 'All' : language === 'sw' ? 'Vipindi' : 'Episodes'}</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`cinema-series-card shrink-0 overflow-hidden ${
        useVertical ? 'cinema-series-vertical w-[200px] md:w-[240px]' : 'w-[300px] md:w-[340px]'
      }`}
    >
      <button
        type="button"
        onClick={portrait || hasSeparateNewBatch ? () => onPlay(entryEpisode) : onDetails}
        aria-label={
          portrait || hasSeparateNewBatch
            ? `Watch ${first.seriesTitle || first.title} from episode ${entryEpisode.episode || 1}`
            : `Explore ${first.seriesTitle || first.title} seasons and episodes`
        }
        className={`cinema-series-art relative block w-full overflow-hidden text-left group ${
          useVertical
            ? portrait && !poster
              ? 'aspect-[9/16]'
              : 'aspect-[2/3]'
            : 'aspect-video'
        }`}
      >
        <CatalogueArtwork src={poster || first.thumbnail} className="h-full w-full object-cover" />
        {hasNewBatch && (
          <span className="absolute top-2.5 left-2.5 z-10 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-950 shadow-md">
            NEW{hasSeparateNewBatch ? ` · ${newEpisodes.length} Ep` : ''}
          </span>
        )}
        <span className="cinema-series-play" aria-hidden="true">
          <Play size={16} fill="currentColor" />
        </span>
      </button>
      <div className="cinema-series-info p-4">
        <p className="cinema-card-kicker">
          {portrait ? (language === 'sw' ? 'Tamthilia Fupi' : 'Micro Drama') : language === 'sw' ? 'Tamthilia' : 'Series'}
        </p>
        <h3 className="text-lg font-bold text-white">{first.seriesTitle || first.title}</h3>
        <p className="mt-1 text-xs text-zinc-400">
          {episodes.length}{' '}
          {language === 'sw'
            ? episodes.length === 1
              ? 'kipindi'
              : 'vipindi'
            : episodes.length === 1
              ? 'episode'
              : 'episodes'}
          {first.genre ? ` · ${first.genre}` : ''}
          {portrait ? (language === 'sw' ? ' · Wima' : ' · Vertical') : ''}
        </p>
        {synopsis && <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-300">{synopsis}</p>}
        {hasSeparateNewBatch ? (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPlay(entryEpisode)}
              className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 px-3 py-2 text-xs font-bold text-white transition-colors"
            >
              {language === 'sw'
                ? `Mpya · Ep ${entryEpisode.episode || 1}`
                : `Watch New (Ep ${entryEpisode.episode || 1})`}
            </button>
            <button
              type="button"
              onClick={onDetails}
              className="series-details-trigger rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
              aria-label={`All episodes from episode 1 for ${first.seriesTitle || first.title}`}
            >
              {language === 'sw' ? 'Zote' : 'All'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDetails}
            className="series-details-trigger mt-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold hover:bg-zinc-800"
            aria-label={`Synopsis and episodes for ${first.seriesTitle || first.title}`}
          >
            {portrait
              ? language === 'sw'
                ? 'Muhtasari & vipindi'
                : 'Synopsis & episodes'
              : language === 'sw'
                ? 'Chunguza misimu & vipindi'
                : 'Explore seasons & episodes'}
          </button>
        )}
      </div>
    </article>
  );
};

export default function SeriesCarousel({ title = 'Series', videos, maxSeries = 24, ...props }: Props) {
  const { t, language } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Video[] | null>(null);
  const groups = useMemo(() => {
    const result = new Map<string, Video[]>();
    for (const video of videos) {
      const key = seriesKey(video) || (isMicroDrama(video) ? `micro-single:${video.id}` : undefined);
      if (!key) continue;
      result.set(key, [...(result.get(key) || []), video]);
    }
    return [...result.values()].slice(0, maxSeries).map((episodes) => episodes.sort(compareEpisodes));
  }, [videos, maxSeries]);

  const hasMicro = useMemo(() => groups.some((epList) => epList[0] && isMicroDrama(epList[0])), [groups]);
  const forceVideoAspect = useMemo(() => {
    if (props.uniformAspect === 'video') return true;
    let hasVertical = false;
    let hasHorizontal = false;
    for (const epList of groups) {
      const isVert = isMicroDrama(epList[0]) || epList.some((ep) => Boolean(publicMediaUrl(ep.seriesPosterUrl)));
      if (isVert) hasVertical = true;
      else hasHorizontal = true;
    }
    return hasVertical && hasHorizontal;
  }, [groups, props.uniformAspect]);
  const subtitle = !groups.length
    ? language === 'sw'
      ? 'Hadithi mpya zinakuja.'
      : 'New stories are on the way.'
    : hasMicro
      ? t('shelf.seriesSubtitleMicro')
      : t('shelf.seriesSubtitleFree');

  const scroll = (direction: number) =>
    ref.current?.scrollBy({ left: direction * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section aria-label={title} className="mb-7 md:mb-12 px-4 md:px-0">
      <div className="mb-3 md:mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg md:text-2xl font-bold">{title}</h2>
          <p className="mt-0.5 md:mt-1 text-xs md:text-sm text-zinc-400">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={`Previous ${title}`}
            onClick={() => scroll(-1)}
            className="rounded-full border border-zinc-700 p-2"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label={`Next ${title}`}
            onClick={() => scroll(1)}
            className="rounded-full border border-zinc-700 p-2"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div ref={ref} className="flex items-start gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory py-2 md:py-3 pb-4 md:pb-5 no-scrollbar">
        {groups.map((episodes) => (
          <SeriesCard
            key={seriesKey(episodes[0]) || episodes[0].id}
            episodes={episodes}
            watchLaterIds={props.watchLaterIds}
            onToggleWatchLater={props.onToggleWatchLater}
            onPlay={props.onPlay}
            onDetails={() => setSelectedEpisodes(episodes)}
            forceVideoAspect={forceVideoAspect}
          />
        ))}
      </div>
      {selectedEpisodes && (
        <SeriesDetails
          episodes={selectedEpisodes}
          watchLaterIds={props.watchLaterIds}
          onToggleWatchLater={props.onToggleWatchLater}
          onClose={() => setSelectedEpisodes(null)}
          onPlay={(video) => {
            setSelectedEpisodes(null);
            props.onPlay(video);
          }}
        />
      )}
    </section>
  );
}
