import React, { useEffect, useState } from 'react';
import { Check, Play, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Video } from '../types';
import CatalogueArtwork from './CatalogueArtwork';

interface Props {
  video: Video;
  slides?: Video[];
  real: boolean;
  saved: boolean;
  onPlay: () => void;
  onSave: () => void;
  count: number;
  index: number;
  onSelect: (index: number) => void;
}

export default function LandingHero({
  video,
  slides,
  real,
  saved,
  onPlay,
  onSave,
  count,
  index,
  onSelect,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);
  const totalSlides = count || (slides?.length ?? 1);
  const activeIndex = index % (totalSlides || 1);
  const currentVideo = slides && slides[activeIndex] ? slides[activeIndex] : video;

  // Auto-advance sliding banner every 6.5s, paused when hovered by the viewer
  useEffect(() => {
    if (isHovered || totalSlides <= 1) return;
    const interval = setInterval(() => {
      onSelect((index + 1) % totalSlides);
    }, 6500);
    return () => clearInterval(interval);
  }, [index, totalSlides, isHovered, onSelect]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect((index - 1 + totalSlides) % totalSlides);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect((index + 1) % totalSlides);
  };

  return (
    <section
      className="landing-hero group/hero relative"
      aria-label="Featured content"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* High-Performance Stacked Background Slides (Hardware-accelerated crossfade, zero-lag preloading) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {slides && slides.length > 0 ? (
          slides.map((slide, i) => (
            <div
              key={slide.id || i}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                i === activeIndex ? 'opacity-100 z-0' : 'opacity-0 -z-10'
              }`}
              style={{ willChange: 'opacity' }}
            >
              <CatalogueArtwork
                src={slide.thumbnail}
                priority={i === 0 || i === activeIndex}
                className="landing-hero-art"
              />
            </div>
          ))
        ) : (
          <CatalogueArtwork src={currentVideo.thumbnail} priority className="landing-hero-art" />
        )}
      </div>

      <div className="landing-hero-shade" />

      {/* Slide Navigation Arrows */}
      {totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous banner slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/75 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/hero:opacity-100 transition-all duration-200 backdrop-blur-sm active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next banner slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/75 border border-white/10 text-white flex items-center justify-center opacity-0 group-hover/hero:opacity-100 transition-all duration-200 backdrop-blur-sm active:scale-95"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Copy & Playback Actions */}
      <div className="landing-hero-copy relative z-10 transition-all duration-300">
        <p className="cinema-eyebrow">
          {real ? currentVideo.author || 'TubeTV' : 'Demo catalogue'} · {currentVideo.category}
        </p>
        <h1 className="transition-all duration-300">
          {currentVideo.seriesTitle || currentVideo.title}
        </h1>
        <p className="landing-hero-synopsis">
          {currentVideo.seriesSynopsis ||
            currentVideo.description ||
            'Real stories. Bigger tomorrows. Find your next favourite on TubeTV.'}
        </p>
        <div className="cinema-actions">
          <button className="cinema-primary" onClick={onPlay}>
            <Play size={16} fill="currentColor" />
            {currentVideo.episode ? `Watch episode ${currentVideo.episode}` : 'Watch now'}
          </button>
          <button className="cinema-secondary" onClick={onSave}>
            {saved ? <Check size={16} /> : <Plus size={16} />}
            {saved ? 'Saved to watch later' : 'Watch later'}
          </button>
        </div>

        {/* Dots Navigation */}
        {totalSlides > 1 && (
          <nav className="landing-hero-dots" aria-label="Featured titles">
            {Array.from({ length: totalSlides }, (_, i) => (
              <button
                key={i}
                aria-label={`Show featured title ${i + 1}`}
                aria-pressed={i === activeIndex}
                onClick={() => onSelect(i)}
              />
            ))}
          </nav>
        )}
      </div>

      <p className="landing-hero-motto">
        Real stories.<br />
        Bigger tomorrows.<span />
        Kenyan stories.<br />
        A brighter Africa.
      </p>
    </section>
  );
}
