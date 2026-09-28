import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Play, Plus, X } from 'lucide-react';
import type { Video } from '../types';
import { isMicroDrama } from '../lib/series';
import CatalogueArtwork from './CatalogueArtwork';

interface Props {
  episodes: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onPlay: (video: Video) => void;
  onClose: () => void;
}

export default function SeriesDetails({ episodes, watchLaterIds, onToggleWatchLater, onPlay, onClose }: Props) {
  const first = episodes[0];
  const portrait = isMicroDrama(first);
  const synopsis = episodes.find(episode => episode.seriesSynopsis)?.seriesSynopsis;
  const seasons = [...new Set(episodes.map(episode => episode.season || 1))];
  const [season, setSeason] = useState(first.season || 1);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close series details"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), [href], [tabindex="0"]');
      if (!controls?.length) return;
      const firstControl = controls[0], lastControl = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === firstControl) { event.preventDefault(); lastControl.focus(); }
      else if (!event.shiftKey && document.activeElement === lastControl) { event.preventDefault(); firstControl.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  const content = <div className="series-details-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="series-details-panel" role="dialog" aria-modal="true" aria-labelledby="series-details-title">
      <header className="series-details-bar"><span className="cinema-card-kicker">{portrait ? 'MICRO DRAMA' : 'SERIES'} · {episodes.length} {episodes.length === 1 ? 'EPISODE' : 'EPISODES'}</span><button type="button" onClick={onClose} aria-label="Close series details"><X size={20} /></button></header>
      <div className="series-details-scroll">
        <div className={`series-details-feature ${portrait ? 'series-details-feature-portrait' : ''}`}>
          <CatalogueArtwork src={first.thumbnail} className="series-details-art" />
          <div className="series-details-feature-copy">
            <h2 id="series-details-title">{first.seriesTitle || first.title}</h2>
            <p className="series-details-meta">{first.author}{first.genre ? ` · ${first.genre}` : ''}{portrait ? ' · Vertical episodes' : ''}</p>
            {synopsis && <><p className="series-details-label">The story</p><p className="series-details-synopsis">{synopsis}</p></>}
            <button type="button" className="cinema-primary" onClick={() => onPlay(first)}><Play size={15} fill="currentColor" /> Watch episode {first.episode || 1}</button>
          </div>
        </div>
        <div className="series-details-episode-heading">
          <div><p className="series-details-label">WATCH THE STORY</p><h3>Episodes</h3></div>
          {seasons.length > 1 ? <label>Season <select value={season} onChange={event => setSeason(Number(event.target.value))}>{seasons.map(value => <option key={value} value={value}>{value}</option>)}</select></label> : <span>Season {season}</span>}
        </div>
        <ol className="series-details-episodes">
          {episodes.filter(episode => (episode.season || 1) === season).map(episode => <li key={episode.id}>
            <button type="button" onClick={() => onPlay(episode)} className="series-details-episode-play" aria-label={`Watch episode ${episode.episode || 1}: ${episode.title}`}>
              <CatalogueArtwork src={episode.thumbnail} className={`series-details-episode-art ${portrait ? 'series-details-episode-art-portrait' : ''}`} />
              <span className="series-details-episode-copy">
                <span className="series-details-episode-kicker">EPISODE {episode.episode || 1}{episode.duration ? ` · ${episode.duration}` : ''}</span>
                <strong>{episode.title}</strong>
                {(episode.episodeSynopsis || episode.description) && <span className="series-details-episode-synopsis">{episode.episodeSynopsis || episode.description}</span>}
              </span>
            </button>
            <button type="button" aria-label={`${watchLaterIds.includes(episode.id) ? 'Remove' : 'Save'} ${episode.title}`} onClick={() => onToggleWatchLater(episode.id)} className="series-details-save">{watchLaterIds.includes(episode.id) ? <Check size={18} /> : <Plus size={18} />}</button>
          </li>)}
        </ol>
      </div>
    </div>
  </div>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
