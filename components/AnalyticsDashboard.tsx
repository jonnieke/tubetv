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
  grossRevenueKes30d?: number;
  revenueByRegion?: Record<string, number>;
  revenueByChannel?: Record<string, number>;
  revenueByPlan?: Record<string, number>;
  dailySeries?: Array<{ date: string; revenueKes: number; qualifiedViews: number }>;
}

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
}

export default function AnalyticsDashboard({
  currentNavItems = [],
  onAddCategory = () => { },
  onRemoveCategory = () => { },
  videos,
}: AnalyticsDashboardProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'menu' | 'royalties'>('overview');
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Star');
  const [loadedVideos, setLoadedVideos] = useState<BunnyVideoItem[]>([]);
  const [funnel, setFunnel] = useState<AnalyticsSummaryPayload | null>(null);

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
        const response = await fetch(`${url}/functions/v1/analytics-summary`, {
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
  }, []);

  const effectiveVideos = videos ?? loadedVideos;

  const { myVideos, totalViews, categoryData } = useMemo(() => {
    let views = 0;
    const categoryCounts = new Map<string, { titles: number; lifetimeViews: number }>();
    const rows = effectiveVideos
      .map((item) => {
        const video = bunnyVideoToVideo(item);
        const count = Number(item.views) || 0;
        views += count;
        const category = video.category || 'Other';
        const previous = categoryCounts.get(category) || { titles: 0, lifetimeViews: 0 };
        categoryCounts.set(category, {
          titles: previous.titles + 1,
          lifetimeViews: previous.lifetimeViews + count,
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
      categoryData: [...categoryCounts].map(([category, totals]) => ({ category, ...totals })),
    };
  }, [effectiveVideos]);

  const grossRevenueKes30d = funnel?.grossRevenueKes30d ?? 0;

  const royaltySnapshot = useMemo(() => {
    const periodLabel = new Date().toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
    return computeShareOfPlayRoyalties(
      effectiveVideos,
      {
        periodLabel,
        grossSubscriptionRevenueKes: grossRevenueKes30d,
        payoutThresholdKes: MINIMUM_PAYOUT_THRESHOLD_KES,
      },
      undefined,
      funnel?.qualifiedViewsByVideo,
    );
  }, [effectiveVideos, grossRevenueKes30d, funnel?.qualifiedViewsByVideo]);

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
            <button
              type="button"
              onClick={() => setActiveTab('royalties')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'royalties' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span>Performance & Royalties</span>
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'overview' && (
        <section aria-label="Measured catalogue totals" className="space-y-6">
          {/* Top 4 KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                <span>30-Day Gross Revenue</span>
                <Wallet className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <strong className="text-2xl md:text-3xl font-bold text-white">
                  {formatKes(grossRevenueKes30d)}
                </strong>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                M-Pesa {channelSplit.mpesaPct}% · Card {channelSplit.cardPct}%
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                <span>Creator Pool (60%)</span>
                <Coins className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2">
                <strong className="text-2xl md:text-3xl font-bold text-white">
                  {formatKes(royaltySnapshot.netCreatorPoolKes)}
                </strong>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                After 1.5% gateway fee ({formatKes(royaltySnapshot.gatewayFeesKes)})
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                <span>Qualified Views (30s / 80% &lt;30s)</span>
                <Eye className="h-4 w-4 text-blue-400" />
              </div>
              <div className="mt-2">
                <strong className="text-2xl md:text-3xl font-bold text-white">
                  {royaltySnapshot.totalQualifiedViews.toLocaleString('en-KE')}
                </strong>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">
                {myVideos.length} published titles · {formatNumber(totalViews)} lifetime views
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
                  <span>Eligible Payouts (&ge; KSh 1,000)</span>
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
                Export M-Pesa CSV
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
                      Daily Revenue (KSh) vs Qualified Views
                    </h2>
                    <p className="text-xs text-zinc-400">Last 14 days of live verified activity</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-300">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Revenue
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-violet-400" />
                      Qualified Views
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

          {/* Bottom Table: Title-by-Title Revenue & Share-of-Play */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Title-by-Title Revenue &amp; Share-of-Play</h2>
                <p className="text-xs text-zinc-400">
                  Attributed from verified 30s (or 80% &lt;30s) Qualified Views across {royaltySnapshot.content.length} titles
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('royalties')}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 cursor-pointer"
              >
                Full Creator Royalties
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 pr-4">Title</th>
                    <th className="py-2.5 pr-4">Category</th>
                    <th className="py-2.5 pr-4 text-right">Qualified Views</th>
                    <th className="py-2.5 pr-4 text-right">Share %</th>
                    <th className="py-2.5 pr-4 text-right">Attributed Revenue</th>
                    <th className="py-2.5 text-right">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {royaltySnapshot.content.slice(0, 12).map((row) => (
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
                  {royaltySnapshot.content.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        No published titles loaded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
