import React, { useState, useMemo } from 'react';
import { Heart, Play, Bell, BellOff, X, Users } from 'lucide-react';
import { Video } from '../types';
import VideoCard from './VideoCard';
import VideoCarousel from './VideoCarousel';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onSubscribeRequest: () => void;
}

interface Church {
  name: string;
  videoCount: number;
  thumbnail: string;
  latestTitle: string;
  videos: Video[];
}

const SUBS_KEY = 'tube_church_subscriptions';

const ChurchHub: React.FC<Props> = ({ videos, watchLaterIds, onToggleWatchLater, onSubscribeRequest }) => {
  const { language } = useLanguage();
  const sw = language === 'sw';

  const [subscribed, setSubscribed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(SUBS_KEY) || '[]'); } catch { return []; }
  });
  const [selectedChurch, setSelectedChurch] = useState<string | null>(null);

  const churches = useMemo<Church[]>(() => {
    const map = new Map<string, Video[]>();
    videos.forEach(v => {
      const name = v.author && v.author !== 'Tube Creator' ? v.author : null;
      if (!name) return;
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(v);
    });
    return Array.from(map.entries())
      .map(([name, vids]) => ({
        name,
        videoCount: vids.length,
        thumbnail: vids[0].thumbnail,
        latestTitle: vids[0].title,
        videos: vids,
      }))
      .sort((a, b) => b.videoCount - a.videoCount);
  }, [videos]);

  const toggleSubscribe = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubscribed(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
      try { localStorage.setItem(SUBS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const selectedData = churches.find(c => c.name === selectedChurch);
  const subscribedVideos = videos.filter(v => subscribed.includes(v.author));

  return (
    <div className="mb-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center border border-amber-500/20 flex-shrink-0">
          <Heart className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">
            {sw ? 'Kituo cha Kanisa' : 'Church Hub'}
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            {churches.length} {sw ? 'makanisa' : 'churches'} · {sw ? 'Fuata kwa masasisho' : 'Follow for updates'}
          </p>
        </div>
      </div>

      {/* My churches carousel */}
      {subscribedVideos.length > 0 && (
        <VideoCarousel
          title={sw ? 'Makanisa Yangu' : 'My Churches'}
          subtitle={sw ? 'Ya hivi karibuni kutoka makanisa unayofuata' : 'Latest from churches you follow'}
          accentColor="from-amber-500 to-yellow-500"
          videos={subscribedVideos}
          watchLaterIds={watchLaterIds}
          onToggleWatchLater={onToggleWatchLater}
          isAuthenticated={true}
        />
      )}

      {/* Selected church drill-down */}
      {selectedData && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setSelectedChurch(null)}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
            <div>
              <h3 className="text-lg font-black text-white leading-tight">{selectedData.name}</h3>
              <p className="text-zinc-500 text-xs">{selectedData.videoCount} {sw ? 'video' : 'videos'}</p>
            </div>
            <button
              onClick={e => toggleSubscribe(selectedData.name, e)}
              className={`ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                subscribed.includes(selectedData.name)
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-amber-600/20 hover:text-amber-400 hover:border-amber-500/30'
              }`}
            >
              {subscribed.includes(selectedData.name)
                ? <><BellOff size={12} /> {sw ? 'Unafuata' : 'Following'}</>
                : <><Bell size={12} /> {sw ? 'Fuata' : 'Follow'}</>}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {selectedData.videos.map(v => (
              <div id={`video-${v.id}`} key={v.id}>
                <VideoCard
                  video={v}
                  isWatchLater={watchLaterIds.includes(v.id)}
                  onToggleWatchLater={onToggleWatchLater}
                  isSubscribed={true}
                  onSubscribeRequest={onSubscribeRequest}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Church cards grid */}
      {churches.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {churches.map(church => {
            const isSubbed   = subscribed.includes(church.name);
            const isSelected = selectedChurch === church.name;
            return (
              <div
                key={church.name}
                onClick={() => setSelectedChurch(isSelected ? null : church.name)}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer border transition-all duration-200 hover:scale-[1.02] ${
                  isSelected
                    ? 'border-amber-500/50 shadow-lg shadow-amber-900/20'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative bg-zinc-900" style={{ aspectRatio: '16/9' }}>
                  <img
                    src={church.thumbnail}
                    alt={church.name}
                    className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity"
                    onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 text-zinc-400 text-[10px]">
                    <Play size={9} fill="currentColor" />
                    {church.videoCount}
                  </div>
                  {isSubbed && (
                    <div className="absolute top-2 right-2">
                      <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow">
                        <Bell size={9} className="text-white fill-white" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 bg-zinc-900">
                  <p className="text-white text-xs font-bold line-clamp-1 leading-tight">{church.name}</p>
                  <p className="text-zinc-600 text-[10px] mt-0.5 line-clamp-1">{church.latestTitle}</p>
                  <button
                    onClick={e => toggleSubscribe(church.name, e)}
                    className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                      isSubbed
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                        : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-amber-600/20 hover:text-amber-400 hover:border-amber-500/30'
                    }`}
                  >
                    {isSubbed
                      ? <><BellOff size={10} /> {sw ? 'Unafuata' : 'Following'}</>
                      : <><Bell size={10} /> {sw ? 'Fuata' : 'Follow'}</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
          <Users className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">
            {sw ? 'Hakuna makanisa yaliyopatikana bado' : 'No churches found yet'}
          </p>
          <p className="text-zinc-600 text-xs mt-1">
            {sw ? 'Video za imani zitaonekana hapa zikipakiwa na jina la mwandishi' : 'Faith videos will appear here once uploaded with author names'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ChurchHub;
