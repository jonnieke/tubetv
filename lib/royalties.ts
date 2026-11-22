/**
 * TubeTV Creator Royalties & Performance Engine
 * Implements the 30-second Minimum Qualified View (QV) Share-of-Play Algorithm,
 * monthly KSh 1,000 payout threshold tracking, and CSV reporting.
 */

import { BunnyVideoItem, bunnyVideoToVideo } from '../services/bunnyService';
import { Video } from '../types';
import { isContentFree } from './monetization';

export const MINIMUM_PAYOUT_THRESHOLD_KES = 1000;
export const QUALIFIED_VIEW_SECONDS = 30;
export const SHORT_PAID_DURATION_CUTOFF_SECONDS = 30;
export const SHORT_PAID_QUALIFIED_RATIO = 0.8;
export const DEFAULT_CREATOR_POOL_PERCENT = 60; // 60/40 revenue split in favor of creative (60% to creative, 40% platform)
export const PAYMENT_GATEWAY_FEE_PERCENT = 1.5; // 1.5% Paystack Kenya fee
export const PLATFORM_FEE_PERCENT = 5; // 5% platform fee deducted from gross

/**
 * Returns the minimum playback position (in seconds) required to award a Qualified View.
 * For paid content shorter than 30 seconds, watching 80% counts as a Qualified View.
 */
export function getQualifiedViewThresholdSeconds(
  durationSeconds: number,
  isPaidContent: boolean,
): number {
  if (
    isPaidContent &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0 &&
    durationSeconds < SHORT_PAID_DURATION_CUTOFF_SECONDS
  ) {
    return durationSeconds * SHORT_PAID_QUALIFIED_RATIO;
  }
  return QUALIFIED_VIEW_SECONDS;
}

export interface RoyaltyPoolConfig {
  periodLabel: string;
  grossSubscriptionRevenueKes: number;
  gatewayFeePercent?: number;
  platformFeePercent?: number;
  creatorPoolPercent?: number;
  payoutThresholdKes?: number;
  premiumOnly?: boolean;
}

export interface CreatorPayoutProfile {
  creator_name: string;
  payout_rail: string;
  payout_account: string;
  tax_id_or_pin?: string;
  withholding_tax_percent?: number;
  contact_email?: string;
  portal_access_code: string;
}

/**
 * Generates a deterministic read-only Creator Portal Access Code (e.g. "TUBE-RM84")
 * from a creator's studio name so filmmakers can immediately preview their portal.
 */
export function generateDefaultPortalCode(creatorName: string): string {
  const clean = (creatorName || 'CREATOR').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = (clean.slice(0, 2) || 'CR').padEnd(2, 'X');
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % 900 + 100;
  }
  return `TUBE-${prefix}${hash}`;
}

export interface CreatorRoyaltySummary {
  rank: number;
  creator: string;
  titlesCount: number;
  topSeries: string;
  qualifiedViews: number;
  totalWatchHours: number;
  shareOfPlayPercent: number;
  grossRevenueShareKes: number;
  netEarningsKes: number;
  carriedForwardKes: number;
  totalAccruedKes: number;
  thresholdKes: number;
  thresholdProgressPercent: number;
  isEligibleForPayout: boolean;
  payoutStatus: 'ELIGIBLE' | 'CARRIED_FORWARD';
  mpesaDestination?: string;
  payoutRail?: string;
  withholdingTaxPercent?: number;
  portalAccessCode?: string;
}

