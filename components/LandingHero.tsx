import React from 'react';
import { Check, Play, Plus } from 'lucide-react';
import { Video } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import CatalogueArtwork from './CatalogueArtwork';

interface Props {
  video: Video;
  real: boolean;
  saved: boolean;
  onPlay: () => void;
  onSave: () => void;
  count: number;
  index: number;
  onSelect: (index: number) => void;
}

export default function LandingHero({ video, real, saved, onPlay, onSave, count, index, onSelect }: Props) {
  const { language, t } = useLanguage();
  return (
    <section className="landing-hero" aria-label="Featured content">
      <CatalogueArtwork src={video.thumbnail} priority className="landing-hero-art" />
      <div className="landing-hero-shade" />
      <div className="landing-hero-copy">
        <p className="cinema-eyebrow">
          {real ? video.author || 'TubeTV' : language === 'sw' ? 'Orodha ya majaribio' : 'Demo catalogue'} · {video.category}
        </p>
        <h1>{video.seriesTitle || video.title}</h1>
        <p className="landing-hero-synopsis">
          {video.seriesSynopsis ||
            video.description ||
            (language === 'sw'
              ? 'Hadithi za kweli za Kenya. Anza kutazama sasa kwenye TubeTV.'
              : 'Real stories. Bigger tomorrows. Find your next favourite on TubeTV.')}
        </p>
        <div className="cinema-actions">
          <button type="button" className="cinema-primary" onClick={onPlay}>
            <Play size={16} fill="currentColor" />
            {video.episode
              ? language === 'sw'
                ? `Tazama kipindi ${video.episode}`
                : `Watch episode ${video.episode}`
              : t('hero.watchNow')}
          </button>
          <button type="button" className="cinema-secondary" onClick={onSave}>
            {saved ? <Check size={16} /> : <Plus size={16} />}
            {saved ? (language === 'sw' ? 'Imehifadhiwa kwenye orodha' : 'Saved to watch later') : t('hero.watchLater')}
          </button>
        </div>
        {count > 1 && (
          <nav className="landing-hero-dots" aria-label="Featured titles">
            <button
              type="button"
              className="landing-hero-arrow"
              aria-label="Previous featured movie"
              onClick={() => onSelect((index - 1 + count) % count)}
            >
              ‹
            </button>
            {Array.from({ length: count }, (_, i) => (
              <button
                type="button"
                key={i}
                aria-label={`Show featured title ${i + 1}`}
                aria-pressed={i === index}
                onClick={() => onSelect(i)}
              />
            ))}
            <button
              type="button"
              className="landing-hero-arrow"
              aria-label="Next featured movie"
              onClick={() => onSelect((index + 1 + count) % count)}
            >
              ›
            </button>
            <span className="landing-hero-count">
              {index + 1} / {count}
            </span>
          </nav>
        )}
      </div>
      <p className="landing-hero-motto">
        {language === 'sw' ? (
          <>
            Hadithi za kweli.
            <br />
            Kesho iliyo bora.
            <span />
            Hadithi za Kenya.
            <br />
            Afrika yenye mwanga.
          </>
        ) : (
          <>
            Real stories.
            <br />
            Bigger tomorrows.
            <span />
            Kenyan stories.
            <br />
            A brighter Africa.
          </>
        )}
      </p>
    </section>
  );
}
