import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Coins,
  TrendingUp,
  CheckCircle2,
  Clock,
  Search,
  Users,
  Film,
  RefreshCw,
  Info,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { BunnyVideoItem } from '../services/bunnyService';
import { supabase } from '../lib/supabase';
import {
  computeShareOfPlayRoyalties,
  exportCreativesCsv,
  exportContentCsv,
  MINIMUM_PAYOUT_THRESHOLD_KES,
  QUALIFIED_VIEW_SECONDS,
  DEFAULT_CREATOR_POOL_PERCENT,
  PAYMENT_GATEWAY_FEE_PERCENT,
  CreatorRoyaltySummary,
  ContentPerformanceRow,
} from '../lib/royalties';

interface RoyaltiesDashboardProps {
  videos?: BunnyVideoItem[];
}

export default function RoyaltiesDashboard({ videos = [] }: RoyaltiesDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('November 2026 (Current)');
  const [grossRevenueInput, setGrossRevenueInput] = useState<number>(35000);
  const [isEditingPool, setIsEditingPool] = useState<boolean>(false);
  const [creatorPoolPercent, setCreatorPoolPercent] = useState<number>(DEFAULT_CREATOR_POOL_PERCENT);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'creatives' | 'content'>('creatives');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ELIGIBLE' | 'CARRIED_FORWARD'>('ALL');
  const [liveDbRevenue, setLiveDbRevenue] = useState<number | null>(null);
  const [loadingDb, setLoadingDb] = useState<boolean>(false);
  const [payoutSaving, setPayoutSaving] = useState<boolean>(false);
  const [payoutSuccessMessage, setPayoutSuccessMessage] = useState<string | null>(null);

  // Fetch actual transaction revenue from Supabase payment_transactions
  useEffect(() => {
    let active = true;
    const fetchTransactionsRevenue = async () => {
      setLoadingDb(true);
      try {
        const { data, error } = await supabase
          .from('payment_transactions')
          .select('amount_kes, status')
          .eq('status', 'succeeded');

        if (!error && data && data.length > 0 && active) {
          const totalFromDb = data.reduce((sum, tx) => sum + (Number(tx.amount_kes) || 0), 0);
          setLiveDbRevenue(totalFromDb);
          if (totalFromDb > 0) {
            setGrossRevenueInput(totalFromDb);
          }
        }
      } catch (err) {
        console.warn('Could not load live payment transactions:', err);
      } finally {
        if (active) setLoadingDb(false);
      }
    };

    void fetchTransactionsRevenue();
    return () => {
      active = false;
    };
  }, []);

  // Compute Share of Play and Royalties
  const royaltyResult = useMemo(() => {
    return computeShareOfPlayRoyalties(videos, {
      periodLabel: selectedPeriod,
      grossSubscriptionRevenueKes: grossRevenueInput,
      creatorPoolPercent,
      gatewayFeePercent: PAYMENT_GATEWAY_FEE_PERCENT,
      payoutThresholdKes: MINIMUM_PAYOUT_THRESHOLD_KES,
    });
  }, [videos, selectedPeriod, grossRevenueInput, creatorPoolPercent]);

  // Filtered Creatives
  const filteredCreators = useMemo(() => {
    return royaltyResult.creators.filter((c) => {
      const matchSearch =
        c.creator.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.topSeries.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (statusFilter === 'ELIGIBLE') return c.isEligibleForPayout;
      if (statusFilter === 'CARRIED_FORWARD') return !c.isEligibleForPayout;
      return true;
    });
  }, [royaltyResult.creators, searchQuery, statusFilter]);

  // Filtered Content
  const filteredContent = useMemo(() => {
    return royaltyResult.content.filter((c) => {
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.seriesTitle.toLowerCase().includes(q) ||
        c.creator.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [royaltyResult.content, searchQuery]);

  // Record settlement to Supabase
  const handleSaveSettlements = async () => {
    setPayoutSaving(true);
    setPayoutSuccessMessage(null);
    try {
      const periodKey = selectedPeriod.slice(0, 7).replace(/\s+/g, '-').toLowerCase();
      const records = royaltyResult.creators.map((c) => ({
        creator_name: c.creator,
        period_label: selectedPeriod,
        qualified_views: c.qualifiedViews,
        share_of_play_percent: c.shareOfPlayPercent,
        gross_pool_kes: royaltyResult.grossRevenueKes,
        net_payout_kes: c.netEarningsKes,
        threshold_kes: MINIMUM_PAYOUT_THRESHOLD_KES,
        status: c.isEligibleForPayout ? 'eligible' : 'carried_forward',
      }));

      const { error } = await supabase
        .from('creator_payout_settlements')
        .upsert(records, { onConflict: 'creator_name,period_label' });

      if (error) {
        console.warn('Settlement upsert note:', error.message);
      }
      setPayoutSuccessMessage(
        `✓ Settlement snapshot for ${selectedPeriod} saved. ${royaltyResult.eligibleCreatorsCount} creatives eligible for M-Pesa payout.`
      );
      setTimeout(() => setPayoutSuccessMessage(null), 6000);
    } catch (err) {
      console.error('Failed to save settlements:', err);
    } finally {
      setPayoutSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Top Header & Export Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Views Performance & Royalties</h2>
              <p className="text-sm text-zinc-400">
                Share-of-Play algorithm · 30-second minimum qualified view · Monthly KSh 1,000 payout threshold
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-zinc-800 text-white text-sm font-semibold rounded-xl px-4 py-2.5 border border-zinc-700 focus:outline-none focus:border-red-500"
          >
            <option value="November 2026 (Current)">November 2026 (Current Cycle)</option>
            <option value="October 2026">October 2026 (Closed Cycle)</option>
            <option value="September 2026">September 2026</option>
            <option value="All Time Catalogue">All Time Catalogue</option>
          </select>

          {/* CSV Export Buttons */}
          <button
            type="button"
            onClick={() =>
              exportCreativesCsv(royaltyResult.creators, {
                periodLabel: selectedPeriod,
                grossRevenueKes: royaltyResult.grossRevenueKes,
                netCreatorPoolKes: royaltyResult.netCreatorPoolKes,
                totalQualifiedViews: royaltyResult.totalQualifiedViews,
              })
            }
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all hover:scale-[1.02]"
            title="Download Creatives Payout Report formatted for Excel and M-Pesa B2C"
          >
            <Download className="w-4 h-4" />
            <span>Export Creatives (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportContentCsv(royaltyResult.content, {
                periodLabel: selectedPeriod,
                totalQualifiedViews: royaltyResult.totalQualifiedViews,
                netCreatorPoolKes: royaltyResult.netCreatorPoolKes,
              })
            }
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
            title="Download full content & episode-level performance breakdown"
          >
            <Download className="w-4 h-4" />
            <span>Export Content (CSV)</span>
          </button>
        </div>
      </div>

      {payoutSuccessMessage && (
        <div className="bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 px-5 py-3.5 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{payoutSuccessMessage}</span>
          </div>
          <button onClick={() => setPayoutSuccessMessage(null)} className="text-xs underline text-emerald-300">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue Pool */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Gross Subscriptions</p>
            <button
              onClick={() => setIsEditingPool(!isEditingPool)}
              className="text-zinc-500 hover:text-amber-400 text-xs flex items-center gap-1 transition-colors"
              title="Configure subscription pool revenue"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isEditingPool ? 'Close' : 'Adjust'}</span>
            </button>
          </div>
          <p className="text-3xl font-black text-white">KES {royaltyResult.grossRevenueKes.toLocaleString()}</p>
          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
            <span>Paystack fee (1.5%): -KES {royaltyResult.gatewayFeesKes.toLocaleString()}</span>
          </p>

          {isEditingPool && (
            <div className="mt-4 pt-3 border-t border-zinc-800 space-y-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Gross Subscription Pool (KES)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={grossRevenueInput}
                  onChange={(e) => setGrossRevenueInput(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Creator Allocation %</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="50"
                    max="90"
                    step="5"
                    value={creatorPoolPercent}
                    onChange={(e) => setCreatorPoolPercent(Number(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="text-xs font-bold text-amber-400">{creatorPoolPercent}%</span>
                </div>
              </div>
              {liveDbRevenue !== null && (
                <button
                  type="button"
                  onClick={() => setGrossRevenueInput(liveDbRevenue)}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Reset to live payments (KES {liveDbRevenue.toLocaleString()})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Net Creator Pool */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Net Creator Pool ({creatorPoolPercent}%)</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              For Creatives
            </span>
          </div>
          <p className="text-3xl font-black text-emerald-400">KES {royaltyResult.netCreatorPoolKes.toLocaleString()}</p>
          <p className="text-xs text-zinc-400 mt-1">
            Platform share (30%): KES {royaltyResult.platformShareKes.toLocaleString()}
          </p>
        </div>

        {/* 30s Qualified Views */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs uppercase tracking-wider text-zinc-400 font-bold">30s Qualified Views (QVs)</p>
            <span className="text-[10px] text-zinc-500 font-medium">≥ 30 sec plays</span>
          </div>
          <p className="text-3xl font-black text-white">{royaltyResult.totalQualifiedViews.toLocaleString()}</p>
          <p className="text-xs text-zinc-400 mt-1">
            {royaltyResult.totalWatchHours.toLocaleString()} Total Watch Hours
          </p>
        </div>

        {/* Payout Threshold Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs uppercase tracking-wider text-amber-400 font-bold">Payouts ≥ KSh 1,000</p>
            <span className="text-[10px] text-amber-300/80 font-semibold">Monthly min</span>
          </div>
          <p className="text-3xl font-black text-white">
            {royaltyResult.eligibleCreatorsCount}{' '}
            <span className="text-sm font-normal text-zinc-400">/ {royaltyResult.creators.length} Creatives</span>
          </p>
          <p className="text-xs text-amber-400/90 mt-1 font-medium">
            KES {royaltyResult.totalEligiblePayoutKes.toLocaleString()} eligible now
          </p>
        </div>
      </div>

      {/* Share of Play Best Practice Explainer Box */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-amber-500/20 rounded-2xl p-5">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Standard 30-Second Qualified View & Payout Rules</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Rule Policy
              </span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-zinc-400 mt-2.5">
              <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800">
                <strong className="text-zinc-200 block mb-1">1. 30s Qualified View (QV)</strong>
                A view only qualifies for payment once playback exceeds 30 continuous seconds (or 100% completion if under 30s). Bounce clicks do not dilute the pool.
              </div>
              <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800">
                <strong className="text-zinc-200 block mb-1">2. Share of Play Formula</strong>
                <code className="text-amber-300 font-mono text-[11px]">
                  (Creative QVs ÷ Total QVs) × Net Pool
                </code>
                . Creatives receive an exact pro-rata proportion of subscription fees based on actual engagement.
              </div>
              <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800">
                <strong className="text-zinc-200 block mb-1">3. KSh 1,000 Monthly Settlement</strong>
                Creatives meeting or exceeding KSh 1,000 are marked <strong>Eligible</strong> for instant M-Pesa B2C payout. Balances below KSh 1,000 roll forward automatically.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs & Search Filter Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Sub-tabs */}
          <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveSubTab('creatives')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'creatives'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Creatives & Studios ({royaltyResult.creators.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('content')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'content'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Content Breakdown ({royaltyResult.content.length})</span>
            </button>
          </div>

          {/* Search & Payout Status Filters */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {activeSubTab === 'creatives' && (
              <div className="flex items-center bg-zinc-950 rounded-xl border border-zinc-800 p-1">
                {(['ALL', 'ELIGIBLE', 'CARRIED_FORWARD'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      statusFilter === filter
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {filter === 'ALL'
                      ? 'All'
                      : filter === 'ELIGIBLE'
                      ? 'Eligible (≥ 1,000)'
                      : 'Carried Forward'}
                  </button>
                ))}
              </div>
            )}

            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeSubTab === 'creatives' ? 'Search creative or studio...' : 'Search title, series, creator...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>

            {activeSubTab === 'creatives' && (
              <button
                type="button"
                onClick={handleSaveSettlements}
                disabled={payoutSaving}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold px-3 py-2 rounded-xl text-white transition-colors disabled:opacity-50"
                title="Save settlement snapshot to Supabase database"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{payoutSaving ? 'Saving...' : 'Snapshot'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-tab 1: Creatives & Studios Table */}
        {activeSubTab === 'creatives' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-800">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">Creator / Studio</th>
                  <th className="py-3.5 px-4">Titles</th>
                  <th className="py-3.5 px-4">Primary Series</th>
                  <th className="py-3.5 px-4 text-right">30s+ QVs</th>
                  <th className="py-3.5 px-4 text-right">Watch Time</th>
                  <th className="py-3.5 px-4 text-right">Share of Play</th>
                  <th className="py-3.5 px-4 text-right">Net Royalties</th>
                  <th className="py-3.5 px-4 text-center">Payout Status (KSh 1,000 Threshold)</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {filteredCreators.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-zinc-500">
                      No creatives match the current filter or search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCreators.map((creator) => (
                    <tr key={creator.creator} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-4 text-zinc-500 font-bold">{creator.rank}</td>
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                          {creator.creator.charAt(0).toUpperCase()}
                        </div>
                        <span>{creator.creator}</span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">{creator.titlesCount}</td>
                      <td className="py-3.5 px-4 text-zinc-300 font-medium">{creator.topSeries}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-white">
                        {creator.qualifiedViews.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-zinc-400">{creator.totalWatchHours} hrs</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-bold text-white">{creator.shareOfPlayPercent.toFixed(2)}%</span>
                          <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-red-600 rounded-full"
                              style={{ width: `${Math.min(100, creator.shareOfPlayPercent * 3)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-sm text-emerald-400">
                          KES {creator.netEarningsKes.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-center gap-1">
                          {creator.isEligibleForPayout ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Eligible (≥ KSh 1,000)</span>
                            </span>
                          ) : (
                            <div className="w-full max-w-[170px] space-y-1">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-amber-400 font-semibold">Carried Forward</span>
                                <span className="text-zinc-500">
                                  KES {creator.netEarningsKes} / 1,000
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-amber-500 rounded-full"
                                  style={{ width: `${creator.thresholdProgressPercent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            exportCreativesCsv([creator], {
                              periodLabel: `${selectedPeriod} - ${creator.creator}`,
                              grossRevenueKes: royaltyResult.grossRevenueKes,
                              netCreatorPoolKes: royaltyResult.netCreatorPoolKes,
                              totalQualifiedViews: royaltyResult.totalQualifiedViews,
                            });
                          }}
                          className="text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 p-1.5 rounded-lg transition-colors"
                          title={`Download CSV statement for ${creator.creator}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Sub-tab 2: Content Performance Breakdown Table */}
        {activeSubTab === 'content' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-800">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">Title & Series</th>
                  <th className="py-3.5 px-4">Ep #</th>
                  <th className="py-3.5 px-4">Creator / Studio</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Tier</th>
                  <th className="py-3.5 px-4 text-right">30s+ QVs</th>
                  <th className="py-3.5 px-4 text-right">Lifetime Views</th>
                  <th className="py-3.5 px-4 text-right">Watch Time</th>
                  <th className="py-3.5 px-4 text-right">Attributed Revenue</th>
                  <th className="py-3.5 px-4 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {filteredContent.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-zinc-500">
                      No content items match the search query.
                    </td>
                  </tr>
                ) : (
                  filteredContent.map((row) => (
                    <tr key={row.videoId} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-4 text-zinc-500 font-bold">{row.rank}</td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-white truncate max-w-xs">{row.title}</p>
                        {row.seriesTitle && row.seriesTitle !== 'Standalone' && (
                          <p className="text-[11px] text-zinc-400 truncate max-w-xs">{row.seriesTitle}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300">
                        {row.episode ? `Ep ${row.episode}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300">{row.creator}</td>
                      <td className="py-3.5 px-4 text-zinc-400">{row.category}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.accessTier === 'Premium'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {row.accessTier}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-white">
                        {row.qualifiedViews.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-zinc-400">
                        {row.lifetimeViews.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-zinc-400">{row.totalWatchHours} hrs</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-emerald-400">
                          KES {row.attributedRevenueKes.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-zinc-400 font-mono">
                        {row.shareOfPoolPercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
