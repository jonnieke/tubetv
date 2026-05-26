
import React, { useState, useEffect } from 'react';
import { ListVideo, X, Trash2, ChevronUp, ChevronDown, Play, Clock } from 'lucide-react';
import {
  QueueItem,
  getQueue,
  getQueueLength,
  removeFromQueue,
  clearQueue,
  moveUp,
  moveDown,
} from '../lib/videoQueue';
import { onThumbError } from '../lib/thumbnail';

interface Props {
  onPlayVideo: (id: string) => void;
}

const QueuePanel: React.FC<Props> = ({ onPlayVideo }) => {
  const [open, setOpen]   = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>(getQueue);
  const [count, setCount] = useState(getQueueLength);

  useEffect(() => {
    const handler = () => {
      setQueue(getQueue());
      setCount(getQueueLength());
    };
    window.addEventListener('tube-queue-changed', handler);
    return () => window.removeEventListener('tube-queue-changed', handler);
  }, []);

  return (
    <>
      {/* Floating queue button — only when there are queued videos */}
      {count > 0 && (
        <button
          onClick={() => setOpen(o => !o)}
          className="fixed bottom-20 md:bottom-4 right-4 z-[130] w-12 h-12 bg-zinc-900 border border-zinc-700 hover:border-red-500/50 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105"
          title={`Queue (${count})`}
        >
          <ListVideo size={18} className="text-zinc-300" />
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5">
            {count > 9 ? '9+' : count}
          </span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-[145] flex justify-end" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm bg-zinc-900 border-l border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ListVideo size={16} className="text-zinc-400" />
                <span className="text-white font-black">Up Next</span>
                <span className="text-zinc-600 text-xs">· {queue.length} video{queue.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                {queue.length > 0 && (
                  <button onClick={() => { clearQueue(); }} className="text-zinc-600 hover:text-red-400 transition-colors" title="Clear queue">
                    <Trash2 size={14} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-white transition-colors p-1">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full pb-16 text-center px-6">
                  <ListVideo className="w-12 h-12 text-zinc-700 mb-3" />
                  <p className="text-zinc-500 font-bold text-sm">Queue is empty</p>
                  <p className="text-zinc-700 text-xs mt-1">Tap ≡+ on any video to add it here. Videos auto-play in order.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {queue.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-zinc-800/40 transition-colors">
                      {/* Position */}
                      <span className="text-zinc-700 text-xs font-mono w-4 flex-shrink-0">{idx + 1}</span>

                      {/* Thumbnail */}
                      <div className="relative w-16 h-11 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                        {item.thumbnail && (
                          <img src={item.thumbnail} alt="" onError={onThumbError} className="w-full h-full object-cover" />
                        )}
                        <button
                          onClick={() => { onPlayVideo(item.id); setOpen(false); }}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Play size={14} className="text-white fill-white" />
                        </button>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-200 text-xs font-bold line-clamp-2 leading-tight">{item.title}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={9} className="text-zinc-600" />
                          <span className="text-zinc-600 text-[10px]">{item.duration}</span>
                        </div>
                      </div>

                      {/* Reorder + remove */}
                      <div className="flex flex-col items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveUp(item.id)} disabled={idx === 0} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors">
                          <ChevronUp size={12} />
                        </button>
                        <button onClick={() => moveDown(item.id)} disabled={idx === queue.length - 1} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors">
                          <ChevronDown size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromQueue(item.id)}
                        className="text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QueuePanel;
