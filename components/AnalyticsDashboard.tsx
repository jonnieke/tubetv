import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  LayoutGrid,
  Tag,
  Star,
  Music,
  Gamepad2,
  Coffee,
  Briefcase,
  Anchor,
  Zap,
  Cpu,
  Film,
  BookOpen,
  Utensils,
  Coins,
  Download,
  TrendingUp,
  Eye,
  Users,
  Globe,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import { NavItem } from '../types';
import { BunnyVideoItem, bunnyVideoToVideo, fetchBunnyVideos } from '../services/bunnyService';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import RoyaltiesDashboard from './RoyaltiesDashboard';
import {
  computeShareOfPlayRoyalties,
  exportPayoutBatchCsv,
  MINIMUM_PAYOUT_THRESHOLD_KES,
} from '../lib/royalties';

interface AnalyticsSummaryPayload {
  since: string;
  until?: string;
  counts: Record<string, number>;
  qualifiedViewsByVideo?: Record<string, number>;
  todayQualifiedViewsByVideo?: Record<string, number>;
  grossRevenueKes30d?: number;
  todayRevenueKes?: number;
  rangeRevenueKes?: number;
  rangeQualifiedViewsByVideo?: Record<string, number>;
  rangeUserCentricGrossByVideo?: Record<string, number>;
  rangeUnattributedGrossKes?: number;
  rangeTransactions?: Array<{
    createdAt: string;
    amountKes: number;
    planCode: string;
    channel: string;
    regionCode: string;
    payerLabel: string;
    payerKey: string;
  }>;
  revenueByRegion?: Record<string, number>;
  revenueByChannel?: Record<string, number>;
  revenueByPlan?: Record<string, number>;
  dailySeries?: Array<{ date: string; revenueKes: number; qualifiedViews: number }>;
  rangeSummary?: {
    from: string;
    to: string;
    totalInteractions: number;
    uniqueViewers: number;
    totalWatchSeconds: number;
    avgWatchSeconds: number;
    byLocation: Record<string, { interactions: number; watchSeconds: number }>;
    byTrafficSource?: Record<
      string,
      { interactions: number; paidConversions: number; adUnlocks: number; shareUnlocks: number }
    >;
  };
  rangeInteractions?: Array<{
    occurredAt: string;
    date: string;
    videoId: string;
    viewerId: string;
    payerLabel?: string;
    paidKes?: number;
    location: string;
    device: string;
    event: string;
    watchSeconds: number;
  }>;
}

