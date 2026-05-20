import React, { useMemo } from 'react';
import { Trophy, Eye, Play } from 'lucide-react';
import { Video } from '../types';

interface Props {
  videos: Video[];
  onCreatorClick: (name: string) => void;
}

interface CreatorStat {
  name: string;
  totalViews: number;
  videoCount: number;
}

const MEDAL_RING = [
  'ring-2 ring-yellow-400',
  'ring-2 ring-zinc-400',
  'ring-2 ring-amber-600',
];
const MEDAL_LABEL = [
  { bg: 'bg-yellow-400', text: 'text-zinc-900', icon: '🥇' },
  { bg: 'bg-zinc-400',   text: 'text-zinc-900', icon: '🥈' },
  { bg: 'bg-amber-600',  text: 'text-white',     icon: '🥉' },
];

const AVATAR_COLORS = [
  'bg-red-600', 'bg-blue-600', 'bg-emerald-600',
  'bg-purple-600', 'bg-amber-600', 'bg-teal-600',
  'bg-rose-600', 'bg-indigo-600',
];

const avatarColor = (name: string) =>
  AVATAR_COLORS[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const initials = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();

const formatViews = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : String(n);

const CreatorLeaderboard: React.FC<Props> = ({ videos, onCreatorClick }) => {
  const creators = useMemo<CreatorStat[]>(() => {
    const map = new Map<string, { views: number; count: number }>();
    videos.forEach(v => {
      if (!v.author || v.author === 'Tube Creator') return;
      const entry = map.get(v.author) ?? { views: 0, count: 0 };
      entry.views += v.views ?? 0;
      entry.count++;
      map.set(v.author, entry);
    });
    return Array.from(map.entries())
      .map(([name, s]) => ({ name, totalViews: s.views, videoCount: s.count }))
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 10);
  }, [videos]);

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20 flex-shrink-0">
          <Trophy className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Top Creators</h2>
          <p className="text-zinc-500 text-xs mt-0.5">Kenya's most-watched channels on Tube TV</p>
        </div>
      </div>

      {creators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
          <Trophy className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No creator data yet</p>
          <p className="text-zinc-600 text-xs mt-1">Upload videos with author names to appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {creators.map((creator, i) => (
            <button
              key={creator.name}
              onClick={() => onCreatorClick(creator.name)}
              className="group relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80 transition-all duration-200 text-left cursor-pointer"
            >
              {/* Medal badge — top 3 only */}
              {i < 3 && (
                <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black z-10 ${MEDAL_LABEL[i].bg} ${MEDAL_LABEL[i].text}`}>
                  {i + 1}
                </span>
              )}

              {/* Rank number — 4th+ */}
              {i >= 3 && (
                <span className="absolute top-2.5 right-3 text-[11px] font-bold text-zinc-600">
                  #{i + 1}
                </span>
              )}

              {/* Avatar */}
              <div className={`w-14 h-14 rounded-2xl ${avatarColor(creator.name)} ${i < 3 ? MEDAL_RING[i] : ''} flex items-center justify-center text-white text-lg font-black flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                {initials(creator.name)}
              </div>

              {/* Name */}
              <p className="w-full text-center text-white font-bold text-[13px] leading-tight line-clamp-2 mt-0.5">
                {creator.name}
              </p>

              {/* Stats */}
              <div className="flex flex-col items-center gap-0.5 w-full">
                <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                  <Eye size={9} className="flex-shrink-0" />
                  {formatViews(creator.totalViews)}
                </span>
                <span className="text-zinc-600 text-[10px] flex items-center gap-1">
                  <Play size={8} fill="currentColor" className="flex-shrink-0" />
                  {creator.videoCount} video{creator.videoCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Medal emoji below card for top 3 */}
              {i < 3 && (
                <span className="text-base leading-none mt-0.5">{MEDAL_LABEL[i].icon}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatorLeaderboard;
