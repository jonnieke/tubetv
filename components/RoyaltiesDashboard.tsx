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
import { BunnyVideoItem, bunnyVideoToVideo } from '../services/bunnyService';
import CreatorPayoutDisbursement from './CreatorPayoutDisbursement';
import CreatorPromoLinkCard from './CreatorPromoLinkCard';
import { supabase } from '../lib/supabase';
import {
  computeShareOfPlayRoyalties,
  extractCarriedForwardByCreator,
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
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Last 30 Days');
  const [fromDate, setFromDate] = useState<string>(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [durationPreset, setDurationPreset] = useState<'today' | '7d' | '30d' | 'custom'>('30d');
  const [poolWindow, setPoolWindow] = useState<'30d' | 'today'>('30d');
  const [grossRevenueInput, setGrossRevenueInput] = useState<number>(0);
  const [revenue30dKes, setRevenue30dKes] = useState<number>(0);
  const [todayRevenueKes, setTodayRevenueKes] = useState<number>(0);
  const [qvs30d, setQvs30d] = useState<Record<string, number>>({});
  const [qvsToday, setQvsToday] = useState<Record<string, number>>({});
  const [userCentricGrossByVideo, setUserCentricGrossByVideo] = useState<Record<string, number> | undefined>(undefined);
  const [unattributedGrossKes, setUnattributedGrossKes] = useState<number>(0);
  const [carriedForwardByCreator, setCarriedForwardByCreator] = useState<Record<string, number>>({});
  const [hasSummaryLoaded, setHasSummaryLoaded] = useState<boolean>(false);
  const [isEditingPool, setIsEditingPool] = useState<boolean>(false);
  const [creatorPoolPercent, setCreatorPoolPercent] = useState<number>(DEFAULT_CREATOR_POOL_PERCENT);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'creatives' | 'content'>('creatives');
  const [expandedCreator, setExpandedCreator] = useState<string | null>(null);
  const [showRules, setShowRules] = useState<boolean>(false);
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
        // 1. Try admin analytics-summary Edge Function (returns verified QVs + succeeded revenue by region for Date A -> Date B)
        const { data: summaryData } = await supabase.functions.invoke(
          `analytics-summary?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`,
          { method: 'GET' },
        );
        if (active && summaryData) {
          setHasSummaryLoaded(true);
          const rangeQvs =
            summaryData.rangeQualifiedViewsByVideo && typeof summaryData.rangeQualifiedViewsByVideo === 'object'
              ? (summaryData.rangeQualifiedViewsByVideo as Record<string, number>)
              : (summaryData.qualifiedViewsByVideo as Record<string, number>) || {};
          setQvs30d(rangeQvs);
          setMeasuredQVs(rangeQvs);

          if (summaryData.todayQualifiedViewsByVideo && typeof summaryData.todayQualifiedViewsByVideo === 'object') {
            setQvsToday(summaryData.todayQualifiedViewsByVideo as Record<string, number>);
          }
          const activeRegionRev =
            summaryData.rangeRevenueByRegion && typeof summaryData.rangeRevenueByRegion === 'object'
              ? (summaryData.rangeRevenueByRegion as Record<string, number>)
              : (summaryData.revenueByRegion as Record<string, number>) || {};
          setRevenueByRegion(activeRegionRev);

          const rangeRev =
            typeof summaryData.rangeRevenueKes === 'number'
              ? summaryData.rangeRevenueKes
              : Number(summaryData.grossRevenueKes30d) || 0;
          const summaryTodayRev = Number(summaryData.todayRevenueKes) || 0;
          setRevenue30dKes(rangeRev);
          setTodayRevenueKes(summaryTodayRev);
          setLiveDbRevenue(rangeRev);
          setGrossRevenueInput(rangeRev);
          if (summaryData.rangeUserCentricGrossByVideo && typeof summaryData.rangeUserCentricGrossByVideo === 'object') {
            setUserCentricGrossByVideo(summaryData.rangeUserCentricGrossByVideo as Record<string, number>);
            setUnattributedGrossKes(Number(summaryData.rangeUnattributedGrossKes) || 0);
          } else {
            setUserCentricGrossByVideo(undefined);
            setUnattributedGrossKes(0);
          }
        }

        // 2. Fallback payment_transactions query scoped to fromDate -> toDate only if analytics-summary did not return revenue
        if (!summaryData || (typeof summaryData.rangeRevenueKes !== 'number' && typeof summaryData.grossRevenueKes30d !== 'number')) {
          const fromIso = `${fromDate}T00:00:00.000Z`;
          const toIso = `${toDate}T23:59:59.999Z`;
          const { data, error } = await supabase
            .from('payment_transactions')
            .select('amount_kes, status, created_at')
            .eq('status', 'succeeded')
            .gte('created_at', fromIso)
            .lte('created_at', toIso);

          if (!error && data && active) {
            const totalFromDb = data.reduce((sum, tx) => sum + (Number(tx.amount_kes) || 0), 0);
            setRevenue30dKes(totalFromDb);
            setLiveDbRevenue(totalFromDb);
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

        // 4. Load historical carried-forward balances from creator_payout_settlements
        const { data: settlementRows, error: settlementErr } = await supabase
          .from('creator_payout_settlements')
          .select('creator_name, period_label, net_payout_kes, carried_forward_kes, total_accrued_kes, status, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(500);

        if (!settlementErr && Array.isArray(settlementRows) && active) {
          setCarriedForwardByCreator(extractCarriedForwardByCreator(settlementRows, selectedPeriod));
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
  }, [fromDate, toDate]);

  // Compute Share of Play and Royalties
  const activeMeasuredQVs = poolWindow === 'today' ? qvsToday : measuredQVs;
  const royaltyResult = useMemo(() => {
    return computeShareOfPlayRoyalties(
      videos,
      {
        periodLabel: poolWindow === 'today' ? 'Today (Live)' : selectedPeriod,
        grossSubscriptionRevenueKes: grossRevenueInput,
        creatorPoolPercent,
        gatewayFeePercent: PAYMENT_GATEWAY_FEE_PERCENT,
        payoutThresholdKes: MINIMUM_PAYOUT_THRESHOLD_KES,
      },
      hasSummaryLoaded || Object.keys(activeMeasuredQVs).length > 0 || Object.keys(carriedForwardByCreator).length > 0
        ? {
            measuredQualifiedViews: activeMeasuredQVs,
            carriedForwardByCreator,
            ...(poolWindow !== 'today' && userCentricGrossByVideo && Object.keys(userCentricGrossByVideo).length > 0
              ? { userCentricGrossByVideo, unattributedGrossKes }
              : {}),
          }
        : undefined,
    );
  }, [videos, selectedPeriod, poolWindow, grossRevenueInput, creatorPoolPercent, activeMeasuredQVs, hasSummaryLoaded, userCentricGrossByVideo, unattributedGrossKes, carriedForwardByCreator]);

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
        carried_forward_kes: c.carriedForwardKes,
        total_accrued_kes: c.totalAccruedKes,
        threshold_kes: MINIMUM_PAYOUT_THRESHOLD_KES,
        status: c.isEligibleForPayout ? 'eligible' : 'carried_forward',
        updated_at: new Date().toISOString(),
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

          {/* Duration Filter Presets + Date A -> Date B */}
          <div className="flex flex-wrap items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5">
            {([
              { id: 'today', label: 'Today', days: 0 },
              { id: '7d', label: '7D', days: 7 },
              { id: '30d', label: '30D', days: 30 },
            ] as const).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const to = new Date().toISOString().slice(0, 10);
                  const from = new Date(Date.now() - preset.days * 86400000).toISOString().slice(0, 10);
                  setDurationPreset(preset.id);
                  setPoolWindow(preset.id === 'today' ? 'today' : '30d');
                  setFromDate(from);
                  setToDate(to);
                  setSelectedPeriod(preset.id === 'today' ? 'Today' : `Last ${preset.days} Days`);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  durationPreset === preset.id ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <input
              type="date"
              value={fromDate}
              aria-label="Royalties from date"
              onChange={(e) => {
                setDurationPreset('custom');
                setPoolWindow('30d');
                setFromDate(e.target.value);
                setSelectedPeriod(`${e.target.value} to ${toDate}`);
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
            />
            <span className="text-xs text-zinc-500">→</span>
            <input
              type="date"
              value={toDate}
              aria-label="Royalties to date"
              onChange={(e) => {
                setDurationPreset('custom');
                setPoolWindow('30d');
                setToDate(e.target.value);
                setSelectedPeriod(`${fromDate} to ${e.target.value}`);
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white"
            />
          </div>

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

      {videos.length > 0 && <CreatorPromoLinkCard videos={videos.map(bunnyVideoToVideo)} />}

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

      {/* Visual 4-Step Money Flow Breakdown */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Where the Money Goes ({fromDate} → {toDate})
          </span>
          <span className="text-[11px] text-zinc-400">
            {poolWindow !== 'today' && userCentricGrossByVideo && Object.keys(userCentricGrossByVideo).length > 0
              ? `User-Centric Per-Pass Split (KSh ${Math.round(
                  Object.values(userCentricGrossByVideo).reduce((a, b) => a + b, 0),
                ).toLocaleString()} direct to watched titles · KSh ${Math.round(unattributedGrossKes).toLocaleString()} shared pro-rata)`
              : 'Pro-Rata Share-of-Play across Premium titles (payouts start at KSh 1,000)'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 px-3 py-2">
            <span className="text-[10px] text-zinc-400 block">1. Money Collected</span>
            <strong className="text-sm font-black text-white">KES {royaltyResult.grossRevenueKes.toLocaleString()}</strong>
          </div>
          <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 px-3 py-2">
            <span className="text-[10px] text-zinc-400 block">2. Minus Fees (1.5% Gateway + 5% Platform)</span>
            <strong className="text-sm font-bold text-zinc-300">
              − KES {(royaltyResult.gatewayFeesKes + royaltyResult.platformFeesKes).toLocaleString()}
            </strong>
          </div>
          <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 px-3 py-2">
            <span className="text-[10px] text-emerald-300 block">3. Creator Pool ({creatorPoolPercent}%)</span>
            <strong className="text-sm font-black text-emerald-400">KES {royaltyResult.netCreatorPoolKes.toLocaleString()}</strong>
          </div>
          <div className="rounded-xl bg-zinc-950/80 border border-zinc-800 px-3 py-2">
            <span className="text-[10px] text-zinc-400 block">4. Tube TV Share ({100 - creatorPoolPercent}%)</span>
            <strong className="text-sm font-bold text-zinc-200">KES {royaltyResult.platformShareKes.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue Pool */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Money Collected</p>
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
            <span>
              Gateway (1.5%): −KES {royaltyResult.gatewayFeesKes.toLocaleString()} · Platform (5%): −KES{' '}
              {royaltyResult.platformFeesKes.toLocaleString()}
            </span>
          </p>
          <div className="mt-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => {
                setPoolWindow('30d');
                setMeasuredQVs(qvs30d);
                setLiveDbRevenue(revenue30dKes);
                setGrossRevenueInput(revenue30dKes);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                poolWindow === '30d' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              30-Day Pool
            </button>
            <button
              type="button"
              onClick={() => {
                setPoolWindow('today');
                setMeasuredQVs(qvsToday);
                setLiveDbRevenue(todayRevenueKes);
                setGrossRevenueInput(todayRevenueKes);
              }}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                poolWindow === 'today' ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Today&apos;s Pool
            </button>
          </div>

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
            <p className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Creator Payout Pool ({creatorPoolPercent}%)</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              For Creators
            </span>
          </div>
          <p className="text-3xl font-black text-emerald-400">KES {royaltyResult.netCreatorPoolKes.toLocaleString()}</p>
          <p className="text-xs text-zinc-400 mt-1">
            Tube TV share ({100 - creatorPoolPercent}%): KES {royaltyResult.platformShareKes.toLocaleString()}
          </p>
        </div>

        {/* 30s Qualified Views */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs uppercase tracking-wider text-zinc-400 font-bold">Verified Plays</p>
            <span className="text-[10px] text-zinc-500 font-medium">Watched ≥ 30s</span>
          </div>
          <p className="text-3xl font-black text-white">{royaltyResult.totalQualifiedViews.toLocaleString()}</p>
          <p className="text-xs text-zinc-400 mt-1">
            {royaltyResult.totalWatchHours.toLocaleString()} total watch hours
          </p>
        </div>

        {/* Payout Threshold Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex justify-between items-start mb-3">
            <p className="text-xs uppercase tracking-wider text-amber-400 font-bold">Ready to Pay (≥ KSh 1,000)</p>
            <span className="text-[10px] text-amber-300/80 font-semibold">Monthly min</span>
          </div>
          <p className="text-3xl font-black text-white">
            {royaltyResult.eligibleCreatorsCount}{' '}
            <span className="text-sm font-normal text-zinc-400">/ {royaltyResult.creators.length} Creators</span>
          </p>
          <p className="text-xs text-amber-400/90 mt-1 font-medium">
            KES {royaltyResult.totalEligiblePayoutKes.toLocaleString()} ready for M-Pesa
          </p>
        </div>
      </div>

      {/* Collapsible Payout Rules Bar */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong className="text-white">60/40 User-Centric Split</strong> · 30s+ Qualified Views · KSh 1,000 monthly minimum payout
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowRules((v) => !v)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 transition-colors"
          >
            {showRules ? 'Hide Rules' : '? Rules'}
          </button>
        </div>
        {showRules && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-800">
            <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800">
              <strong className="text-zinc-200 block mb-1">1. 30s Qualified View (QV)</strong>
              A view only qualifies for payment once playback exceeds 30 continuous seconds (or 80% completion if under 30s). Bounce clicks do not dilute the pool.
            </div>
            <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800">
              <strong className="text-zinc-200 block mb-1">2. 60/40 User-Centric Formula</strong>
              Each subscriber&apos;s pass funds only the Premium titles they watched, weighted by <code className="text-amber-300 font-mono text-[11px]">√(minutes)</code> (capped at 90m) with 1-play-per-day anti-farming.
            </div>
            <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800">
              <strong className="text-zinc-200 block mb-1">3. KSh 1,000 Monthly Settlement</strong>
              Creatives meeting or exceeding KSh 1,000 are marked <strong>Eligible</strong> for instant M-Pesa B2C payout. Balances below KSh 1,000 roll forward automatically.
            </div>
          </div>
        )}
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
                      ? 'Ready to Pay (≥ 1,000)'
                      : 'Saving Up (< 1,000)'}
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

        {/* Sub-tab 1: Creatives & Studios Table (6 clean columns) */}
        {activeSubTab === 'creatives' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-800">
                <tr>
                  <th className="py-3.5 px-4">Creator / Studio</th>
                  <th className="py-3.5 px-4">Contents</th>
                  <th className="py-3.5 px-4 text-right">Engagement</th>
                  <th className="py-3.5 px-4 text-right">Earned (Net)</th>
                  <th className="py-3.5 px-4">Payout &amp; Destination</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {filteredCreators.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500">
                      No creatives match the current filter or search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCreators.map((creator) => {
                    const savedProfile = creatorProfiles[creator.creator];
                    const portalCode = savedProfile?.portal_access_code || generateDefaultPortalCode(creator.creator);
                    const isExpanded = expandedCreator === creator.creator;
                    const creatorContents = isExpanded
                      ? royaltyResult.content.filter((c) => c.creator === creator.creator)
                      : [];
                    return (
                      <React.Fragment key={creator.creator}>
                        <tr
                          onClick={() => setExpandedCreator(isExpanded ? null : creator.creator)}
                          className="hover:bg-zinc-800/30 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[11px] font-bold text-zinc-500 w-5 shrink-0">#{creator.rank}</span>
                              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200 shrink-0">
                                {creator.creator.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-white block truncate">{creator.creator}</span>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400" onClick={(e) => e.stopPropagation()}>
                                  <span className="truncate max-w-[140px]">{creator.topSeries}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-300">
                                    {portalCode}
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
                                    className="text-zinc-400 hover:text-white underline"
                                    title="Copy read-only Creator Self-Service Portal link"
                                  >
                                    Copy Link
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800/80 border border-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-zinc-200">
                              {creator.titlesCount} {creator.titlesCount === 1 ? 'title' : 'titles'} {isExpanded ? '▲' : '▼'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="font-bold text-white">
                              {creator.qualifiedViews.toLocaleString()} plays
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-0.5">
                              {creator.totalWatchHours} hrs · <span className="text-zinc-200 font-semibold">{creator.shareOfPlayPercent.toFixed(2)}%</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-mono font-bold text-sm text-emerald-400 block">
                              KES {(creator.carriedForwardKes > 0 ? creator.totalAccruedKes : creator.netEarningsKes).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {creator.carriedForwardKes > 0
                                ? `Period KES ${creator.netEarningsKes.toLocaleString()} + KES ${creator.carriedForwardKes.toLocaleString()} rolled`
                                : `Gross KES ${creator.grossRevenueShareKes.toLocaleString()}`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="space-y-1.5 max-w-[200px]">
                              {creator.isEligibleForPayout ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>Ready to Pay (≥ KSh 1,000)</span>
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-amber-400 font-semibold">Carried Forward</span>
                                    <span className="text-zinc-500 font-mono">KES {creator.totalAccruedKes} / 1,000</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-amber-500 rounded-full"
                                      style={{ width: `${creator.thresholdProgressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                              {savedProfile?.payout_account ? (
                                <div className="text-[11px] text-emerald-300 font-mono truncate">
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
                                  className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 hover:underline font-semibold"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Add M-Pesa / Bank Number</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditProfile(creator.creator)}
                                className="text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                                title={`Configure M-Pesa / Bank Payout & Portal Code for ${creator.creator}`}
                              >
                                Profile
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
                        {isExpanded && (
                          <tr className="bg-zinc-950/90">
                            <td colSpan={6} className="p-4 border-b border-zinc-800">
                              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                                      {creator.creator} — Earnings by Content ({creatorContents.length} titles)
                                    </h4>
                                    <p className="text-[11px] text-zinc-400">
                                      Per-title breakdown summing to {creator.creator}&apos;s total net royalties for {royaltyResult.periodLabel}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 block">Creator Total</span>
                                    <strong className="font-mono text-base font-black text-emerald-400">
                                      KES {creator.netEarningsKes.toLocaleString()}
                                    </strong>
                                  </div>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-[11px]">
                                    <thead>
                                      <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                                        <th className="py-2 pr-3">Title &amp; Series</th>
                                        <th className="py-2 pr-3">Category</th>
                                        <th className="py-2 pr-3 text-right">30s+ QVs</th>
                                        <th className="py-2 pr-3 text-right">Watch Time</th>
                                        <th className="py-2 pr-3 text-right">Pool Share</th>
                                        <th className="py-2 text-right">Earned</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60">
                                      {creatorContents.map((item) => (
                                        <tr key={item.videoId} className="hover:bg-zinc-800/30">
                                          <td className="py-2 pr-3">
                                            <span className="font-semibold text-white">{item.title}</span>
                                            {item.seriesTitle && (
                                              <span className="ml-1.5 text-zinc-400">
                                                ({item.seriesTitle}{item.episode !== '-' ? ` · Ep ${item.episode}` : ''})
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 pr-3 text-zinc-400">{item.category}</td>
                                          <td className="py-2 pr-3 text-right font-mono text-zinc-200">
                                            {item.qualifiedViews.toLocaleString()}
                                          </td>
                                          <td className="py-2 pr-3 text-right font-mono text-zinc-400">
                                            {item.totalWatchHours} hrs
                                          </td>
                                          <td className="py-2 pr-3 text-right font-mono text-zinc-300">
                                            {item.shareOfPoolPercent.toFixed(2)}%
                                          </td>
                                          <td className="py-2 text-right font-mono font-bold text-emerald-300">
                                            KES {item.attributedRevenueKes.toLocaleString()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {filteredCreators.length > 0 && (
                <tfoot className="bg-zinc-950/90 border-t border-zinc-700 font-bold text-xs">
                  <tr>
                    <td className="py-3 px-4 text-zinc-300">
                      Total ({filteredCreators.length} {filteredCreators.length === 1 ? 'Creative' : 'Creatives'})
                    </td>
                    <td className="py-3 px-4 text-zinc-200">
                      {filteredCreators.reduce((s, c) => s + c.titlesCount, 0).toLocaleString()} titles
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-white">
                      {filteredCreators.reduce((s, c) => s + c.qualifiedViews, 0).toLocaleString()} QVs ·{' '}
                      {filteredCreators.reduce((s, c) => s + c.shareOfPlayPercent, 0).toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-emerald-400">
                      KES {filteredCreators.reduce((s, c) => s + c.totalAccruedKes, 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-zinc-500 text-[11px]" colSpan={2}>
                      Click any creator row to expand per-content earnings
                    </td>
                  </tr>
                </tfoot>
              )}
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
