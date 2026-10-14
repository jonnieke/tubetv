import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Video } from '../types';
import SeriesDetails from './SeriesDetails';

const episode = (number: number, season = 1): Video => ({
  id: `episode-${season}-${number}`, title: `Episode ${number}: A different chapter`,
  seriesTitle: 'A real Kenyan series', seriesId: 'series-1', seriesSynopsis: 'The main story has its own synopsis.',
  seasonSynopsis: `Season ${season} has its own story.`,
  episodeSynopsis: `Episode ${number} has its own synopsis.`, category: 'Series', thumbnail: '/real-episode.jpg',
  author: 'A real creator', duration: '12:30', views: 0, isPremium: false, episode: number, season,
});

describe('Series details sheet', () => {
  it('keeps main and episodic synopses separate with episode artwork and controls', () => {
    const html = renderToStaticMarkup(<SeriesDetails episodes={[episode(1), episode(2)]} watchLaterIds={['episode-1-2']}
      onToggleWatchLater={() => {}} onPlay={() => {}} onClose={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('The main story has its own synopsis.');
    expect(html).toContain('Season 1 has its own story.');
    expect(html).toContain('Episode 1 has its own synopsis.');
    expect(html).toContain('Episode 2 has its own synopsis.');
    expect(html).toContain('series-details-episode-art');
    expect(html).toContain('series-details-episodes-horizontal');
    expect(html).toContain('Watch episode 2: Episode 2: A different chapter');
    expect(html).toContain('Remove Episode 2: A different chapter');
    expect(html).toContain('Close series details');
  });

  it('offers a season selector when more than one season is published', () => {
    const html = renderToStaticMarkup(<SeriesDetails episodes={[episode(1), episode(1, 2)]} watchLaterIds={[]}
      onToggleWatchLater={() => {}} onPlay={() => {}} onClose={() => {}} />);
    expect(html).toContain('<select');
    expect(html).toContain('value="2"');
  });

  it('uses a show poster and links the shared trailer without replacing episode art', () => {
    const episodes = [episode(1), episode(2)].map(item => ({
      ...item, seriesPosterUrl: 'https://cdn.example.com/show-poster.jpg', seriesTrailerUrl: 'https://video.example.com/trailer',
    }));
    const html = renderToStaticMarkup(<SeriesDetails episodes={episodes} watchLaterIds={[]}
      onToggleWatchLater={() => {}} onPlay={() => {}} onClose={() => {}} />);
    expect(html).toContain('src="https://cdn.example.com/show-poster.jpg"');
    expect(html).toContain('href="https://video.example.com/trailer"');
    expect(html).toContain('Watch trailer');
    expect(html).toContain('src="/real-episode.jpg"');
  });
});
