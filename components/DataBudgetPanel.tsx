import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Zap, AlertTriangle, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { getDailyUsage, getBudgetMb, setBudgetMb, getUsagePercent, DailyUsage } from '../lib/dataTracker';
import { applyQualityMode } from '../lib/networkQuality';

const BUDGETS = [
  { label: '200 MB', value: 200 },
  { label: '500 MB', value: 500 },
  { label: '1 GB',  value: 1024 },
  { label: 'Unlimited', value: 0 },
];

const fmtMb = (mb: number) =>
  mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;

const DataBudgetPanel: React.FC = () => {
  const [usage, setUsage]     = useState<DailyUsage>(getDailyUsage);
  const [budget, setBudget]   = useState<number>(getBudgetMb);
  const [pct, setPct]         = useState<number>(getUsagePercent);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(() => {
    setUsage(getDailyUsage());
    setBudget(getBudgetMb());
    setPct(getUsagePercent());
  }, []);

  // Refresh whenever user navigates back to this section
  useEffect(() => { refresh(); }, [refresh]);

  const handleBudget = (mb: number) => {
    setBudgetMb(mb);
    refresh();
    // Auto-switch to 360p when budget is tight
    if (mb > 0 && mb <= 200) applyQualityMode('360p');
  };

  const barColor =
    pct >= 90 ? 'bg-red-500' :
    pct >= 70 ? 'bg-amber-500' :
    'bg-green-500';

  const topGroups = [...usage.records]
    .reverse()
    .reduce<Record<string, { title: string; mb: number }>>((acc, r) => {
      if (!acc[r.videoId]) acc[r.videoId] = { title: r.title, mb: 0 };
      acc[r.videoId].mb = Math.round((acc[r.videoId].mb + r.mb) * 100) / 100;
      return acc;
    }, {});
  const topVideos = Object.values(topGroups).sort((a, b) => b.mb - a.mb).slice(0, 5);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden mb-6">

      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/20 flex-shrink-0">
          <BarChart2 className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm">Data Usage Today</p>
          <p className="text-zinc-500 text-xs mt-0.5">{usage.date}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white font-black text-lg tabular-nums">{fmtMb(usage.totalMb)}</p>
          {budget > 0 && (
            <p className="text-zinc-600 text-[10px]">of {fmtMb(budget)}</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {budget > 0 && (
        <div className="px-5 pb-3">
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct >= 80 && (
            <div className="flex items-center gap-1.5 mt-2">
              <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />
              <p className="text-amber-400 text-[11px] font-semibold">
                {pct >= 90 ? 'Almost at your limit — switching to 360p' : 'Approaching data limit'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Budget selector */}
      <div className="px-5 pb-4 border-t border-zinc-800/60 pt-3">
        <p className="text-zinc-500 text-[11px] font-black tracking-wider mb-2">DAILY BUDGET</p>
        <div className="flex gap-2 flex-wrap">
          {BUDGETS.map(b => (
            <button
              key={b.value}
              onClick={() => handleBudget(b.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                budget === b.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow shadow-blue-900/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-blue-500/50 hover:text-blue-300'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-5 pb-4 flex gap-2">
        <button
          onClick={() => applyQualityMode('360p')}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
        >
          <WifiOff size={11} /> Data Saver
        </button>
        <button
          onClick={() => applyQualityMode('hd')}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
        >
          <Wifi size={11} /> HD Mode
        </button>
        <button
          onClick={() => applyQualityMode('auto')}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
        >
          <Zap size={11} /> Auto
        </button>
      </div>

      {/* Usage breakdown toggle */}
      {topVideos.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between px-5 py-2.5 border-t border-zinc-800/60 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
          >
            <span>Today's breakdown ({topVideos.length} videos)</span>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {expanded && (
            <div className="px-5 pb-4 space-y-2">
              {topVideos.map(v => (
                <div key={v.title} className="flex items-center justify-between">
                  <p className="text-zinc-400 text-xs truncate flex-1 mr-3">{v.title}</p>
                  <p className="text-zinc-600 text-xs flex-shrink-0 tabular-nums">{fmtMb(v.mb)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DataBudgetPanel;
