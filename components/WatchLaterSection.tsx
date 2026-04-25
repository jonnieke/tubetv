import React from 'react';
import { Video } from '../types';
import VideoCard from './VideoCard';
import { Clock, PlayCircle } from 'lucide-react';

interface WatchLaterSectionProps {
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
}

const WatchLaterSection: React.FC<WatchLaterSectionProps> = ({ videos, watchLaterIds, onToggleWatchLater }) => {
  // Filter videos that are in the watch list
  const watchList = videos.filter(v => watchLaterIds.includes(v.id));

  return (
    <div className="p-6 md:p-12 h-screen overflow-y-auto pb-24">
      <header className="mb-8 flex items-center gap-4">
        <div className="w-16 h-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-700 shadow-xl">
            <Clock className="w-8 h-8 text-white" />
        </div>
        <div>
            <h1 className="text-3xl font-bold text-white mb-1">Watch List</h1>
            <p className="text-zinc-400">{watchList.length} videos • Updated today</p>
        </div>
      </header>

      {watchList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {watchList.map((video) => (
            <VideoCard 
                key={video.id} 
                video={video} 
                isWatchLater={true}
                onToggleWatchLater={onToggleWatchLater}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
             <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
                 <PlayCircle className="w-12 h-12 text-zinc-600" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">Your list is empty</h2>
             <p className="text-zinc-500 max-w-md">
                 Add movies and shows to your list so you can easily find them later.
             </p>
        </div>
      )}
    </div>
  );
};

export default WatchLaterSection;