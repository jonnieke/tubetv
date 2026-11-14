import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Video } from '../types';
import CatalogueArtwork from './CatalogueArtwork';
import SeriesCarousel from './SeriesCarousel';
import VideoCard from './VideoCard';
import VideoCarousel from './VideoCarousel';
import { PlaybackProvider } from '../contexts/PlaybackContext';
import { LanguageProvider } from '../contexts/LanguageContext';

const episode = (format: 'standard' | 'micro-drama'): Video => ({ id: format, title: 'Episode one', seriesTitle: 'A real series', category: format === 'micro-drama' ? 'Micro Dramas' : 'Series', seriesFormat: format, thumbnail: '/episode.jpg', author: 'Producer', views: 0, duration: '10:00', isPremium: false, episode: 1 });
const renderSeries = (video: Video) => renderToStaticMarkup(<SeriesCarousel videos={[video]} watchLaterIds={[]} onToggleWatchLater={() => {}} onPlay={() => {}} />);

describe('catalogue artwork presentation', () => {
  it('keeps standard series landscape and renders the title below the artwork once', () => {
    const html = renderSeries(episode('standard'));
    expect(html).toContain('aspect-video');
    expect(html).toContain('Explore A real series seasons and episodes');
    expect(html).not.toContain('cinema-series-vertical');
    expect(html).toContain('<h3');
    expect(html).not.toContain('cinema-poster-title');
  });
  it('keeps actual micro drama episodes in a vertical frame', () => {
    const html = renderSeries(episode('micro-drama'));
    expect(html).toContain('cinema-series-vertical');
    expect(html).toContain('aspect-[9/16]');
    expect(html).toContain('Watch A real series from episode 1');
  });
  it('uses a stable branded fallback when no thumbnail exists', () => {
    const html = renderToStaticMarkup(<CatalogueArtwork src="" className="h-full w-full" />);
    expect(html).toContain('cinema-artwork-fallback');
    expect(html).not.toContain('<img');
  });
  it('applies lazy async decoding for shelf artwork and eager high priority for hero artwork', () => {
    const shelfHtml = renderToStaticMarkup(<CatalogueArtwork src="https://cdn.example.com/a.jpg" />);
    expect(shelfHtml).toContain('loading="lazy"');
    expect(shelfHtml).toContain('decoding="async"');
    expect(shelfHtml).toContain('cinema-artwork-loading');

    const heroHtml = renderToStaticMarkup(<CatalogueArtwork src="https://cdn.example.com/hero.jpg" priority />);
    expect(heroHtml).toContain('loading="eager"');
    expect(heroHtml).toContain('decoding="sync"');
    expect(heroHtml).toContain('fetchPriority="high"');
    expect(heroHtml).not.toContain('cinema-artwork-loading');
  });
  it('keeps catalogue metadata quiet without fake zero-view popularity or inactive menus', () => {
    const html = renderToStaticMarkup(<VideoCard video={{ ...episode('standard'), views: 0 }} />);
    expect(html).toContain('Episode one');
    expect(html).toContain('Producer');
    expect(html).not.toContain('0.0K views');
    expect(html).not.toContain('More options');
  });
  it('keeps mixed VideoCarousel rows like Continue Watching uniformly landscape', () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <PlaybackProvider
          value={{
            preferences: { autoplay: true, dataSaver: false, maxQuality: 'auto' },
            getProgress: () => undefined,
            onEnded: () => {},
            onProgress: () => {},
          }}
        >
          <VideoCarousel
            title="Continue Watching"
            videos={[episode('standard'), episode('micro-drama')]}
            watchLaterIds={[]}
            onToggleWatchLater={() => {}}
            isAuthenticated={false}
          />
        </PlaybackProvider>
      </LanguageProvider>,
    );
    expect(html).toContain('aspect-video');
    expect(html).not.toContain('aspect-[9/16]');
  });
});
