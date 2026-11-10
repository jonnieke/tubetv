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
import CreatorPayoutDisbursement from './CreatorPayoutDisbursement';
import { supabase } from '../lib/supabase';
import {
  computeShareOfPlayRoyalties,
  exportCreativesCsv,
  exportPayoutBatchCsv,
  exportContentCsv,
  generateDefaultPortalCode,
  CreatorPayoutProfile,
  MINIMUM_PAYOUT_THRESHOLD_KES,
  QUALIFIED_VIEW_SECONDS,
  DEFAULT_CREATOR_POOL_PERCENT,
  PAYMENT_GATEWAY_FEE_PERCENT,
  CreatorRoyaltySummary,
  ContentPerformanceRow,
} from '../lib/royalties';

const CREATOR_PROFILES_STORAGE_KEY = 'tubetv_creator_payout_profiles_v1';

export function getSavedCreatorProfiles(): Record<string, CreatorPayoutProfile> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CREATOR_PROFILES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

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
  const [measuredQVs, setMeasuredQVs] = useState<Record<string, number>>({});
  const [revenueByRegion, setRevenueByRegion] = useState<Record<string, number>>({});
  const [payoutRail, setPayoutRail] = useState<string>('M-Pesa B2C (Kenya)');
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, CreatorPayoutProfile>>(getSavedCreatorProfiles);
  const [editingProfileCreator, setEditingProfileCreator] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<CreatorPayoutProfile>({
    creator_name: '',
    payout_rail: 'M-Pesa B2C (Kenya)',
    payout_account: '',
    tax_id_or_pin: '',
    withholding_tax_percent: 0,
    contact_email: '',
    portal_access_code: '',
  });
  const [loadingDb, setLoadingDb] = useState<boolean>(false);
  const [payoutSaving, setPayoutSaving] = useState<boolean>(false);
  const [payoutSuccessMessage, setPayoutSuccessMessage] = useState<string | null>(null);

  // Fetch actual transaction revenue and server-verified 30s Qualified Views from Supabase
  useEffect(() => {
    let active = true;
    const fetchTransactionsRevenue = async () => {
      setLoadingDb(true);
      try {
        // 1. Try admin analytics-summary Edge Function (returns verified QVs + succeeded revenue by region)
        const { data: summaryData } = await supabase.functions.invoke('analytics-summary', {
          method: 'GET',
        });
        if (active && summaryData) {
          if (summaryData.qualifiedViewsByVideo && typeof summaryData.qualifiedViewsByVideo === 'object') {
            setMeasuredQVs(summaryData.qualifiedViewsByVideo as Record<string, number>);
          }
          if (summaryData.revenueByRegion && typeof summaryData.revenueByRegion === 'object') {
            setRevenueByRegion(summaryData.revenueByRegion as Record<string, number>);
          }
          const summaryRev = Number(summaryData.grossRevenueKes30d) || 0;
          if (summaryRev > 0) {
            setLiveDbRevenue(summaryRev);
            setGrossRevenueInput(summaryRev);
          }
        }

        // 2. Also query payment_transactions fallback
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

        // 3. Load saved Creator Payout Directory profiles from Supabase
        const { data: profileRows, error: profileErr } = await supabase
          .from('creator_payout_profiles')
          .select('*');

        if (!profileErr && Array.isArray(profileRows) && profileRows.length > 0 && active) {
          const merged: Record<string, CreatorPayoutProfile> = { ...getSavedCreatorProfiles() };
          profileRows.forEach((row: any) => {
            if (row.creator_name) {
              merged[row.creator_name] = {
                creator_name: row.creator_name,
                payout_rail: row.payout_rail || 'M-Pesa B2C (Kenya)',
                payout_account: row.payout_account || '',
                tax_id_or_pin: row.tax_id_or_pin || '',
                withholding_tax_percent: Number(row.withholding_tax_percent) || 0,
                contact_email: row.contact_email || '',
                portal_access_code: row.portal_access_code || generateDefaultPortalCode(row.creator_name),
              };
            }
          });
          setCreatorProfiles(merged);
          try {
            window.localStorage.setItem(CREATOR_PROFILES_STORAGE_KEY, JSON.stringify(merged));
          } catch {}
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
    return computeShareOfPlayRoyalties(
      videos,
      {
        periodLabel: selectedPeriod,
        grossSubscriptionRevenueKes: grossRevenueInput,
        creatorPoolPercent,
        gatewayFeePercent: PAYMENT_GATEWAY_FEE_PERCENT,
        payoutThresholdKes: MINIMUM_PAYOUT_THRESHOLD_KES,
      },
      Object.keys(measuredQVs).length > 0 ? { measuredQualifiedViews: measuredQVs } : undefined,
    );
  }, [videos, selectedPeriod, grossRevenueInput, creatorPoolPercent, measuredQVs]);

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

  const openEditProfile = (creatorName: string) => {
    const existing = creatorProfiles[creatorName];
    setProfileForm({
      creator_name: creatorName,
      payout_rail: existing?.payout_rail || payoutRail,
      payout_account: existing?.payout_account || '',
      tax_id_or_pin: existing?.tax_id_or_pin || '',
      withholding_tax_percent: existing?.withholding_tax_percent ?? 0,
      contact_email: existing?.contact_email || '',
      portal_access_code: existing?.portal_access_code || generateDefaultPortalCode(creatorName),
    });
    setEditingProfileCreator(creatorName);
  };

  const handleSaveCreatorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfileCreator) return;
    const normalized: CreatorPayoutProfile = {
      ...profileForm,
      creator_name: editingProfileCreator,
      portal_access_code:
        (profileForm.portal_access_code || generateDefaultPortalCode(editingProfileCreator))
          .trim()
          .toUpperCase(),
    };

    const next = { ...creatorProfiles, [editingProfileCreator]: normalized };
    setCreatorProfiles(next);
    try {
      window.localStorage.setItem(CREATOR_PROFILES_STORAGE_KEY, JSON.stringify(next));
    } catch {}

    try {
      await supabase.from('creator_payout_profiles').upsert(
        {
          creator_name: normalized.creator_name,
          payout_rail: normalized.payout_rail,
          payout_account: normalized.payout_account,
          tax_id_or_pin: normalized.tax_id_or_pin || '',
          withholding_tax_percent: Number(normalized.withholding_tax_percent) || 0,
          contact_email: normalized.contact_email || '',
          portal_access_code: normalized.portal_access_code,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'creator_name' }
      );
    } catch (err) {
      console.warn('Could not sync creator profile to Supabase:', err);
    }

    setPayoutSuccessMessage(
      `✓ Saved Payout Directory profile & Portal Code (${normalized.portal_access_code}) for ${editingProfileCreator}.`
    );
    setEditingProfileCreator(null);
  };

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
        `✓ Settlement snapshot for ${selectedPeriod} saved (${payoutRail}). ${royaltyResult.eligibleCreatorsCount} creatives eligible for payout.`
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
                60/40 revenue share in favor of creative · 30s minimum qualified view · Monthly KSh 1,000 payout threshold
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Payout Rail Selector */}
          <select
            aria-label="Creator payout settlement rail"
            value={payoutRail}
            onChange={(e) => setPayoutRail(e.target.value)}
            className="bg-zinc-800 text-emerald-300 text-xs font-bold rounded-xl px-3.5 py-2.5 border border-emerald-500/30 focus:outline-none focus:border-emerald-500"
          >
            <option value="M-Pesa B2C (Kenya)">🇰🇪 M-Pesa B2C (Kenya)</option>
            <option value="Paystack Bank Transfer (NG / GH / ZA)">🇳🇬🇿🇦 Paystack Transfer (NG/GH/ZA)</option>
            <option value="Mobile Money (TZ / UG / RW)">🇹🇿🇺🇬 Mobile Money (East Africa)</option>
            <option value="Wise / Bank Wire (Diaspora USD/GBP/EUR)">🌍 Wise / Wire (Diaspora)</option>
          </select>

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
              exportPayoutBatchCsv(royaltyResult.creators, {
                periodLabel: selectedPeriod,
                payoutRail,
                profiles: creatorProfiles,
              })
            }
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 rounded-xl text-sm font-black shadow-md transition-all hover:scale-[1.02]"
            title="Download Batch Payout CSV containing only Eligible Creatives (>= KSh 1,000) for M-Pesa B2C / Paystack / Wise upload"
          >
            <Download className="w-4 h-4" />
            <span>Batch Payout CSV ({royaltyResult.eligibleCreatorsCount})</span>
          </button>

          <CreatorPayoutDisbursement
            creators={royaltyResult.creators}
            profiles={creatorProfiles}
            periodLabel={selectedPeriod}
          />

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
            title="Download full Creatives Payout & Carry-Forward Report"
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

      {Object.keys(revenueByRegion).length > 0 && (
        <div className="bg-zinc-900/75 border border-zinc-800 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            30-Day Verified Subscriptions by Market (KES Equivalent)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(revenueByRegion).map(([region, amount]) => (
              <span
                key={region}
                className="px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200"
              >
                {region}: <span className="text-emerald-400">KES {Number(amount).toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>
      )}

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
            Platform share ({100 - creatorPoolPercent}%): KES {royaltyResult.platformShareKes.toLocaleString()}
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
                <strong className="text-zinc-200 block mb-1">2. 60/40 Share of Play Formula</strong>
                <code className="text-amber-300 font-mono text-[11px]">
                  (Creative QVs ÷ Total QVs) × 60% Net Pool
                </code>
                . Revenue share is 60/40 in favor of the creative. Creatives receive an exact pro-rata proportion of 60% subscription pool based on actual qualified engagement.
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
                  <th className="py-3.5 px-4">Payout Account & Portal Code</th>
                  <th className="py-3.5 px-4 text-right">30s+ QVs</th>
                  <th className="py-3.5 px-4 text-right">Watch Time</th>
                  <th className="py-3.5 px-4 text-right">Share of Play</th>
                  <th className="py-3.5 px-4 text-right">Net Royalties</th>
                  <th className="py-3.5 px-4 text-center">Payout Status (KSh 1,000 Threshold)</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
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
                  filteredCreators.map((creator) => {
                    const savedProfile = creatorProfiles[creator.creator];
                    const portalCode = savedProfile?.portal_access_code || generateDefaultPortalCode(creator.creator);
                    return (
                      <tr key={creator.creator} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4 text-zinc-500 font-bold">{creator.rank}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                              {creator.creator.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-white block">{creator.creator}</span>
                              <span className="text-[10px] text-zinc-400">{creator.topSeries}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400">{creator.titlesCount}</td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {savedProfile?.payout_account ? (
                              <div className="text-[11px] text-emerald-300 font-mono">
                                {savedProfile.payout_account}{' '}
                                <span className="text-zinc-500 font-sans">
                                  ({savedProfile.payout_rail.split(' ')[0]}
                                  {savedProfile.withholding_tax_percent
                                    ? ` · ${savedProfile.withholding_tax_percent}% WHT`
                                    : ''})
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openEditProfile(creator.creator)}
                                className="text-[11px] text-amber-400 hover:underline font-semibold"
                              >
                                + Set M-Pesa / Bank Account
                              </button>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[10px] text-zinc-300">
                                Portal: {portalCode}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const url = `${window.location.origin}/?creator_code=${encodeURIComponent(portalCode)}`;
                                  void navigator.clipboard?.writeText(url);
                                  setPayoutSuccessMessage(
                                    `✓ Copied Self-Service Creator Portal link for ${creator.creator} (${portalCode})`
                                  );
                                }}
                                className="text-[10px] text-zinc-400 hover:text-white underline"
                                title="Copy read-only Creator Self-Service Portal link"
                              >
                                Copy Link
                              </button>
                            </div>
                          </div>
                        </td>
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
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditProfile(creator.creator)}
                              className="text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                              title={`Configure M-Pesa / Bank Payout & Portal Code for ${creator.creator}`}
                            >
                              Payout Profile
                            </button>
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
                          </div>
                        </td>
                      </tr>
                    );
                  })
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

      {/* Creator Payout Directory & Self-Service Portal Code Modal */}
      {editingProfileCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-white">Creator Payout Profile</h3>
                <p className="text-xs text-zinc-400">
                  Studio / Creative: <strong className="text-amber-400">{editingProfileCreator}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfileCreator(null)}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveCreatorProfile} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Payout Settlement Rail</label>
                <select
                  value={profileForm.payout_rail}
                  onChange={(e) => setProfileForm({ ...profileForm, payout_rail: e.target.value })}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="M-Pesa B2C (Kenya)">🇰🇪 M-Pesa B2C (Kenya)</option>
                  <option value="Paystack Bank Transfer (NG / GH / ZA)">🇳🇬🇿🇦 Paystack Bank Transfer (NG/GH/ZA)</option>
                  <option value="Mobile Money (TZ / UG / RW)">🇹🇿🇺🇬 Mobile Money (East Africa)</option>
                  <option value="Wise / Bank Wire (Diaspora USD/GBP/EUR)">🌍 Wise / Bank Wire (Diaspora)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  M-Pesa Number / Bank Account / Wise Email
                </label>
                <input
                  type="text"
                  placeholder="e.g. 254712345678 or Equity 0110..."
                  value={profileForm.payout_account}
                  onChange={(e) => setProfileForm({ ...profileForm, payout_account: e.target.value })}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">KRA PIN / Tax ID</label>
                  <input
                    type="text"
                    placeholder="e.g. A001234567Z"
                    value={profileForm.tax_id_or_pin || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, tax_id_or_pin: e.target.value })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Withholding Tax (%)</label>
                  <select
                    value={profileForm.withholding_tax_percent ?? 0}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, withholding_tax_percent: Number(e.target.value) })
                    }
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={0}>0% (No WHT)</option>
                    <option value={5}>5% (Resident Digital Content WHT)</option>
                    <option value={15}>15% (Non-Resident Royalty WHT)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Creator Self-Service Portal Access Code
                </label>
                <input
                  type="text"
                  value={profileForm.portal_access_code}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, portal_access_code: e.target.value.toUpperCase() })
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2.5 font-mono text-amber-400 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Share this code with the filmmaker so they can view their own series QVs & 60% earnings in Settings → Creator Portal.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProfileCreator(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black font-black hover:bg-amber-400"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
