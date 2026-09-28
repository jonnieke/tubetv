import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ShortsPlayer from './ShortsPlayer';
import type { ShortVideo } from '../types';

const short: ShortVideo = {
  id: 'short-1', thumbnail: '/short.jpg', videoUrl: '/short.mp4', author: '@creator',
  description: 'A short Kenyan story', likes: 1, comments: 2,
};

describe('Shorts viewing surface', () => {
  it('provides a clear exit and accessible actions without an admin sign-in trap', () => {
    const html = renderToStaticMarkup(<ShortsPlayer shorts={[short]} onExit={() => {}} />);
    expect(html).toContain('Back to Discover');
    expect(html).toContain('A short Kenyan story');
    expect(html).toContain('aria-label="Unmute short"');
    expect(html).toContain('aria-label="Share short"');
    expect(html).not.toContain('Open comments');
    expect(html).not.toContain('Like short');
    expect(html).not.toContain('Subscribe');
    expect(html).not.toContain('Shop Now');
  });

  it('shows an honest exit when no shorts have been published', () => {
    const html = renderToStaticMarkup(<ShortsPlayer shorts={[]} onExit={() => {}} />);
    expect(html).toContain('More moments are on the way.');
    expect(html).toContain('Back to Discover');
  });
});
