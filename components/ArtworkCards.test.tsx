import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Video } from '../types';
import CatalogueArtwork from './CatalogueArtwork';
import SeriesCarousel from './SeriesCarousel';
import VideoCard from './VideoCard';

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
  it('keeps catalogue metadata quiet without fake zero-view popularity or inactive menus', () => {
    const html = renderToStaticMarkup(<VideoCard video={{ ...episode('standard'), views: 0 }} />);
    expect(html).toContain('Episode one');
    expect(html).toContain('Producer');
    expect(html).not.toContain('0.0K views');
    expect(html).not.toContain('More options');
  });
});
