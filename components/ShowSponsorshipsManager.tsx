import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  ExternalLink,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  createShowSponsorship,
  deleteShowSponsorship,
  listShowSponsorships,
  toggleShowSponsorshipActive,
  type ShowSponsorshipRecord,
} from '../lib/sponsors';

export const ShowSponsorshipsManager: React.FC = () => {
  const [items, setItems] = useState<ShowSponsorshipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [seriesKey, setSeriesKey] = useState('*');
  const [seriesTitle, setSeriesTitle] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [tagline, setTagline] = useState('');
  const [clickUrl, setClickUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [campaignBudgetKes, setCampaignBudgetKes] = useState(50000);
  const [unlocksFreeViewing, setUnlocksFreeViewing] = useState(false);
  const [endsAt, setEndsAt] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listShowSponsorships();
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load show sponsorships.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorName.trim() || !/^https:\/\//i.test(clickUrl.trim())) {
      setError('Sponsor name and an https:// destination URL are required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const created = await createShowSponsorship({
        seriesKey: seriesKey.trim() || '*',
        seriesTitle: seriesTitle.trim() || undefined,
        sponsorName: sponsorName.trim(),
        tagline: tagline.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        clickUrl: clickUrl.trim(),
        unlocksFreeViewing,
        packageTier: unlocksFreeViewing ? 'free_season_unlock' : 'presented_by',
        campaignBudgetKes,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      });
      setItems((prev) => [created, ...prev]);
      setSponsorName('');
      setSeriesTitle('');
      setTagline('');
      setClickUrl('');
      setLogoUrl('');
      setEndsAt('');
      setUnlocksFreeViewing(false);
      setSuccess(
        created.unlocksFreeViewing
          ? `Brand-funded Free Season is now live for "${created.seriesTitle || created.seriesKey}"!`
          : `Show sponsorship for "${created.sponsorName}" is now live!`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save sponsorship.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: ShowSponsorshipRecord) => {
    try {
      await toggleShowSponsorshipActive(item.id, !item.isActive);
      setItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, isActive: !item.isActive } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle sponsorship.');
    }
  };

  const handleDelete = async (item: ShowSponsorshipRecord) => {
    if (!window.confirm(`Delete sponsorship "${item.sponsorName}"?`)) return;
    try {
      await deleteShowSponsorship(item.id);
      setItems((prev) => prev.filter((r) => r.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sponsorship.');
    }
  };

  return (
    <div className="space-y-4 pt-6 border-t border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Briefcase size={18} className="text-amber-400" />
            <span>B2B Show Sponsorships &amp; Brand-Funded Free Seasons</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Attach a brand sponsor to a specific series (by Series ID, slug, or <code className="text-amber-300">*</code> for site-wide). Enable{' '}
            <strong className="text-white">Free Season Unlock</strong> to make all episodes of that show free during the brand campaign.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">{success}</div>
      )}

      <form onSubmit={handleCreate} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Brand / Sponsor Name *</label>
            <input
              type="text"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              placeholder="e.g. Safaricom Home Fibre"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
              Series Key / Slug (or * for Global)
            </label>
            <input
              type="text"
              value={seriesKey}
              onChange={(e) => setSeriesKey(e.target.value)}
              placeholder="e.g. roommates or *"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Show Display Title</label>
            <input
              type="text"
              value={seriesTitle}
              onChange={(e) => setSeriesTitle(e.target.value)}
              placeholder="e.g. Roommates"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Click-Through URL (https://) *</label>
            <input
              type="url"
              value={clickUrl}
              onChange={(e) => setClickUrl(e.target.value)}
              placeholder="https://brand.co.ke/promo"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Enjoy this entire season free, courtesy of..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Deal Budget (KES)</label>
            <input
              type="number"
              min={0}
              step={500}
              value={campaignBudgetKes}
              onChange={(e) => setCampaignBudgetKes(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Brand Logo URL (optional)</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://.../logo.png"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Campaign End Date (optional)</label>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unlocksFreeViewing}
              onChange={(e) => setUnlocksFreeViewing(e.target.checked)}
              className="accent-amber-400"
            />
            <Sparkles size={13} className="text-amber-300 shrink-0" />
            <span className="font-bold">Unlock Free Season for All Viewers</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs px-4 py-2 transition disabled:opacity-50 cursor-pointer"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          <span>{saving ? 'Saving...' : 'Launch Show Sponsorship'}</span>
        </button>
      </form>

      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400 py-3">
            <Loader2 size={14} className="animate-spin" /> Loading show sponsorships...
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-zinc-500 py-2">No show sponsorships configured yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold text-white">{item.sponsorName}</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                    Show: {item.seriesTitle || item.seriesKey}
                  </span>
                  {item.unlocksFreeViewing && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-400/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                      <Sparkles size={10} /> Free Season Unlocked
                    </span>
                  )}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      item.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {item.isActive ? 'LIVE' : 'PAUSED'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                  <span>Budget: <strong className="text-white">KSh {item.campaignBudgetKes.toLocaleString()}</strong></span>
                  {item.endsAt && <span>Ends: {new Date(item.endsAt).toLocaleDateString()}</span>}
                  <a
                    href={item.clickUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-amber-300 hover:underline"
                  >
                    Destination <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggle(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-2.5 py-1.5 text-[11px] font-bold text-zinc-200 transition cursor-pointer"
                >
                  {item.isActive ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                  <span>{item.isActive ? 'Pause' : 'Activate'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(item)}
                  aria-label={`Delete ${item.sponsorName}`}
                  className="inline-flex items-center justify-center rounded-lg border border-red-900/60 bg-red-950/30 hover:bg-red-900/40 p-1.5 text-red-400 transition cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ShowSponsorshipsManager;
