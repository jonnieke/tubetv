import React from 'react';
import { Check, Play, Plus } from 'lucide-react';
import { Video } from '../types';
import CatalogueArtwork from './CatalogueArtwork';

interface Props { video: Video; real: boolean; saved: boolean; onPlay: () => void; onSave: () => void; count: number; index: number; onSelect: (index: number) => void }
export default function LandingHero({ video, real, saved, onPlay, onSave, count, index, onSelect }: Props) {
  return <section className="landing-hero" aria-label="Featured content">
    <CatalogueArtwork src={video.thumbnail} priority className="landing-hero-art" />
    <div className="landing-hero-shade" />
    <div className="landing-hero-copy">
      <p className="cinema-eyebrow">{real ? video.author || 'TubeTV' : 'Demo catalogue'} · {video.category}</p>
      <h1>{video.seriesTitle || video.title}</h1>
      <p className="landing-hero-synopsis">{video.seriesSynopsis || video.description || 'Real stories. Bigger tomorrows. Find your next favourite on TubeTV.'}</p>
      <div className="cinema-actions">
        <button className="cinema-primary" onClick={onPlay}><Play size={16} fill="currentColor" />{video.episode ? `Watch episode ${video.episode}` : 'Watch now'}</button>
        <button className="cinema-secondary" onClick={onSave}>{saved ? <Check size={16} /> : <Plus size={16} />}{saved ? 'Saved to watch later' : 'Watch later'}</button>
      </div>
      {count > 1 && <nav className="landing-hero-dots" aria-label="Featured titles"><button className="landing-hero-arrow" aria-label="Previous featured movie" onClick={() => onSelect((index - 1 + count) % count)}>‹</button>{Array.from({ length: count }, (_, i) => <button key={i} aria-label={`Show featured title ${i + 1}`} aria-pressed={i === index} onClick={() => onSelect(i)} />)}<button className="landing-hero-arrow" aria-label="Next featured movie" onClick={() => onSelect((index + 1) % count)}>›</button><span className="landing-hero-count">{index + 1} / {count}</span></nav>}
    </div>
    <p className="landing-hero-motto">Real stories.<br />Bigger tomorrows.<span />Kenyan stories.<br />A brighter Africa.</p>
  </section>;
}
