import React, { useMemo, useState } from 'react';
import { Check, Copy, Link2, Share2, Sparkles } from 'lucide-react';
import type { Video } from '../types';
import { compareEpisodes, isMicroDrama, seriesKey } from '../lib/series';
import { buildCreatorPromoLink, buildViralCaption, type PromoChannel } from '../lib/promoLinks';
import { generateDefaultPortalCode } from '../lib/royalties';

interface Props {
  videos: Video[];
  defaultCreatorCode?: string;
}

const CHANNELS: Array<{ id: PromoChannel; label: string }> = [
  { id: 'tiktok', label: 'TikTok' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'IG Reels' },
  { id: 'youtube', label: 'YT Shorts' },
];

export const CreatorPromoLinkCard: React.FC<Props> = ({ videos, defaultCreatorCode }) => {
  const seriesOptions = useMemo(() => {
    const grouped = new Map<string, Video[]>();
    for (const raw of videos) {
      if (!raw) continue;
      const normalizedId = raw.id || (raw as unknown as { guid?: string }).guid || '';
      const v: Video = normalizedId === raw.id ? raw : { ...raw, id: normalizedId };
      const key = seriesKey(v) || v.id || v.title || 'untitled';
      const list = grouped.get(key) || [];
      list.push(v);
      grouped.set(key, list);
    }

    const items = Array.from(grouped.values()).map((eps) => {
      const sorted = [...eps].sort(compareEpisodes);
      const opener = sorted[0];
      return {
        opener,
        episodeCount: sorted.length,
        isMicro: isMicroDrama(opener),
      };
    });

    // Prioritize Micro Dramas first
    return items.sort((a, b) => Number(b.isMicro) - Number(a.isMicro));
  }, [videos]);

  const [selectedId, setSelectedId] = useState<string>(() => seriesOptions[0]?.opener.id || '');
  const [channel, setChannel] = useState<PromoChannel>('tiktok');
  const [captionLang, setCaptionLang] = useState<'en' | 'sw'>('en');
  const [copiedMode, setCopiedMode] = useState<'none' | 'link' | 'caption'>('none');

  const activeOption = useMemo(
    () => seriesOptions.find((s) => s.opener.id === selectedId) || seriesOptions[0],
    [seriesOptions, selectedId],
  );

  if (!activeOption) return null;

  const creatorCode =
    defaultCreatorCode || generateDefaultPortalCode(activeOption.opener.author || 'TubeTV');
  const siteOrigin =
    typeof window !== 'undefined' && window.location.origin.startsWith('https://')
      ? window.location.origin
      : 'https://www.tube.co.ke';

  const promoLink = buildCreatorPromoLink({
    video: activeOption.opener,
    channel,
    creatorCode,
    siteOrigin,
    totalSeriesEpisodes: activeOption.episodeCount,
  });

  const viralCaption = buildViralCaption({
    video: activeOption.opener,
    link: promoLink,
    language: captionLang,
    totalSeriesEpisodes: activeOption.episodeCount,
  });

  const copyText = async (text: string, mode: 'link' | 'caption') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMode(mode);
      window.setTimeout(() => setCopiedMode('none'), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <section
      aria-label="Creator Viral Promo Link Generator"
      className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/20 via-zinc-900/90 to-zinc-950 p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-400">
            <Sparkles size={16} />
          </span>
          <div>
            <h3 className="text-sm font-black text-white">Creator Viral Promo Link Generator</h3>
            <p className="text-[11px] text-zinc-400">
              Deep-link TikTok, Reels &amp; WhatsApp clips directly into autoplaying Ep 1 with live conversion attribution.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-mono font-bold text-rose-300">
          Ref: {creatorCode}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Show / Opening Episode
          </label>
          <select
            value={activeOption.opener.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white focus:border-rose-500 focus:outline-none"
          >
            {seriesOptions.map((opt) => (
              <option key={opt.opener.id} value={opt.opener.id}>
                {opt.opener.seriesTitle || opt.opener.title} ({opt.episodeCount} Eps)
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Social Channel
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannel(ch.id)}
                className={`rounded-xl border py-2 text-[11px] font-bold transition-colors ${
                  channel === ch.id
                    ? 'border-rose-500 bg-rose-600/20 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Caption
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['en', 'sw'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setCaptionLang(lang)}
                className={`rounded-xl border py-2 text-[11px] font-bold uppercase transition-colors ${
                  captionLang === lang
                    ? 'border-white bg-white text-black'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generated Link & Caption Preview */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-3 space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-300 break-all">
          <Link2 size={13} className="shrink-0 text-emerald-400" />
          <span>{promoLink}</span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed border-t border-zinc-800/80 pt-2">
          {viralCaption}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyText(promoLink, 'link')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-3.5 py-2 text-xs font-bold text-white transition-colors"
        >
          {copiedMode === 'link' ? <Check size={14} /> : <Copy size={14} />}
          <span>{copiedMode === 'link' ? 'Link Copied!' : 'Copy Tracked Link'}</span>
        </button>

        <button
          type="button"
          onClick={() => void copyText(viralCaption, 'caption')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-200 transition-colors"
        >
          {copiedMode === 'caption' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span>{copiedMode === 'caption' ? 'Caption Copied!' : 'Copy Caption + Link'}</span>
        </button>

        <a
          href={`https://wa.me/?text=${encodeURIComponent(viralCaption)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-3.5 py-2 text-xs font-bold text-emerald-300 transition-colors"
        >
          <Share2 size={14} />
          <span>Post to WhatsApp</span>
        </a>
      </div>
    </section>
  );
};

export default CreatorPromoLinkCard;
