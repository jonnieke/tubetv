import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Film,
  Loader2,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  approveSponsorAd,
  createSponsorAd,
  deleteSponsorAd,
  listAllSponsorAds,
  toggleSponsorAdActive,
  uploadSponsorAdFile,
  type SponsorAd,
} from '../lib/sponsorAds';

export const SponsorAdsManager: React.FC = () => {
  const [ads, setAds] = useState<SponsorAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [title, setTitle] = useState('');
  const [advertiserName, setAdvertiserName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [clickUrl, setClickUrl] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(30);

  const loadAds = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listAllSponsorAds();
      setAds(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sponsor ads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAds();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess('');
    setUploadingFile(true);
    try {
      const publicUrl = await uploadSponsorAdFile(file);
      setVideoUrl(publicUrl);
      if (!title) {
        setTitle(file.name.replace(/\.[^.]+$/, ''));
      }
      setSuccess('Video uploaded! Fill in the advertiser name and click Save Ad.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload ad video.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !advertiserName.trim() || !videoUrl.trim()) {
      setError('Title, advertiser name, and video URL (or Bunny video GUID) are required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const created = await createSponsorAd({
        title,
        advertiserName,
        videoUrl,
        clickUrl: clickUrl || undefined,
        durationSeconds,
      });
      setAds((prev) => [created, ...prev]);
      setTitle('');
      setAdvertiserName('');
      setVideoUrl('');
      setClickUrl('');
      setDurationSeconds(30);
      setSuccess('Sponsor ad is now live in the 30s non-skippable Ad-to-Unlock rotation!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save sponsor ad.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (ad: SponsorAd) => {
    try {
      await approveSponsorAd(ad.id);
      setAds((prev) =>
        prev.map((item) =>
          item.id === ad.id ? { ...item, approvalStatus: 'approved', isActive: true } : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve ad.');
    }
  };

  const handleToggle = async (ad: SponsorAd) => {
    try {
      await toggleSponsorAdActive(ad.id, !ad.isActive);
      setAds((prev) => prev.map((item) => (item.id === ad.id ? { ...item, isActive: !item.isActive } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ad status.');
    }
  };

  const handleDelete = async (ad: SponsorAd) => {
    if (!window.confirm(`Delete "${ad.title}" (${ad.advertiserName})?`)) return;
    try {
      await deleteSponsorAd(ad.id);
      setAds((prev) => prev.filter((item) => item.id !== ad.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ad.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/20 via-zinc-900 to-zinc-950 p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400">
            <Megaphone size={18} />
          </span>
          <div>
            <h2 className="text-lg font-black text-white">Non-Skippable 30s Sponsor Video Ads</h2>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              Upload a 30-second MP4/WebM ad directly or paste a <strong>Bunny Stream Video GUID / HLS URL</strong>.
              Active ads rotate automatically when viewers choose <em>Watch 30s Ad to Unlock</em> (or 2×30s ads for extra episodes on 10+ episode dramas).
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Advertiser / Brand Name *
              </label>
              <input
                type="text"
                required
                value={advertiserName}
                onChange={(e) => setAdvertiserName(e.target.value)}
                placeholder="e.g. Safaricom M-Pesa"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Campaign / Spot Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. M-Pesa Tuinuane 30s Spot"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Bunny Video GUID, HLS (.m3u8), or MP4 URL *
              </label>
              <input
                type="text"
                required
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste Bunny GUID (e.g. 550e8400-...) or https://...mp4"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Click-Through URL (Optional)
              </label>
              <input
                type="url"
                value={clickUrl}
                onChange={(e) => setClickUrl(e.target.value)}
                placeholder="https://brand-website.co.ke"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Seconds
              </label>
              <input
                type="number"
                min={10}
                max={90}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value) || 30)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-200 cursor-pointer transition">
              {uploadingFile ? <Loader2 size={14} className="animate-spin text-amber-400" /> : <UploadCloud size={14} className="text-amber-400" />}
              <span>{uploadingFile ? 'Uploading MP4...' : 'Upload 30s MP4 / WebM'}</span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                disabled={uploadingFile}
                onChange={handleFileUpload}
              />
            </label>

            <button
              type="submit"
              disabled={saving || uploadingFile}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-4 py-2 text-xs font-black text-zinc-950 transition cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>Save &amp; Activate Ad</span>
            </button>
          </div>

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
      </div>

      {/* Active & Paused Ads List */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Film size={15} className="text-amber-400" />
            Ad Inventory ({ads.length})
          </h3>
          <span className="text-[11px] text-zinc-400">
            {ads.filter((a) => a.isActive).length} active in rotation
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-xs text-zinc-400 gap-2">
            <Loader2 size={15} className="animate-spin" />
            Loading sponsor ads...
          </div>
        ) : ads.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500">
            No sponsor video ads uploaded yet. Add your first 30s Bunny or MP4 spot above to start monetizing free unlocks.
          </p>
        ) : (
          <div className="space-y-2.5">
            {ads.map((ad) => {
              const completionPct =
                ad.impressions > 0 ? Math.min(100, Math.round((ad.completions / ad.impressions) * 100)) : 0;
              return (
                <div
                  key={ad.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          ad.approvalStatus === 'pending_review'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : ad.approvalStatus === 'completed'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              : ad.isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {ad.approvalStatus === 'pending_review'
                          ? 'Pending Review'
                          : ad.approvalStatus === 'completed'
                            ? 'Completed'
                            : ad.isActive
                              ? 'Live'
                              : 'Paused'}
                      </span>
                      <strong className="text-xs font-bold text-white truncate">{ad.advertiserName}</strong>
                      <span className="text-xs text-zinc-400 truncate">· {ad.title}</span>
                      <span className="text-[10px] font-mono text-amber-300">{ad.durationSeconds}s</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                      <span>
                        Impressions: <strong className="text-white">{ad.impressions.toLocaleString()}</strong>
                      </span>
                      <span>
                        30s Completions: <strong className="text-emerald-400">{ad.completions.toLocaleString()}</strong>{' '}
                        ({completionPct}%)
                      </span>
                      {ad.clickUrl && (
                        <a
                          href={ad.clickUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-amber-300 hover:underline"
                        >
                          Link <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {ad.approvalStatus === 'pending_review' ? (
                      <button
                        type="button"
                        onClick={() => void handleApprove(ad)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-[11px] font-extrabold text-white transition cursor-pointer"
                      >
                        <CheckCircle2 size={13} />
                        <span>Approve &amp; Go Live</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleToggle(ad)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-2.5 py-1.5 text-[11px] font-bold text-zinc-200 transition cursor-pointer"
                      >
                        {ad.isActive ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                        <span>{ad.isActive ? 'Pause' : 'Activate'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(ad)}
                      aria-label={`Delete ${ad.title}`}
                      className="inline-flex items-center justify-center rounded-lg border border-red-900/60 bg-red-950/30 hover:bg-red-900/40 p-1.5 text-red-400 transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SponsorAdsManager;
