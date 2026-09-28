import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LandingHero from './LandingHero';
import LandingFooter from './LandingFooter';
import MicroDramaComingSoon from './MicroDramaComingSoon';
import ViewerWelcome from './ViewerWelcome';
import type { Video } from '../types';

const video: Video = { id: 'real', title: 'Real catalogue title', category: 'Movies', author: 'Creator', description: 'Published synopsis', thumbnail: '/real.jpg', views: 10, duration: '24:00', isPremium: false };
describe('Landing presentation preserves the platform', () => {
  it('uses real hero metadata and retains playback and watch-later controls', () => {
    const html = renderToStaticMarkup(<LandingHero video={video} real saved={false} onPlay={() => {}} onSave={() => {}} count={2} index={0} onSelect={() => {}} />);
    expect(html).toContain('Real catalogue title');
    expect(html).toContain('Published synopsis');
    expect(html).toContain('Watch now');
    expect(html).toContain('Watch later');
    expect(html).toContain('aria-label="Featured titles"');
    expect(html).toContain('Show featured title 2');
    expect(html).not.toContain('A Nairobi Secret');
  });
  it('labels micro dramas as upcoming without inventing playable titles', () => {
    const html = renderToStaticMarkup(<MicroDramaComingSoon />);
    expect(html).toContain('COMING SOON');
    expect(html).toContain('No episodes have launched yet');
    expect(html).not.toContain('Watch episode');
  });
  it('keeps the home micro-drama feature compact and gives the dedicated page working alternatives', () => {
    const compact = renderToStaticMarkup(<MicroDramaComingSoon compact onExplore={() => {}} />);
    const dedicated = renderToStaticMarkup(<MicroDramaComingSoon onMovies={() => {}} onSeries={() => {}} />);
    expect(compact).toContain('micro-launch-compact');
    expect(compact).toContain('What are Micro Dramas?');
    expect(dedicated).toContain('Explore Movies');
    expect(dedicated).toContain('Explore Series');
    expect(dedicated).not.toContain('Watch episode');
  });
  it('keeps category and legal navigation in the footer', () => {
    const html = renderToStaticMarkup(<LandingFooter navigate={() => {}} />);
    for (const label of ['Movies', 'Series', 'Micro Dramas', 'Shorts', 'Education', 'Live']) expect(html).toContain(label);
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="mailto:info@onfonmedia.com"');
    expect(html).toContain('href="tel:+254703012000"');
  });
  it('offers optional onboarding without requiring an account', () => {
    const html = renderToStaticMarkup(<ViewerWelcome navigate={() => {}} />);
    expect(html).toContain('No account needed');
    expect(html).toContain('Skip introduction');
    expect(html).toContain('aria-expanded="false"');
  });
});
