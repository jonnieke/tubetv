import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CinematicHome from './CinematicHome';
import CinemaNavigation from './CinemaNavigation';
import { Video, ViewState } from '../types';

const episode = (number: number): Video => ({ id: `ep-${number}`, title: `Chapter ${number}`, seriesTitle: 'Published story', seriesId: 'one', seriesSynopsis: 'A published main synopsis.', seriesFormat: 'micro-drama', category: 'Micro Dramas', episode: number, season: 1, author: 'Studio', thumbnail: '/poster.jpg', duration: '2m', views: 0, isPremium: false });
describe('Cinematic discovery', () => {
  it('groups series into one poster and starts with the earliest published episode', () => {
    const html = renderToStaticMarkup(<CinematicHome videos={[episode(2), episode(1)]} demo={false} onPlay={() => {}} onBrowse={() => {}} />);
    expect(html).toContain('Watch episode 1');
    expect(html).toContain('A published main synopsis.');
    expect(html.match(/class="cinema-poster"/g)).toHaveLength(1);
    expect(html).not.toContain('A Nairobi Secret');
    expect(html).not.toContain('DEMO CATALOGUE');
  });
  it('handles an empty library without inventing content', () => {
    expect(renderToStaticMarkup(<CinematicHome videos={[]} demo={false} onPlay={() => {}} onBrowse={() => {}} />)).toContain('New stories are on the way.');
  });
  it('marks the selected movies destination in the top navigation', () => {
    const html = renderToStaticMarkup(<CinemaNavigation view={ViewState.ORIGINALS} subcategory="Movies" items={[]} authenticated={false} admin={false} search="" onSearch={() => {}} navigate={() => {}} login={() => {}} logout={() => {}} />);
    expect(html).toContain('aria-current="page">Movies');
    expect(html).toContain('aria-label="Admin sign in"');
  });
});
