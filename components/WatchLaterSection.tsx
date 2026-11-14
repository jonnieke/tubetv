import React, { useEffect, useState } from 'react';
import { Video } from '../types';
import VideoCard from './VideoCard';
import { Clock, Download, PlayCircle, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  clearAllOfflineVideos,
  getOfflineSavedVideos,
  removeOfflineVideo,
  type OfflineSavedVideo,
} from '../lib/offlineCache';

interface WatchLaterSectionProps {
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
}

const WatchLaterSection: React.FC<WatchLaterSectionProps> = ({ videos, watchLaterIds, onToggleWatchLater }) => {
  const { language, t } = useLanguage();
  const [offlineMap, setOfflineMap] = useState<Record<string, OfflineSavedVideo>>(() => getOfflineSavedVideos());
  const [activeFilter, setActiveFilter] = useState<'all' | 'offline'>('all');

  useEffect(() => {
    const syncOffline = () => setOfflineMap(getOfflineSavedVideos());
    window.addEventListener('tubetv:offline-updated', syncOffline);
    window.addEventListener('tubetv:pass-updated', syncOffline);
    return () => {
      window.removeEventListener('tubetv:offline-updated', syncOffline);
      window.removeEventListener('tubetv:pass-updated', syncOffline);
    };
  }, []);

  const offlineIds = Object.keys(offlineMap);
  const totalOfflineMb = Object.values(offlineMap).reduce((sum, item) => sum + (item.estimatedSizeMb || 4.2), 0);

  const watchList = videos.filter((v) =>
    activeFilter === 'offline' ? Boolean(offlineMap[v.id]) : watchLaterIds.includes(v.id) || Boolean(offlineMap[v.id]),
  );

  return (
    <div className="p-6 md:p-12 min-h-full pb-24">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-700 shadow-xl">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">{t('watchlist.title')}</h1>
            <p className="text-zinc-400">
              {language === 'sw'
                ? `${watchList.length} video zimehifadhiwa kwenye kifaa hiki`
                : `${watchList.length} ${watchList.length === 1 ? 'video' : 'videos'} saved on this device`}
              {offlineIds.length > 0 ? ` · ${offlineIds.length} cached offline (${totalOfflineMb.toFixed(1)} MB)` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              activeFilter === 'all'
                ? 'bg-zinc-800 border-zinc-600 text-white'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            All Saved ({new Set([...watchLaterIds, ...offlineIds]).size})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('offline')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              activeFilter === 'offline'
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Download size={13} />
            <span>Offline Commute ({offlineIds.length})</span>
          </button>
          {offlineIds.length > 0 && (
            <button
              type="button"
              onClick={() => void clearAllOfflineVideos()}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-900/50 transition-colors"
              title="Clear offline cached video segments"
            >
              <Trash2 size={13} />
              <span>Clear Offline</span>
            </button>
          )}
        </div>
      </header>

      {watchList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {watchList.map((video) => {
            const offlineEntry = offlineMap[video.id];
            return (
              <div key={video.id} className="space-y-1.5">
                <VideoCard
                  video={video}
                  isWatchLater={watchLaterIds.includes(video.id)}
                  onToggleWatchLater={onToggleWatchLater}
                  uniformAspect="video"
                />
                {offlineEntry && (
                  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Download size={11} />
                      Cached Offline · ~{offlineEntry.estimatedSizeMb} MB
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeOfflineVideo(video.id)}
                      className="text-zinc-400 hover:text-red-300 underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
            <PlayCircle className="w-12 h-12 text-zinc-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('watchlist.emptyTitle')}</h2>
          <p className="text-zinc-500 max-w-md">{t('watchlist.emptyBody')}</p>
        </div>
      )}
    </div>
  );
};

export default WatchLaterSection;
