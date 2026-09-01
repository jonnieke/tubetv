
import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import ShortsShelf from './components/ShortsShelf';
import { ViewState, Video, NavItem, ViewStateOrString } from './types';
import { CONTENT_RATING_ENFORCED, MOCK_VIDEOS, MOCK_SHORTS, PAYWALL_ENABLED } from './constants';
import { Menu, Search, Bell, X, LogIn, Sparkles, Loader2, GraduationCap, Sprout, Heart, Globe, PlayCircle, Home, Clapperboard, Smartphone, Clock, UploadCloud, BarChart2, Star, Music, Gamepad2, Utensils, Cpu, BookOpen, Coffee, Briefcase, Anchor, Zap, Film } from 'lucide-react';
import { fetchBunnyVideos, bunnyVideoToVideo } from './services/bunnyService';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useLanguage } from './contexts/LanguageContext';
import { isAdminUser } from './lib/authorization';
import { clearLocalAuthSession, loadLocalAuthSession, saveLocalAuthSession } from './lib/localAuth';
import { PlaybackProvider } from './contexts/PlaybackContext';
import { fetchActiveSubscription, type ActiveSubscription } from './lib/subscriptions';
import { DEFAULT_PLAYBACK_PREFERENCES, loadPreferences, loadProgress, loadWatchList, savePreferences, saveProgress, setWatchLater as persistWatchLater, type PlaybackPreferences, type WatchProgress } from './lib/viewerState';
import { setVideoMetadata, videoPath } from './lib/seo';
import LegalPage from './components/LegalPage';
import { trackEvent } from './lib/analytics';
import { normalizeContentRating, PUBLIC_CONTENT_RATINGS } from './lib/contentRating';

import { TranslationKey } from './translations';

