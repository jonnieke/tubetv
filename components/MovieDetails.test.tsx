import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Video } from '../types';
import MovieDetails from './MovieDetails';

const sampleMovie = (id: string, title: string, category = 'Movies'): Video => ({
  id,
  title,
  category,
  thumbnail: `/${id}.jpg`,
  author: 'Nairobi Studios',
  duration: '1h 45m',
  views: 12500,
  isPremium: false,
  description: 'An exciting story about discovery and courage in Kenya.',
  genre: 'Drama',
  productionYear: 2026,
});

describe('MovieDetails Modal', () => {
  it('renders movie details, synopsis, actions and recommended similar movies belt', () => {
    const main = sampleMovie('movie-1', 'The Great Safari');
    const sim1 = sampleMovie('movie-2', 'Echoes of the Rift');
    const sim2 = sampleMovie('movie-3', 'Coastline Mystery');

    const html = renderToStaticMarkup(
      <MovieDetails
        movie={main}
        allVideos={[main, sim1, sim2]}
        watchLaterIds={['movie-1']}
        onToggleWatchLater={() => {}}
        onPlay={() => {}}
        onClose={() => {}}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('The Great Safari');
    expect(html).toContain('The story');
    expect(html).toContain('An exciting story about discovery and courage in Kenya.');
    expect(html).toContain('Play Movie');
    expect(html).toContain('In Watch Later');
    expect(html).toContain('MORE LIKE THIS');
    expect(html).toContain('Recommended Movies');
    expect(html).toContain('Echoes of the Rift');
    expect(html).toContain('Coastline Mystery');
    expect(html).toContain('Close movie details');
  });

  it('renders "Add to Watch Later" when movie is not yet in playlist', () => {
    const main = sampleMovie('movie-1', 'The Great Safari');

    const html = renderToStaticMarkup(
      <MovieDetails
        movie={main}
        allVideos={[main]}
        watchLaterIds={[]}
        onToggleWatchLater={() => {}}
        onPlay={() => {}}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Add to Watch Later');
  });
});