const formatWatchDuration = (sec: number) => {
  if (!sec || sec <= 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatKes = (amount: number) =>
  `KSh ${Math.round(amount).toLocaleString('en-KE')}`;

// Helper for formatting large numbers
const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const AVAILABLE_ICONS = [
  { name: 'Star', icon: Star },
  { name: 'Music', icon: Music },
  { name: 'Game', icon: Gamepad2 },
  { name: 'Food', icon: Utensils },
  { name: 'Tech', icon: Cpu },
  { name: 'News', icon: BookOpen },
  { name: 'Lifestyle', icon: Coffee },
  { name: 'Business', icon: Briefcase },
  { name: 'Travel', icon: Anchor },
  { name: 'Trending', icon: Zap },
  { name: 'Movie', icon: Film },
];

interface AnalyticsDashboardProps {
  currentNavItems?: NavItem[];
  onAddCategory?: (name: string, iconName: string) => void;
  onRemoveCategory?: (id: string) => void;
  videos?: BunnyVideoItem[];
  /** When mounted inside AdminDashboard, Royalties & Payouts is its own sidebar tab, so the inner copy is hidden. */
  embedded?: boolean;
  onOpenRoyalties?: () => void;
}

export default function AnalyticsDashboard({
  currentNavItems = [],
  onAddCategory = () => { },
  onRemoveCategory = () => { },
  videos,
  embedded = false,
  onOpenRoyalties,
}: AnalyticsDashboardProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'menu' | 'royalties'>('overview');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Star');
  const [loadedVideos, setLoadedVideos] = useState<BunnyVideoItem[]>([]);
  const [funnel, setFunnel] = useState<AnalyticsSummaryPayload | null>(null);
  const [dateFrom, setDateFrom] = useState<string>(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [interactionSearch, setInteractionSearch] = useState<string>('');
  const [selectedPayerFilter, setSelectedPayerFilter] = useState<string | null>(null);
  const [showAllInteractions, setShowAllInteractions] = useState<boolean>(false);
  const [hideZeroSecStarts, setHideZeroSecStarts] = useState<boolean>(true);

  useEffect(() => {
    if (videos !== undefined) return;
    let active = true;
    void fetchBunnyVideos(true)
      .then((items) => {
        if (active) setLoadedVideos(items);
      })
      .catch(() => {
        /* Keep empty state if admin library is unreachable */
      });
    return () => {
      active = false;
    };
  }, [videos]);

  useEffect(() => {
    let active = true;
    const loadMeasured = async () => {
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!url || !session) return;
      try {
        const qs = new URLSearchParams({ from: dateFrom, to: dateTo }).toString();
        const response = await fetch(`${url}/functions/v1/analytics-summary?${qs}`, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (response.ok && active) setFunnel(await response.json());
      } catch {
        /* Measured events remain unavailable; never synthesize them. */
      }
    };
    void loadMeasured();
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo]);

  const effectiveVideos = videos ?? loadedVideos;

  const { myVideos, totalViews, categoryData } = useMemo(() => {
    let views = 0;
    const qvMap = funnel?.qualifiedViewsByVideo || {};
    const rangeQvMap = funnel?.rangeQualifiedViewsByVideo || {};
    const categoryCounts = new Map<string, { titles: number; lifetimeViews: number; rangeViews: number }>();
    const rows = effectiveVideos
      .map((item) => {
        const video = bunnyVideoToVideo(item);
        const bunnyViews = Number(item.views) || 0;
        const measuredViews = qvMap[item.guid] ?? 0;
        const rangeViews = rangeQvMap[item.guid] ?? 0;
        const count = Math.max(bunnyViews, measuredViews);
        views += count;
        const category = video.category || 'Other';
        const previous = categoryCounts.get(category) || { titles: 0, lifetimeViews: 0, rangeViews: 0 };
        categoryCounts.set(category, {
          titles: previous.titles + 1,
          lifetimeViews: previous.lifetimeViews + count,
          rangeViews: previous.rangeViews + rangeViews,
        });
        return {
          id: item.guid,
          title: item.title,
          category,
          thumbnail: video.thumbnail,
          date: item.dateUploaded,
          views: count,
          duration: video.duration,
        };
      })
      .sort((a, b) => b.views - a.views);
    return {
      myVideos: rows,
      totalViews: views,
      categoryData: [...categoryCounts]
        .map(([category, totals]) => ({ category, ...totals }))
        .sort((a, b) => b.lifetimeViews - a.lifetimeViews || b.titles - a.titles),
    };
  }, [effectiveVideos, funnel?.qualifiedViewsByVideo, funnel?.rangeQualifiedViewsByVideo]);

  const grossRevenueKes30d = funnel?.grossRevenueKes30d ?? 0;
  const todayRevenueKes = funnel?.todayRevenueKes ?? 0;

  const royaltySnapshot = useMemo(() => {
    const periodLabel = new Date().toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
    const hasRange = typeof funnel?.rangeRevenueKes === 'number';
    return computeShareOfPlayRoyalties(
      effectiveVideos,
      {
        periodLabel,
        grossSubscriptionRevenueKes: hasRange ? funnel!.rangeRevenueKes! : grossRevenueKes30d,
        payoutThresholdKes: MINIMUM_PAYOUT_THRESHOLD_KES,
        premiumOnly: true,
      },
      {
        measuredQualifiedViews: hasRange ? funnel?.rangeQualifiedViewsByVideo : funnel?.qualifiedViewsByVideo,
        ...(hasRange && funnel?.rangeUserCentricGrossByVideo
          ? {
              userCentricGrossByVideo: funnel.rangeUserCentricGrossByVideo,
              unattributedGrossKes: funnel.rangeUnattributedGrossKes ?? 0,
            }
          : {}),
      },
    );
  }, [
    effectiveVideos,
    grossRevenueKes30d,
    funnel?.qualifiedViewsByVideo,
    funnel?.rangeRevenueKes,
    funnel?.rangeQualifiedViewsByVideo,
    funnel?.rangeUserCentricGrossByVideo,
    funnel?.rangeUnattributedGrossKes,
  ]);

  const todayRoyaltySnapshot = useMemo(() => {
    const todayMap = funnel?.todayQualifiedViewsByVideo || {};
    const interactedToday = effectiveVideos.filter((v) => (todayMap[v.guid] ?? 0) > 0);
    return computeShareOfPlayRoyalties(
      interactedToday,
      {
        periodLabel: 'Today',
        grossSubscriptionRevenueKes: todayRevenueKes,
        payoutThresholdKes: MINIMUM_PAYOUT_THRESHOLD_KES,
        premiumOnly: true,
      },
      {
        measuredQualifiedViews: todayMap,
      },
    );
  }, [effectiveVideos, todayRevenueKes, funnel?.todayQualifiedViewsByVideo]);

  const channelSplit = useMemo(() => {
    const mpesa = funnel?.revenueByChannel?.mpesa ?? 0;
    const card = funnel?.revenueByChannel?.card ?? 0;
    const total = mpesa + card;
    if (total <= 0) return { mpesaPct: 0, cardPct: 0, mpesa, card };
    const mpesaPct = Math.round((mpesa / total) * 100);
    return { mpesaPct, cardPct: Math.max(0, 100 - mpesaPct), mpesa, card };
  }, [funnel?.revenueByChannel]);

  const regionBreakdown = useMemo(() => {
    const entries = Object.entries(funnel?.revenueByRegion || {}).filter(([, val]) => val > 0);
    const total = entries.reduce((sum, [, val]) => sum + val, 0);
    const palette = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];
    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([code, amount], idx) => ({
        code,
        label: code === 'KE' ? 'Kenya' : code === 'US' || code === 'GB' ? `Diaspora (${code})` : code,
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
        color: palette[idx % palette.length],
      }));
  }, [funnel?.revenueByRegion]);

  const planBreakdown = useMemo(() => {
    const plans = funnel?.revenueByPlan || {};
    const rows = [
      { key: 'daily', label: '24h Daily Pass (KSh 10)', amount: plans.daily || 0, color: 'bg-emerald-500' },
      { key: 'weekly', label: 'Weekly Pass (KSh 50)', amount: plans.weekly || 0, color: 'bg-blue-500' },
      { key: 'monthly', label: 'Monthly Pass (KSh 149)', amount: plans.monthly || 0, color: 'bg-violet-500' },
    ];
    const maxAmt = Math.max(1, ...rows.map((r) => r.amount));
    const totalAmt = rows.reduce((sum, r) => sum + r.amount, 0);
    return rows.map((r) => ({
      ...r,
      widthPct: totalAmt > 0 ? Math.max(4, Math.round((r.amount / maxAmt) * 100)) : 0,
      sharePct: totalAmt > 0 ? Math.round((r.amount / totalAmt) * 100) : 0,
    }));
  }, [funnel?.revenueByPlan]);

  const chartSeries = useMemo(() => {
    const raw = funnel?.dailySeries || [];
    const slice = raw.slice(-14);
    const maxRev = Math.max(1, ...slice.map((d) => d.revenueKes));
    const maxQv = Math.max(1, ...slice.map((d) => d.qualifiedViews));
    return { slice, maxRev, maxQv };
  }, [funnel?.dailySeries]);

  const handleExportCsv = () => {
    exportPayoutBatchCsv(royaltySnapshot.creators, {
      payoutRail: 'M-Pesa B2C',
      periodLabel: royaltySnapshot.periodLabel,
    });
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim()) {
      onAddCategory(newCatName.trim(), newCatIcon);
      setNewCatName('');
      setNewCatIcon('Star');
    }
  };

  return (
    <div className="p-4 md:p-8 min-h-full pb-24">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{t('studio.welcome')}</h1>
          <p className="text-zinc-400">{t('studio.subtitle')}</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
            >
              {t('studio.overview')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'menu' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
            >
              {t('studio.menu')}
            </button>
            {!embedded && (
              <button
                type="button"
                onClick={() => setActiveTab('royalties')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'royalties' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Performance &amp; Royalties</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {activeTab === 'overview' && (
        <section aria-label="Measured catalogue totals" className="space-y-6">
          {/* Unified Global Date Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mr-1">Date Window</span>
              {[
                {
                  label: 'Today',
                  apply: () => {
                    const d = new Date().toISOString().slice(0, 10);
                    setDateFrom(d);
                    setDateTo(d);
                  },
                },
                {
                  label: 'Yesterday',
                  apply: () => {
                    const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                    setDateFrom(d);
                    setDateTo(d);
                  },
                },
                {
                  label: '7D',
                  apply: () => {
                    setDateFrom(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
                    setDateTo(new Date().toISOString().slice(0, 10));
                  },
                },
                {
                  label: '30D',
                  apply: () => {
                    setDateFrom(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
                    setDateTo(new Date().toISOString().slice(0, 10));
                  },
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setSelectedPayerFilter(null);
                    preset.apply();
                  }}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-200 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="From date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-white"
              />
              <span className="text-xs text-zinc-500">to</span>
              <input
                type="date"
                aria-label="To date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-white"
              />
            </div>
          </div>

          {/* Top 4 KPI Cards synced to selected Date Window */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                <span>
                  Money Collected{' '}
                  <span className="text-[10px] font-semibold text-emerald-400">
                    ({dateFrom === dateTo ? dateTo : `${dateFrom.slice(5)} → ${dateTo.slice(5)}`})
                  </span>
                </span>
                <Wallet className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <strong className="text-2xl md:text-3xl font-bold text-white">
                  {formatKes(typeof funnel?.rangeRevenueKes === 'number' ? funnel.rangeRevenueKes : grossRevenueKes30d)}
                </strong>
                <span className="text-[11px] text-zinc-500">in selected range</span>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                Rolling 30d total: <strong className="text-zinc-200">{formatKes(grossRevenueKes30d)}</strong> · M-Pesa {channelSplit.mpesaPct}% · Card {channelSplit.cardPct}%
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                <span>Creator Payout Pool (60%)</span>
                <Coins className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2">
                <strong className="text-2xl md:text-3xl font-bold text-white">
                  {formatKes(royaltySnapshot.netCreatorPoolKes)}
                </strong>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                After 1.5% gateway + 5% platform fee ({formatKes(royaltySnapshot.gatewayFeesKes + royaltySnapshot.platformFeesKes)})
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                <span>Verified Plays</span>
                <Eye className="h-4 w-4 text-blue-400" />
              </div>
              <div className="mt-2">
                <strong className="text-2xl md:text-3xl font-bold text-white">
                  {royaltySnapshot.totalQualifiedViews.toLocaleString('en-KE')}
                </strong>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                Watched ≥30s (or 80% of shorts) · {myVideos.length} titles
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                  <span>Ready to Pay (≥ KSh 1,000)</span>
                  <Users className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <strong className="text-2xl md:text-3xl font-bold text-white">
                    {royaltySnapshot.eligibleCreatorsCount} Creators
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={royaltySnapshot.creators.length === 0}
                className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 px-3 py-2 text-xs font-bold text-black transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Export M-Pesa Batch
              </button>
            </div>
          </div>

          {/* Middle 60/40 Analytics Row */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left 7 cols: Revenue vs Qualified Views + Conversion Funnel */}
            <div className="lg:col-span-7 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 flex flex-col justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      Daily Money Collected vs. Verified Plays
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Last 14 days of verified activity
                      {chartSeries.slice.length > 0 && (() => {
                        const peak = chartSeries.slice.reduce(
                          (best, d) => (d.revenueKes > best.revenueKes ? d : best),
                          chartSeries.slice[0],
                        );
                        return peak.revenueKes > 0
                          ? ` · Best day: ${peak.date} (${formatKes(peak.revenueKes)})`
                          : '';
                      })()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-300">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Money Collected
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-violet-400" />
                      Verified Plays
                    </span>
                  </div>
                </div>

                {chartSeries.slice.length > 0 ? (
                  <div
                    style={{ gridTemplateColumns: `repeat(${chartSeries.slice.length}, minmax(0, 1fr))` }}
                    className="grid gap-1.5 items-end h-40 pt-4 pb-1 border-b border-zinc-800/80"
                  >
                    {chartSeries.slice.map((day) => {
                      const revH = Math.max(4, Math.round((day.revenueKes / chartSeries.maxRev) * 100));
                      const qvH = Math.max(4, Math.round((day.qualifiedViews / chartSeries.maxQv) * 100));
                      return (
                        <div
                          key={day.date}
                          title={`${day.date}: ${formatKes(day.revenueKes)} · ${day.qualifiedViews} QV`}
                          className="flex flex-col items-center gap-1 h-full justify-end group"
                        >
                          <div className="w-full flex items-end justify-center gap-0.5 h-32">
                            <div
                              style={{ height: `${revH}%` }}
                              className="w-1/2 rounded-t bg-emerald-500/85 group-hover:bg-emerald-400 transition-all"
                            />
                            <div
                              style={{ height: `${qvH}%` }}
                              className="w-1/2 rounded-t bg-violet-500/75 group-hover:bg-violet-400 transition-all"
                            />
                          </div>
                          <span className="text-[9px] text-zinc-500 hidden sm:inline">
                            {day.date.slice(8)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-36 flex items-center justify-center rounded-xl border border-dashed border-zinc-800 text-xs text-zinc-500">
                    {funnel ? 'No transactions or qualified views recorded in this window yet.' : 'Connect admin session to load live 14-day trend.'}
                  </div>
                )}
              </div>

              {/* Compact Conversion Funnel Strip */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
                  7-Day Conversion Funnel
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: 'Paywall Views', value: funnel?.counts?.paywall_view ?? 0 },
                    { label: 'STK Initiated', value: funnel?.counts?.paywall_initiated ?? 0 },
                    { label: 'Paid Passes', value: funnel?.counts?.paywall_completed ?? 0 },
                    { label: 'Shares', value: funnel?.counts?.video_shared ?? 0 },
                  ].map((step, idx, arr) => (
                    <div
                      key={step.label}
                      className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-[10px] text-zinc-400">{step.label}</p>
                        <strong className="text-sm font-bold text-white">{formatNumber(step.value)}</strong>
                      </div>
                      {idx < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-zinc-600 hidden sm:block" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Microdrama Viral Funnel & Traffic Attribution */}
              <div className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-950/20 via-zinc-950/80 to-zinc-950 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                    Microdrama Viral Funnel &amp; Hybrid Unlocks
                  </p>
                  <span className="text-[10px] font-semibold text-zinc-500">Live 30-day counts</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: 'For You Views', value: funnel?.counts?.foryou_impression ?? 0 },
                    { label: 'Swipe-Up Eps', value: funnel?.counts?.microdrama_swipe_next ?? 0 },
                    { label: 'Ad Unlocks', value: funnel?.counts?.ad_unlock_completed ?? 0 },
                    { label: 'WA Unlocks', value: funnel?.counts?.share_unlock_completed ?? 0 },
                    { label: 'Comments', value: funnel?.counts?.episode_comment_posted ?? 0 },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg bg-zinc-900/90 border border-zinc-800/90 px-2.5 py-2"
                    >
                      <p className="text-[10px] text-zinc-400 truncate">{item.label}</p>
                      <strong className="text-sm font-bold text-white">{formatNumber(item.value)}</strong>
                    </div>
                  ))}
                </div>

                {funnel?.rangeSummary?.byTrafficSource &&
                  Object.keys(funnel.rangeSummary.byTrafficSource).length > 0 && (
                    <div className="pt-2 border-t border-zinc-800/80">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Acquisition Sources (TikTok · WhatsApp · Direct)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(funnel.rangeSummary.byTrafficSource)
                          .sort((a, b) => b[1].interactions - a[1].interactions)
                          .slice(0, 6)
                          .map(([src, stats]) => (
                            <span
                              key={src}
                              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-200"
                            >
                              <strong className="uppercase text-rose-300">{src}</strong>
                              <span className="text-zinc-400">{formatNumber(stats.interactions)} events</span>
                              {stats.paidConversions > 0 && (
                                <span className="text-emerald-400 font-bold">
                                  · {stats.paidConversions} paid
                                </span>
                              )}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Right 5 cols: Regional Split + Pass Tier Split */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <Globe className="h-4 w-4 text-blue-400" />
                  Top Revenue by Region
                </h2>
                {regionBreakdown.length > 0 ? (
                  <div className="space-y-2.5">
                    {regionBreakdown.map((reg) => (
                      <div key={reg.code} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-200 font-medium">{reg.label}</span>
                          <span className="text-zinc-400">
                            {formatKes(reg.amount)} ({reg.pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            style={{ width: `${Math.max(4, reg.pct)}%`, backgroundColor: reg.color }}
                            className="h-full rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No regional payment breakdown recorded yet.</p>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                <h2 className="text-base font-bold text-white mb-4">Pass Tier Split (30d)</h2>
                <div className="space-y-3">
                  {planBreakdown.map((plan) => (
                    <div key={plan.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300">{plan.label}</span>
                        <span className="text-zinc-400">
                          {formatKes(plan.amount)} ({plan.sharePct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          style={{ width: `${plan.widthPct}%` }}
                          className={`h-full rounded-full ${plan.color}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Date A -> Date B Audience Interactions & Watch Duration */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  Paid Passes &amp; Audience Interactions ({dateFrom} &rarr; {dateTo})
                </h2>
                <p className="text-xs text-zinc-400">
                  Click any Paid Pass pill below to isolate what that subscriber watched
                </p>
              </div>
              {selectedPayerFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedPayerFilter(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                >
                  <span>Filtering: {selectedPayerFilter}</span>
                  <span className="text-white">✕</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400">Interactions</div>
                <div className="text-lg font-black text-white mt-0.5">
                  {(funnel?.rangeSummary?.totalInteractions ?? 0).toLocaleString('en-KE')}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400">Unique Viewers</div>
                <div className="text-lg font-black text-sky-300 mt-0.5">
                  {(funnel?.rangeSummary?.uniqueViewers ?? 0).toLocaleString('en-KE')}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400">Total Watch Time</div>
                <div className="text-lg font-black text-emerald-300 mt-0.5">
                  {formatWatchDuration(funnel?.rangeSummary?.totalWatchSeconds ?? 0)}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400">Avg Duration</div>
                <div className="text-lg font-black text-amber-300 mt-0.5">
                  {formatWatchDuration(funnel?.rangeSummary?.avgWatchSeconds ?? 0)}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 p-3 col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300/80">Range Revenue</div>
                <div className="text-lg font-black text-emerald-300 mt-0.5">
                  {formatKes(funnel?.rangeRevenueKes ?? 0)}
                </div>
              </div>
            </div>

            {(funnel?.rangeTransactions?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-emerald-300">
                    Paid Passes in Range ({funnel!.rangeTransactions!.length})
                  </span>
                  <span className="text-zinc-400">
                    Total collected: <strong className="text-emerald-300">{formatKes(funnel?.rangeRevenueKes ?? 0)}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {funnel!.rangeTransactions!.slice(0, 12).map((tx, i) => {
                    const isSelected = selectedPayerFilter === tx.payerLabel;
                    return (
                      <button
                        key={`${tx.createdAt}-${i}`}
                        type="button"
                        onClick={() => setSelectedPayerFilter(isSelected ? null : tx.payerLabel)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-500/20 text-white'
                            : 'border-zinc-800 bg-zinc-950/80 hover:border-emerald-500/50'
                        }`}
                      >
                        <span className="font-bold text-emerald-300">{formatKes(tx.amountKes)}</span>
                        <span className="font-mono text-white">{tx.payerLabel}</span>
                        <span className="text-zinc-400 capitalize">{tx.planCode}</span>
                        <span className="text-zinc-500">· {tx.channel}</span>
                        <span className="text-zinc-500">
                          · {tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(() => {
              const videoMetaById = new Map(
                effectiveVideos.map((v) => {
                  const mapped = bunnyVideoToVideo(v);
                  const seriesLabel = mapped.seriesTitle
                    ? `${mapped.seriesTitle}${mapped.episode ? ` · Ep ${mapped.episode}` : ''}`
                    : '';
                  return [v.guid, { title: mapped.title || v.title, seriesLabel, accessTier: mapped.accessTier }];
                }),
              );
              const rows = (funnel?.rangeInteractions || []).filter((r) => {
                if (hideZeroSecStarts && r.watchSeconds === 0 && r.event === 'playback_start') return false;
                if (selectedPayerFilter && r.payerLabel !== selectedPayerFilter) return false;
                if (!interactionSearch.trim()) return true;
                const q = interactionSearch.toLowerCase();
                const meta = videoMetaById.get(r.videoId);
                const title = (meta?.title || r.videoId).toLowerCase();
                const series = (meta?.seriesLabel || '').toLowerCase();
                const payer = (r.payerLabel || '').toLowerCase();
                return (
                  title.includes(q) ||
                  series.includes(q) ||
                  payer.includes(q) ||
                  r.location.toLowerCase().includes(q) ||
                  r.viewerId.toLowerCase().includes(q) ||
                  r.device.toLowerCase().includes(q)
                );
              });

              const exportRangeCsv = () => {
                const header = ['OccurredAt', 'Series', 'Title', 'Payer', 'PaidKES', 'ViewerID', 'Device', 'Location', 'Event', 'WatchSeconds'];
                const csvRows = rows.map((r) => {
                  const meta = videoMetaById.get(r.videoId);
                  return [
                    r.occurredAt,
                    `"${(meta?.seriesLabel || '').replace(/"/g, '""')}"`,
                    `"${(meta?.title || r.videoId).replace(/"/g, '""')}"`,
                    `"${(r.payerLabel || 'Guest').replace(/"/g, '""')}"`,
                    String(r.paidKes || 0),
                    r.viewerId,
                    r.device,
                    `"${r.location.replace(/"/g, '""')}"`,
                    r.event,
                    String(r.watchSeconds),
                  ];
                });
                const blob = new Blob([[header.join(','), ...csvRows.map((c) => c.join(','))].join('\n')], {
                  type: 'text/csv;charset=utf-8;',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `tubetv-interactions-${dateFrom}-to-${dateTo}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              };

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="search"
                        value={interactionSearch}
                        onChange={(e) => setInteractionSearch(e.target.value)}
                        placeholder="Filter by title, location (e.g. KE), viewer ID or device..."
                        className="w-full sm:w-80 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-white placeholder-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => setHideZeroSecStarts((v) => !v)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          hideZeroSecStarts
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {hideZeroSecStarts ? 'Verified Plays Only (Hide 0s)' : 'Showing All Events'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={exportRangeCsv}
                      disabled={rows.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export Range CSV ({rows.length})
                    </button>
                  </div>

                  {rows.length > 0 ? (
                    <div className="space-y-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-zinc-900">
                            <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                              <th className="py-2 pr-4">Date &amp; Time</th>
                              <th className="py-2 pr-4">Content</th>
                              <th className="py-2 pr-4">Who (Viewer / Device)</th>
                              <th className="py-2 pr-4">From Where</th>
                              <th className="py-2 pr-4">Action</th>
                              <th className="py-2 text-right">Duration</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/70">
                            {(showAllInteractions ? rows : rows.slice(0, 25)).map((r, idx) => {
                              const meta = videoMetaById.get(r.videoId);
                              const hasPaid = (r.paidKes ?? 0) > 0;
                              return (
                                <tr key={`${r.occurredAt}-${r.videoId}-${idx}`} className="hover:bg-zinc-800/30">
                                  <td className="py-2.5 pr-4 text-zinc-400 whitespace-nowrap align-top">
                                    {r.occurredAt ? new Date(r.occurredAt).toLocaleString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : r.date}
                                  </td>
                                  <td className="py-2.5 pr-4 max-w-[230px] align-top">
                                    <div className="font-semibold text-white truncate">{meta?.title || r.videoId}</div>
                                    {meta?.seriesLabel && (
                                      <div className="text-[10px] text-zinc-400 truncate mt-0.5">{meta.seriesLabel}</div>
                                    )}
                                  </td>
                                  <td className="py-2.5 pr-4 align-top">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {hasPaid ? (
                                        <span
                                          title={`This viewer spent ${formatKes(r.paidKes!)} total in the selected date range (not per play)`}
                                          className="inline-flex items-center rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300"
                                        >
                                          Pass Holder ({formatKes(r.paidKes!)} total)
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-md bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                                          Guest
                                        </span>
                                      )}
                                      {r.payerLabel && r.payerLabel !== 'Guest' && (
                                        <span className="font-mono text-[11px] font-semibold text-white">{r.payerLabel}</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                                      {r.device} · {r.viewerId}
                                    </div>
                                  </td>
                                  <td className="py-2.5 pr-4 text-zinc-300 align-top whitespace-nowrap">{r.location}</td>
                                  <td className="py-2.5 pr-4 align-top">
                                    <span className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 whitespace-nowrap">
                                      {r.event.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="py-2.5 text-right font-mono font-bold text-emerald-300 align-top whitespace-nowrap">
                                    {formatWatchDuration(r.watchSeconds)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {rows.length > 25 && (
                        <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                          <span>
                            Showing {showAllInteractions ? rows.length : Math.min(25, rows.length)} of {rows.length} interactions
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowAllInteractions((v) => !v)}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            {showAllInteractions ? 'Show first 25' : `Show all (${rows.length})`}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-400">
                      No viewer interactions recorded between {dateFrom} and {dateTo}.
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Category Breakdown (Watch-Time & Catalogue Categories) */}
          {categoryData.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-bold text-white">Watch-Time &amp; Catalogue Categories</h2>
                  <p className="text-xs text-zinc-400">
                    How each category performs across {totalViews.toLocaleString('en-KE')} total plays
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {categoryData.map((cat) => {
                  const sharePct = totalViews > 0 ? Math.round((cat.lifetimeViews / totalViews) * 100) : 0;
                  return (
                    <div key={cat.category} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white truncate">{cat.category}</span>
                        <span className="text-[10px] text-zinc-500">{cat.titles} titles</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <strong className="text-base font-black text-emerald-300">
                          {cat.lifetimeViews.toLocaleString('en-KE')}
                        </strong>
                        <span className="text-[10px] text-zinc-400">
                          {cat.rangeViews > 0 ? `${cat.rangeViews.toLocaleString('en-KE')} in range` : `${sharePct}% share`}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/80"
                          style={{ width: `${Math.max(4, sharePct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Table: Top Earning Titles (User-Centric Breakdown) */}
          {(() => {
            const earningTitles = royaltySnapshot.content.filter(
              (row) => row.attributedRevenueKes > 0 || row.qualifiedViews > 0,
            );
            const unattributedGross = funnel?.rangeUnattributedGrossKes ?? 0;
            return (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Top Earning Titles ({dateFrom} → {dateTo})</h2>
                <p className="text-xs text-zinc-400">
                  User-Centric: rewarded directly to{' '}
                  <strong className="text-zinc-200">{earningTitles.length}</strong> watched premium{' '}
                  {earningTitles.length === 1 ? 'title' : 'titles'} from {formatKes(royaltySnapshot.netCreatorPoolKes)} creator pool
                  {unattributedGross > 0 ? ` · ${formatKes(unattributedGross)} gross from unqualified-only passes pooled across active titles` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => (embedded && onOpenRoyalties ? onOpenRoyalties() : setActiveTab('royalties'))}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
              >
                Full Creator Royalties &amp; M-Pesa Payouts
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 pr-4">Title</th>
                    <th className="py-2.5 pr-4">Category</th>
                    <th className="py-2.5 pr-4 text-right">Verified Plays</th>
                    <th className="py-2.5 pr-4 text-right">Watch Share</th>
                    <th className="py-2.5 pr-4 text-right">Earned (KES)</th>
                    <th className="py-2.5 text-right">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {earningTitles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        No verified premium plays recorded in this date window yet.
                      </td>
                    </tr>
                  ) : earningTitles.slice(0, 12).map((row) => (
                    <tr key={row.videoId} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-white max-w-[240px] truncate">
                        {row.title}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-400">{row.category}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-zinc-200">
                        {row.qualifiedViews.toLocaleString('en-KE')}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-zinc-300">
                        {row.shareOfPoolPercent.toFixed(1)}%
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-emerald-400">
                        {formatKes(row.attributedRevenueKes)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            row.accessTier === 'Premium'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {row.accessTier}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
            );
          })()}
        </section>
      )}

      {/* --- TAB: MENU MANAGER --- */}
      {activeTab === 'menu' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6 text-xl font-bold text-white">
                <LayoutGrid className="text-purple-500" />
                <h3>Add New Category</h3>
              </div>

              <form onSubmit={handleAddCategory} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Category Name</label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Technology, Gaming, Recipes"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Select Icon</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setNewCatIcon(name)}
                        className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all border ${newCatIcon === name
                            ? 'bg-red-600 border-red-500 text-white shadow-lg scale-105'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                          }`}
                      >
                        <Icon size={20} />
                        <span className="text-[10px]">{name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Add to Menu
                </button>
              </form>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6 text-xl font-bold text-white">
                <Tag className="text-blue-500" />
                <h3>Active Menu Items</h3>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {currentNavItems
                  .filter((item) => !item.restricted && item.id !== 'SETTINGS')
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl group hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
                          {item.icon && <item.icon size={18} />}
                        </div>
                        <div>
                          <p className="font-medium text-white">{item.label}</p>
                          <p className="text-xs text-zinc-500">{item.isCustom ? 'Custom Category' : 'System Page'}</p>
                        </div>
                      </div>

                      {item.isCustom && (
                        <button
                          type="button"
                          onClick={() => onRemoveCategory(item.id)}
                          className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remove from menu"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: ROYALTIES & PERFORMANCE --- */}
      {activeTab === 'royalties' && (
        <section aria-label="Creatives Royalties & Performance">
          <RoyaltiesDashboard videos={effectiveVideos} />
        </section>
      )}
    </div>
  );
}
