import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { Video } from '../types';
import { compareEpisodes, isMicroDrama, seriesKey } from '../lib/series';
import CatalogueArtwork from './CatalogueArtwork';
import SeriesDetails from './SeriesDetails';

interface Props {
  title?: string;
  videos: Video[];
  onToggleWatchLater: (id: string) => void;
  watchLaterIds: string[];
  isAuthenticated?: boolean;
  onPlay: (video: Video) => void;
}

const SeriesCard: React.FC<{ episodes: Video[]; onPlay: (video: Video) => void; onDetails: () => void }> = ({ episodes, onPlay, onDetails }) => {
  const first = episodes[0];
  const synopsis = episodes.find(episode => episode.seriesSynopsis)?.seriesSynopsis;
  const portrait = isMicroDrama(first);
  return <article className={`cinema-series-card shrink-0 overflow-hidden ${portrait ? 'cinema-series-vertical w-[200px] md:w-[240px]' : 'w-[300px] md:w-[340px]'}`}>
    <button type="button" onClick={portrait ? () => onPlay(first) : onDetails} aria-label={portrait ? `Watch ${first.seriesTitle || first.title} from episode ${first.episode || 1}` : `Explore ${first.seriesTitle || first.title} seasons and episodes`} className={`cinema-series-art relative block w-full overflow-hidden text-left group ${portrait ? 'aspect-[9/16]' : 'aspect-video'}`}>
      <CatalogueArtwork src={first.thumbnail} className="h-full w-full object-cover" />
      <span className="cinema-series-play" aria-hidden="true"><Play size={16} fill="currentColor" /></span>
    </button>
    <div className="cinema-series-info p-4">
      <p className="cinema-card-kicker">{portrait ? 'Micro Drama' : 'Series'} · {first.author}</p>
      <h3 className="text-lg font-bold text-white">{first.seriesTitle || first.title}</h3>
      <p className="mt-1 text-xs text-zinc-400">{episodes.length} {episodes.length === 1 ? 'episode' : 'episodes'}{first.genre ? ` · ${first.genre}` : ''}{portrait ? ' · Vertical' : ''}</p>
      {synopsis && <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-300">{synopsis}</p>}
      <button type="button" onClick={onDetails} className="series-details-trigger mt-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold hover:bg-zinc-800" aria-label={`Synopsis and episodes for ${first.seriesTitle || first.title}`}>{portrait ? 'Synopsis & episodes' : 'Explore seasons & episodes'}</button>
    </div>
  </article>;
};

export default function SeriesCarousel({ title = 'Series', videos, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Video[] | null>(null);
  const groups = useMemo(() => {
    const result = new Map<string, Video[]>();
    for (const video of videos) {
      const key = seriesKey(video);
      if (!key) continue;
      result.set(key, [...(result.get(key) || []), video]);
    }
    return [...result.values()].map(episodes => episodes.sort(compareEpisodes));
  }, [videos]);
  const scroll = (direction: number) => ref.current?.scrollBy({ left: direction * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return <section aria-label={title} className="mb-12 px-4 md:px-0">
    <div className="mb-5 flex items-center justify-between gap-4">
      <div><h2 className="text-2xl font-bold">{title}</h2><p className="mt-1 text-sm text-zinc-400">{groups.length ? 'Find your next story. Watch every episode free.' : 'New stories are on the way.'}</p></div>
      <div className="flex gap-2"><button aria-label={`Previous ${title}`} onClick={() => scroll(-1)} className="rounded-full border border-zinc-700 p-2"><ChevronLeft size={18} /></button><button aria-label={`Next ${title}`} onClick={() => scroll(1)} className="rounded-full border border-zinc-700 p-2"><ChevronRight size={18} /></button></div>
    </div>
    <div ref={ref} className="flex items-start gap-4 overflow-x-auto pb-4 no-scrollbar">{groups.map(episodes => <SeriesCard key={seriesKey(episodes[0])} episodes={episodes} onPlay={props.onPlay} onDetails={() => setSelectedEpisodes(episodes)} />)}</div>
    {selectedEpisodes && <SeriesDetails episodes={selectedEpisodes} watchLaterIds={props.watchLaterIds} onToggleWatchLater={props.onToggleWatchLater}
      onClose={() => setSelectedEpisodes(null)} onPlay={video => { setSelectedEpisodes(null); props.onPlay(video); }} />}
  </section>;
}
