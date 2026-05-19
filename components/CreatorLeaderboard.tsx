import React, { useMemo } from 'react';
import { Trophy, Play, Eye, ChevronRight } from 'lucide-react';
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

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_BG = [
  'bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/40',
  'bg-zinc-500/10 border-zinc-500/20 hover:border-zinc-500/40',
  'bg-amber-700/10 border-amber-700/20 hover:border-amber-700/40',
];
const MEDAL_TEXT = ['text-yellow-400', 'text-zinc-300', 'text-amber-500'];

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
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20 flex-shrink-0">
          <Trophy className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Top Creators</h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            Kenya's most-watched channels on Tube TV
          </p>
        </div>
      </div>

      {creators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
          <Trophy className="w-10 h-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm font-medium">No creator data yet</p>
          <p className="text-zinc-600 text-xs mt-1">
            Upload videos with author names to appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {creators.map((creator, i) => (
            <div
              key={creator.name}
              onClick={() => onCreatorClick(creator.name)}
              className={`flex items-center gap-4 p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 hover:scale-[1.01] ${
                i < 3
                  ? MEDAL_BG[i]
                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-600'
              }`}
            >
              {/* Rank */}
              <div className={`w-8 text-center font-black text-base flex-shrink-0 ${i < 3 ? MEDAL_TEXT[i] : 'text-zinc-600'}`}>
                {i < 3 ? MEDAL[i] : i + 1}
              </div>

              {/* Avatar */}
              <div className={`w-10 h-10 rounded-xl ${avatarColor(creator.name)} flex items-center justify-center text-white text-sm font-black flex-shrink-0`}>
                {initials(creator.name)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{creator.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-zinc-500 text-[11px] flex items-center gap-1">
                    <Eye size={10} /> {formatViews(creator.totalViews)} views
                  </span>
                  <span className="text-zinc-700 text-[10px]">·</span>
                  <span className="text-zinc-500 text-[11px] flex items-center gap-1">
                    <Play size={10} fill="currentColor" /> {creator.videoCount} videos
                  </span>
                </div>
              </div>

              <ChevronRight size={14} className="text-zinc-700 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatorLeaderboard;