const VideoCard = lazy(() => import('./components/VideoCard'));
const VideoCarousel = lazy(() => import('./components/VideoCarousel'));
const SeriesCarousel = lazy(() => import('./components/SeriesCarousel'));
const ShortsPlayer = lazy(() => import('./components/ShortsPlayer'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const UploadSection = lazy(() => import('./components/UploadSection'));
const WatchLaterSection = lazy(() => import('./components/WatchLaterSection'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const SettingsSection = lazy(() => import('./components/SettingsSection'));
const LiveSection = lazy(() => import('./components/LiveSection'));
const DEMO_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const DEMO_VIDEOS = MOCK_VIDEOS.map((video) => ({
  ...video,
  url: video.url || DEMO_VIDEO_URL,
  contentRating: (['Kids', 'Education', 'Farmers', 'Faith'].includes(video.category) ? 'GE' : 'PG') as Video['contentRating'],
}));


// Admin emails/phones — add yours here

// Icon Map for Dynamic Rendering
const ICON_MAP: Record<string, any> = {
  Home, Clapperboard, Smartphone, GraduationCap, Sprout, Heart, Baby: PlayCircle, Globe, Radio: PlayCircle, Clock, UploadCloud, BarChart2,
  Star, Music, Game: Gamepad2, Food: Utensils, Tech: Cpu, News: BookOpen, Lifestyle: Coffee, Business: Briefcase, Travel: Anchor, Trending: Zap, Movie: Film
};

const INITIAL_NAV_ITEMS: NavItem[] = [
  { id: ViewState.HOME, label: 'Home', labelKey: 'nav.home', iconName: 'Home', icon: Home },
  { id: ViewState.ORIGINALS, label: 'Originals', labelKey: 'nav.originals', iconName: 'Clapperboard', icon: Clapperboard },
  { id: ViewState.SHORTS, label: 'Shorts', labelKey: 'nav.shorts', iconName: 'Smartphone', icon: Smartphone },
  { id: ViewState.EDUCATION, label: 'Education', labelKey: 'nav.education', iconName: 'GraduationCap', icon: GraduationCap },
  { id: ViewState.FARMERS, label: 'Farmers', labelKey: 'nav.farmers', iconName: 'Sprout', icon: Sprout },
  { id: ViewState.FAITH, label: 'Faith', labelKey: 'nav.faith', iconName: 'Heart', icon: Heart },
  { id: ViewState.KIDS, label: 'Kids', labelKey: 'nav.kids', iconName: 'Baby', icon: PlayCircle },
  { id: ViewState.DIASPORA, label: 'Diaspora', labelKey: 'nav.diaspora', iconName: 'Globe', icon: Globe },
  { id: ViewState.LIVE, label: 'Live', labelKey: 'nav.live', iconName: 'Radio', icon: PlayCircle },
  { id: ViewState.WATCH_LATER, label: 'Watch List', labelKey: 'nav.watchlist', iconName: 'Clock', icon: Clock },
];

const LoadingPanel = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="min-h-[320px] w-full flex flex-col items-center justify-center text-zinc-500">
    <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-3" />
    <p className="text-sm font-medium">{label}</p>
  </div>
);

const App: React.FC = () => {
  const { t } = useLanguage();
  const [currentView, setCurrentView] = useState<ViewStateOrString>(ViewState.HOME);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'billing'>('general');
  const [pendingSubscription, setPendingSubscription] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [watchLater, setWatchLater] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tube_watch_later');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState('');

  // --- LOCAL AUTH: phone + PIN session ---
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Bootstrap local auth session on mount
  useEffect(() => {
    const session = loadLocalAuthSession();
    setCurrentUser(session);
    setIsAuthenticated(Boolean(session));
    setIsAuthLoading(false);
  }, []);
  const [preferences, setPreferences] = useState<PlaybackPreferences>(DEFAULT_PLAYBACK_PREFERENCES);
  const [watchProgress, setWatchProgress] = useState<Record<string, WatchProgress>>({});
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);

  const refreshSubscription = async () => {
    if (!currentUser) {
      setActiveSubscription(null);
      return;
    }
    try {
      setActiveSubscription(await fetchActiveSubscription(currentUser.id));
    } catch {
      setActiveSubscription(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const userId = currentUser?.id;
    Promise.all([
      loadPreferences(userId),
      loadWatchList(userId),
      loadProgress(userId),
      userId ? fetchActiveSubscription(userId).catch(() => null) : Promise.resolve(null),
    ]).then(([nextPreferences, nextWatchLater, nextProgress, subscription]) => {
      if (cancelled) return;
      setPreferences(nextPreferences);
      setWatchLater(nextWatchLater);
      setWatchProgress(nextProgress);
      setActiveSubscription(subscription);
    });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const handlePreferencesChange = (nextPreferences: PlaybackPreferences) => {
    setPreferences(nextPreferences);
    void savePreferences(currentUser?.id, nextPreferences);
  };

  const handleWatchProgress = (videoId: string, progress: WatchProgress) => {
    setWatchProgress((current) => ({ ...current, [videoId]: progress }));
    void saveProgress(currentUser?.id, videoId, progress);
  };

  const isSubscribed = !PAYWALL_ENABLED || Boolean(activeSubscription);
  const handleVideoEnded = (videoId: string) => {
    if (!preferences.autoplay || videos.length < 2) return;
    const currentIndex = videos.findIndex((video) => video.id === videoId);
    if (currentIndex < 0) return;
    const nextVideo = videos[(currentIndex + 1) % videos.length];
    if (nextVideo.id !== videoId) {
      window.history.pushState({}, '', videoPath(nextVideo.id));
      setActiveHeroVideo(nextVideo);
    }
  };

  // ─── Detect admin ───────────────────────────────────────────────────────────
  const isAdmin = isAdminUser(currentUser);

  // ─── Videos: load from Bunny CDN on mount ─────────────────────────────────
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isRealContent, setIsRealContent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadVideos = async () => {
      try {
        const bunnyItems = await fetchBunnyVideos();
        console.log('Bunny Items Fetched:', bunnyItems.length);
        if (cancelled) return;
        if (bunnyItems.length > 0) {
          const mapped = bunnyItems.map(bunnyVideoToVideo) as Video[];
          const publicItems = mapped.filter((video) => !video.muted);
          const visible = CONTENT_RATING_ENFORCED
            ? publicItems.filter((video) => PUBLIC_CONTENT_RATINGS.includes(normalizeContentRating(video.contentRating)))
            : publicItems.filter((video) => normalizeContentRating(video.contentRating) !== '18');
          console.log('Mapped Videos (first 2):', mapped.slice(0, 2));
          if (visible.length > 0) {
            setVideos(visible);
            setIsRealContent(true);
          } else {
            console.warn('No Bunny titles are available under the current rating policy; showing labelled demo content.');
            setVideos(DEMO_VIDEOS);
            setIsRealContent(false);
          }
        } else {
          console.log('No Bunny items found, showing curated demo content.');
          setVideos(DEMO_VIDEOS);
        }
      } catch (err) {
        console.warn('Bunny load failed, showing demo content:', err);
        if (!cancelled) setVideos(DEMO_VIDEOS);
      } finally {
        if (!cancelled) setIsLoadingVideos(false);
      }
    };
    loadVideos();
    const onVisibilityChange = (event: Event) => {
      const { videoId, hidden } = (event as CustomEvent<{ videoId: string; hidden: boolean }>).detail;
      if (hidden) {
        setVideos((current) => current.filter((video) => video.id !== videoId));
      } else {
        void loadVideos();
      }
    };
    window.addEventListener('tube-visibility-change', onVisibilityChange);
    return () => {
      cancelled = true;
      window.removeEventListener('tube-visibility-change', onVisibilityChange);
    };
  }, []);

  // Derive real shorts from the videos library (tagged with 'Shorts' category)
  const realShorts = useMemo(() => {
    const fromVideos = videos
      .filter(v => v.category === 'Shorts')
      .map(v => ({
        id: v.id,
        thumbnail: v.thumbnail,
        author: v.author,
        description: v.description || v.title,
        likes: Math.floor(v.views / 10) + 12,
        comments: Math.floor(v.views / 100) + 2,
        videoUrl: v.url || ''
      }));
    
    // Only fall back to MOCK_SHORTS if we are not loading AND have no real shorts
    if (isLoadingVideos) return [];
    return fromVideos.length > 0 ? fromVideos : (isRealContent ? [] : MOCK_SHORTS);
  }, [videos, isLoadingVideos, isRealContent]);

  useEffect(() => {
    if (isLoadingVideos) return;
    trackEvent('catalogue_view', { videoCount: videos.length, source: isRealContent ? 'bunny' : 'demo' });
  }, [isLoadingVideos, isRealContent, videos.length]);


  // Dynamic Navigation State
  const [navItems, setNavItems] = useState<NavItem[]>(() => {
    try {
      const saved = localStorage.getItem('tube_nav_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Fix for the 'multiple Gaming icons' glitch:
        // If more than one item has the 'nav.gaming' key, it's corrupted state from the old version.
        const gamingCount = parsed.filter((item: any) => item.labelKey === 'nav.gaming').length;
        if (gamingCount > 1) {
          localStorage.removeItem('tube_nav_items');
          return INITIAL_NAV_ITEMS;
        }

        // Re-attach icon components based on iconName string
        return parsed.map((item: NavItem) => ({
          ...item,
          icon: ICON_MAP[item.iconName || 'PlayCircle'] || PlayCircle
        }));
      }
    } catch {
      // Ignore
    }
    return INITIAL_NAV_ITEMS;
  });

  // Sync nav items to local storage
  useEffect(() => {
    // Strip out the React component 'icon' before saving to avoid JSON circular errors
    const serializable = navItems.map(({ icon, ...rest }) => rest);
    try {
      localStorage.setItem('tube_nav_items', JSON.stringify(serializable));
    } catch { }
  }, [navItems]);

  // Hero spotlight: cycles through top 5 videos
  const [heroIndex, setHeroIndex] = useState(0);
  const [activeHeroVideo, setActiveHeroVideo] = useState<Video | null>(null);
  const openVideo = (video: Video) => {
    window.history.pushState({}, '', videoPath(video.id));
    setActiveHeroVideo(video);
  };
  const closeVideo = () => {
    window.history.pushState({}, '', '/');
    setActiveHeroVideo(null);
  };

  useEffect(() => {
    const syncRoute = () => {
      const match = window.location.pathname.match(/^\/watch\/([^/]+)$/);
      if (!match) {
        setActiveHeroVideo(null);
        return;
      }
      const id = decodeURIComponent(match[1]);
      const video = videos.find((item) => item.id === id);
      if (video) setActiveHeroVideo(video);
    };
    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [videos]);

  useEffect(() => {
    setVideoMetadata(activeHeroVideo || undefined);
  }, [activeHeroVideo]);
  useEffect(() => {
    if (videos.length === 0) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % Math.min(5, videos.length));
    }, 8000);
    return () => clearInterval(timer);
  }, [videos]);
  useEffect(() => {
    if (!activeHeroVideo) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeVideo();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeHeroVideo]);


  const [recommendedVideos, setRecommendedVideos] = useState<Video[]>([]);
  const [isRecLoading, setIsRecLoading] = useState(false);

  // Translate Nav Items
  const translatedNavItems = navItems.map(item => ({
    ...item,
    label: item.labelKey ? t(item.labelKey as TranslationKey) : item.label
  }));

  // Dynamic Sub-Categories based on view
  const [activeSubCategory, setActiveSubCategory] = useState('');

  const getSubCategories = (view: ViewStateOrString) => {
    // System Views
    switch (view) {
      case ViewState.EDUCATION:
        return ['CBC', 'High School', 'Revision', 'AI Learning', 'Teachers'];
      case ViewState.FARMERS:
        return ['Crops', 'Livestock', 'Climate', 'Agribusiness', 'Dairy'];
      case ViewState.FAITH:
        return ['Sermons', 'Kids Bible', 'Worship', 'Devotion'];
      case ViewState.DIASPORA:
        return ['Investments', 'Events', 'News', 'Culture'];
      case ViewState.KIDS:
        return ['Cartoons', 'Learning', 'Songs', 'Stories'];
      case ViewState.ORIGINALS:
        return ['Movies', 'Series'];
      case ViewState.LIVE:
        return ['Sports', 'News', 'Events'];
      case ViewState.HOME:
        return ['Trending', 'New Releases', 'Most Watched'];
      default:
        // For custom categories, we can return generic filters
        return ['Trending', 'New', 'Top Rated'];
    }
  };

  const currentSubCategories = getSubCategories(currentView);

  // Reset sub-category when view changes
  useEffect(() => {
    setActiveSubCategory(getSubCategories(currentView)[0]);
  }, [currentView]);

  // Handle new uploads from the UploadSection
  const handleUploadComplete = (newVideo: Video) => {
    setVideos(prev => [newVideo, ...prev]);
  };

  // Admin: Add Category Logic
  const handleAddCategory = (name: string, iconName: string) => {
    const newId = `CAT_${name.toUpperCase().replace(/\s+/g, '_')}`;
    const newItem: NavItem = {
      id: newId,
      label: name,
      iconName: iconName,
      icon: ICON_MAP[iconName] || Star, // Default to Star if not found
      isCustom: true
    };

    // Insert before Watch List (index 9 in initial list, but safer to find index)
    setNavItems(prev => {
      const watchListIndex = prev.findIndex(i => i.id === ViewState.WATCH_LATER);
      const newItems = [...prev];
      if (watchListIndex !== -1) {
        newItems.splice(watchListIndex, 0, newItem);
      } else {
        newItems.push(newItem);
      }
      return newItems;
    });
  };

  // Admin: Remove Category Logic
  const handleRemoveCategory = (id: string) => {
    setNavItems(prev => prev.filter(item => item.id !== id));
    if (currentView === id) {
      setCurrentView(ViewState.HOME);
    }
  };

  const getFilteredVideos = () => {
    let filtered = videos;

    // Filter by Main View Category
    if (currentView !== ViewState.HOME) {
      const viewCategoryMap: Record<string, string> = {
        [ViewState.EDUCATION]: 'Education',
        [ViewState.FARMERS]: 'Farmers',
        [ViewState.FAITH]: 'Faith',
        [ViewState.DIASPORA]: 'Diaspora',
        [ViewState.KIDS]: 'Kids',
        [ViewState.LIVE]: 'Live',
      };

      const targetCategory = viewCategoryMap[currentView as string];

      if (currentView === ViewState.ORIGINALS) {
        filtered = filtered.filter(v => v.category === 'Movies' || v.category === 'Series' || v.category === 'Originals');
      } else if (targetCategory) {
        filtered = filtered.filter(v => v.category === targetCategory);
      } else {
        // Custom Category Handling
        // For demo purposes, check if the video has tags matching the custom category name
        const customItem = navItems.find(i => i.id === currentView);
        if (customItem && customItem.isCustom) {
          // Loosely match tags or category strings
          filtered = filtered.filter(v =>
            v.tags?.some(tag => tag.toLowerCase().includes(customItem.label.toLowerCase())) ||
            v.category.toLowerCase().includes(customItem.label.toLowerCase())
          );
        }
      }
    }

    // Filter by Sub-Category Pills
    if (activeSubCategory && activeSubCategory !== 'All') {
      if (currentView === ViewState.ORIGINALS) {
        filtered = filtered.filter(v => v.category === activeSubCategory || (activeSubCategory === 'Movies' && v.category === 'Originals'));
      } else {
        filtered = filtered.filter(v =>
          v.genre?.includes(activeSubCategory) ||
          v.tags?.includes(activeSubCategory) ||
          v.title.includes(activeSubCategory) ||
          (activeSubCategory === 'Trending' && v.category === 'Trending') ||
          (activeSubCategory === 'Most Watched' && v.views > 1000)
        );
      }
    }

    // Filter by Search Query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(video =>
        video.title.toLowerCase().includes(query) ||
        video.category.toLowerCase().includes(query) ||
        video.author.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredVideos = getFilteredVideos();

  const toggleWatchLater = (id: string) => {
    const shouldSave = !watchLater.includes(id);
    setWatchLater((current) => shouldSave ? [...current, id] : current.filter((videoId) => videoId !== id));
    void persistWatchLater(currentUser?.id, id, shouldSave);
  };

  // Generate Recommendations when Watch Later changes
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (watchLater.length === 0) {
        setRecommendedVideos([]);
        return;
      }
      setIsRecLoading(true);
      const historyData = videos
        .filter(v => watchLater.includes(v.id))
        .map(v => ({ title: v.title, category: v.category }));

      const availableData = videos.map(v => ({ id: v.id, title: v.title, category: v.category }));
      const { getVideoRecommendations } = await import('./services/geminiService');
      const recommendedIds = await getVideoRecommendations(historyData, availableData);
      const recs = videos.filter(v => recommendedIds.includes(v.id) && !watchLater.includes(v.id));
      setRecommendedVideos(recs);
      setIsRecLoading(false);
    };

    const timer = setTimeout(() => {
      if (watchLater.length > 0) fetchRecommendations();
    }, 1000);
    return () => clearTimeout(timer);
  }, [watchLater, videos]);


  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value && currentView !== ViewState.HOME) {
      setCurrentView(ViewState.HOME);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
  };
  const handleSubscribeRequest = () => {
    trackEvent('paywall_view', { source: 'subscription_request', offer: 'daily_10' });
    setSettingsInitialTab('billing');
    if (!isAuthenticated) {
      setPendingSubscription(true);
      setShowLogin(true);
      return;
    }
    setCurrentView(ViewState.SETTINGS);
    setIsMobileMenuOpen(false);
  };


  const handleNavigate = (view: ViewStateOrString) => {
    // Guard: Settings and Admin require authentication
    if (view === ViewState.SETTINGS && !isAuthenticated) {
      setShowLogin(true);
      return;
    }
    // Guard: Admin requires admin role
    if (view === ViewState.SETTINGS) setSettingsInitialTab('general');
    if (view === ViewState.ADMIN && !isAdmin) {
      return;
    }
    // Guard: restricted nav items (Upload, Analytics) require auth
    const item = navItems.find(i => i.id === view);
    if (item?.restricted && !isAuthenticated) {
      setShowLogin(true);
    } else {
      setCurrentView(view);
      setIsMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    clearLocalAuthSession();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentView(ViewState.HOME);
  };

  // Derive phone for display from the current local session
  const userPhone = currentUser?.phone || null;

  // Show a brief loading state while local auth hydrates
  if (isAuthLoading) {
    return (
      <div className="bg-zinc-950 h-screen w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  // Header Helper
  const getViewTitle = () => {
    const currentItem = navItems.find(i => i.id === currentView);
    if (currentItem && currentView !== ViewState.HOME) {
      return { title: currentItem.label, icon: currentItem.icon || Star };
    }
    return null;
  };

  const renderContent = () => {
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
        return <ShortsPlayer shorts={realShorts} onLoginRequest={() => setShowLogin(true)} />;
      case ViewState.LIVE:
        return <LiveSection isAuthenticated={isAuthenticated} />;
      case ViewState.SETTINGS:
        return (
          <SettingsSection
            initialTab={settingsInitialTab}
            currentUser={currentUser}
            userPhone={userPhone}
            onLogout={handleLogout}
            preferences={preferences}
            onPreferencesChange={handlePreferencesChange}
            activeSubscription={activeSubscription}
            onSubscriptionRefresh={refreshSubscription}
          />
        );
      case ViewState.UPLOAD:
        if (!isAuthenticated) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <UploadCloud className="w-12 h-12 text-zinc-600 mb-4" />
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
              <UploadCloud className="w-12 h-12 text-zinc-600 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Creator uploads are invite-only</h2>
              <p className="text-zinc-400 max-w-md">
                Tube TV is approving creators before opening uploads. This keeps the library trusted while payments and creator tools are finalized.
              </p>
            </div>
          );
        }
        return <UploadSection onUploadComplete={handleUploadComplete} creatorName={userPhone || 'Admin'} />;
      case ViewState.ANALYTICS:
        if (!isAuthenticated) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <BarChart2 className="w-12 h-12 text-zinc-600 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Sign in to access Studio</h2>
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
              <BarChart2 className="w-12 h-12 text-zinc-600 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Studio analytics are coming soon</h2>
              <p className="text-zinc-400 max-w-md">
                Creator dashboards will open after verified uploads, payouts, and real engagement tracking are connected.
              </p>
            </div>
          );
        }
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
      case ViewState.WATCH_LATER:
        return (
          <WatchLaterSection
            videos={videos}
            watchLaterIds={watchLater}
            onToggleWatchLater={toggleWatchLater}
          />
        );

      // Default / Generic Grid View for Home and all Categories (System + Custom)
      default:
        const viewHeader = getViewTitle();

        return (
          <div className="p-4 md:p-8 pb-24">
            {/* Hero Section - Only on HOME and not searching */}
            {currentView === ViewState.HOME && !searchQuery && (() => {
              const featuredVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 5);
              const hero = featuredVideos[heroIndex % featuredVideos.length];
              if (!hero) return null;
              return (
                <div className="w-full h-[45vh] md:h-[58vh] rounded-2xl overflow-hidden relative mb-10 group animate-in fade-in duration-700 shadow-2xl">
                  {/* Thumbnail */}
                  <img
                    key={hero.id}
                    src={hero.thumbnail}
                    alt={hero.title}
                    fetchPriority="high"
                    decoding="async"
                    className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105 bg-zinc-800"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                  />

                  {/* Dark overlay — stronger at bottom so text is always readable */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />

                  {/* Content — pinned to bottom-left, max 55% width to avoid right-side overflow */}
                  <div className="absolute bottom-0 left-0 p-5 md:p-10 w-full md:max-w-[60%]">
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">{isRealContent ? 'Featured' : 'Demo content'}</span>
                      {hero.isPremium && !PAYWALL_ENABLED && (
                        <span className="bg-purple-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">✨ Premium</span>
                      )}
                      <span className="text-zinc-400 text-[10px] uppercase tracking-wide">{hero.category}</span>
                    </div>

                    {/* Title */}
                    <h1 className="text-xl md:text-4xl font-black text-white leading-tight drop-shadow-lg line-clamp-2 mb-2">
                      {hero.title}
                    </h1>

                    {/* Meta — single line, hidden on very small screens */}
                    <p className="hidden sm:block text-zinc-300 text-xs md:text-sm line-clamp-1 mb-4">
                      {hero.author} · {(hero.views / 1000).toFixed(0)}K views · {hero.duration}
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openVideo(hero)}
                        className="bg-white text-black font-bold px-5 md:px-7 py-2.5 rounded-lg flex items-center gap-2 hover:bg-zinc-200 transition-colors shadow-lg text-sm"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        Play Now
                      </button>
                      <button
                        onClick={() => toggleWatchLater(hero.id)}
                        className="bg-white/10 backdrop-blur text-white font-bold px-5 md:px-7 py-2.5 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2 border border-white/20 text-sm"
                      >
                        {watchLater.includes(hero.id) ? '✓ Saved' : '+ Watch Later'}
                      </button>
                    </div>

                    {/* Dot indicators */}
                    <div className="flex gap-1.5 mt-4">
                      {featuredVideos.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setHeroIndex(i)}
                          className={`h-1 rounded-full transition-all duration-500 ${i === heroIndex % featuredVideos.length ? 'w-6 bg-red-500' : 'w-1.5 bg-white/30 hover:bg-white/60'
                            }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* View Specific Header (if not Home) */}
            {viewHeader && (
              <div className="mb-6 flex items-center gap-3">
                <div className="p-3 bg-zinc-800 rounded-full">
                  <viewHeader.icon className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white">{viewHeader.title}</h1>
              </div>
            )}

            {/* Sub-Category Pills */}
            <div className="flex gap-3 overflow-x-auto pb-4 mb-6 no-scrollbar sticky top-0 z-10 bg-zinc-950/90 backdrop-blur py-2 -mx-4 px-4 md:-mx-8 md:px-8">
              {currentSubCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveSubCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border border-transparent
                            ${activeSubCategory === cat
                      ? 'bg-white text-black'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Shorts Shelf (Vertical Video Carousel) - Only on Home */}
            {currentView === ViewState.HOME && !searchQuery && (
              <ShortsShelf
                shorts={realShorts}
                onShortClick={() => setCurrentView(ViewState.SHORTS)}
              />
            )}

            {/* Main Grid */}
            <div className="mb-6 flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">
                {searchQuery ? `Results for "${searchQuery}"` :
                  activeSubCategory !== 'All' ? activeSubCategory :
                    currentView === ViewState.HOME ? 'Trending Now' : 'Popular Videos'}
              </h2>
              {isRealContent ? (
                <span className="text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">CATALOG</span>
              ) : !isLoadingVideos && (
                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">DEMO</span>
              )}
            </div>

            {/* Skeleton loader while fetching from Bunny */}
            {(isLoadingVideos || (!isRealContent && videos.length === 0)) ? (
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
            ) : currentView === ViewState.HOME && !searchQuery && activeSubCategory === 'Trending' ? (
              // Netflix-style category carousels
              <div className="space-y-2 animate-in fade-in duration-500">
                {/* 🔥 Trending — sorted by real view count */}
                <VideoCarousel
                  key="Trending"
                  title="🔥 Trending Now"
                  videos={[...videos].sort((a, b) => b.views - a.views).slice(0, 20)}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={isSubscribed}
                />

                {/* 📺 Series Carousel — groups episodes by seriesTitle/season */}
                <SeriesCarousel
                  videos={videos.filter(v => v.category === 'Series' || v.category === 'Originals')}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={isSubscribed}
                  onSubscribeRequest={handleSubscribeRequest}
                />

                {/* Standard category carousels */}
                {['Movies', 'Farmers', 'Education', 'Faith', 'Kids', 'Diaspora'].map(cat => {
                  // Fallback for old "Originals" tag until all content is migrated
                  const catVideos = videos.filter(v => v.category === cat || (cat === 'Movies' && v.category === 'Originals'));
                  const label = cat === 'Movies' ? '🎬 Kenyan Movies' : cat;
                  return (
                    <VideoCarousel
                      key={cat}
                      title={label}
                      videos={catVideos}
                      watchLaterIds={watchLater}
                      onToggleWatchLater={toggleWatchLater}
                      isAuthenticated={isSubscribed}
                    />
                  );
                })}
              </div>
            ) : currentView === ViewState.ORIGINALS && !searchQuery ? (
              // Nested Originals View
              <div className="space-y-2 animate-in fade-in duration-500">
                {activeSubCategory === 'Series' ? (
                  <>
                    {/* Series Carousels */}
                    {['Swahili', 'Drama', 'Comedy', 'Thriller'].map(genre => {
                      const genreVideos = filteredVideos.filter(v => v.genre?.includes(genre) || v.tags?.includes(genre));
                      if (genreVideos.length === 0) return null;
                      return (
                        <SeriesCarousel
                          key={genre}
                          title={`📺 ${genre} Series`}
                          videos={genreVideos}
                          watchLaterIds={watchLater}
                          onToggleWatchLater={toggleWatchLater}
                          isAuthenticated={isSubscribed}
                          onSubscribeRequest={handleSubscribeRequest}
                        />
                      );
                    })}
                  </>
                ) : (
                  <>
                    {/* Movies Carousels */}
                    {['Swahili', 'Drama', 'Comedy', 'Documentary', 'Action'].map(genre => {
                      const genreVideos = filteredVideos.filter(v => v.genre?.includes(genre) || v.tags?.includes(genre));
                      if (genreVideos.length === 0) return null;
                      return (
                        <VideoCarousel
                          key={genre}
                          title={`🎬 ${genre} Movies`}
                          videos={genreVideos}
                          watchLaterIds={watchLater}
                          onToggleWatchLater={toggleWatchLater}
                          isAuthenticated={isSubscribed}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                  {filteredVideos.map((video) => (
                    <div id={`video-${video.id}`} key={video.id}>
                      <VideoCard
                        video={video}
                        isWatchLater={watchLater.includes(video.id)}
                        onToggleWatchLater={toggleWatchLater}
                        isSubscribed={isSubscribed}
                        onSubscribeRequest={handleSubscribeRequest}
                      />
                    </div>
                  ))}
                </div>

                {/* AI Recommendations Section (Only on Home) */}
                {currentView === ViewState.HOME && !searchQuery && watchLater.length > 0 && (
                  <div className="mt-16 animate-in fade-in duration-700">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-purple-500/20 rounded-full">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Recommended For You</h2>
                        <p className="text-xs text-zinc-400">Based on your Watch List</p>
                      </div>
                    </div>

                    {isRecLoading ? (
                      <div className="flex items-center justify-center py-12 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
                        <span className="ml-3 text-zinc-500 text-sm">AI is curating your feed...</span>
                      </div>
                    ) : recommendedVideos.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {recommendedVideos.map((video) => (
                          <VideoCard
                            key={`rec-${video.id}`}
                            video={video}
                            isWatchLater={watchLater.includes(video.id)}
                            onToggleWatchLater={toggleWatchLater}
                            isSubscribed={isSubscribed}
                            onSubscribeRequest={handleSubscribeRequest}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            )}

            {/* Empty state — only if not loading and no results */}
            {!isLoadingVideos && filteredVideos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-zinc-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No videos found</h3>
                <p className="text-zinc-500">
                  {currentView !== ViewState.HOME ? 'No content in this category yet.' : 'Try searching for something else or change the category.'}
                </p>
              </div>
            )}

          </div>
        );
    }
  };

  const legalKind = window.location.pathname === '/privacy' ? 'privacy' : window.location.pathname === '/terms' ? 'terms' : null;
  if (legalKind) {
    return <LegalPage kind={legalKind} />;
  }

  return (
    <PlaybackProvider value={{
      preferences,
      getProgress: (videoId) => watchProgress[videoId],
      onEnded: handleVideoEnded,
      onProgress: handleWatchProgress,
    }}>
      <div className="flex h-screen bg-zinc-950 text-white font-sans selection:bg-red-500 selection:text-white">
      {/* Verified phone authentication modal */}
      {showLogin && !isAuthenticated && (
        <Suspense fallback={<LoadingPanel label="Opening login..." />}>
          <AuthModal
            onSuccess={(user) => {
              saveLocalAuthSession(user);
              setCurrentUser(user);
              setIsAuthenticated(true);
              setShowLogin(false);
              setCurrentView(pendingSubscription ? ViewState.SETTINGS : ViewState.HOME);
              setPendingSubscription(false);
            }}
            onCancel={() => setShowLogin(false)}
          />
        </Suspense>
      )}

      {activeHeroVideo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Playing ${activeHeroVideo.title}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 md:p-8"
          onClick={closeVideo}
        >
          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label="Close player"
              onClick={closeVideo}
              className="absolute -top-12 right-0 z-10 rounded-full bg-zinc-800 p-2 text-white hover:bg-zinc-700"
            >
              <X className="h-5 w-5" />
            </button>
            <Suspense fallback={<LoadingPanel label="Opening player..." />}>
              <VideoCard
                video={activeHeroVideo}
                autoPlay
                isSubscribed={isSubscribed}
                onSubscribeRequest={handleSubscribeRequest}
              />
            <div className="max-h-64 overflow-y-auto bg-zinc-950 p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="rounded border border-zinc-700 px-2 py-1">{activeHeroVideo.contentRating || 'UNRATED'}</span>
                <span>{activeHeroVideo.category}</span>
                <span>{activeHeroVideo.author}</span>
              </div>
              <h1 className="mt-3 text-xl font-bold">{activeHeroVideo.title}</h1>
              {activeHeroVideo.description && <p className="mt-2 text-sm leading-6 text-zinc-300">{activeHeroVideo.description}</p>}
              {activeHeroVideo.transcript && (
                <details className="mt-4 border-t border-zinc-800 pt-4">
                  <summary className="cursor-pointer font-medium">Transcript</summary>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{activeHeroVideo.transcript}</p>
                </details>
              )}
            </div>
            </Suspense>
      {/* Sidebar */}
          </div>
        </div>
      )}
      <Sidebar
        currentView={currentView}
        navItems={translatedNavItems}
        onNavigate={handleNavigate}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        onLoginRequest={() => setShowLogin(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col h-screen overflow-hidden relative">

        {/* Top Navbar */}
        <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
          <div className="h-16 flex items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-4 lg:hidden">
              <button aria-label="Open navigation menu" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                <Menu className="text-zinc-300" />
              </button>
              <span className="font-bold text-xl tracking-tighter">Tube</span>
            </div>

            {/* Desktop Search Bar */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder={t('common.search')}
                aria-label="Search videos"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2 pl-10 pr-10 text-zinc-300 focus:outline-none focus:border-zinc-600 focus:bg-black transition-all"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 md:gap-6">
              {/* Mobile Search Toggle */}
              <button
                aria-label={isMobileSearchOpen ? 'Close search' : 'Open search'}
                className="md:hidden text-zinc-400 hover:text-white transition-colors"
                onClick={() => {
                  setIsMobileSearchOpen(!isMobileSearchOpen);
                  if (!isMobileSearchOpen) setTimeout(() => document.getElementById('mobile-search-input')?.focus(), 100);
                }}
              >
                {isMobileSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
              </button>

              <button aria-label="Notifications" className="relative">
                <Bell className="w-6 h-6 text-zinc-400 hover:text-white transition-colors" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full"></span>
              </button>
              {isAuthenticated && currentUser ? (
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-orange-500 flex items-center justify-center cursor-pointer shadow-lg"
                  title={userPhone || 'My Account'}
                >
                  <span className="text-white text-xs font-bold">
                    {userPhone ? userPhone.slice(-2) : 'ME'}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="flex items-center gap-2 text-sm font-bold bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-full transition-colors"
                >
                  <LogIn size={16} />
                  Login
                </button>
              )}
            </div>
          </div>

          {/* Mobile Search Bar — slides in below header */}
          <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${isMobileSearchOpen ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
            }`}>
            <div className="px-4 pb-3 relative">
              <input
                id="mobile-search-input"
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search Tube..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-full py-2.5 pl-10 pr-10 text-zinc-300 focus:outline-none focus:border-red-500 transition-colors"
              />
              <Search className="absolute left-7 top-3 w-4 h-4 text-zinc-500" />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-7 top-3 text-zinc-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-zinc-950 no-scrollbar">
          <Suspense fallback={<LoadingPanel label="Loading Tube TV..." />}>
            {renderContent()}
          </Suspense>
        </main>

        {/* Mobile Bottom Nav (Simplified for common tasks) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around p-3 z-50 pb-safe">
          <button
            onClick={() => handleNavigate(ViewState.HOME)}
            className={`flex flex-col items-center gap-1 ${currentView === ViewState.HOME ? 'text-white' : 'text-zinc-500'}`}
          >
            <Home size={20} />
            <span className="text-[10px]">Home</span>
          </button>
          <button
            onClick={() => handleNavigate(ViewState.SHORTS)}
            className={`flex flex-col items-center gap-1 ${currentView === ViewState.SHORTS ? 'text-white' : 'text-zinc-500'}`}
          >
            <div className="w-5 h-5 border-2 border-current rounded-sm"></div>
            <span className="text-[10px]">Shorts</span>
          </button>
          <button
            onClick={() => handleNavigate(ViewState.EDUCATION)}
            className={`flex flex-col items-center gap-1 ${currentView === ViewState.EDUCATION ? 'text-white' : 'text-zinc-500'}`}
          >
            <GraduationCap size={20} />
            <span className="text-[10px]">Learn</span>
          </button>
          <button
            onClick={() => handleNavigate(ViewState.UPLOAD)}
            className={`flex flex-col items-center gap-1 ${currentView === ViewState.UPLOAD ? 'text-white' : 'text-zinc-500'}`}
          >
            <div className="bg-red-600 rounded-full p-1 -mt-4 mb-1">
              <span className="text-xl font-bold leading-none">+</span>
            </div>
          </button>
          <button
            onClick={() => handleNavigate(ViewState.ANALYTICS)}
            className={`flex flex-col items-center gap-1 ${currentView === ViewState.ANALYTICS ? 'text-white' : 'text-zinc-500'}`}
          >
            <BarChart2 size={20} />
            <span className="text-[10px]">Studio</span>
          </button>
        </div>
      </div>
    </div>
    </PlaybackProvider>
  );
};

export default App;
