import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Play, X } from 'lucide-react';
import type { Video } from '../types';
import { compareEpisodes, isMicroDrama, seriesKey } from '../lib/series';
import CatalogueArtwork from './CatalogueArtwork';

interface Props { videos: Video[]; demo: boolean; onPlay: (video: Video) => void; onBrowse: () => void }

/** Editorial discovery layout; all artwork and copy come from published metadata. */
export default function CinematicHome({ videos, demo, onPlay, onBrowse }: Props) {
  const [selected, setSelected] = useState<Video | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setSelected(null); }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [selected]);
  const stories = useMemo(() => {
    const unique = new Map<string, Video>();
    for (const video of [...videos].sort(compareEpisodes)) {
      if (isMicroDrama(video) && !unique.has(seriesKey(video) || video.id)) unique.set(seriesKey(video) || video.id, video);
    }
    return [...unique.values()];
  }, [videos]);
  const posters = stories.length ? stories : videos.slice(0, 5);
  const hero = posters[0];
  const episodes = selected ? videos.filter(v => seriesKey(selected) ? seriesKey(v) === seriesKey(selected) : v.id === selected.id).sort(compareEpisodes) : [];
  if (!hero) return <div className="cinema-empty">New stories are on the way.</div>;
  return <div className="cinema-home">
    <section className="cinema-hero" aria-label="Featured story">
      <CatalogueArtwork className="cinema-hero-art" src={hero.thumbnail} priority />
      <div className="cinema-hero-shade" />
      <div className="cinema-hero-copy">
        <p className="cinema-eyebrow">{demo ? 'DEMO CATALOGUE' : hero.author} · {isMicroDrama(hero) ? 'MICRO DRAMA' : hero.category}</p>
        <h1>{hero.seriesTitle || hero.title}</h1>
        <p className="cinema-logline">{hero.seriesSynopsis || hero.description || 'Real stories. Bigger tomorrows. Discover your next favourite on TubeTV.'}</p>
        <div className="cinema-actions">
          <button className="cinema-primary" onClick={() => onPlay(hero)}><Play size={16} fill="currentColor" />{seriesKey(hero) ? `Watch episode ${hero.episode || 1}` : 'Watch now'}</button>
          <button className="cinema-secondary" onClick={() => setSelected(hero)}>{seriesKey(hero) ? 'View episodes' : 'View details'}</button>
        </div>
      </div>
    </section>
    <section className="cinema-shelf" aria-label="Featured stories">
      <div className="cinema-section-title"><h2>{stories.length ? 'Small episodes. Big stories.' : 'Stories worth discovering.'}</h2><button onClick={onBrowse}>See all <ArrowRight size={13} /></button></div>
      <div className="cinema-posters">
        {posters.slice(0, 12).map(video => <button key={video.id} className="cinema-poster" onClick={() => setSelected(video)} aria-label={`View ${video.seriesTitle || video.title}`}>
          <CatalogueArtwork src={video.thumbnail} />
          <span className="cinema-poster-shade" />
          <span className="cinema-poster-label">{video.author}<br />{isMicroDrama(video) ? 'MICRO DRAMA' : video.category}</span>
          <span className="cinema-poster-copy"><span className="cinema-poster-title">{video.seriesTitle || video.title}</span><span className="cinema-poster-tagline">{video.genre || video.category}</span></span>
        </button>)}
      </div>
    </section>
    <section className="cinema-discover" aria-label="More to discover">
      <div className="cinema-section-title"><h2>More to discover</h2></div>
      <div className="cinema-landscapes">{videos.filter(v => !isMicroDrama(v)).slice(0, 18).map(video => <button key={video.id} onClick={() => onPlay(video)} className="cinema-landscape">
        <CatalogueArtwork src={video.thumbnail} /><span>{video.title}</span><small>{video.category}</small>
      </button>)}</div>
    </section>
    <footer className="cinema-footer"><span>Real stories. Bigger tomorrows.</span><span>Kenyan stories. A brighter Africa.</span></footer>
    {selected && <div className="cinema-details-backdrop" onClick={() => setSelected(null)}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={selected.seriesTitle || selected.title} className="cinema-details" onClick={e => e.stopPropagation()}>
        <button autoFocus className="cinema-details-close" aria-label="Close story details" onClick={() => setSelected(null)}><X /></button>
        <h2>{selected.seriesTitle || selected.title}</h2><p>{selected.seriesSynopsis || selected.description}</p>
        <h3>{seriesKey(selected) ? 'Episodes' : 'Watch story'}</h3>
        {episodes.map(episode => <button key={episode.id} className="cinema-episode" onClick={() => { setSelected(null); onPlay(episode); }}><img src={episode.thumbnail} alt="" /><span><small>{seriesKey(episode) ? `Season ${episode.season || 1} · Episode ${episode.episode || 1}` : episode.category} · {episode.duration}</small><strong>{episode.title}</strong><span>{episode.episodeSynopsis || episode.description}</span></span><Play size={18} /></button>)}
      </section>
    </div>}
  </div>;
}
