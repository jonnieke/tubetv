
import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import HomeView from './components/HomeView';
import AuthModal from './components/AuthModal';

// Landing page — shown to new / unauthenticated visitors
const LandingPage = lazy(() => import('./components/LandingPage'));

// Heavy routes — loaded on demand
const ShortsPlayer     = lazy(() => import('./components/ShortsPlayer'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const AdminDashboard   = lazy(() => import('./components/AdminDashboard'));
const UploadSection    = lazy(() => import('./components/UploadSection'));
const WatchLaterSection = lazy(() => import('./components/WatchLaterSection'));
const SettingsSection  = lazy(() => import('./components/SettingsSection'));
const LiveSection      = lazy(() => import('./components/LiveSection'));
import { ViewState, Video, NavItem, ViewStateOrString } from './types';
import { MOCK_SHORTS } from './constants';
import { Menu, Search, Bell, X, LogIn, Loader2, GraduationCap, Sprout, Heart, Globe, PlayCircle, Home, Clapperboard, Smartphone, Clock, UploadCloud, BarChart2, Star, Music, Gamepad2, Utensils, Cpu, BookOpen, Coffee, Briefcase, Anchor, Zap, Film, Shirt, PawPrint, WifiOff, History, Baby, ThumbsUp } from 'lucide-react';
import { getVideoRecommendations } from './services/geminiService';
import { isKidsModeActive, setKidsModeActive, KIDS_SAFE_VIEWS } from './lib/kidsMode';
import KidsModeModal from './components/KidsModeModal';
import LikedVideosView from './components/LikedVideosView';
import NotificationPanel from './components/NotificationPanel';
import { generateNotifications } from './lib/notifications';
import { fetchBunnyVideos, bunnyVideoToVideo, BunnyVideoItem } from './services/bunnyService';
import { supabase, normalizePhone } from './lib/supabase';
import { log, warn } from './lib/logger';
import { useToast } from './components/Toast';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useLanguage } from './contexts/LanguageContext';
import { TranslationKey } from './translations';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',').map((s: string) => s.trim()).filter(Boolean);

const ADMIN_PHONES = (import.meta.env.VITE_ADMIN_PHONES || '')
  .split(',').map((s: string) => s.trim()).filter(Boolean);

// Icon Map for Dynamic Rendering
const ICON_MAP: Record<string, any> = {
  Home, Clapperboard, Smartphone, GraduationCap, Sprout, Heart, Baby, Globe, Radio: PlayCircle, Clock, UploadCloud, BarChart2,
  Star, Music, Game: Gamepad2, Food: Utensils, Tech: Cpu, News: BookOpen, Lifestyle: Coffee, Business: Briefcase, Travel: Anchor, Trending: Zap, Movie: Film, Shirt, PawPrint, ThumbsUp, WifiOff, History
};

const INITIAL_NAV_ITEMS: NavItem[] = [
  { id: ViewState.HOME, label: 'Home', labelKey: 'nav.home', iconName: 'Home', icon: Home },
  { id: ViewState.ORIGINALS, label: 'Originals', labelKey: 'nav.originals', iconName: 'Clapperboard', icon: Clapperboard },
  { id: ViewState.SHORTS, label: 'Shorts', labelKey: 'nav.shorts', iconName: 'Smartphone', icon: Smartphone },
  { id: ViewState.EDUCATION, label: 'Education', labelKey: 'nav.education', iconName: 'GraduationCap', icon: GraduationCap },
  { id: ViewState.FARMERS, label: 'Farmers', labelKey: 'nav.farmers', iconName: 'Sprout', icon: Sprout },
  { id: ViewState.FAITH, label: 'Faith', labelKey: 'nav.faith', iconName: 'Heart', icon: Heart },
  { id: ViewState.KIDS, label: 'Kids', labelKey: 'nav.kids', iconName: 'Baby', icon: Baby },
  { id: ViewState.DIASPORA, label: 'Diaspora', labelKey: 'nav.diaspora', iconName: 'Globe', icon: Globe },
  { id: ViewState.FASHION, label: 'Fashion', labelKey: 'nav.fashion', iconName: 'Shirt', icon: Shirt },
  { id: ViewState.WILDLIFE, label: 'Wildlife', labelKey: 'nav.wildlife', iconName: 'PawPrint', icon: PawPrint },
  { id: ViewState.LIVE, label: 'Live', labelKey: 'nav.live', iconName: 'Radio', icon: PlayCircle },
  { id: ViewState.WATCH_LATER, label: 'Watch List', labelKey: 'nav.watchlist', iconName: 'Clock', icon: Clock },
  { id: ViewState.OFFLINE, label: 'Offline', labelKey: 'nav.offline', iconName: 'WifiOff', icon: WifiOff },
  { id: ViewState.HISTORY, label: 'History', labelKey: 'nav.history', iconName: 'History', icon: History },
  { id: ViewState.LIKED, label: 'Liked', labelKey: 'nav.liked', iconName: 'ThumbsUp', icon: ThumbsUp },
];

