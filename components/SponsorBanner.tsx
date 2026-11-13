import React from 'react';
import { ExternalLink } from 'lucide-react';
import { getActiveSponsor } from '../lib/sponsors';

interface Props {
  hasActivePass: boolean;
}

/** Lightweight, non-intrusive sponsorship banner shown only to free-tier viewers when configured. */
export default function SponsorBanner({ hasActivePass }: Props) {
  if (hasActivePass) return null;
  const sponsor = getActiveSponsor();
  if (!sponsor) return null;

  return (
    <aside
      aria-label="Series sponsor"
      className="mx-[3.3%] my-3 rounded-xl border border-amber-500/25 bg-gradient-to-r from-zinc-900/90 via-zinc-900/80 to-amber-950/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="shrink-0 rounded bg-amber-500/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
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
