import React from 'react';
import type { Video, ShortVideo, ViewStateOrString } from '../../types';
import { ViewState } from '../../types';
import LandingHero from '../LandingHero';
import SeriesCarousel from '../SeriesCarousel';
import VideoCarousel from '../VideoCarousel';
import ShortsShelf from '../ShortsShelf';
import ViewerWelcome from '../ViewerWelcome';
import MicroDramaComingSoon from '../MicroDramaComingSoon';
import { isMicroDrama, seriesKey } from '../../lib/series';

interface HomeViewProps {
  videos: Video[];
  realShorts: ShortVideo[];
  isRealContent: boolean;
  isLoadingVideos: boolean;
  watchLaterIds: string[];
  heroIndex: number;
  recommendations: {
    continueWatching: Video[];
    forYou: Video[];
  };
  isAuthenticated: boolean;
  onSetHeroIndex: (index: number) => void;
  onPlayVideo: (video: Video) => void;
  onToggleWatchLater: (id: string) => void;
  onNavigate: (view: ViewStateOrString, subCategory?: string) => void;
}

export default function HomeView({
  videos,
  realShorts,
  isRealContent,
  isLoadingVideos,
  watchLaterIds,
  heroIndex,
  recommendations,
  isAuthenticated,
  onSetHeroIndex,
  onPlayVideo,
  onToggleWatchLater,
  onNavigate,
}: HomeViewProps) {
  // Hero: Prioritize micro drama openers, then most-viewed videos
  const dramaOpeners = videos.filter((video) => isMicroDrama(video) && (video.episode || 1) === 1);
  const featuredVideos = [...(dramaOpeners.length ? dramaOpeners : videos)]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);
  const hero = featuredVideos[heroIndex % featuredVideos.length];

  const microDramaEpisodes = videos.filter(isMicroDrama);

  return (
    <div className="space-y-6">
      {/* Featured Spotlight Hero */}
      {hero && (
        <LandingHero
          video={hero}
          real={isRealContent}
          saved={watchLaterIds.includes(hero.id)}
          onPlay={() => onPlayVideo(hero)}
          onSave={() => onToggleWatchLater(hero.id)}
          count={featuredVideos.length}
          index={heroIndex % featuredVideos.length}
          onSelect={onSetHeroIndex}
        />
      )}

      {/* Micro Dramas Shelf Leads Discovery */}
      {!isLoadingVideos && microDramaEpisodes.length === 0 && (
        <MicroDramaComingSoon compact onExplore={() => onNavigate(ViewState.MICRO_DRAMAS)} />
      )}
      {!isLoadingVideos && microDramaEpisodes.length > 0 && (
        <SeriesCarousel
          title="Micro Dramas · Small episodes. Big stories."
          videos={microDramaEpisodes}
          watchLaterIds={watchLaterIds}
          onToggleWatchLater={onToggleWatchLater}
          isAuthenticated={isAuthenticated}
          onPlay={onPlayVideo}
        />
      )}

      {/* Continue Watching Section */}
      {recommendations.continueWatching.length > 0 && (
        <VideoCarousel
          title="Continue watching"
          videos={recommendations.continueWatching}
          watchLaterIds={watchLaterIds}
          onToggleWatchLater={onToggleWatchLater}
          isAuthenticated={isAuthenticated}
        />
      )}

      {/* Picked For You */}
      {recommendations.forYou.length > 0 && (
        <VideoCarousel
          title="Picked for you"
          videos={recommendations.forYou}
          watchLaterIds={watchLaterIds}
          onToggleWatchLater={onToggleWatchLater}
          isAuthenticated={isAuthenticated}
        />
      )}

      {/* Vertical Shorts Shelf */}
      {realShorts.length > 0 && (
        <ShortsShelf
          shorts={realShorts}
          onShortClick={() => onNavigate(ViewState.SHORTS)}
        />
      )}

      {/* Trending Now */}
      <VideoCarousel
        key="Trending"
        title="Trending Now"
        videos={[...videos].sort((a, b) => b.views - a.views).slice(0, 20)}
        watchLaterIds={watchLaterIds}
        onToggleWatchLater={onToggleWatchLater}
        isAuthenticated={isAuthenticated}
      />

      {/* Standard Series Carousel */}
      {videos.some((v) => (v.category === 'Series' || (v.category === 'Originals' && Boolean(seriesKey(v)))) && !isMicroDrama(v)) && (
        <SeriesCarousel
          onPlay={onPlayVideo}
          videos={videos.filter((v) => (v.category === 'Series' || (v.category === 'Originals' && Boolean(seriesKey(v)))) && !isMicroDrama(v))}
          watchLaterIds={watchLaterIds}
          onToggleWatchLater={onToggleWatchLater}
          isAuthenticated={isAuthenticated}
        />
      )}

      {/* Curated Category Carousels */}
      {['Movies', 'School Flix', 'Music', 'Documentary', 'Farmers', 'Education', 'Faith', 'Kids', 'Diaspora'].map((cat) => {
        const catVideos = videos.filter((v) => v.category === cat || (cat === 'Movies' && v.category === 'Originals'));
        const label = cat === 'Movies' ? 'Kenyan Movies' : cat;
        return (
          <VideoCarousel
            key={cat}
            title={label}
            videos={catVideos}
            watchLaterIds={watchLaterIds}
            onToggleWatchLater={onToggleWatchLater}
            isAuthenticated={isAuthenticated}
          />
        );
      })}

      {/* Welcoming Card for New Viewers */}
      <ViewerWelcome navigate={onNavigate} />
    </div>
  );
}
