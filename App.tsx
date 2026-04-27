
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import VideoCard from './components/VideoCard';
import VideoCarousel from './components/VideoCarousel';
import SeriesCarousel from './components/SeriesCarousel';
import ShortsPlayer from './components/ShortsPlayer';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AdminDashboard from './components/AdminDashboard';
import UploadSection from './components/UploadSection';
import WatchLaterSection from './components/WatchLaterSection';
import AuthModal from './components/AuthModal';
import ShortsShelf from './components/ShortsShelf';
import SettingsSection from './components/SettingsSection';
import LiveSection from './components/LiveSection';
import { ViewState, Video, NavItem, ViewStateOrString } from './types';
import { MOCK_VIDEOS, MOCK_SHORTS, PAYWALL_ENABLED } from './constants';
import { Menu, Search, Bell, X, LogIn, Sparkles, Loader2, GraduationCap, Sprout, Heart, Globe, PlayCircle, Home, Clapperboard, Smartphone, Clock, UploadCloud, BarChart2, Star, Music, Gamepad2, Utensils, Cpu, BookOpen, Coffee, Briefcase, Anchor, Zap, Film } from 'lucide-react';
import { getVideoRecommendations } from './services/geminiService';
import { fetchBunnyVideos, bunnyVideoToVideo } from './services/bunnyService';
import { supabase, normalizePhone } from './lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useLanguage } from './contexts/LanguageContext';
import { TranslationKey } from './translations';

// Admin emails/phones — add yours here
const ADMIN_EMAILS = ['admin@tubeKenya.co.ke'];
const ADMIN_PHONES = ['+254724457435']; // Replace with your actual admin phone

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

const App: React.FC = () => {
  const { t } = useLanguage();
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
  const [searchQuery, setSearchQuery] = useState('');

  // --- REAL AUTH: Supabase session ---
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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
      ADMIN_PHONES.map(normalizePhone).includes(normalizePhone(currentUser.user_metadata?.phone || '')) ||
      ADMIN_PHONES.includes(currentUser.phone ?? '')
    : false;

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
          console.log('Mapped Videos (first 2):', mapped.slice(0, 2));
          setVideos(mapped);
          setIsRealContent(true);
        } else {
          console.log('No Bunny items found, keeping mock data.');
        }
      } catch (err) {
        console.warn('Bunny load failed, showing demo content:', err);
      } finally {
        if (!cancelled) setIsLoadingVideos(false);
      }
    };
    loadVideos();
    return () => { cancelled = true; };
  }, []);

  // Derive real shorts from the videos library (tagged with 'Shorts' category)
  const realShorts = useMemo(() => {
    const fromVideos = videos
      .filter(v => v.category === 'Shorts')
      .map(v => ({
        id: v.id,
        url: v.thumbnail,
        author: v.author,
        description: v.description || v.title,
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

  // Hero spotlight: cycles through top 5 videos
  const [heroIndex, setHeroIndex] = useState(0);
  useEffect(() => {
    if (videos.length === 0) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % Math.min(5, videos.length));
    }, 8000);
    return () => clearInterval(timer);
  }, [videos]);

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
    setWatchLater(prev => {
      const next = prev.includes(id)
        ? prev.filter(videoId => videoId !== id)
        : [...prev, id];
      try { localStorage.setItem('tube_watch_later', JSON.stringify(next)); } catch { }
      return next;
    });
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

  const handleNavigate = (view: ViewStateOrString) => {
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
        return <ShortsPlayer shorts={realShorts} />;
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
                      <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">#1 In Kenya</span>
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
                        onClick={() => document.getElementById(`video-${hero.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
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
                <span className="text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">LIVE</span>
              ) : !isLoadingVideos && (
                <span className="text-sm text-zinc-500">({filteredVideos.length})</span>
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
                  isAuthenticated={!PAYWALL_ENABLED || isAuthenticated}
                />

                {/* 📺 Series Carousel — groups episodes by seriesTitle/season */}
                <SeriesCarousel
                  videos={videos.filter(v => v.category === 'Series' || v.category === 'Originals')}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={!PAYWALL_ENABLED || isAuthenticated}
                  onSubscribeRequest={() => setShowLogin(true)}
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
                      isAuthenticated={!PAYWALL_ENABLED || isAuthenticated}
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
                          isAuthenticated={!PAYWALL_ENABLED || isAuthenticated}
                          onSubscribeRequest={() => setShowLogin(true)}
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
                          isAuthenticated={!PAYWALL_ENABLED || isAuthenticated}
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
                        isSubscribed={!PAYWALL_ENABLED || isAuthenticated}
                        onSubscribeRequest={() => setShowLogin(true)}
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
                            isSubscribed={!PAYWALL_ENABLED || isAuthenticated}
                            onSubscribeRequest={() => setShowLogin(true)}
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

  return (
    <div className="flex h-screen bg-zinc-950 text-white font-sans selection:bg-red-500 selection:text-white">
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

            {/* Desktop Search Bar */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
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
            </div>

            <div className="flex items-center gap-3 md:gap-6">
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

              <button className="relative">
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
          {renderContent()}
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
