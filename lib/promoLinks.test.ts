import { describe, expect, it } from 'vitest';
import { buildCreatorPromoLink, buildViralCaption } from './promoLinks';
import type { Video } from '../types';

const sampleVideo: Video = {
  id: 'micro-last-matatu-ep1',
  title: 'Episode 1',
  seriesTitle: 'The Last Matatu',
  thumbnail: 'thumb.jpg',
  views: 250,
  duration: '1m 40s',
  isPremium: true,
  author: 'Nairobi Reels',
  category: 'Micro Dramas',
  seriesFormat: 'micro-drama',
  episode: 1,
};

describe('Creator Viral Promo Link Generator', () => {
  it('builds a tracked deep link with utm_source, campaign slug, creator ref, and autoplay=1', () => {
    const link = buildCreatorPromoLink({
      video: sampleVideo,
      channel: 'tiktok',
      creatorCode: 'TUBE-NR123',
      siteOrigin: 'https://www.tube.co.ke',
    });

    expect(link).toBe(
      'https://www.tube.co.ke/watch/micro-last-matatu-ep1?utm_source=tiktok&utm_campaign=the-last-matatu&ref=TUBE-NR123&autoplay=1',
    );
  });

  it('adapts caption free-episode hook dynamically (2 free < 30 eps, 5 free >= 30 eps)', () => {
    const link = 'https://www.tube.co.ke/watch/micro-last-matatu-ep1?utm_source=whatsapp';
    const shortCaption = buildViralCaption({ video: sampleVideo, link, totalSeriesEpisodes: 10 });
    const fullSeasonCaption = buildViralCaption({ video: sampleVideo, link, totalSeriesEpisodes: 35 });

    expect(shortCaption).toContain('Ep 1–2 FREE');
    expect(fullSeasonCaption).toContain('Ep 1–5 FREE');
  });
});
