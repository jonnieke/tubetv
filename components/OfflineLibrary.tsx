import React, { useState, useCallback } from 'react';
import { Download, Trash2, WifiOff, Play, Clock } from 'lucide-react';
import { getOfflineSaves, removeOffline, OfflineSave } from '../lib/dataTracker';
import { onThumbError } from '../lib/thumbnail';

interface Props {
  onWatchVideo?: (id: string) => void;
}

const OfflineLibrary: React.FC<Props> = ({ onWatchVideo }) => {
  const [saves, setSaves] = useState<OfflineSave[]>(getOfflineSaves);

  const handleRemove = useCallback((id: string) => {
    removeOffline(id);
    setSaves(getOfflineSaves());
  }, []);

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/20 flex-shrink-0">
          <Download className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Offline Library</h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            {saves.length} {saves.length === 1 ? 'video' : 'videos'} saved · Watch without internet
          </p>
        </div>
      </div>

      {saves.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
          <WifiOff className="w-12 h-12 text-zinc-700 mb-4" />
          <p className="text-zinc-400 text-base font-bold">No offline videos yet</p>
          <p className="text-zinc-600 text-sm mt-1 max-w-xs">
            Tap the download icon on any video to save it for offline viewing — great for commutes on 2G/3G.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {saves.map(save => (
            <div
              key={save.id}
              className="group relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-200 hover:scale-[1.02]"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-zinc-800">
                <img
                  src={save.thumbnail}
                  alt={save.title}
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                  onError={onThumbError}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

                {/* Offline badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                  <Download size={8} /> SAVED
                </div>

                {/* Duration */}
                <div className="absolute bottom-2 right-2 bg-black/80 text-[10px] px-1.5 py-0.5 rounded text-white font-medium flex items-center gap-1">
                  <Clock size={8} />
                  {save.duration}
                </div>

                {/* Play overlay */}
                {onWatchVideo && (
                  <button
                    onClick={() => onWatchVideo(save.id)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30 hover:bg-white/30 transition-colors">
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="text-white font-bold text-sm line-clamp-2 leading-tight">{save.title}</h3>
                <p className="text-zinc-500 text-xs mt-1 truncate">{save.author}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-zinc-700 text-[10px]">Saved {fmtDate(save.savedAt)}</span>
                  <button
                    onClick={() => handleRemove(save.id)}
                    className="p-1.5 text-zinc-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Remove from offline"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OfflineLibrary;
