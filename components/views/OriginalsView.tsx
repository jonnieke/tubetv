import React from 'react';
import type { Video, ViewStateOrString } from '../../types';
import { ViewState } from '../../types';
import VideoCard from '../VideoCard';
import VideoCarousel from '../VideoCarousel';
import SeriesCarousel from '../SeriesCarousel';
import MicroDramaComingSoon from '../MicroDramaComingSoon';
import { isMicroDrama } from '../../lib/series';

interface OriginalsViewProps {
  activeSubCategory: string;
  filteredVideos: Video[];
  allVideos: Video[];
  watchLaterIds: string[];
  isAuthenticated: boolean;
  onPlayVideo: (video: Video) => void;
  onToggleWatchLater: (id: string) => void;
  onNavigate: (view: ViewStateOrString, subCategory?: string) => void;
}

export default function OriginalsView({
  activeSubCategory,
  filteredVideos,
  allVideos,
  watchLaterIds,
  isAuthenticated,
  onPlayVideo,
  onToggleWatchLater,
  onNavigate,
}: OriginalsViewProps) {
  const microDramas = allVideos.filter(isMicroDrama);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {activeSubCategory === 'All' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => (
            <div key={video.id}>
              <VideoCard
                video={video}
                isWatchLater={watchLaterIds.includes(video.id)}
                onToggleWatchLater={onToggleWatchLater}
              />
            </div>
          ))}
        </div>
      ) : activeSubCategory === 'Micro Dramas' ? (
        microDramas.length > 0 ? (
          <SeriesCarousel
            title="Micro Dramas"
            videos={microDramas}
            watchLaterIds={watchLaterIds}
            onToggleWatchLater={onToggleWatchLater}
            isAuthenticated={isAuthenticated}
            onPlay={onPlayVideo}
          />
        ) : (
          <MicroDramaComingSoon
            onMovies={() => onNavigate(ViewState.ORIGINALS, 'Movies')}
            onSeries={() => onNavigate(ViewState.ORIGINALS, 'Series')}
          />
        )
      ) : activeSubCategory === 'Series' ? (
        filteredVideos.length > 0 && (
          <SeriesCarousel
            title="All Series"
            videos={filteredVideos}
            watchLaterIds={watchLaterIds}
            onToggleWatchLater={onToggleWatchLater}
            onPlay={onPlayVideo}
          />
        )
      ) : (
        <>
          {filteredVideos.length > 0 && (
            <VideoCarousel
              title="All Movies"
              videos={filteredVideos}
              watchLaterIds={watchLaterIds}
              onToggleWatchLater={onToggleWatchLater}
              isAuthenticated={isAuthenticated}
            />
          )}

          {/* Genre specific movie carousels */}
          {['Swahili', 'Drama', 'Comedy', 'Documentary', 'Action'].map((genre) => {
            const genreVideos = filteredVideos.filter(
              (v) => v.genre?.includes(genre) || v.tags?.includes(genre)
            );
            if (genreVideos.length === 0) return null;
            return (
              <VideoCarousel
                key={genre}
                title={`${genre} Movies`}
                videos={genreVideos}
                watchLaterIds={watchLaterIds}
                onToggleWatchLater={onToggleWatchLater}
                isAuthenticated={isAuthenticated}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