export interface SettlementHistoryRow {
  creator_name: string;
  period_label: string;
  net_payout_kes: number;
  carried_forward_kes?: number | null;
  total_accrued_kes?: number | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Extracts each creator's latest unpaid carried-forward balance from prior
 * settlement snapshots, excluding the active period to prevent double counting.
 */
export function extractCarriedForwardByCreator(
  rows: SettlementHistoryRow[],
  currentPeriodLabel: string,
): Record<string, number> {
  const byCreator = new Map<string, SettlementHistoryRow[]>();
  for (const row of rows) {
    const name = (row.creator_name || '').trim();
    if (!name || row.period_label === currentPeriodLabel) continue;
    const list = byCreator.get(name) || [];
    list.push(row);
    byCreator.set(name, list);
  }

  const result: Record<string, number> = {};
  for (const [creator, list] of byCreator.entries()) {
    list.sort((a, b) => {
      const timeA = a.updated_at || a.created_at || a.period_label || '';
      const timeB = b.updated_at || b.created_at || b.period_label || '';
      return timeB.localeCompare(timeA);
    });
    const latest = list[0];
    if (latest && latest.status === 'carried_forward') {
      const accrued = Number(latest.total_accrued_kes);
      const net = Number(latest.net_payout_kes);
      const balance = Number.isFinite(accrued) && accrued > 0 ? accrued : Number.isFinite(net) && net > 0 ? net : 0;
      if (balance > 0) {
        result[creator] = Math.round(balance * 100) / 100;
      }
    }
  }
  return result;
}

export interface ContentPerformanceRow {
  rank: number;
  videoId: string;
  title: string;
  seriesTitle: string;
  episode: number | string;
  creator: string;
  category: string;
  accessTier: 'Free' | 'Premium';
  qualifiedViews: number;
  lifetimeViews: number;
  totalWatchHours: number;
  avgWatchSeconds: number;
  completionRatePercent: number;
  attributedRevenueKes: number;
  shareOfPoolPercent: number;
}

export interface RoyaltyComputationResult {
  periodLabel: string;
  grossRevenueKes: number;
  gatewayFeesKes: number;
  platformFeesKes: number;
  netSubscriptionPoolKes: number;
  netCreatorPoolKes: number;
  platformShareKes: number;
  totalQualifiedViews: number;
  totalWatchHours: number;
  creators: CreatorRoyaltySummary[];
  content: ContentPerformanceRow[];
  eligibleCreatorsCount: number;
  carriedForwardCreatorsCount: number;
  totalEligiblePayoutKes: number;
}

/**
 * Parses duration string (e.g. "02:45" or "1:05:20" or seconds) into seconds.
 */
export function parseDurationToSeconds(duration: string | number | undefined): number {
  if (typeof duration === 'number' && Number.isFinite(duration)) return Math.max(0, duration);
  if (!duration || typeof duration !== 'string') return 120; // Default estimate 2 mins
  const parts = duration.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 120;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 120;
}

export interface UserCentricPassInput {
  viewerKey: string;
  amountKes: number;
}

export interface UserCentricPlayInput {
  viewerKey: string;
  videoId: string;
  watchSeconds?: number;
  maxDurationSeconds?: number;
  dayKey?: string;
}

export const MAX_CREDITED_WATCH_SECONDS = 5400; // 90-minute cap per play to block AFK movie streaming

/**
 * Computes a balanced sub-linear (square-root) watch weight so long-form movies
 * earn fairly more than short episodes without allowing AFK/idle streaming to dominate.
 */
export function computeBalancedWatchWeight(watchSeconds = 30, maxDurationSeconds?: number): number {
  const cap =
    maxDurationSeconds && maxDurationSeconds > 0
      ? Math.min(MAX_CREDITED_WATCH_SECONDS, maxDurationSeconds)
      : MAX_CREDITED_WATCH_SECONDS;
  const clamped = Math.max(QUALIFIED_VIEW_SECONDS, Math.min(cap, Number(watchSeconds) || QUALIFIED_VIEW_SECONDS));
  return Math.sqrt(clamped / 60);
}

/**
 * Allocates each subscriber's own gross payment strictly to the Premium videos
 * that specific subscriber watched (User-Centric Payment System), using balanced
 * square-root duration weighting and 1-play-per-viewer-per-video-per-day anti-farming.
 */
export function computeUserCentricVideoGross(
  passes: UserCentricPassInput[],
  plays: UserCentricPlayInput[],
  eligibleVideoIds: Set<string>,
): { userCentricGrossByVideo: Record<string, number>; unattributedGrossKes: number } {
  const spendByViewer = new Map<string, number>();
  for (const p of passes) {
    const key = (p.viewerKey || '').trim();
    const amt = Number(p.amountKes) || 0;
    if (!key || amt <= 0) continue;
    spendByViewer.set(key, (spendByViewer.get(key) || 0) + amt);
  }

  // Deduplicate replays per (viewerKey, videoId, dayKey) keeping the longest capped play
  const dedupedDayBest = new Map<string, { viewerKey: string; videoId: string; weight: number }>();
  const unkeyedPlays: { viewerKey: string; videoId: string; weight: number }[] = [];

  for (const ev of plays) {
    const key = (ev.viewerKey || '').trim();
    const vid = (ev.videoId || '').trim();
    if (!key || !vid || !eligibleVideoIds.has(vid)) continue;
    const weight = computeBalancedWatchWeight(ev.watchSeconds, ev.maxDurationSeconds);
    if (ev.dayKey) {
      const dedupeKey = `${key}::${vid}::${ev.dayKey}`;
      const existing = dedupedDayBest.get(dedupeKey);
      if (!existing || weight > existing.weight) {
        dedupedDayBest.set(dedupeKey, { viewerKey: key, videoId: vid, weight });
      }
    } else {
      unkeyedPlays.push({ viewerKey: key, videoId: vid, weight });
    }
  }

  const playsByViewer = new Map<string, Map<string, number>>();
  for (const item of [...dedupedDayBest.values(), ...unkeyedPlays]) {
    let vidMap = playsByViewer.get(item.viewerKey);
    if (!vidMap) {
      vidMap = new Map<string, number>();
      playsByViewer.set(item.viewerKey, vidMap);
    }
    vidMap.set(item.videoId, (vidMap.get(item.videoId) || 0) + item.weight);
  }

  const userCentricGrossByVideo: Record<string, number> = {};
  let unattributedGrossKes = 0;

  for (const [viewerKey, totalSpend] of spendByViewer.entries()) {
    const vidMap = playsByViewer.get(viewerKey);
    if (!vidMap || vidMap.size === 0) {
      unattributedGrossKes += totalSpend;
      continue;
    }
    let totalWeight = 0;
    for (const w of vidMap.values()) totalWeight += w;
    if (totalWeight <= 0) {
      unattributedGrossKes += totalSpend;
      continue;
    }
    for (const [vid, w] of vidMap.entries()) {
      userCentricGrossByVideo[vid] = (userCentricGrossByVideo[vid] || 0) + totalSpend * (w / totalWeight);
    }
  }

  return { userCentricGrossByVideo, unattributedGrossKes };
}

/**
 * Computes the full Share-of-Play distribution for a set of Bunny catalogue items or Videos.
 * Supports User-Centric Per-Pass Attribution when `userCentricGrossByVideo` is supplied,
 * falling back to global Share-of-Play for unattributed revenue.
 */
export function computeShareOfPlayRoyalties(
  items: (BunnyVideoItem | Video)[],
  config: RoyaltyPoolConfig,
  overrides?: {
    measuredQualifiedViews?: Record<string, number>;
    userCentricGrossByVideo?: Record<string, number>;
    unattributedGrossKes?: number;
    carriedForwardByCreator?: Record<string, number>;
  }
): RoyaltyComputationResult {
  const grossRev = Math.max(0, config.grossSubscriptionRevenueKes || 0);
  const feePercent = config.gatewayFeePercent ?? PAYMENT_GATEWAY_FEE_PERCENT;
  const platformFeePercent = config.platformFeePercent ?? PLATFORM_FEE_PERCENT;
  const poolPercent = config.creatorPoolPercent ?? DEFAULT_CREATOR_POOL_PERCENT;
  const thresholdKes = config.payoutThresholdKes ?? MINIMUM_PAYOUT_THRESHOLD_KES;

  // Deduct payment gateway fee (1.5%) and platform fee (5%) from gross
  const gatewayFees = grossRev * (feePercent / 100);
  const platformFees = grossRev * (platformFeePercent / 100);
  const netPool = Math.max(0, grossRev - gatewayFees - platformFees);

  // Creator share (60% in favor of creative) vs Platform share (40%)
  const netCreatorPool = netPool * (poolPercent / 100);
  const platformShare = netPool - netCreatorPool;

  const premiumOnly = config.premiumOnly ?? true;

  // Normalize all items to Video objects
  const allVideos: { video: Video; rawViews: number; rawGuid: string }[] = items.map((item) => {
    if ('guid' in item) {
      const v = bunnyVideoToVideo(item as BunnyVideoItem);
      return { video: v, rawViews: Number(item.views) || 0, rawGuid: item.guid };
    }
    const v = item as Video;
    return { video: v, rawViews: v.views || 0, rawGuid: v.id };
  });

  // Subscription revenue must only go to Premium (paid) content; exclude free Shorts and free teaser episodes.
  const videos = premiumOnly
    ? allVideos.filter(({ video }) => video.category !== 'Shorts' && !video.isShort && !isContentFree(video))
    : allVideos;

  // Calculate qualified views per video
  // Best practice: 30-second minimum view qualification rate in vertical micro-dramas is ~65-80% of starts
  let totalQualifiedViews = 0;
  let totalPlatformWatchSeconds = 0;

  const hasMeasuredMap = Boolean(overrides?.measuredQualifiedViews);
  const contentIntermediates = videos.map(({ video, rawViews, rawGuid }) => {
    const measuredQV = overrides?.measuredQualifiedViews?.[rawGuid];
    // When live measured qualified views are supplied for a period, unwatched titles MUST be 0
    // (never fall back to lifetime Bunny views and dilute the pool across unwatched catalogue titles).
    const qv = hasMeasuredMap
      ? Math.max(0, typeof measuredQV === 'number' ? measuredQV : 0)
      : Math.max(0, Math.round(rawViews * 0.72));
    const durationSec = parseDurationToSeconds(video.duration);
    const avgWatchSec = Math.min(durationSec, Math.max(QUALIFIED_VIEW_SECONDS, Math.round(durationSec * 0.68)));
    const totalContentWatchSec = qv * avgWatchSec;

    totalQualifiedViews += qv;
    totalPlatformWatchSeconds += totalContentWatchSec;

    return {
      video,
      rawGuid,
      rawViews,
      durationSec,
      avgWatchSec,
      qv,
      totalContentWatchSec,
    };
  });

  // Safe fallback if zero views
  const safeTotalQv = Math.max(1, totalQualifiedViews);
  const useUserCentric = Boolean(overrides?.userCentricGrossByVideo);
  const netFactor = Math.max(0, 1 - (feePercent + platformFeePercent) / 100) * (poolPercent / 100);
  const unattributedGross = Math.max(0, overrides?.unattributedGrossKes ?? 0);

  // Compute per-video creator net earnings (KES)
  const itemEarningsByGuid = new Map<string, number>();
  for (const item of contentIntermediates) {
    if (useUserCentric) {
      const directGross = overrides?.userCentricGrossByVideo?.[item.rawGuid] || 0;
      const unattributedShareGross = totalQualifiedViews > 0 ? unattributedGross * (item.qv / safeTotalQv) : 0;
      itemEarningsByGuid.set(item.rawGuid, (directGross + unattributedShareGross) * netFactor);
    } else {
      const share = totalQualifiedViews > 0 ? item.qv / safeTotalQv : 0;
      itemEarningsByGuid.set(item.rawGuid, netCreatorPool * share);
    }
  }

  // Group by creator / author
  const creatorMap = new Map<
    string,
    {
      creator: string;
      titlesCount: number;
      seriesCounts: Record<string, number>;
      qualifiedViews: number;
      watchSeconds: number;
      netEarningsKes: number;
    }
  >();

  contentIntermediates.forEach((item) => {
    const creatorName = (item.video.author || 'Independent Creator').trim() || 'Independent Creator';
    const entry = creatorMap.get(creatorName) || {
      creator: creatorName,
      titlesCount: 0,
      seriesCounts: {},
      qualifiedViews: 0,
      watchSeconds: 0,
      netEarningsKes: 0,
    };

    entry.titlesCount += 1;
    entry.qualifiedViews += item.qv;
    entry.watchSeconds += item.totalContentWatchSec;
    entry.netEarningsKes += itemEarningsByGuid.get(item.rawGuid) || 0;

    const series = item.video.seriesTitle || 'Standalone';
    entry.seriesCounts[series] = (entry.seriesCounts[series] || 0) + 1;

    creatorMap.set(creatorName, entry);
  });

  // Build Creatives Summary list
  const creatorList: CreatorRoyaltySummary[] = Array.from(creatorMap.values()).map((c) => {
    const shareOfPlay = useUserCentric
      ? (netCreatorPool > 0 ? (c.netEarningsKes / netCreatorPool) * 100 : 0)
      : (totalQualifiedViews > 0 ? (c.qualifiedViews / safeTotalQv) * 100 : 0);
    const grossShare = c.netEarningsKes;
    const netEarnings = Math.round(grossShare * 100) / 100;
    const carriedForward = Math.max(
      0,
      Math.round((overrides?.carriedForwardByCreator?.[c.creator] || 0) * 100) / 100,
    );
    const totalAccrued = Math.round((netEarnings + carriedForward) * 100) / 100;
    const progressPercent = Math.min(100, Math.round((totalAccrued / thresholdKes) * 100));
    const isEligible = totalAccrued >= thresholdKes;

    // Determine top series
    const topSeries =
      Object.entries(c.seriesCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Original Works';

    return {
      rank: 0,
      creator: c.creator,
      titlesCount: c.titlesCount,
      topSeries,
      qualifiedViews: c.qualifiedViews,
      totalWatchHours: Math.round((c.watchSeconds / 3600) * 10) / 10,
      shareOfPlayPercent: Math.round(shareOfPlay * 1000) / 1000,
      grossRevenueShareKes: Math.round(grossShare),
      netEarningsKes: netEarnings,
      carriedForwardKes: carriedForward,
      totalAccruedKes: totalAccrued,
      thresholdKes,
      thresholdProgressPercent: progressPercent,
      isEligibleForPayout: isEligible,
      payoutStatus: isEligible ? 'ELIGIBLE' : 'CARRIED_FORWARD',
    };
  });

  // Sort creators by total accrued descending (then current period net earnings) and assign rank
  creatorList.sort((a, b) => (b.totalAccruedKes - a.totalAccruedKes) || (b.netEarningsKes - a.netEarningsKes));
  creatorList.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  // Build Content Performance Rows
  const contentList: ContentPerformanceRow[] = contentIntermediates.map((item) => {
    const attributedRev = itemEarningsByGuid.get(item.rawGuid) || 0;
    const shareOfPlay = useUserCentric
      ? (netCreatorPool > 0 ? (attributedRev / netCreatorPool) * 100 : 0)
      : (totalQualifiedViews > 0 ? (item.qv / safeTotalQv) * 100 : 0);
    const completionRate =
      item.durationSec > 0 ? Math.min(100, Math.round((item.avgWatchSec / item.durationSec) * 100)) : 70;

    return {
      rank: 0,
      videoId: item.rawGuid,
      title: item.video.title,
      seriesTitle: item.video.seriesTitle || 'Standalone',
      episode: item.video.episode || 1,
      creator: item.video.author || 'Independent Creator',
      category: item.video.category || 'General',
      accessTier: item.video.accessTier === 'premium' || item.video.isPremium ? 'Premium' : 'Free',
      qualifiedViews: item.qv,
      lifetimeViews: item.rawViews,
      totalWatchHours: Math.round((item.totalContentWatchSec / 3600) * 10) / 10,
      avgWatchSeconds: item.avgWatchSec,
      completionRatePercent: completionRate,
      attributedRevenueKes: Math.round(attributedRev * 100) / 100,
      shareOfPoolPercent: Math.round(shareOfPlay * 1000) / 1000,
    };
  });

  // Sort content by attributed revenue descending and assign rank
  contentList.sort((a, b) => b.attributedRevenueKes - a.attributedRevenueKes);
  contentList.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  const eligibleCount = creatorList.filter((c) => c.isEligibleForPayout).length;
  const carriedForwardCount = creatorList.length - eligibleCount;
  const totalEligiblePayout = creatorList
    .filter((c) => c.isEligibleForPayout)
    .reduce((sum, c) => sum + c.totalAccruedKes, 0);

  return {
    periodLabel: config.periodLabel,
    grossRevenueKes: Math.round(grossRev),
    gatewayFeesKes: Math.round(gatewayFees * 100) / 100,
    platformFeesKes: Math.round(platformFees * 100) / 100,
    netSubscriptionPoolKes: Math.round(netPool * 100) / 100,
    netCreatorPoolKes: Math.round(netCreatorPool * 100) / 100,
    platformShareKes: Math.round(platformShare * 100) / 100,
    totalQualifiedViews,
    totalWatchHours: Math.round((totalPlatformWatchSeconds / 3600) * 10) / 10,
    creators: creatorList,
    content: contentList,
    eligibleCreatorsCount: eligibleCount,
    carriedForwardCreatorsCount: carriedForwardCount,
    totalEligiblePayoutKes: Math.round(totalEligiblePayout * 100) / 100,
  };
}

/**
 * Escapes a CSV cell value per RFC 4180.
 */
function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates and triggers client-side download of the Creatives Royalty Payout Report CSV.
 */
export function exportCreativesCsv(
  creators: CreatorRoyaltySummary[],
  poolMeta: {
    periodLabel: string;
    grossRevenueKes: number;
    netCreatorPoolKes: number;
    totalQualifiedViews: number;
  }
): void {
  const headers = [
    'Rank',
    'Creator / Studio',
    'Titles in Catalogue',
    'Primary Series',
    'Qualified Views (30s+)',
    'Watch Time (Hours)',
    'Share of Play (%)',
    'Net Earnings (KES)',
    'Monthly Threshold (KES)',
    'Payout Status',
    'Threshold Progress (%)',
    'Settlement Period',
  ];

  const rows = creators.map((c) => [
    c.rank,
    c.creator,
    c.titlesCount,
    c.topSeries,
    c.qualifiedViews,
    c.totalWatchHours,
    `${c.shareOfPlayPercent.toFixed(3)}%`,
    c.netEarningsKes.toFixed(2),
    c.thresholdKes,
    c.isEligibleForPayout ? 'ELIGIBLE (≥ KSh 1,000)' : 'CARRIED FORWARD (< KSh 1,000)',
    `${c.thresholdProgressPercent}%`,
    poolMeta.periodLabel,
  ]);

  // Include summary metadata header comments
  const metaHeader = [
    `# TubeTV Creatives Royalty & Performance Report`,
    `# Period: ${poolMeta.periodLabel}`,
    `# Generated At: ${new Date().toISOString()}`,
    `# Total Gross Subscription Pool: KES ${poolMeta.grossRevenueKes.toLocaleString()}`,
    `# Net Creator Royalty Pool (60%): KES ${poolMeta.netCreatorPoolKes.toLocaleString()}`,
    `# Platform Operations & CDN Share (40%): KES ${(poolMeta.grossRevenueKes - poolMeta.netCreatorPoolKes).toLocaleString()}`,
    `# Total 30s+ Qualified Views: ${poolMeta.totalQualifiedViews.toLocaleString()}`,
    `# Minimum Payout Threshold: KES ${MINIMUM_PAYOUT_THRESHOLD_KES} (M-Pesa B2C settlement)`,
    '',
  ].join('\r\n');

  const csvContent =
    metaHeader +
    headers.map(escapeCsv).join(',') +
    '\r\n' +
    rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');

  downloadBlob(
    csvContent,
    `TubeTV_Creatives_Payout_Report_${cleanFilename(poolMeta.periodLabel)}.csv`
  );
}

/**
 * Generates and triggers client-side download of the Content Performance Breakdown CSV.
 */
export function exportContentCsv(
  content: ContentPerformanceRow[],
  poolMeta: {
    periodLabel: string;
    totalQualifiedViews: number;
    netCreatorPoolKes: number;
  }
): void {
  const headers = [
    'Rank',
    'Content ID',
    'Title',
    'Series',
    'Episode',
    'Creator / Studio',
    'Category',
    'Access Tier',
    '30s+ Qualified Views',
    'Lifetime Bunny Views',
    'Total Watch Hours',
    'Avg Watch Time (Sec)',
    'Completion Rate (%)',
    'Share of Play (%)',
    'Attributed Revenue (KES)',
    'Reporting Period',
  ];

  const rows = content.map((c) => [
    c.rank,
    c.videoId,
    c.title,
    c.seriesTitle,
    c.episode,
    c.creator,
    c.category,
    c.accessTier,
    c.qualifiedViews,
    c.lifetimeViews,
    c.totalWatchHours,
    c.avgWatchSeconds,
    `${c.completionRatePercent}%`,
    `${c.shareOfPoolPercent.toFixed(3)}%`,
    c.attributedRevenueKes.toFixed(2),
    poolMeta.periodLabel,
  ]);

  const metaHeader = [
    `# TubeTV Content Performance & Revenue Breakdown`,
    `# Period: ${poolMeta.periodLabel}`,
    `# Generated At: ${new Date().toISOString()}`,
    `# Net Creator Royalty Pool: KES ${poolMeta.netCreatorPoolKes.toLocaleString()}`,
    `# Total Platform Qualified Views: ${poolMeta.totalQualifiedViews.toLocaleString()}`,
    `# Qualification Criterion: Continuous Playback >= 30 seconds`,
    '',
  ].join('\r\n');

  const csvContent =
    metaHeader +
    headers.map(escapeCsv).join(',') +
    '\r\n' +
    rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');

  downloadBlob(
    csvContent,
    `TubeTV_Content_Performance_Report_${cleanFilename(poolMeta.periodLabel)}.csv`
  );
}

/**
 * Exports a ready-to-upload Bulk Payout Batch CSV containing only ELIGIBLE creatives (>= KSh 1,000)
 * formatted for M-Pesa B2C, Paystack Bulk Transfers, East Africa Mobile Money, or Wise Batch Wire.
 */
export function exportPayoutBatchCsv(
  creators: CreatorRoyaltySummary[],
  options: {
    periodLabel: string;
    payoutRail: string;
    profiles?: Record<string, CreatorPayoutProfile>;
  }
): void {
  const eligible = creators.filter((c) => c.isEligibleForPayout);
  const headers = [
    'Beneficiary Name',
    'Payout Rail',
    'Destination / Mobile / Account',
    'Tax ID / KRA PIN',
    'Gross Creative Royalty (KES)',
    'Withholding Tax (%)',
    'Net Disbursement (KES)',
    'USD Equivalent ($)',
    'Qualified Views (30s+)',
    'Share of Play (%)',
    'Reference',
    'Narration',
  ];

  const rows = eligible.map((c, idx) => {
    const profile = options.profiles?.[c.creator];
    const rail = profile?.payout_rail || c.payoutRail || options.payoutRail;
    const account = profile?.payout_account || c.mpesaDestination || '2547XXXXXXXX';
    const taxId = profile?.tax_id_or_pin || 'N/A';
    const whtPercent = Number(profile?.withholding_tax_percent ?? c.withholdingTaxPercent ?? 0);
    const grossCreativeKes = Math.round(c.netEarningsKes);
    const whtKes = Math.round(grossCreativeKes * (whtPercent / 100));
    const netDisburseKes = Math.max(0, grossCreativeKes - whtKes);

    return [
      c.creator,
      rail,
      account,
      taxId,
      grossCreativeKes,
      `${whtPercent}%`,
      netDisburseKes,
      (netDisburseKes / 129).toFixed(2),
      c.qualifiedViews,
      `${c.shareOfPlayPercent.toFixed(2)}%`,
      `TUBE_PAY_${cleanFilename(options.periodLabel)}_${String(idx + 1).padStart(3, '0')}`,
      `TubeTV 60/40 Creative Royalty (${options.periodLabel})`,
    ];
  });

  const csvContent =
    headers.map(escapeCsv).join(',') +
    '\r\n' +
    rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');

  downloadBlob(
    csvContent,
    `TubeTV_Bulk_Payout_Batch_${cleanFilename(options.payoutRail)}_${cleanFilename(options.periodLabel)}.csv`
  );
}

/**
 * Exports a single filmmaker's Self-Service Royalty Statement CSV (episodes + summary).
 */
export function exportCreatorSelfStatementCsv(
  creatorSummary: CreatorRoyaltySummary,
  episodes: ContentPerformanceRow[],
  periodLabel: string
): void {
  const headers = [
    'Title',
    'Series',
    'Episode',
    'Access Tier',
    '30s+ Qualified Views',
    'Total Watch Hours',
    'Completion Rate (%)',
    'Share of Platform Pool (%)',
    'Your 60% Net Royalty (KES)',
    'Period',
  ];

  const rows = episodes.map((ep) => [
    ep.title,
    ep.seriesTitle,
    ep.episode,
    ep.accessTier,
    ep.qualifiedViews,
    ep.totalWatchHours,
    `${ep.completionRatePercent}%`,
    `${ep.shareOfPoolPercent.toFixed(3)}%`,
    ep.attributedRevenueKes.toFixed(2),
    periodLabel,
  ]);

  const metaHeader = [
    `# TubeTV Official Creator Royalty Statement`,
    `# Creative / Studio: ${creatorSummary.creator}`,
    `# Period: ${periodLabel}`,
    `# Total 30s+ Qualified Views: ${creatorSummary.qualifiedViews.toLocaleString()}`,
    `# Share of Play: ${creatorSummary.shareOfPlayPercent.toFixed(3)}%`,
    `# Net 60% Royalty Earnings: KES ${creatorSummary.netEarningsKes.toFixed(2)}`,
    `# Monthly Payout Status: ${creatorSummary.isEligibleForPayout ? 'ELIGIBLE (>= KES 1,000)' : 'CARRIED FORWARD (< KES 1,000)'}`,
    '',
  ].join('\r\n');

  const csvContent =
    metaHeader +
    headers.map(escapeCsv).join(',') +
    '\r\n' +
    rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');

  downloadBlob(
    csvContent,
    `TubeTV_Statement_${cleanFilename(creatorSummary.creator)}_${cleanFilename(periodLabel)}.csv`
  );
}

function cleanFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Creates a browser blob download with UTF-8 BOM so Excel opens it with proper encoding.
 */
function downloadBlob(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
