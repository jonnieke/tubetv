import React, { useEffect, useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { fetchActiveShowSponsorship, getActiveSponsor, type SponsorSlot } from '../lib/sponsors';

interface Props {
  hasActivePass: boolean;
  seriesKeys?: string[];
  className?: string;
}

/**
 * Lightweight, non-intrusive B2B sponsorship banner.
 * Supports per-show database sponsorships (including "Free Season Unlocked by [Brand]")
 * as well as global free-tier sponsorships.
 */
export default function SponsorBanner({ hasActivePass, seriesKeys, className }: Props) {
  const keysSignature = (seriesKeys || []).filter(Boolean).join('|');
  const [sponsor, setSponsor] = useState<SponsorSlot | null>(() => getActiveSponsor());

  useEffect(() => {
    let active = true;
    const keys = keysSignature ? keysSignature.split('|') : [];
    void fetchActiveShowSponsorship(keys).then((slot) => {
      if (active) setSponsor(slot);
    });
    return () => {
      active = false;
    };
  }, [keysSignature]);

  if (!sponsor) return null;
  // Hide global banners for paid subscribers, but always credit a brand funding a specific show
  if (hasActivePass && !sponsor.seriesKey) return null;

  return (
    <aside
      aria-label="Series sponsor"
      className={
        className ||
        'mx-[3.3%] my-3 rounded-xl border border-amber-500/25 bg-gradient-to-r from-zinc-900/90 via-zinc-900/80 to-amber-950/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3'
      }
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {sponsor.logoUrl && (
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name}
            className="h-6 w-6 rounded object-contain bg-white/10 p-0.5 shrink-0"
          />
        )}
        <span className="inline-flex items-center gap-1 shrink-0 rounded bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
          {sponsor.unlocksFreeViewing && <Sparkles size={10} />}
          {sponsor.badge}
        </span>
        <p className="text-xs text-zinc-200 truncate">
          <strong className="text-white font-bold">{sponsor.name}</strong>
          <span className="text-zinc-400"> · {sponsor.tagline}</span>
        </p>
      </div>
      <a
        href={sponsor.url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200 shrink-0"
      >
        <span>Learn more</span>
        <ExternalLink size={12} />
      </a>
    </aside>
  );
}
