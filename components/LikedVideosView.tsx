
import React from 'react';
import { ThumbsUp, Heart } from 'lucide-react';
import { Video } from '../types';
import { getLikedIds } from '../lib/videoRatings';
import VideoCard from './VideoCard';

interface Props {
  videos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onCreatorClick?: (name: string) => void;
}

const LikedVideosView: React.FC<Props> = ({ videos, watchLaterIds, onToggleWatchLater, onCreatorClick }) => {
  const likedIds = getLikedIds();
  const likedVideos = likedIds
    .map(id => videos.find(v => v.id === id))
    .filter((v): v is Video => !!v);

  return (
    <div className="pb-24 px-4 md:px-8 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-green-600/30 to-emerald-600/20 rounded-2xl flex items-center justify-center border border-green-500/20 flex-shrink-0">
          <ThumbsUp className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Liked Videos</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {likedVideos.length} {likedVideos.length === 1 ? 'video' : 'videos'} you liked
          </p>
        </div>
      </div>

      {likedVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-zinc-800 rounded-2xl">
          <Heart className="w-12 h-12 text-zinc-700 mb-4" />
          <p className="text-zinc-400 text-base font-bold">No liked videos yet</p>
          <p className="text-zinc-600 text-sm mt-1 max-w-xs">
            Tap 👍 on any video to save it here. Your likes help us recommend better content.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {likedVideos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={onToggleWatchLater}
              isAuthenticated={true}
              onCreatorClick={onCreatorClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LikedVideosView;
