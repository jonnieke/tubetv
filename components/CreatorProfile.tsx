import React, { useState, useMemo } from 'react';
import { ArrowLeft, Bell, BellOff, Play, Eye, Heart } from 'lucide-react';
import { Video } from '../types';
import VideoCard from './VideoCard';
import TipJarModal from './TipJarModal';

const CREATOR_SUBS_KEY = 'tube_creator_subscriptions';

interface Props {
  name: string;
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onSubscribeRequest: () => void;
  onBack: () => void;
  onCreatorClick: (name: string) => void;
}

const avatarColor = (name: string) =>
  ['bg-red-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-amber-600', 'bg-teal-600'][
    name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 6
  ];

const initials = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();

const formatViews = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : String(n);

const CreatorProfile: React.FC<Props> = ({
  name, videos, watchLaterIds, onToggleWatchLater, onSubscribeRequest, onBack, onCreatorClick,
}) => {
  const creatorVideos = useMemo(
    () => videos.filter(v => v.author === name).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)),
    [videos, name],
  );
  const totalViews = useMemo(
    () => creatorVideos.reduce((sum, v) => sum + (v.views ?? 0), 0),
    [creatorVideos],
  );

  const [subscribed, setSubscribed] = useState<boolean>(() => {
    try {
      const subs: string[] = JSON.parse(localStorage.getItem(CREATOR_SUBS_KEY) || '[]');
      return subs.includes(name);
    } catch { return false; }
  });
  const [showTip, setShowTip] = useState(false);

  const toggleSubscribe = () => {
    setSubscribed(prev => {
      const next = !prev;
      try {
        const subs: string[] = JSON.parse(localStorage.getItem(CREATOR_SUBS_KEY) || '[]');
        const updated = next ? [...subs, name] : subs.filter(n2 => n2 !== name);
        localStorage.setItem(CREATOR_SUBS_KEY, JSON.stringify(updated));
      } catch {}
      return next;
    });
  };

  return (
    <div className="animate-in fade-in duration-300">
      {showTip && <TipJarModal creatorName={name} onClose={() => setShowTip(false)} />}

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-zinc-500 hover:text-white text-sm font-semibold mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Hero card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className={`w-20 h-20 rounded-2xl ${avatarColor(name)} flex items-center justify-center text-white text-2xl font-black flex-shrink-0 shadow-lg`}>
          {initials(name)}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-white leading-tight">{name}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <span className="text-zinc-500 text-sm flex items-center gap-1.5">
              <Play size={12} fill="currentColor" /> {creatorVideos.length} videos
            </span>
            <span className="text-zinc-500 text-sm flex items-center gap-1.5">
              <Eye size={12} /> {formatViews(totalViews)} views
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={toggleSubscribe}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
              subscribed
                ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                : 'bg-red-600 text-white border-red-600 hover:bg-red-500 shadow shadow-red-900/30'
            }`}
          >
            {subscribed ? <><BellOff size={14} /> Following</> : <><Bell size={14} /> Follow</>}
          </button>
          <button
            onClick={() => setShowTip(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 transition-all"
          >
            <Heart size={14} /> Tip via M-Pesa
          </button>
        </div>
      </div>

      {/* Video grid */}
      {creatorVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
          <Play className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No videos from this creator yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {creatorVideos.map(v => (
            <div id={`video-${v.id}`} key={v.id}>
              <VideoCard
                video={v}
                isWatchLater={watchLaterIds.includes(v.id)}
                onToggleWatchLater={onToggleWatchLater}
                isSubscribed={true}
                onSubscribeRequest={onSubscribeRequest}
                onCreatorClick={onCreatorClick}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatorProfile;
