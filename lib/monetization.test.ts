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

    it('keeps entire micro drama free if marked free with sufficient freeEpisodes', () => {
      const freeDrama: Video = {
        ...microDrama(5),
        isPremium: false,
        accessTier: 'free',
        freeEpisodes: 999,
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

    it('locks movies by default when not explicitly marked free', () => {
      const defaultMovie: Video = {
        ...baseVideo,
        id: 'movie-default',
        category: 'Movies',
        isPremium: true,
        accessTier: 'premium',
      };
      expect(isVideoLocked(defaultMovie, false)).toBe(true);
      expect(isContentFree(defaultMovie)).toBe(false);
    });

    it('keeps shorts free by default', () => {
      const shortVideoByCategory: Video = { ...baseVideo, id: 'short-1', category: 'Shorts', isPremium: false };
      const shortVideoByProp: Video = { ...baseVideo, id: 'short-2', category: 'Shorts', isShort: true, isPremium: true };
      expect(isVideoLocked(shortVideoByCategory, false)).toBe(false);
      expect(isContentFree(shortVideoByCategory)).toBe(true);
      expect(isVideoLocked(shortVideoByProp, false)).toBe(false);
      expect(isContentFree(shortVideoByProp)).toBe(true);
    });
  });

  describe('Subscription Tier Hierarchy & Upgrade Rules', () => {
    const TIER_RANKS: Record<string, number> = { daily: 1, weekly: 2, monthly: 3 };

    function canSubscribeTier(activeTier: string | null, targetTier: string): boolean {
      if (!activeTier) return true;
      const currentRank = TIER_RANKS[activeTier.toLowerCase()] || 0;
      const targetRank = TIER_RANKS[targetTier.toLowerCase()] || 0;
      return targetRank > currentRank;
    }

    it('allows subscribing to any tier if user has no active pass', () => {
      expect(canSubscribeTier(null, 'daily')).toBe(true);
      expect(canSubscribeTier(null, 'weekly')).toBe(true);
      expect(canSubscribeTier(null, 'monthly')).toBe(true);
    });

    it('prevents subscribing again to the same tier', () => {
      expect(canSubscribeTier('daily', 'daily')).toBe(false);
      expect(canSubscribeTier('weekly', 'weekly')).toBe(false);
      expect(canSubscribeTier('monthly', 'monthly')).toBe(false);
    });

    it('prevents downgrading to a lower tier while active', () => {
      expect(canSubscribeTier('weekly', 'daily')).toBe(false);
      expect(canSubscribeTier('monthly', 'daily')).toBe(false);
      expect(canSubscribeTier('monthly', 'weekly')).toBe(false);
    });

    it('allows upgrading only to a strictly higher tier', () => {
      expect(canSubscribeTier('daily', 'weekly')).toBe(true);
      expect(canSubscribeTier('daily', 'monthly')).toBe(true);
      expect(canSubscribeTier('weekly', 'monthly')).toBe(true);
    });
  });
});
