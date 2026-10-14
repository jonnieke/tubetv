import { describe, expect, it } from 'vitest';
import { isContentFree, isVideoLocked } from './monetization';
import type { Video } from '../types';

const baseVideo: Video = {
  id: 'vid-1',
  title: 'Test Show',
  thumbnail: 'thumb.jpg',
  views: 100,
  duration: '10m',
  isPremium: false,
  author: 'Author',
  category: 'Movies',
};

describe('monetization rules', () => {
  describe('Model 1: Micro Dramas & Series', () => {
    const microDrama = (ep: number, isPrem = true, freeEps = 2): Video => ({
      ...baseVideo,
      category: 'Micro Dramas',
      seriesFormat: 'micro-drama',
      seriesTitle: 'Kibera Hustle',
      episode: ep,
      isPremium: isPrem,
      freeEpisodes: freeEps,
    });

    it('keeps teaser episodes 1 and 2 free by default', () => {
      expect(isVideoLocked(microDrama(1), false)).toBe(false);
      expect(isVideoLocked(microDrama(2), false)).toBe(false);
    });

    it('locks episode 3+ when premium without active pass', () => {
      expect(isVideoLocked(microDrama(3), false)).toBe(true);
      expect(isVideoLocked(microDrama(10), false)).toBe(true);
    });

    it('unlocks episode 3+ if user has active pass', () => {
      expect(isVideoLocked(microDrama(3), true)).toBe(false);
    });

    it('unlocks episode 3+ if specific episode is unlocked', () => {
      expect(isVideoLocked(microDrama(3), false, ['vid-1'])).toBe(false);
    });

    it('respects custom freeEpisodes count', () => {
      // 3 free teaser episodes
      expect(isVideoLocked(microDrama(3, true, 3), false)).toBe(false);
      expect(isVideoLocked(microDrama(4, true, 3), false)).toBe(true);
    });

    it('keeps entire micro drama free if marked free', () => {
      const freeDrama: Video = {
        ...microDrama(5),
        isPremium: false,
        accessTier: 'free',
      };
      expect(isVideoLocked(freeDrama, false)).toBe(false);
    });
  });

  describe('Model 2: Standalone Movies and Shows', () => {
    it('allows free access to free movies', () => {
      const freeMovie: Video = { ...baseVideo, category: 'Movies', isPremium: false };
      expect(isVideoLocked(freeMovie, false)).toBe(false);
      expect(isContentFree(freeMovie)).toBe(true);
    });

    it('locks premium movies without active pass', () => {
      const premiumMovie: Video = { ...baseVideo, category: 'Movies', isPremium: true, accessTier: 'premium' };
      expect(isVideoLocked(premiumMovie, false)).toBe(true);
      expect(isContentFree(premiumMovie)).toBe(false);
    });

    it('unlocks premium movie with active subscription', () => {
      const premiumMovie: Video = { ...baseVideo, category: 'Movies', isPremium: true };
      expect(isVideoLocked(premiumMovie, true)).toBe(false);
    });

    it('unlocks premium movie if specifically unlocked in session', () => {
      const premiumMovie: Video = { ...baseVideo, id: 'movie-100', category: 'Movies', isPremium: true };
      expect(isVideoLocked(premiumMovie, false, ['movie-100'])).toBe(false);
    });
  });
});
