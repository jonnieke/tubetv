import React, { useState } from 'react';
import { Lock, Play, Sparkles, X } from 'lucide-react';
import type { Video } from '../types';
import { publicMediaUrl } from '../lib/mediaUrl';

interface ContinueBingeBarProps {
  video: Video;
  nextVideo?: Video;
  progressFraction?: number;
  isNextLocked?: boolean;
  upgradeWeeklyLabel?: string;
  onUpgradeWeekly?: () => void;
  language: string;
  onResume: (target: Video) => void;
}

export const ContinueBingeBar: React.FC<ContinueBingeBarProps> = ({
  video,
  nextVideo,
  progressFraction = 0,
  isNextLocked = false,
  upgradeWeeklyLabel,
  onUpgradeWeekly,
  language,
  onResume,
}) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const almostDone = progressFraction >= 0.88 && Boolean(nextVideo);
  const target = almostDone && nextVideo ? nextVideo : video;
  const seriesName = target.seriesTitle || target.title;
  const epNum = target.episode || 1;
  const poster = publicMediaUrl(target.seriesPosterUrl) || publicMediaUrl(target.thumbnail);
  const pct = Math.min(100, Math.max(8, Math.round(progressFraction * 100)));

  return (
    <aside
      aria-label="Continue bingeing"
      className="mx-[3.3%] my-3 rounded-2xl border border-rose-500/30 bg-gradient-to-r from-zinc-900/95 via-zinc-950/95 to-rose-950/35 p-2.5 sm:p-3 shadow-xl backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onResume(target)}
          className="relative h-14 w-10 sm:h-16 sm:w-11 shrink-0 overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-900"
        >
          {poster ? (
            <img src={poster} alt={seriesName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-500">
              <Play size={14} />
            </div>
          )}
          <span className="absolute bottom-0 inset-x-0 h-1 bg-zinc-800">
            <span className="block h-full bg-red-500" style={{ width: `${almostDone ? 100 : pct}%` }} />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
            {almostDone
              ? language === 'sw'
                ? 'Kipindi Kinachofuata Tayari'
                : 'Up Next in Your Binge'
              : language === 'sw'
                ? 'Endelea Kutazama'
                : 'Continue Bingeing'}
          </p>
          <p className="text-xs sm:text-sm font-black text-white truncate">
            {seriesName} · Ep {epNum}
          </p>
          <p className="text-[11px] text-zinc-400 truncate">
            {almostDone
              ? language === 'sw'
                ? `Gusa kuendelea na Kipindi ${epNum}`
                : `Jump straight into Episode ${epNum}`
              : language === 'sw'
                ? `Umefika ${pct}% · Gusa kuendelea`
                : `${pct}% watched · Tap to pick up right where you left off`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {upgradeWeeklyLabel && onUpgradeWeekly && (
            <button
              type="button"
              onClick={onUpgradeWeekly}
              className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-2 text-[11px] font-extrabold text-amber-200 transition cursor-pointer"
            >
              <Sparkles size={12} className="text-amber-400" />
              <span>{upgradeWeeklyLabel}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onResume(target)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg shadow-red-950/50 active:scale-95 transition"
          >
            {almostDone && isNextLocked ? (
              <Lock size={13} />
            ) : (
              <Play size={13} fill="currentColor" />
            )}
            <span>
              {almostDone
                ? language === 'sw'
                  ? `Ep ${epNum}`
                  : `Ep ${epNum}`
                : language === 'sw'
                  ? 'Endelea'
                  : 'Resume'}
            </span>
          </button>
        </div>

        <button
          type="button"
          aria-label="Dismiss resume bar"
          onClick={() => setDismissed(true)}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition"
        >
          <X size={14} />
        </button>
      </div>
      {upgradeWeeklyLabel && onUpgradeWeekly && (
        <button
          type="button"
          onClick={onUpgradeWeekly}
          className="sm:hidden mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/45 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-[11px] font-extrabold text-amber-200 transition cursor-pointer"
        >
          <Sparkles size={12} className="text-amber-400" />
          <span>{upgradeWeeklyLabel}</span>
        </button>
      )}
    </aside>
  );
};

export default ContinueBingeBar;
