import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Coins, Loader2, Megaphone, Rocket, Sparkles } from 'lucide-react';
import type { Video } from '../types';
import { compareEpisodes, seriesKey } from '../lib/series';
import {
  CREATOR_BOOST_PACKAGES,
  fetchCreatorAdHostEarnings,
  fetchCreatorBoostAds,
  submitCreatorBoostAd,
  type BoostPackageCode,
  type CreatorAdHostSummary,
  type SponsorAd,
} from '../lib/sponsorAds';

interface Props {
  creatorCode: string;
  creatorName: string;
  videos: Video[];
}

export const CreatorBoostCard: React.FC<Props> = ({ creatorCode, creatorName, videos }) => {
  const showOptions = useMemo(() => {
    const grouped = new Map<string, Video[]>();
    for (const v of videos) {
      const key = seriesKey(v) || v.id;
      const list = grouped.get(key) || [];
      list.push(v);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries()).map(([key, eps]) => {
      const sorted = [...eps].sort(compareEpisodes);
      return {
        key,
        opener: sorted[0],
        episodeCount: sorted.length,
      };
    });
  }, [videos]);

  const [selectedKey, setSelectedKey] = useState<string>(() => showOptions[0]?.key || '');
  const [packageCode, setPackageCode] = useState<BoostPackageCode>('starter');
  const [customTrailerUrl, setCustomTrailerUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [campaigns, setCampaigns] = useState<SponsorAd[]>([]);
  const [hostSummary, setHostSummary] = useState<CreatorAdHostSummary>({
    totalAdCompletionsHosted: 0,
    totalCreatorShareKes: 0,
  });

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchCreatorBoostAds(creatorCode),
      fetchCreatorAdHostEarnings(creatorName),
    ]).then(([ads, host]) => {
      if (!active) return;
      setCampaigns(ads);
      setHostSummary(host);
    });
    return () => {
      active = false;
    };
  }, [creatorCode, creatorName]);

  const activeShow = useMemo(
    () => showOptions.find((s) => s.key === selectedKey) || showOptions[0],
    [showOptions, selectedKey],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShow) return;
    const trailerSource =
      customTrailerUrl.trim() ||
      activeShow.opener.seriesTrailerUrl ||
      activeShow.opener.trailerUrl ||
      activeShow.opener.id;

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const created = await submitCreatorBoostAd({
        creatorCode,
        creatorName,
        showTitle: activeShow.opener.seriesTitle || activeShow.opener.title,
        videoId: activeShow.opener.id,
        targetSeriesKey: activeShow.key,
        trailerVideoUrl: trailerSource,
        packageCode,
      });
      setCampaigns((prev) => [created, ...prev]);
      setCustomTrailerUrl('');
      setSuccess(
        `Boost submitted for "${activeShow.opener.seriesTitle || activeShow.opener.title}"! Once approved by TubeTV Admin, your 30s trailer will run across other shows.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit boost campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 60% Ad-Host Revenue Banner */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/35 via-zinc-900 to-zinc-950 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
            <Coins size={18} />
          </span>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
              Ad-Host Revenue Share (60% Creator Split)
            </p>
            <p className="text-xs text-zinc-300 mt-0.5">
              Whenever free viewers watch a 30s non-skippable ad to unlock an episode of <strong>your</strong> show, you earn <strong>60%</strong> of the ad completion value.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-emerald-400">
            KES {hostSummary.totalCreatorShareKes.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-zinc-400">
            from {hostSummary.totalAdCompletionsHosted.toLocaleString()} hosted 30s ad completions
          </p>
        </div>
      </div>

      {/* Boost My Show Self-Serve Submission */}
      {activeShow && (
        <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/20 via-zinc-900/90 to-zinc-950 p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400">
              <Rocket size={16} />
            </span>
            <div>
              <h3 className="text-sm font-black text-white">Boost Your Show in 30s Non-Skippable Ad Slots</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Promote your 30-second trailer to free viewers unlocking <em>other</em> trending shows. Viewers click straight into your Episode 1!
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Show to Promote
                </label>
                <select
                  value={activeShow.key}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white focus:border-amber-500 focus:outline-none"
                >
                  {showOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.opener.seriesTitle || opt.opener.title} ({opt.episodeCount} Eps)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  30s Trailer Bunny GUID or MP4 URL (Optional — defaults to Ep 1 / Trailer)
                </label>
                <input
                  type="text"
                  value={customTrailerUrl}
                  onChange={(e) => setCustomTrailerUrl(e.target.value)}
                  placeholder="Leave blank to use show trailer / Ep 1"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Boost Packages */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.values(CREATOR_BOOST_PACKAGES)).map((pkg) => {
                const selected = packageCode === pkg.code;
                return (
                  <button
                    key={pkg.code}
                    type="button"
                    onClick={() => setPackageCode(pkg.code)}
                    className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-amber-400 bg-amber-500/15 shadow-md shadow-amber-950/40'
                        : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-white">{pkg.label}</span>
                      <span className="text-xs font-black text-amber-300">KSh {pkg.budgetKes.toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">{pkg.tagline}</p>
                    <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                      KSh {pkg.cpvKes.toFixed(2)} per full 30s view
                    </p>
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-4 py-2 text-xs font-black text-zinc-950 transition cursor-pointer"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>Submit Boost Campaign for Approval</span>
            </button>

            {error && (
              <p className="rounded-xl border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-200">{error}</p>
            )}
            {success && (
              <p className="rounded-xl border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>{success}</span>
              </p>
            )}
          </form>

          {/* Creator's Active & Pending Boost Campaigns */}
          {campaigns.length > 0 && (
            <div className="pt-3 border-t border-zinc-800/80 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Megaphone size={12} className="text-amber-400" />
                Your Boost Campaigns ({campaigns.length})
              </p>
              {campaigns.map((c) => {
                const target = c.targetCompletions || 250;
                const pct = Math.min(100, Math.round((c.completions / target) * 100));
                return (
                  <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <strong className="text-white truncate">{c.title}</strong>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          c.approvalStatus === 'approved' && c.isActive
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : c.approvalStatus === 'completed'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {c.approvalStatus === 'pending_review'
                          ? 'Pending Approval'
                          : c.approvalStatus === 'completed'
                            ? 'Completed'
                            : c.isActive
                              ? 'Live'
                              : 'Paused'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>
                        {c.completions.toLocaleString()} / {target.toLocaleString()} guaranteed 30s views ({pct}%)
                      </span>
                      <span>KSh {c.budgetKes.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default CreatorBoostCard;
