
import React, { useState, useCallback } from 'react';
import { History, Trash2, CheckCircle, Clock, X } from 'lucide-react';
import { getHistory, clearHistory, removeFromHistory, HistoryRecord } from '../lib/watchHistory';

const bucket = (ts: number): string => {
  const now = Date.now();
  const diff = now - ts;
  const day = 86400000;
  if (diff < day) return 'Today';
  if (diff < day * 2) return 'Yesterday';
  if (diff < day * 7) return 'This Week';
  return 'Older';
};

const BUCKET_ORDER = ['Today', 'Yesterday', 'This Week', 'Older'];

const WatchHistoryView: React.FC = () => {
  const [records, setRecords] = useState<HistoryRecord[]>(getHistory);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleRemove = useCallback((videoId: string) => {
    removeFromHistory(videoId);
    setRecords(getHistory());
  }, []);

  const handleClearAll = useCallback(() => {
    clearHistory();
    setRecords([]);
    setShowClearConfirm(false);
  }, []);

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleString('en-KE', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });

  // Group by time bucket
  const groups: Record<string, HistoryRecord[]> = {};
  for (const rec of records) {
    const b = bucket(rec.watchedAt);
    if (!groups[b]) groups[b] = [];
    groups[b].push(rec);
  }

  return (
    <div className="pb-24 px-4 md:px-8 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center border border-amber-500/20 flex-shrink-0">
            <History className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Watch History</h2>
            <p className="text-zinc-500 text-xs mt-0.5">{records.length} video{records.length !== 1 ? 's' : ''} watched</p>
          </div>
        </div>

        {records.length > 0 && (
          <div className="flex items-center gap-2">
            {showClearConfirm ? (
              <>
                <span className="text-zinc-400 text-xs hidden sm:block">Clear all history?</span>
                <button
                  onClick={handleClearAll}
                  className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all"
                >
                  Yes, clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="p-1.5 text-zinc-600 hover:text-zinc-400 rounded-lg transition-colors"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-500/30 px-3 py-1.5 rounded-lg transition-all"
              >
                <Trash2 size={12} />
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-zinc-800 rounded-2xl">
          <History className="w-12 h-12 text-zinc-700 mb-4" />
          <p className="text-zinc-400 text-base font-bold">No watch history yet</p>
          <p className="text-zinc-600 text-sm mt-1 max-w-xs">
            Videos you watch will appear here so you can easily find them again.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {BUCKET_ORDER.filter(b => groups[b]?.length).map(b => (
            <div key={b}>
              <h3 className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-3">{b}</h3>
              <div className="space-y-2">
                {groups[b].map(rec => (
                  <div
                    key={`${rec.videoId}-${rec.watchedAt}`}
                    className="group flex items-center gap-3 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700 rounded-xl p-3 transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-28 sm:w-36 aspect-video flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
                      <img
                        src={rec.thumbnail}
                        alt={rec.title}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      {rec.completed && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <CheckCircle size={20} className="text-green-400" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/80 text-[9px] px-1 py-0.5 rounded text-zinc-300 font-medium">
                        {rec.duration}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm line-clamp-2 leading-snug">{rec.title}</p>
                      <p className="text-zinc-500 text-xs mt-0.5 truncate">{rec.author}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-zinc-600 text-[10px] flex items-center gap-1">
                          <Clock size={9} />{fmtDate(rec.watchedAt)}
                        </span>
                        {rec.completed ? (
                          <span className="text-[9px] font-black text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">COMPLETED</span>
                        ) : (
                          <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">IN PROGRESS</span>
                        )}
                      </div>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemove(rec.videoId)}
                      className="flex-shrink-0 p-2 text-zinc-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Remove from history"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchHistoryView;
