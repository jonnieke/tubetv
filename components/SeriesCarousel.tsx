import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Plus, Check } from 'lucide-react';
import type { Video } from '../types';
import { compareEpisodes, isMicroDrama, seriesKey } from '../lib/series';

interface Props {
  title?: string;
  videos: Video[];
  onToggleWatchLater: (id: string) => void;
  watchLaterIds: string[];
  isAuthenticated?: boolean;
  onPlay: (video: Video) => void;
}

const SeriesCard: React.FC<Omit<Props, 'videos'> & { episodes: Video[] }> = ({ episodes, onPlay, onToggleWatchLater, watchLaterIds }) => {
  const first = episodes[0];
  const [expanded, setExpanded] = useState(false);
  const [season, setSeason] = useState(first.season || 1);
  const seasons = [...new Set(episodes.map(episode => episode.season || 1))];
  const synopsis = episodes.find(episode => episode.seriesSynopsis)?.seriesSynopsis;
  const portrait = isMicroDrama(first);
  return (
    <article className={`cinema-series-card shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 ${portrait ? 'w-[200px] md:w-[240px]' : 'w-[300px] md:w-[340px]'}`}>
      <button type="button" onClick={() => onPlay(first)} aria-label={`Watch ${first.seriesTitle} from episode ${first.episode || 1}`} className={`relative block w-full overflow-hidden text-left group ${portrait ? 'aspect-[9/16]' : 'aspect-video'}`}>
        <img src={first.thumbnail} alt={first.seriesTitle || first.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        <span className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        <span className="cinema-poster-label">{first.author}<br />{portrait ? 'Micro drama' : 'Series'}</span>
        <span className="cinema-poster-copy"><span className="cinema-poster-title">{first.seriesTitle}</span><span className="cinema-poster-tagline">Watch episode {first.episode || 1}</span></span>
      </button>
      <div className="p-4">
        <h3 className="text-lg font-bold text-white">{first.seriesTitle}</h3>
        <p className="mt-1 text-xs text-zinc-400">{episodes.length} episodes · {first.genre || 'Series'}{portrait ? ' · Vertical' : ''}</p>
        {synopsis && <p className={`mt-3 text-sm leading-6 text-zinc-300 ${expanded ? '' : 'line-clamp-3'}`}>{synopsis}</p>}
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="mt-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold hover:bg-zinc-800">{expanded ? 'Close episodes' : 'Synopsis & episodes'}</button>
      </div>
      {expanded && <div className="border-t border-zinc-800 p-3">
        <label className="mb-3 block text-xs text-zinc-400">Season
          <select value={season} onChange={event => setSeason(Number(event.target.value))} className="ml-3 rounded bg-zinc-800 p-2 text-white">{seasons.map(value => <option key={value} value={value}>{value}</option>)}</select>
        </label>
        <ol className="max-h-80 space-y-2 overflow-y-auto">
          {episodes.filter(episode => (episode.season || 1) === season).map(episode => <li key={episode.id} className="flex items-start gap-2 rounded-lg bg-zinc-950 p-3">
            <button type="button" onClick={() => onPlay(episode)} className="min-w-0 flex-1 text-left">
              <span className="text-[10px] uppercase tracking-wider text-red-400">Episode {episode.episode || 1} · {episode.duration}</span>
              <span className="mt-1 block text-sm font-semibold">{episode.title}</span>
              {(episode.episodeSynopsis || episode.description) && <span className="mt-1 block text-xs leading-5 text-zinc-400">{episode.episodeSynopsis || episode.description}</span>}
            </button>
            <button type="button" aria-label={`${watchLaterIds.includes(episode.id) ? 'Remove' : 'Save'} ${episode.title}`} onClick={() => onToggleWatchLater(episode.id)} className="rounded p-2 hover:bg-zinc-800">{watchLaterIds.includes(episode.id) ? <Check size={16} /> : <Plus size={16} />}</button>
          </li>)}
        </ol>
      </div>}
    </article>
  );
};

export default function SeriesCarousel({ title = 'Series', videos, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);
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
    <div ref={ref} className="flex items-start gap-4 overflow-x-auto pb-4">{groups.map(episodes => <SeriesCard key={seriesKey(episodes[0])} episodes={episodes} {...props} />)}</div>
  </section>;
}