const App: React.FC = () => {
  const { t, language, toggleLanguage } = useLanguage();
  const toast = useToast();
  const [currentView, setCurrentView] = useState<ViewStateOrString>(ViewState.HOME);
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
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Kids Mode ---
  const [isKidsMode, setIsKidsMode] = useState<boolean>(() => isKidsModeActive());
  const [kidsModalMode, setKidsModalMode] = useState<'activate' | 'deactivate' | null>(null);

  // --- REAL AUTH: Supabase session ---
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // --- Landing page: show to first-time / unauthenticated visitors ---
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('tube_entered_app');
    } catch {
      return true;
    }
  });

  const enterApp = useCallback(() => {
    try { localStorage.setItem('tube_entered_app', '1'); } catch { }
    setShowLanding(false);
  }, []);

  // Authenticated users skip the landing page automatically
  useEffect(() => {
    if (isAuthenticated) setShowLanding(false);
  }, [isAuthenticated]);

  // Bootstrap Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        setIsAuthenticated(true);
      }
      setIsAuthLoading(false);
    });

    // Listen for sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        setIsAuthenticated(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─── Detect admin ──────────────────────────────────────────────────────────
  const isAdmin = currentUser
    ? ADMIN_EMAILS.includes(currentUser.email ?? '') ||
      // Match via user_metadata.phone (set at signup)
      ADMIN_PHONES.map(normalizePhone).includes(normalizePhone(currentUser.user_metadata?.phone || '')) ||
      // Match via Supabase phone field (native phone auth)
      ADMIN_PHONES.includes(currentUser.phone ?? '') ||
      // Reliable fallback: derive email from each admin phone and compare directly
      ADMIN_PHONES.some(p => `${normalizePhone(p)}@tubekenya.com` === currentUser.email)
    : false;

  // ─── Videos: load from Bunny CDN on mount ─────────────────────────────────
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isRealContent, setIsRealContent] = useState(false);
  // Keep raw Bunny items so we can re-filter after a mute toggle without re-fetching
  const bunnyItemsRef = useRef<BunnyVideoItem[]>([]);

  const applyVideos = useCallback((items: BunnyVideoItem[]) => {
    const mapped = items.map(bunnyVideoToVideo).filter(v => !v.muted) as Video[];
    setVideos(mapped);
    setIsRealContent(true);
    // Generate notifications after videos load
    try { generateNotifications(mapped); } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadVideos = async () => {
      try {
        const bunnyItems = await fetchBunnyVideos();
        log('Bunny Items Fetched:', bunnyItems.length);
        if (cancelled) return;
        if (bunnyItems.length > 0) {
          bunnyItemsRef.current = bunnyItems;
          applyVideos(bunnyItems);
          log('Mapped Videos (first 2):', videos.slice(0, 2));
        } else {
          log('No Bunny items found, keeping mock data.');
        }
      } catch (err) {
        warn('Bunny load failed, showing demo content:', err);
        toast.warning('Could not load videos from server — showing demo content.');
      } finally {
        if (!cancelled) setIsLoadingVideos(false);
      }
    };
    loadVideos();
    return () => { cancelled = true; };
  }, [applyVideos]);

  // Instantly update the public video list when admin mutes / unmutes
  useEffect(() => {
    const onMuteChange = (e: Event) => {
      const { videoId, muted } = (e as CustomEvent<{ videoId: string; muted: boolean }>).detail;
      if (muted) {
        // Remove the video immediately from the public list
        setVideos(prev => prev.filter(v => v.id !== videoId));
      } else {
        // Re-map from raw items so the unmuted video re-appears
        if (bunnyItemsRef.current.length > 0) applyVideos(bunnyItemsRef.current);
      }
    };
    window.addEventListener('tube-mute-change', onMuteChange);
    return () => window.removeEventListener('tube-mute-change', onMuteChange);
  }, [applyVideos]);

  // Derive real shorts from the videos library (tagged with 'Shorts' category)
  const realShorts = useMemo(() => {
    const fromVideos = videos
      .filter(v => v.category === 'Shorts')
      .map(v => ({
        id: v.id,
        url: v.thumbnail,
        title: v.title,
        author: v.author,
        description: v.description || '',
        category: v.category,
        likes: Math.floor(v.views / 10) + 12,
        comments: Math.floor(v.views / 100) + 2,
        videoUrl: v.url
      }));
    
    // Only fall back to MOCK_SHORTS if we are not loading AND have no real shorts
    if (isLoadingVideos) return [];
    return fromVideos.length > 0 ? fromVideos : (isRealContent ? [] : MOCK_SHORTS);
  }, [videos, isLoadingVideos, isRealContent]);

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

  // ─── Deep-link: ?v=videoId&t=seconds ─────────────────────────────────────
  const [pendingDeepLink, setPendingDeepLink] = useState<{ videoId: string; timestamp: number } | null>(null);

  // Read URL params once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('v');
    const timestamp = parseInt(params.get('t') || '0', 10);
    if (videoId) {
      setPendingDeepLink({ videoId, timestamp: isNaN(timestamp) ? 0 : timestamp });
      // Bypass landing page so the linked video is immediately accessible
      try { localStorage.setItem('tube_entered_app', '1'); } catch {}
      setShowLanding(false);
    }
  }, []);

  // Once videos are loaded, scroll to the linked video and fire a play event
  useEffect(() => {
    if (!pendingDeepLink || videos.length === 0) return;
    const { videoId, timestamp } = pendingDeepLink;
    const timer = setTimeout(() => {
      const el = document.getElementById(`video-${videoId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.dispatchEvent(
          new CustomEvent('tube-deep-link', { detail: { videoId, timestamp } })
        );
        setPendingDeepLink(null);
        // Clean the URL without a page reload
        window.history.replaceState({}, '', window.location.pathname);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [pendingDeepLink, videos]);

  // Hero spotlight index — advance logic lives in HomeView (owns the progress bar)
  const [heroIndex, setHeroIndex] = useState(0);

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
        return ['All', 'Trending', 'New Releases', 'Most Watched'];
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

  const filteredVideos = useMemo(() => {
    let filtered = videos;

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
        const customItem = navItems.find(i => i.id === currentView);
        if (customItem && customItem.isCustom) {
          filtered = filtered.filter(v =>
            v.tags?.some(tag => tag.toLowerCase().includes(customItem.label.toLowerCase())) ||
            v.category.toLowerCase().includes(customItem.label.toLowerCase())
          );
        }
      }
    }

    if (activeSubCategory && activeSubCategory !== 'All') {
      if (currentView === ViewState.HOME) {
        // HOME pills are sort modes ('Trending', 'New Releases', 'Most Watched')
        // — don't filter here; HomeView sorts and renders the appropriate grid
      } else if (currentView === ViewState.ORIGINALS) {
        filtered = filtered.filter(v => v.category === activeSubCategory || (activeSubCategory === 'Movies' && v.category === 'Originals'));
      } else {
        filtered = filtered.filter(v =>
          v.genre?.includes(activeSubCategory) ||
          v.tags?.includes(activeSubCategory) ||
          v.title.includes(activeSubCategory)
        );
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(video =>
        video.title.toLowerCase().includes(query) ||
        video.category.toLowerCase().includes(query) ||
        video.author.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [videos, currentView, activeSubCategory, searchQuery, navItems]);

  const suggestions = useMemo(() => {
    if (!searchInput || searchInput.length < 2) return [];
    const q = searchInput.toLowerCase();
    return videos
      .filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.author.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
      )
      .sort((a, b) => b.views - a.views)
      .slice(0, 6);
  }, [searchInput, videos]);

  const toggleWatchLater = useCallback((id: string) => {
    setWatchLater(prev => {
      const next = prev.includes(id)
        ? prev.filter(videoId => videoId !== id)
        : [...prev, id];
      try { localStorage.setItem('tube_watch_later', JSON.stringify(next)); } catch { }
      return next;
    });
  }, []);

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


  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (value && currentView !== ViewState.HOME) {
      setCurrentView(ViewState.HOME);
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchQuery(value), 300);
  }, [currentView]);

  const clearSearch = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSearchInput('');
    setSearchQuery('');
    setShowSuggestions(false);
  }, []);

  const selectSuggestion = useCallback((title: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSearchInput(title);
    setSearchQuery(title);
    setShowSuggestions(false);
    if (currentView !== ViewState.HOME) setCurrentView(ViewState.HOME);
  }, [currentView]);

  const handleNavigate = (view: ViewStateOrString) => {
    // Guard: Kids Mode restricts navigation to safe views
    if (isKidsMode && typeof view === 'string' && !KIDS_SAFE_VIEWS.has(view)) {
      setKidsModalMode('deactivate');
      return;
    }
    // Guard: Settings and Admin require authentication
    if (view === ViewState.SETTINGS && !isAuthenticated) {
      setShowLogin(true);
      return;
    }
    // Guard: Admin requires admin role
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
      // Clear any pending search so showCarousels isn't stuck false on the new view
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      setSearchInput('');
      setSearchQuery('');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentView(ViewState.HOME);
  };

  // Derive phone for display from Supabase user metadata
  const userPhone = currentUser?.user_metadata?.phone
    || currentUser?.email?.replace('@tube.ke', '')
    || null;

  // Show a brief loading state while Supabase resolves the session
  if (isAuthLoading) {
    return (
      <div className="bg-zinc-950 h-screen w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  // Show landing page for new / unauthenticated visitors
  if (showLanding && !isAuthenticated) {
    return (
      <Suspense fallback={
        <div className="bg-zinc-950 h-screen w-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
        </div>
      }>
        <LandingPage
          onEnterApp={enterApp}
          onSignIn={() => { enterApp(); setShowLogin(true); }}
        />
      </Suspense>
    );
  }

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
        return <ShortsPlayer shorts={realShorts} recommendedVideos={recommendedVideos} onLoginRequest={() => setShowLogin(true)} />;
      case ViewState.LIVE:
        return <LiveSection isAuthenticated={isAuthenticated} />;
      case ViewState.SETTINGS:
        return <SettingsSection currentUser={currentUser} userPhone={userPhone} onLogout={handleLogout} />;
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
            hasFullAccess={isAdmin || isAuthenticated}
          />
        );

      case ViewState.LIKED:
        return (
          <LikedVideosView
            videos={videos}
            watchLaterIds={watchLater}
            onToggleWatchLater={toggleWatchLater}
            onCreatorClick={name => setCurrentView('creator:' + name)}
          />
        );

      case ViewState.ANALYTICS:
        if (!isAuthenticated) { setShowLogin(true); return null; }
        return (
          <AnalyticsDashboard
            currentNavItems={navItems}
            onAddCategory={handleAddCategory}
            onRemoveCategory={handleRemoveCategory}
            videos={bunnyItemsRef.current}
          />
        );

      case ViewState.UPLOAD:
        if (!isAuthenticated) { setShowLogin(true); return null; }
        return (
          <UploadSection
            onUploadComplete={handleUploadComplete}
            creatorName={userPhone || 'Creator'}
          />
        );

      // Default / Generic Grid View for Home and all Categories (System + Custom)
      default:
        return (
          <HomeView
            videos={videos}
            filteredVideos={filteredVideos}
            realShorts={realShorts}
            isLoadingVideos={isLoadingVideos}
            isRealContent={isRealContent}
            currentView={currentView}
            heroIndex={heroIndex}
            setHeroIndex={setHeroIndex}
            searchQuery={searchQuery}
            searchInput={searchInput}
            activeSubCategory={activeSubCategory}
            setActiveSubCategory={setActiveSubCategory}
            currentSubCategories={currentSubCategories}
            watchLater={watchLater}
            toggleWatchLater={toggleWatchLater}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            recommendedVideos={recommendedVideos}
            isRecLoading={isRecLoading}
            navItems={navItems}
            setCurrentView={setCurrentView}
            setShowLogin={setShowLogin}
          />
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-white font-sans selection:bg-red-500 selection:text-white">
      {/* Kids Mode Modal */}
      {kidsModalMode && (
        <KidsModeModal
          mode={kidsModalMode}
          onSuccess={() => {
            const nowActive = isKidsModeActive();
            setIsKidsMode(nowActive);
            setKidsModalMode(null);
            if (nowActive) setCurrentView(ViewState.KIDS);
          }}
          onCancel={() => setKidsModalMode(null)}
        />
      )}

      {/* Phone + PIN Auth Modal (overlays everything) */}
      {showLogin && !isAuthenticated && (
        <AuthModal
          onSuccess={(user) => {
            setCurrentUser(user);
            setIsAuthenticated(true);
            setShowLogin(false);
            setCurrentView(ViewState.HOME);
          }}
          onCancel={() => setShowLogin(false)}
        />
      )}

      {/* Sidebar */}
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
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                <Menu className="text-zinc-300" />
              </button>
              <span className="font-bold text-xl tracking-tighter">Tube</span>
            </div>

            {/* DEV ONLY — quick landing page preview toggle */}
            {import.meta.env.DEV && (
              <button
                onClick={() => {
                  try { localStorage.removeItem('tube_entered_app'); } catch {}
                  setShowLanding(true);
                }}
                className="hidden md:flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border border-dashed border-zinc-600 text-zinc-500 hover:border-red-500 hover:text-red-400 transition-colors flex-shrink-0"
                title="Preview landing page (dev only)"
              >
                ↩ Landing
              </button>
            )}

            {/* Desktop Search Bar */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
              <input
                type="text"
                value={searchInput}
                onChange={handleSearch}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder={t('common.search')}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2 pl-10 pr-10 text-zinc-300 focus:outline-none focus:border-zinc-600 focus:bg-black transition-all"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl z-[100]">
                  {suggestions.map(v => (
                    <button
                      key={v.id}
                      onMouseDown={() => selectSuggestion(v.title)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors text-left"
                    >
                      <Search size={12} className="text-zinc-600 flex-shrink-0" />
                      <span className="text-zinc-200 text-sm truncate flex-1">{v.title}</span>
                      <span className="text-zinc-600 text-xs flex-shrink-0">{v.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 md:gap-4">
              {/* Mobile Search Toggle */}
              <button
                className="md:hidden text-zinc-400 hover:text-white transition-colors"
                onClick={() => {
                  setIsMobileSearchOpen(!isMobileSearchOpen);
                  if (!isMobileSearchOpen) setTimeout(() => document.getElementById('mobile-search-input')?.focus(), 100);
                }}
              >
                {isMobileSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
              </button>

              {/* Data usage pill */}
              <button
                onClick={() => handleNavigate(ViewState.OFFLINE)}
                className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-blue-400 border border-zinc-800 hover:border-blue-500/30 rounded-full px-2.5 py-1 transition-all"
                title="Data usage & offline saves"
              >
                <WifiOff size={10} />
                <span>Offline</span>
              </button>

              {/* Watch history pill */}
              <button
                onClick={() => handleNavigate(ViewState.HISTORY)}
                className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/30 rounded-full px-2.5 py-1 transition-all"
                title="Watch history"
              >
                <History size={10} />
                <span>History</span>
              </button>

              {/* Kids Mode toggle */}
              <button
                onClick={() => setKidsModalMode(isKidsMode ? 'deactivate' : 'activate')}
                className={`hidden sm:flex items-center gap-1 text-[10px] font-bold rounded-full px-2.5 py-1 transition-all border ${isKidsMode ? 'bg-violet-600/20 text-violet-300 border-violet-500/50 hover:bg-violet-600/30' : 'text-zinc-500 border-zinc-800 hover:text-violet-400 hover:border-violet-500/30'}`}
                title={isKidsMode ? 'Exit Kids Mode' : 'Enable Kids Mode'}
              >
                <Baby size={10} />
                <span>{isKidsMode ? 'Kids ON' : 'Kids'}</span>
              </button>

              {/* Language toggle — EN / SW */}
              <button
                onClick={toggleLanguage}
                className="flex items-center text-[11px] font-black tracking-wider rounded-full overflow-hidden border border-zinc-700 flex-shrink-0"
                title={language === 'en' ? 'Switch to Kiswahili' : 'Switch to English'}
              >
                <span className={`px-2.5 py-1 transition-colors ${language === 'en' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>EN</span>
                <span className={`px-2.5 py-1 transition-colors ${language === 'sw' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>SW</span>
              </button>

              <NotificationPanel
                onNavigateVideo={id => {
                  const v = videos.find(x => x.id === id);
                  if (v) setCurrentView(ViewState.HOME);
                }}
              />
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
                value={searchInput}
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

        {/* Kids Mode Banner */}
        {isKidsMode && (
          <div className="flex items-center justify-between px-4 py-2 bg-violet-950/80 border-b border-violet-800/40">
            <div className="flex items-center gap-2">
              <Baby size={14} className="text-violet-300" />
              <span className="text-violet-200 text-xs font-black tracking-wide">KIDS MODE ON</span>
              <span className="text-violet-400 text-xs">— Safe content only</span>
            </div>
            <button
              onClick={() => setKidsModalMode('deactivate')}
              className="text-[10px] font-bold text-violet-400 hover:text-violet-200 border border-violet-700 hover:border-violet-400 rounded-full px-2.5 py-0.5 transition-all"
            >Exit</button>
          </div>
        )}

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-zinc-950 no-scrollbar">
          <Suspense fallback={
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            </div>
          }>
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
  );
};

export default App;
