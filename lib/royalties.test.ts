import { describe, it, expect } from 'vitest';
import {
  computeShareOfPlayRoyalties,
  parseDurationToSeconds,
  MINIMUM_PAYOUT_THRESHOLD_KES,
  RoyaltyPoolConfig,
} from './royalties';
import { Video } from '../types';

describe('Creator Royalties & Share of Play Engine', () => {
  it('correctly parses duration formats into seconds', () => {
    expect(parseDurationToSeconds(180)).toBe(180);
    expect(parseDurationToSeconds('01:30')).toBe(90);
    expect(parseDurationToSeconds('02:15:30')).toBe(2 * 3600 + 15 * 60 + 30);
    expect(parseDurationToSeconds(undefined)).toBe(120);
    expect(parseDurationToSeconds('invalid')).toBe(120);
  });

  it('computes 70% net creator pool after Paystack 1.5% gateway fee', () => {
    const config: RoyaltyPoolConfig = {
      periodLabel: 'November 2026',
      grossSubscriptionRevenueKes: 100000,
      gatewayFeePercent: 1.5,
      creatorPoolPercent: 70,
    };

    const mockVideos: Video[] = [
      {
        id: 'vid-1',
        title: 'Campus Hustle Ep 1',
        thumbnail: '',
        views: 1000,
        duration: '02:00',
        isPremium: false,
        author: 'Malik Studios',
        category: 'Micro Dramas',
        seriesTitle: 'Campus Hustle',
        episode: 1,
      },
    ];

    const result = computeShareOfPlayRoyalties(mockVideos, config);

    // Gross: 100,000
    // Gateway Fee: 1,500 (1.5%)
    // Net Subscription Pool: 98,500
    // Net Creator Pool: 68,950 (70% of 98,500)
    // Platform Share: 29,550 (30% of 98,500)
    expect(result.grossRevenueKes).toBe(100000);
    expect(result.gatewayFeesKes).toBe(1500);
    expect(result.netSubscriptionPoolKes).toBe(98500);
    expect(result.netCreatorPoolKes).toBe(68950);
    expect(result.platformShareKes).toBe(29550);
  });

  it('allocates pro-rata Share of Play based on 30s Qualified Views', () => {
    const config: RoyaltyPoolConfig = {
      periodLabel: 'November 2026',
      grossSubscriptionRevenueKes: 50000,
      gatewayFeePercent: 1.5,
      creatorPoolPercent: 70,
    };

    // Creator A has 600 views, Creator B has 400 views
    const mockVideos: Video[] = [
      {
        id: 'vid-1',
        title: 'Series Alpha Ep 1',
        thumbnail: '',
        views: 600,
        duration: '03:00',
        isPremium: true,
        author: 'Studio Alpha',
        category: 'Series',
        seriesTitle: 'Series Alpha',
      },
      {
        id: 'vid-2',
        title: 'Series Beta Ep 1',
        thumbnail: '',
        views: 400,
        duration: '03:00',
        isPremium: true,
        author: 'Studio Beta',
        category: 'Series',
        seriesTitle: 'Series Beta',
      },
    ];

    const result = computeShareOfPlayRoyalties(mockVideos, config);

    expect(result.creators.length).toBe(2);

    const studioAlpha = result.creators.find((c) => c.creator === 'Studio Alpha')!;
    const studioBeta = result.creators.find((c) => c.creator === 'Studio Beta')!;

    // Alpha should have 60% share, Beta 40%
    expect(studioAlpha.shareOfPlayPercent).toBeCloseTo(60, 1);
    expect(studioBeta.shareOfPlayPercent).toBeCloseTo(40, 1);

    // Alpha earnings should be 60% of netCreatorPool
    expect(studioAlpha.netEarningsKes).toBeCloseTo(result.netCreatorPoolKes * 0.6, 1);
    expect(studioBeta.netEarningsKes).toBeCloseTo(result.netCreatorPoolKes * 0.4, 1);
  });

  it('enforces KSh 1,000 minimum monthly payout threshold', () => {
    const config: RoyaltyPoolConfig = {
      periodLabel: 'November 2026',
      grossSubscriptionRevenueKes: 2000, // Small pool
      gatewayFeePercent: 0,
      creatorPoolPercent: 70, // Total creator pool = 1,400
      payoutThresholdKes: MINIMUM_PAYOUT_THRESHOLD_KES,
    };

    // Alpha gets 80% (1,120 KES >= 1,000 threshold -> ELIGIBLE)
    // Beta gets 20% (280 KES < 1,000 threshold -> CARRIED_FORWARD)
    const mockVideos: Video[] = [
      {
        id: 'vid-1',
        title: 'Popular Show',
        thumbnail: '',
        views: 800,
        duration: '01:00',
        isPremium: false,
        author: 'Big Creator',
        category: 'Shorts',
      },
      {
        id: 'vid-2',
        title: 'Indie Short',
        thumbnail: '',
        views: 200,
        duration: '01:00',
        isPremium: false,
        author: 'Small Creator',
        category: 'Shorts',
      },
    ];

    const result = computeShareOfPlayRoyalties(mockVideos, config);

    const bigCreator = result.creators.find((c) => c.creator === 'Big Creator')!;
    const smallCreator = result.creators.find((c) => c.creator === 'Small Creator')!;

    expect(bigCreator.netEarningsKes).toBe(1120);
    expect(bigCreator.isEligibleForPayout).toBe(true);
    expect(bigCreator.payoutStatus).toBe('ELIGIBLE');
    expect(bigCreator.thresholdProgressPercent).toBe(100);

    expect(smallCreator.netEarningsKes).toBe(280);
    expect(smallCreator.isEligibleForPayout).toBe(false);
    expect(smallCreator.payoutStatus).toBe('CARRIED_FORWARD');
    expect(smallCreator.thresholdProgressPercent).toBe(28); // 280 / 1000 = 28%

    expect(result.eligibleCreatorsCount).toBe(1);
    expect(result.carriedForwardCreatorsCount).toBe(1);
    expect(result.totalEligiblePayoutKes).toBe(1120);
  });
});
