import { describe, it, expect } from 'vitest';
import {
  computeBalancedWatchWeight,
  computeShareOfPlayRoyalties,
  computeUserCentricVideoGross,
  extractCarriedForwardByCreator,
  getQualifiedViewThresholdSeconds,
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

  it('computes 60/40 net creator pool in favor of creative after Paystack 1.5% gateway fee', () => {
    const config: RoyaltyPoolConfig = {
      periodLabel: 'November 2026',
      grossSubscriptionRevenueKes: 100000,
      gatewayFeePercent: 1.5,
      // Uses default 60% creator pool
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
    // Net Creator Pool: 59,100 (60% of 98,500 in favor of creative)
    // Platform Share: 39,400 (40% of 98,500)
    expect(result.grossRevenueKes).toBe(100000);
    expect(result.gatewayFeesKes).toBe(1500);
    expect(result.netSubscriptionPoolKes).toBe(98500);
    expect(result.netCreatorPoolKes).toBe(59100);
    expect(result.platformShareKes).toBe(39400);
  });

  it('allocates pro-rata Share of Play based on 30s Qualified Views', () => {
    const config: RoyaltyPoolConfig = {
      periodLabel: 'November 2026',
      grossSubscriptionRevenueKes: 50000,
      gatewayFeePercent: 1.5,
      // Default 60% creator pool
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
      grossSubscriptionRevenueKes: 2500, // Small pool
      gatewayFeePercent: 0,
      creatorPoolPercent: 60, // Total creator pool = 1,500 (60% split)
      payoutThresholdKes: MINIMUM_PAYOUT_THRESHOLD_KES,
    };

    // Big Creator gets 80% (1,200 KES >= 1,000 threshold -> ELIGIBLE)
    // Small Creator gets 20% (300 KES < 1,000 threshold -> CARRIED_FORWARD)
    const mockVideos: Video[] = [
      {
        id: 'vid-1',
        title: 'Popular Show',
        thumbnail: '',
        views: 800,
        duration: '01:00',
        isPremium: true,
        author: 'Big Creator',
        category: 'Movies',
      },
      {
        id: 'vid-2',
        title: 'Indie Film',
        thumbnail: '',
        views: 200,
        duration: '01:00',
        isPremium: true,
        author: 'Small Creator',
        category: 'Movies',
      },
      {
        id: 'vid-3',
        title: 'Ticktock Viral Clip',
        thumbnail: '',
        views: 99999,
        duration: '00:45',
        isPremium: false,
        author: 'Ticktock',
        category: 'Shorts',
      },
    ];

    const result = computeShareOfPlayRoyalties(mockVideos, config);

    expect(result.creators.find((c) => c.creator === 'Ticktock')).toBeUndefined();

    const bigCreator = result.creators.find((c) => c.creator === 'Big Creator')!;
    const smallCreator = result.creators.find((c) => c.creator === 'Small Creator')!;

    expect(bigCreator.netEarningsKes).toBe(1200);
    expect(bigCreator.isEligibleForPayout).toBe(true);
    expect(bigCreator.payoutStatus).toBe('ELIGIBLE');
    expect(bigCreator.thresholdProgressPercent).toBe(100);

    expect(smallCreator.netEarningsKes).toBe(300);
    expect(smallCreator.isEligibleForPayout).toBe(false);
    expect(smallCreator.payoutStatus).toBe('CARRIED_FORWARD');
    expect(smallCreator.thresholdProgressPercent).toBe(30); // 300 / 1000 = 30%

    expect(result.eligibleCreatorsCount).toBe(1);
    expect(result.carriedForwardCreatorsCount).toBe(1);
    expect(result.totalEligiblePayoutKes).toBe(1200);
  });

  it('awards qualified views at 80% for paid content under 30 seconds', () => {
    expect(getQualifiedViewThresholdSeconds(25, true)).toBeCloseTo(20, 2);
    expect(getQualifiedViewThresholdSeconds(15, true)).toBeCloseTo(12, 2);
    expect(getQualifiedViewThresholdSeconds(25, false)).toBe(30);
    expect(getQualifiedViewThresholdSeconds(45, true)).toBe(30);
  });

  it('allocates user-centric royalties per pass without heavy binge dilution (5 vs 200 plays)', () => {
    const videos: Video[] = [
      { id: 'v-a', title: 'Campus Hustle', thumbnail: '', views: 5, duration: '10:00', isPremium: true, author: 'Creator A', category: 'Movies' },
      { id: 'v-b', title: 'Binge Drama', thumbnail: '', views: 200, duration: '02:00', isPremium: true, author: 'Creator B', category: 'Series' },
    ];
    const passes = [
      { viewerKey: 'user-a', amountKes: 10 },
      { viewerKey: 'user-b', amountKes: 10 },
    ];
    const plays = [
      ...Array.from({ length: 5 }, () => ({ viewerKey: 'user-a', videoId: 'v-a', watchSeconds: 60 })),
      ...Array.from({ length: 200 }, () => ({ viewerKey: 'user-b', videoId: 'v-b', watchSeconds: 60 })),
    ];
    const { userCentricGrossByVideo, unattributedGrossKes } = computeUserCentricVideoGross(
      passes,
      plays,
      new Set(['v-a', 'v-b']),
    );
    expect(unattributedGrossKes).toBe(0);
    expect(userCentricGrossByVideo['v-a']).toBeCloseTo(10, 2);
    expect(userCentricGrossByVideo['v-b']).toBeCloseTo(10, 2);

    const result = computeShareOfPlayRoyalties(
      videos,
      { periodLabel: 'Today', grossSubscriptionRevenueKes: 20 },
      { measuredQualifiedViews: { 'v-a': 5, 'v-b': 200 }, userCentricGrossByVideo, unattributedGrossKes },
    );
    const creatorA = result.creators.find((c) => c.creator === 'Creator A')!;
    const creatorB = result.creators.find((c) => c.creator === 'Creator B')!;
    expect(creatorA.netEarningsKes).toBeCloseTo(5.91, 2);
    expect(creatorB.netEarningsKes).toBeCloseTo(5.91, 2);
  });

  it('balances movies vs short episodes with sqrt weighting, 90m cap, and daily replay deduplication', () => {
    // 2-min micro episode vs 90-min movie vs 4-hour AFK movie
    const microWeight = computeBalancedWatchWeight(120);
    const movieWeight = computeBalancedWatchWeight(5400);
    const afkMovieWeight = computeBalancedWatchWeight(14400);
    expect(microWeight).toBeCloseTo(Math.sqrt(2), 2);
    expect(movieWeight).toBeCloseTo(Math.sqrt(90), 2);
    expect(afkMovieWeight).toBe(movieWeight); // AFK beyond 90m adds zero extra weight

    // Same viewer looping movie 10 times in one day counts only once
    const { userCentricGrossByVideo } = computeUserCentricVideoGross(
      [{ viewerKey: 'u1', amountKes: 10 }],
      [
        { viewerKey: 'u1', videoId: 'micro-1', watchSeconds: 120, dayKey: '2026-11-17' },
        ...Array.from({ length: 10 }, () => ({
          viewerKey: 'u1',
          videoId: 'movie-1',
          watchSeconds: 5400,
          dayKey: '2026-11-17',
        })),
      ],
      new Set(['micro-1', 'movie-1']),
    );
    // Movie gets sqrt(90)/(sqrt(90)+sqrt(2)) ≈ 87% of KES 10, Micro gets ~13% (not 97.8% vs 2.2% and not 10x looped)
    expect(userCentricGrossByVideo['movie-1']).toBeCloseTo(10 * (movieWeight / (movieWeight + microWeight)), 2);
    expect(userCentricGrossByVideo['micro-1']).toBeCloseTo(10 * (microWeight / (movieWeight + microWeight)), 2);
  });

  it('extracts latest unpaid carried-forward balance without double counting across months', () => {
    const history = [
      // Creator A had 400 in Sep, 350 in Oct -> Oct total_accrued_kes is 750
      { creator_name: 'Studio A', period_label: '2026-09', net_payout_kes: 400, total_accrued_kes: 400, status: 'carried_forward', updated_at: '2026-09-30T23:59:00Z' },
      { creator_name: 'Studio A', period_label: '2026-10', net_payout_kes: 350, carried_forward_kes: 400, total_accrued_kes: 750, status: 'carried_forward', updated_at: '2026-10-31T23:59:00Z' },
      // Active period row should be ignored
      { creator_name: 'Studio A', period_label: 'Last 30 Days', net_payout_kes: 300, total_accrued_kes: 1050, status: 'eligible', updated_at: '2026-11-18T12:00:00Z' },
      // Studio B was already paid in Oct -> 0 rollover
      { creator_name: 'Studio B', period_label: '2026-09', net_payout_kes: 500, total_accrued_kes: 500, status: 'carried_forward', updated_at: '2026-09-30T23:59:00Z' },
      { creator_name: 'Studio B', period_label: '2026-10', net_payout_kes: 700, carried_forward_kes: 500, total_accrued_kes: 1200, status: 'paid', updated_at: '2026-10-31T23:59:00Z' },
    ];

    const carried = extractCarriedForwardByCreator(history, 'Last 30 Days');
    expect(carried['Studio A']).toBe(750);
    expect(carried['Studio B']).toBeUndefined();
  });

  it('combines carried-forward balance with current earnings to cross the KSh 1,000 eligibility threshold', () => {
    const videos: Video[] = [
      { id: 'v1', title: 'Ep 3', thumbnail: '', views: 100, duration: '02:00', isPremium: true, author: 'Studio A', category: 'Series' },
      { id: 'v2', title: 'Ep 4', thumbnail: '', views: 100, duration: '02:00', isPremium: true, author: 'Studio B', category: 'Series' },
    ];
    // Total creator pool = 1,000 * 60% = 600 -> 300 each this period
    const result = computeShareOfPlayRoyalties(
      videos,
      { periodLabel: 'Last 30 Days', grossSubscriptionRevenueKes: 1000, gatewayFeePercent: 0, creatorPoolPercent: 60 },
      { carriedForwardByCreator: { 'Studio A': 750 } },
    );

    const studioA = result.creators.find((c) => c.creator === 'Studio A')!;
    const studioB = result.creators.find((c) => c.creator === 'Studio B')!;

    expect(studioA.netEarningsKes).toBe(300);
    expect(studioA.carriedForwardKes).toBe(750);
    expect(studioA.totalAccruedKes).toBe(1050);
    expect(studioA.isEligibleForPayout).toBe(true);
    expect(studioA.payoutStatus).toBe('ELIGIBLE');
    expect(studioA.thresholdProgressPercent).toBe(100);

    expect(studioB.netEarningsKes).toBe(300);
    expect(studioB.carriedForwardKes).toBe(0);
    expect(studioB.totalAccruedKes).toBe(300);
    expect(studioB.isEligibleForPayout).toBe(false);
    expect(studioB.payoutStatus).toBe('CARRIED_FORWARD');

    expect(result.eligibleCreatorsCount).toBe(1);
    expect(result.totalEligiblePayoutKes).toBe(1050);
  });
});
