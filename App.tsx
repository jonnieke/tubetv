import React, { Suspense, lazy, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CinemaNavigation from './components/CinemaNavigation';
import LandingFooter from './components/LandingFooter';
import MicroDramaComingSoon from './components/MicroDramaComingSoon';
import BrowseIntro from './components/BrowseIntro';
import CatalogueEmptyState from './components/CatalogueEmptyState';
import SeriesCarousel from './components/SeriesCarousel';
import LegalPage from './components/LegalPage';
import HomeView from './components/views/HomeView';
import OriginalsView from './components/views/OriginalsView';
import { ViewState, Video } from './types';
import { Loader2, Home, PlayCircle, Clock, BarChart2 } from 'lucide-react';
import { PlaybackProvider } from './contexts/PlaybackContext';
import {
  DEFAULT_PLAYBACK_PREFERENCES,
  loadPreferences,
  loadProgress,
  loadWatchList,
  savePreferences,
  saveProgress,
  setWatchLater as persistWatchLater,
  type PlaybackPreferences,
  type WatchProgress,
} from './lib/viewerState';
import { setVideoMetadata, videoPath } from './lib/seo';
import { trackEvent } from './lib/analytics';
import { isMicroDrama, nextEpisode, seriesKey } from './lib/series';
import { filterDiscoveryVideos } from './lib/discovery';
import { recommendVideos } from './lib/recommendations';
import { shouldSaveData } from './lib/network';
import { useViewerAuth } from './hooks/useViewerAuth';
import { useCatalogue } from './hooks/useCatalogue';
import { useNavigationState } from './hooks/useNavigationState';

// Lazy-loaded feature views
const VideoCard = lazy(() => import('./components/VideoCard'));
const ShortsPlayer = lazy(() => import('./components/ShortsPlayer'));
const MicroDramaPlayer = lazy(() => import('./components/MicroDramaPlayer'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const UploadSection = lazy(() => import('./components/UploadSection'));
const WatchLaterSection = lazy(() => import('./components/WatchLaterSection'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const ViewerAuthModal = lazy(() => import('./components/ViewerAuthModal'));
const MovieDetails = lazy(() => import('./components/MovieDetails'));
const SettingsSection = lazy(() => import('./components/SettingsSection'));
const LiveSection = lazy(() => import('./components/LiveSection'));
const CreatorStudio = lazy(() => import('./components/CreatorStudio').then(m => ({ default: m.CreatorStudio })));
const ModerationQueue = lazy(() => import('./components/ModerationQueue').then(m => ({ default: m.ModerationQueue })));
import { PWAInstallBanner } from './components/PWAInstallBanner';

const LoadingPanel = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="min-h-[320px] w-full flex flex-col items-center justify-center text-zinc-500">
    <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-3" />
    <p className="text-sm font-medium">{label}</p>
  </div>
);

const App: React.FC = () => {
  // ─── 1. Custom Hooks ────────────────────────────────────────────────────────
  const {
    currentUser,
    isAuthenticated,
    isAdmin,
    userPhone,
    showLogin,
    setShowLogin,
    showViewerAuth,
    setShowViewerAuth,
    deviceConflictNotice,
    setDeviceConflictNotice,
    handleLogout,
    setCurrentUser,
    setIsAuthenticated,
  } = useViewerAuth();

  const {
    videos,
    realShorts,
    isLoadingVideos,
    isRealContent,
    catalogueError,
    loadVideos,
    handleUploadComplete,
  } = useCatalogue();

  const {
    currentView,
    setCurrentView,
    activeSubCategory,
    setActiveSubCategory,
    currentSubCategories,
    navItems,
    translatedNavItems,
    searchQuery,
    customCategory,
    handleNavigate,
    handleAddCategory,
    handleRemoveCategory,
    handleSearch,
    clearSearch,
  } = useNavigationState();

  // ─── 2. Viewer Playback & Progress State ─────────────────────────────────────
  const [preferences, setPreferences] = useState<PlaybackPreferences>(DEFAULT_PLAYBACK_PREFERENCES);
  const [watchProgress, setWatchProgress] = useState<Record<string, WatchProgress>>({});
  const [watchLater, setWatchLater] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tube_watch_later');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let cancelled = false;
    const userId = currentUser?.id;
    Promise.all([
      loadPreferences(userId),
      loadWatchList(userId),
      loadProgress(userId),
    ]).then(([nextPreferences, nextWatchLater, nextProgress]) => {
      if (cancelled) return;
      setPreferences(nextPreferences);
      setWatchLater(nextWatchLater);
      setWatchProgress(nextProgress);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const handleAuthReq = () => setShowViewerAuth(true);
    window.addEventListener('tubetv:require-auth', handleAuthReq);
    return () => window.removeEventListener('tubetv:require-auth', handleAuthReq);
  }, [setShowViewerAuth]);

  const handlePreferencesChange = useCallback((nextPreferences: PlaybackPreferences) => {
    setPreferences(nextPreferences);
    void savePreferences(currentUser?.id, nextPreferences);
  }, [currentUser?.id]);

  const handleWatchProgress = useCallback((videoId: string, progress: WatchProgress) => {
    setWatchProgress((current) => ({ ...current, [videoId]: progress }));
    void saveProgress(currentUser?.id, videoId, progress);
  }, [currentUser?.id]);

  const toggleWatchLater = useCallback((id: string) => {
    const shouldSave = !watchLater.includes(id);
    setWatchLater((current) => (shouldSave ? [...current, id] : current.filter((videoId) => videoId !== id)));
    void persistWatchLater(currentUser?.id, id, shouldSave);
  }, [watchLater, currentUser?.id]);

  // ─── 3. Video Player & Route Sync ───────────────────────────────────────────
  const [activeHeroVideo, setActiveHeroVideo] = useState<Video | null>(null);
  const [selectedMovieForDetails, setSelectedMovieForDetails] = useState<Video | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const playerDialogRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const openVideo = useCallback((video: Video) => {
    setSelectedMovieForDetails(null);
    window.history.pushState({}, '', videoPath(video.id));
    setActiveHeroVideo(video);
  }, []);

  const closeVideo = useCallback(() => {
    window.history.pushState({}, '', '/');
    setActiveHeroVideo(null);
  }, []);

  const handleVideoEnded = useCallback((videoId: string) => {
    if (!preferences.autoplay || shouldSaveData(preferences.dataSaver)) return;
    const nextVideo = nextEpisode(videos, videoId);
    if (nextVideo) {
      trackEvent('episode_next', { fromVideoId: videoId, toVideoId: nextVideo.id, automatic: true });
      openVideo(nextVideo);
    }
  }, [preferences.autoplay, preferences.dataSaver, videos, openVideo]);

  // Sync route on mount and popstate (supports both /watch/:id and ?watch=:id)
  useEffect(() => {
    const syncRoute = () => {
      const match = window.location.pathname.match(/^\/watch\/([^/]+)$/);
      let targetId: string | null = null;

      if (match) {
        targetId = decodeURIComponent(match[1]);
      } else {
        const queryParams = new URLSearchParams(window.location.search);
        const watchParam = queryParams.get('watch');
        if (watchParam) targetId = watchParam;
      }

      if (!targetId) {
        setActiveHeroVideo(null);
        return;
      }

      const video = videos.find((item) => item.id === targetId);
      if (video) {
        setActiveHeroVideo(video);
        if (window.location.pathname !== videoPath(video.id)) {
          window.history.replaceState({}, '', videoPath(video.id));
        }
      }
    };

    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [videos]);

  // Update dynamic document title & OG meta tags on player change
  useEffect(() => {
    setVideoMetadata(activeHeroVideo || undefined);
  }, [activeHeroVideo]);

  // Keyboard close for player
  useEffect(() => {
    if (!activeHeroVideo) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeVideo();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeHeroVideo, closeVideo]);

  // Reset scroll position on navigation change
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [currentView, activeSubCategory]);

  // Recommendations and Search Filtering
  const recommendations = useMemo(
    () => recommendVideos(videos, watchProgress, watchLater),
    [videos, watchProgress, watchLater]
  );

  const filteredVideos = useMemo(
    () => filterDiscoveryVideos(videos, currentView, activeSubCategory, searchQuery, customCategory),
    [videos, currentView, activeSubCategory, searchQuery, customCategory]
  );

  // ─── 4. View Switcher ───────────────────────────────────────────────────────
  const renderContent = () => {
    if (catalogueError) {
      return (
        <div role="alert" className="mx-auto max-w-lg p-12 text-center">
          <h1 className="font-serif text-3xl">Catalogue unavailable</h1>
          <p className="mt-4 text-zinc-400">{catalogueError}</p>
          <button className="cinema-primary mt-6" onClick={() => loadVideos()}>
            Try again
          </button>
        </div>
      );
    }

    switch (currentView) {
      case ViewState.SHORTS:
        if (isLoadingVideos) {
          return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-black">
              <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
              <p className="text-zinc-400 font-medium">Loading Shorts...</p>
            </div>
          );
        }
        return <ShortsPlayer shorts={realShorts} onExit={() => handleNavigate(ViewState.HOME)} />;

      case ViewState.LIVE:
        return <LiveSection videos={isRealContent ? videos : []} />;

      case ViewState.SETTINGS:
        return (
          <SettingsSection
            initialTab="general"
            currentUser={currentUser}
            userPhone={userPhone}
            onLogout={handleLogout}
            preferences={preferences}
            onPreferencesChange={handlePreferencesChange}
          />
        );

      case ViewState.UPLOAD:
        if (!isAuthenticated) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Sign in to access creator tools</h2>
              <button
                onClick={() => setShowLogin(true)}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-lg transition-colors"
              >
                Login
              </button>
            </div>
          );
        }
        if (!isAdmin) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Creator uploads are invite-only</h2>
              <p className="text-zinc-400 max-w-md">
                TubeTV is approving creators before opening uploads.
              </p>
            </div>
          );
        }
        return <UploadSection onUploadComplete={handleUploadComplete} creatorName={userPhone || 'Admin'} />;

      case ViewState.ANALYTICS:
        if (!isAuthenticated || !isAdmin) return null;
        return (
          <AnalyticsDashboard
            currentNavItems={navItems}
            onAddCategory={handleAddCategory}
            onRemoveCategory={handleRemoveCategory}
          />
        );

      case ViewState.ADMIN:
        if (!isAdmin) return null;
        return (
          <AdminDashboard
            onUploadComplete={handleUploadComplete}
            creatorName={userPhone || 'Admin'}
            currentNavItems={navItems}
            onAddCategory={handleAddCategory}
            onRemoveCategory={handleRemoveCategory}
          />
        );

      case ViewState.CREATOR_STUDIO:
        return <CreatorStudio onClose={() => handleNavigate(ViewState.HOME)} />;

      case ViewState.MODERATION:
        if (!isAdmin) return null;
        return <ModerationQueue />;

      case ViewState.WATCH_LATER:
        return (
          <WatchLaterSection
            videos={videos}
            watchLaterIds={watchLater}
            onToggleWatchLater={toggleWatchLater}
          />
        );

      // Default: Discover, Home, Micro Dramas, Originals, and Category Grids
      default:
        return (
          <div className={currentView === ViewState.HOME && !searchQuery ? 'catalogue-page landing-page p-4 md:p-8 pb-24' : 'catalogue-page p-4 md:p-8 pb-24'}>
            {(currentView !== ViewState.HOME || searchQuery) && (
              <BrowseIntro
                view={currentView}
                subcategory={activeSubCategory}
                customLabel={customCategory}
                search={searchQuery}
                resultCount={filteredVideos.length}
                loading={isLoadingVideos}
                onClearSearch={clearSearch}
              />
            )}

            {/* Sub-Category Filter Pills */}
            {!searchQuery && (
              <div className="flex gap-3 overflow-x-auto pb-4 mb-6 no-scrollbar sticky top-0 z-10 bg-zinc-950/90 backdrop-blur py-2 -mx-4 px-4 md:-mx-8 md:px-8">
                {currentSubCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveSubCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border border-transparent ${
                      activeSubCategory === cat
                        ? 'bg-white text-black'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* View Branches */}
            {currentView === ViewState.HOME && !searchQuery && activeSubCategory === 'Trending' ? (
              <HomeView
                videos={videos}
                realShorts={realShorts}
                isRealContent={isRealContent}
                isLoadingVideos={isLoadingVideos}
                watchLaterIds={watchLater}
                heroIndex={heroIndex}
                recommendations={recommendations}
                isAuthenticated={isAuthenticated}
                onSetHeroIndex={setHeroIndex}
                onPlayVideo={openVideo}
                onToggleWatchLater={toggleWatchLater}
                onNavigate={handleNavigate}
                onOpenMovieDetails={setSelectedMovieForDetails}
              />
            ) : currentView === ViewState.MICRO_DRAMAS && !searchQuery ? (
              videos.some(isMicroDrama) ? (
                <SeriesCarousel
                  title="Micro Dramas"
                  videos={videos.filter(isMicroDrama)}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  onPlay={openVideo}
                />
              ) : (
                <MicroDramaComingSoon
                  onMovies={() => handleNavigate(ViewState.ORIGINALS, 'Movies')}
                  onSeries={() => handleNavigate(ViewState.ORIGINALS, 'Series')}
                />
              )
            ) : currentView === ViewState.ORIGINALS && !searchQuery ? (
              <OriginalsView
                activeSubCategory={activeSubCategory}
                filteredVideos={filteredVideos}
                allVideos={videos}
                watchLaterIds={watchLater}
                isAuthenticated={isAuthenticated}
                onPlayVideo={openVideo}
                onToggleWatchLater={toggleWatchLater}
                onNavigate={handleNavigate}
                onOpenMovieDetails={setSelectedMovieForDetails}
              />
            ) : (
              // Standard Grid for Filtered or Category Results
              <>
                <div className="catalogue-section-heading">
                  <h2>
                    {searchQuery
                      ? 'Matching titles'
                      : activeSubCategory === 'All'
                      ? 'All titles'
                      : activeSubCategory}
                  </h2>
                  {!isRealContent && !isLoadingVideos && <span className="catalogue-demo-label">DEMO</span>}
                </div>

                {isLoadingVideos || (!isRealContent && videos.length === 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="bg-zinc-900 rounded-lg overflow-hidden animate-pulse">
                        <div className="aspect-video bg-zinc-800" />
                        <div className="p-3 space-y-2">
                          <div className="h-4 bg-zinc-800 rounded w-3/4" />
                          <div className="h-3 bg-zinc-800 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    {filteredVideos.map((video) => (
                      <div id={`video-${video.id}`} key={video.id}>
                        <VideoCard
                          video={video}
                          isWatchLater={watchLater.includes(video.id)}
                          onToggleWatchLater={toggleWatchLater}
                          onOpenDetails={setSelectedMovieForDetails}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Empty State */}
            {!isLoadingVideos && filteredVideos.length === 0 && (
              <CatalogueEmptyState
                search={searchQuery}
                subcategory={activeSubCategory}
                onClearSearch={clearSearch}
                onShowAll={() => setActiveSubCategory('All')}
                onBrowse={() => handleNavigate(ViewState.HOME)}
              />
            )}
          </div>
        );
    }
  };

  // Legal routes check
  const legalKind = window.location.pathname === '/privacy' ? 'privacy' : window.location.pathname === '/terms' ? 'terms' : null;
  if (legalKind) {
    return <LegalPage kind={legalKind} />;
  }

  return (
    <PlaybackProvider
      value={{
        preferences,
        getProgress: (videoId) => watchProgress[videoId],
        onEnded: handleVideoEnded,
        onProgress: handleWatchProgress,
        isAuthenticated,
        onRequireLogin: () => setShowViewerAuth(true),
        onOpenMovieDetails: (movie) => setSelectedMovieForDetails(movie),
      }}
    >
      <div className="flex h-screen bg-zinc-950 text-white font-sans selection:bg-red-500 selection:text-white">
        {/* Auth Modal */}
        {showLogin && !isAuthenticated && (
          <Suspense fallback={<LoadingPanel label="Opening login..." />}>
            <AuthModal
              onSuccess={(user) => {
                setCurrentUser(user);
                setIsAuthenticated(true);
                setShowLogin(false);
                setCurrentView(ViewState.HOME);
              }}
              onCancel={() => setShowLogin(false)}
            />
          </Suspense>
        )}

        {/* 1-Device Limit Conflict Alert */}
        {deviceConflictNotice && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-red-800 p-6 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 mx-auto mb-3">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">1 Device Limit Reached</h3>
              <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                {deviceConflictNotice}
              </p>
              <button
                type="button"
                onClick={() => setDeviceConflictNotice(null)}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        )}

        {/* Movie Details Modal */}
        {selectedMovieForDetails && (
          <Suspense fallback={null}>
            <MovieDetails
              movie={selectedMovieForDetails}
              allVideos={videos}
              watchLaterIds={watchLater}
              onToggleWatchLater={toggleWatchLater}
              onPlay={(movie) => {
                setSelectedMovieForDetails(null);
                openVideo(movie);
              }}
              onSelectMovie={(movie) => setSelectedMovieForDetails(movie)}
              onClose={() => setSelectedMovieForDetails(null)}
            />
          </Suspense>
        )}

        {/* Viewer Welcome Bonus / Authentication Modal */}
        {showViewerAuth && (
          <Suspense fallback={null}>
            <ViewerAuthModal
              isOpen={showViewerAuth}
              onClose={() => setShowViewerAuth(false)}
              onSuccess={(user) => {
                setCurrentUser(user);
                setIsAuthenticated(true);
                setShowViewerAuth(false);
              }}
            />
          </Suspense>
        )}

        {/* Video Playback: Dedicated 9:16 Microdrama Player vs Standard Cinema Player */}
        {activeHeroVideo && (
          isMicroDrama(activeHeroVideo) ? (
            <Suspense fallback={<LoadingPanel label="Opening micro drama..." />}>
              <MicroDramaPlayer
                currentVideo={activeHeroVideo}
                allVideos={videos}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                onPlayEpisode={openVideo}
                onClose={closeVideo}
                isAuthenticated={isAuthenticated}
                onRequireLogin={() => setShowViewerAuth(true)}
              />
            </Suspense>
          ) : (
            <div
              ref={playerDialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={`Playing ${activeHeroVideo.title}`}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 md:p-8"
              onClick={closeVideo}
            >
              <div className="cinema-player relative w-full max-h-[90vh] overflow-y-auto max-w-5xl" onClick={(e) => e.stopPropagation()}>
                <div className="cinema-player-header">
                  <button aria-label="Back to browsing" onClick={closeVideo}>←</button>
                  <span className="cinema-logo">Tube<span>TV</span></span>
                  <span />
                </div>
                <Suspense fallback={<LoadingPanel label="Opening player..." />}>
                  <VideoCard
                    key={activeHeroVideo.id}
                    video={activeHeroVideo}
                    autoPlay
                    playerOnly
                    nextEpisode={nextEpisode(videos, activeHeroVideo.id)}
                    onNextEpisode={() => {
                      const next = nextEpisode(videos, activeHeroVideo.id);
                      if (next) {
                        trackEvent('episode_next', { fromVideoId: activeHeroVideo.id, toVideoId: next.id, automatic: false });
                        openVideo(next);
                      }
                    }}
                  />
                  <div className="cinema-player-info bg-zinc-950 p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span className="rounded border border-zinc-700 px-2 py-1">{activeHeroVideo.contentRating || 'UNRATED'}</span>
                      <span>{activeHeroVideo.category}</span>
                      <span>{activeHeroVideo.author}</span>
                    </div>
                    <h1 className="mt-3 text-xl font-bold">{activeHeroVideo.seriesTitle || activeHeroVideo.title}</h1>
                    {seriesKey(activeHeroVideo) && (
                      <p className="mt-1 text-sm text-zinc-300">Season {activeHeroVideo.season || 1} · Episode {activeHeroVideo.episode || 1}</p>
                    )}
                    {(activeHeroVideo.episodeSynopsis || activeHeroVideo.description) && (
                      <p className="mt-2 text-sm leading-6 text-zinc-300">{activeHeroVideo.episodeSynopsis || activeHeroVideo.description}</p>
                    )}
                  </div>
                </Suspense>
              </div>
            </div>
          )
        )}

        {/* Main Content Area */}
        <div className={`cinema-shell flex-1 flex flex-col h-screen overflow-hidden relative ${currentView === ViewState.SHORTS ? 'shorts-shell' : ''}`}>
          <CinemaNavigation
            view={currentView}
            subcategory={activeSubCategory}
            items={translatedNavItems}
            authenticated={isAuthenticated}
            admin={isAdmin}
            search={searchQuery}
            onSearch={handleSearch}
            navigate={handleNavigate}
            login={() => setShowLogin(true)}
            logout={handleLogout}
          />

          {/* Scrollable View Content */}
          <main
            ref={mainRef}
            className={`flex-1 overflow-y-auto overflow-x-hidden relative bg-zinc-950 no-scrollbar ${
              currentView === ViewState.HOME && !searchQuery ? 'landing-main' : ''
            } ${currentView === ViewState.SHORTS ? 'shorts-main' : ''}`}
          >
            <Suspense fallback={<LoadingPanel label="Loading Tube TV..." />}>
              {renderContent()}
              <LandingFooter navigate={handleNavigate} />
            </Suspense>
          </main>

          {/* Mobile Bottom Navigation */}
          <div className={`md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around p-3 z-50 pb-safe ${currentView === ViewState.SHORTS ? 'shorts-hidden-mobile' : ''}`}>
            <button
              onClick={() => handleNavigate(ViewState.HOME)}
              className={`flex flex-col items-center gap-1 ${currentView === ViewState.HOME ? 'text-white' : 'text-zinc-500'}`}
            >
              <Home size={20} />
              <span className="text-[10px]">Home</span>
            </button>
            <button
              onClick={() => handleNavigate(ViewState.MICRO_DRAMAS)}
              className={`flex flex-col items-center gap-1 ${currentView === ViewState.MICRO_DRAMAS ? 'text-red-500' : 'text-zinc-500'}`}
            >
              <div className="w-5 h-5 border-2 border-current rounded-sm"></div>
              <span className="text-[10px]">Micro Dramas</span>
            </button>
            <button
              onClick={() => handleNavigate(ViewState.SHORTS)}
              className={`flex flex-col items-center gap-1 ${currentView === ViewState.SHORTS ? 'text-white' : 'text-zinc-500'}`}
            >
              <PlayCircle size={20} />
              <span className="text-[10px]">Shorts</span>
            </button>
            <button
              onClick={() => handleNavigate(ViewState.WATCH_LATER)}
              className={`flex flex-col items-center gap-1 ${currentView === ViewState.WATCH_LATER ? 'text-white' : 'text-zinc-500'}`}
            >
              <Clock size={20} />
              <span className="text-[10px]">My List</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => handleNavigate(ViewState.ANALYTICS)}
                className={`flex flex-col items-center gap-1 ${currentView === ViewState.ANALYTICS ? 'text-white' : 'text-zinc-500'}`}
              >
                <BarChart2 size={20} />
                <span className="text-[10px]">Studio</span>
              </button>
            )}
          </div>
        </div>
        <PWAInstallBanner />
      </div>
    </PlaybackProvider>
  );
};

export default App;
