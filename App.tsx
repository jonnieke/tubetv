import React, { Suspense, lazy, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CinemaNavigation from './components/CinemaNavigation';
import LandingHero from './components/LandingHero';
import LandingFooter from './components/LandingFooter';
import {
  CreatorOriginalsSpotlight,
  LandingPassRibbon,
  TopTenCarousel,
} from './components/LandingShowcase';
import MicroDramaComingSoon from './components/MicroDramaComingSoon';
import ViewerWelcome from './components/ViewerWelcome';
import CatalogueArtwork from './components/CatalogueArtwork';
import BrowseIntro from './components/BrowseIntro';
import CatalogueEmptyState from './components/CatalogueEmptyState';
import ShortsShelf from './components/ShortsShelf';
import PWAInstallBanner from './components/PWAInstallBanner';
import PushNotificationPrompt from './components/PushNotificationPrompt';
import { ViewState, Video, NavItem, ViewStateOrString } from './types';
import { CONTENT_RATING_ENFORCED, MOCK_VIDEOS, MOCK_SHORTS } from './constants';
import {
  X,
  Loader2,
  Check,
  Share2,
  GraduationCap,
  Sprout,
  Heart,
  Globe,
  PlayCircle,
  Home,
  Clapperboard,
  Smartphone,
  Clock,
  UploadCloud,
  BarChart2,
  Star,
  Music,
  Gamepad2,
  Utensils,
  Cpu,
  BookOpen,
  Coffee,
  Briefcase,
  Anchor,
  Zap,
  Film,
  type LucideIcon,
} from 'lucide-react';
import { fetchBunnyVideos, fetchBunnyVideoById, bunnyVideoToVideo } from './services/bunnyService';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useLanguage } from './contexts/LanguageContext';
import { isAdminUser } from './lib/authorization';
import { featuredMovies } from './lib/featured';
import { clearLocalAuthSession } from './lib/localAuth';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { verifiedActiveAdminUser } from './lib/adminSession';
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
import LegalPage from './components/LegalPage';
import { trackEvent } from './lib/analytics';
import { compareEpisodes, isMicroDrama, nextEpisode, seriesKey } from './lib/series';
import { filterDiscoveryVideos, filterVideosByRating, isKidsVideo } from './lib/discovery';
import { recommendVideos, getRelatedVideos } from './lib/recommendations';
import { normalizeContentRating, PUBLIC_CONTENT_RATINGS } from './lib/contentRating';
import { shouldSaveData } from './lib/network';
import { isLongFormatVideo, isVideoLocked } from './lib/monetization';
import {
  clearStoredPass,
  fetchActiveSubscription,
  getRememberedPhone,
  getStoredPass,
  restorePassByPhone,
  restorePaystackPass,
} from './lib/subscriptions';
import type { SettingsTabId } from './components/SettingsSection';
import { TranslationKey } from './translations';

function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await importer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isDynamicChunkError =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module') ||
        (err as any)?.name === 'ChunkLoadError';

      if (isDynamicChunkError && typeof window !== 'undefined') {
        const lastReload = Number(sessionStorage.getItem('tubetv_chunk_reload_ts') || 0);
        if (Date.now() - lastReload > 8_000) {
          sessionStorage.setItem('tubetv_chunk_reload_ts', String(Date.now()));
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw err;
    }
  });
}

const VideoCard = lazyWithRetry(() => import('./components/VideoCard'));
const VideoCarousel = lazyWithRetry(() => import('./components/VideoCarousel'));
const SeriesCarousel = lazyWithRetry(() => import('./components/SeriesCarousel'));
const ShortsPlayer = lazyWithRetry(() => import('./components/ShortsPlayer'));
const AnalyticsDashboard = lazyWithRetry(() => import('./components/AnalyticsDashboard'));
const AdminDashboard = lazyWithRetry(() => import('./components/AdminDashboard'));
const UploadSection = lazyWithRetry(() => import('./components/UploadSection'));
const WatchLaterSection = lazyWithRetry(() => import('./components/WatchLaterSection'));
const AuthModal = lazyWithRetry(() => import('./components/AuthModal'));
const PaywallModal = lazyWithRetry(() => import('./components/PaywallModal'));
const SettingsSection = lazyWithRetry(() => import('./components/SettingsSection'));
const LiveSection = lazyWithRetry(() => import('./components/LiveSection'));
const FilmmakerSubmissionModal = lazyWithRetry(() => import('./components/FilmmakerSubmissionModal'));

const DEMO_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const DEMO_VIDEOS = MOCK_VIDEOS.map((video) => ({
  ...video,
  url: video.url || DEMO_VIDEO_URL,
  contentRating: (['Kids', 'Education', 'Farmers', 'Faith'].includes(video.category) ? 'GE' : 'PG') as Video['contentRating'],
}));

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Clapperboard,
  Smartphone,
  GraduationCap,
  Sprout,
  Heart,
  Baby: PlayCircle,
  Globe,
  Radio: PlayCircle,
  Clock,
  UploadCloud,
  BarChart2,
  Star,
  Music,
  Game: Gamepad2,
  Food: Utensils,
  Tech: Cpu,
  News: BookOpen,
  Lifestyle: Coffee,
  Business: Briefcase,
  Travel: Anchor,
  Trending: Zap,
  Movie: Film,
};

const INITIAL_NAV_ITEMS: NavItem[] = [
  { id: ViewState.HOME, label: 'Home', labelKey: 'nav.home', iconName: 'Home', icon: Home },
  { id: ViewState.MICRO_DRAMAS, label: 'Micro Dramas', labelKey: 'nav.microDramas', iconName: 'Smartphone', icon: Smartphone },
  { id: ViewState.ORIGINALS, label: 'Originals', labelKey: 'nav.originals', iconName: 'Clapperboard', icon: Clapperboard },
  { id: ViewState.GENRES, label: 'Genres', labelKey: 'nav.genres', iconName: 'Movie', icon: Film },
  { id: ViewState.SHORTS, label: 'Shorts', labelKey: 'nav.shorts', iconName: 'Smartphone', icon: Smartphone },
  { id: ViewState.EDUCATION, label: 'Education', labelKey: 'nav.education', iconName: 'GraduationCap', icon: GraduationCap },
  { id: ViewState.FARMERS, label: 'Farmers', labelKey: 'nav.farmers', iconName: 'Sprout', icon: Sprout },
  { id: ViewState.FAITH, label: 'Faith', labelKey: 'nav.faith', iconName: 'Heart', icon: Heart },
  { id: ViewState.KIDS, label: 'Kids', labelKey: 'nav.kids', iconName: 'Baby', icon: PlayCircle },
  { id: ViewState.DIASPORA, label: 'Diaspora', labelKey: 'nav.diaspora', iconName: 'Globe', icon: Globe },
  { id: ViewState.LIVE, label: 'Live', labelKey: 'nav.live', iconName: 'Radio', icon: PlayCircle },
  { id: ViewState.WATCH_LATER, label: 'Watch List', labelKey: 'nav.watchlist', iconName: 'Clock', icon: Clock },
];

const BASE_GENRES = ['Drama', 'Comedy', 'Action', 'Romance', 'Animation', 'Swahili', 'Education', 'Kids', 'Documentary'];

const LoadingPanel = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="min-h-[320px] w-full flex flex-col items-center justify-center text-zinc-500">
    <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-3" />
    <p className="text-sm font-medium">{label}</p>
  </div>
);

const App: React.FC = () => {
  const { t, language } = useLanguage();
  const [currentView, setCurrentView] = useState<ViewStateOrString>(() => {
    if (typeof window === 'undefined') return ViewState.HOME;
    const params = new URLSearchParams(window.location.search);
    if (params.get('creator_code')) {
      return ViewState.SETTINGS;
    }
    const requestedView = params.get('view');
    if (requestedView && Object.values(ViewState).includes(requestedView as ViewState)) {
      return requestedView as ViewState;
    }
    return ViewState.HOME;
  });
  const [initialCreatorCode] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('creator_code') || '';
  });
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId>(() =>
    initialCreatorCode ? 'creator' : 'general'
  );
  const [selectedShortId, setSelectedShortId] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return new URLSearchParams(window.location.search).get('short') || undefined;
  });
  const [isVideoFinished, setIsVideoFinished] = useState(false);
  const [replayNonce, setReplayNonce] = useState(0);
  const [modalAutoPlay, setModalAutoPlay] = useState<boolean>(true);
  const [showFilmmakerForm, setShowFilmmakerForm] = useState(false);

  const [watchLater, setWatchLater] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tube_watch_later');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState('');

  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const playerDialogRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    clearLocalAuthSession();
    if (!isSupabaseConfigured) {
      setIsAuthLoading(false);
      return;
    }
    let active = true;
    void verifiedActiveAdminUser()
      .then((user) => {
        if (!active) return;
        setCurrentUser(user);
        setIsAuthenticated(Boolean(user));
        setIsAuthLoading(false);
      })
      .catch(() => {
        if (active) setIsAuthLoading(false);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        return;
      }
      setTimeout(() => {
        if (!active) return;
        void verifiedActiveAdminUser().then((user) => {
          if (!active) return;
          setCurrentUser(user);
          setIsAuthenticated(Boolean(user));
        });
      }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const [preferences, setPreferences] = useState<PlaybackPreferences>(DEFAULT_PLAYBACK_PREFERENCES);
  const [watchProgress, setWatchProgress] = useState<Record<string, WatchProgress>>({});
  const [hasActivePass, setHasActivePass] = useState<boolean>(() => Boolean(getStoredPass()));
  const [paywallVideo, setPaywallVideo] = useState<Video | null>(null);
  const [deviceSwitchedNotice, setDeviceSwitchedNotice] = useState<{ phone?: string; tier?: string } | null>(null);
  const [reclaimingPass, setReclaimingPass] = useState(false);
  const [expiringSoonMinutes, setExpiringSoonMinutes] = useState<number | null>(null);
  const [dismissedExpiryNotice, setDismissedExpiryNotice] = useState<boolean>(false);

  useEffect(() => {
    const checkPassExpiryWindow = () => {
      const stored = getStoredPass();
      if (!stored) {
        setExpiringSoonMinutes(null);
        return;
      }
      const remainingMs = new Date(stored.expiresAt).getTime() - Date.now();
      if (remainingMs > 0 && remainingMs <= 2 * 60 * 60 * 1000) {
        setExpiringSoonMinutes(Math.max(1, Math.ceil(remainingMs / 60000)));
      } else {
        setExpiringSoonMinutes(null);
      }
    };
    checkPassExpiryWindow();
    const timer = window.setInterval(checkPassExpiryWindow, 30000);
    window.addEventListener('tubetv:pass-updated', checkPassExpiryWindow);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('tubetv:pass-updated', checkPassExpiryWindow);
    };
  }, []);

  const refreshAccessState = useCallback(async () => {
    try {
      const sub = await fetchActiveSubscription(currentUser?.id);
      setHasActivePass(Boolean(sub?.is_active));
    } catch {
      setHasActivePass(Boolean(getStoredPass()));
    }
  }, [currentUser?.id]);

  useEffect(() => {
    void refreshAccessState();
    const handlePassUpdate = () => {
      const stored = getStoredPass();
      setHasActivePass(Boolean(stored));
      if (stored) setDeviceSwitchedNotice(null);
      void refreshAccessState();
    };
    const handleDeviceSwitched = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string; tier?: string }>).detail || {};
      setHasActivePass(false);
      setDeviceSwitchedNotice({
        phone: detail.phone || getRememberedPhone() || undefined,
        tier: detail.tier,
      });
    };
    window.addEventListener('tubetv:pass-updated', handlePassUpdate);
    window.addEventListener('tubetv:device-switched', handleDeviceSwitched);

    // Auto-restore pass if returning from a Paystack redirect callback
    const searchParams = new URLSearchParams(window.location.search);
    const paystackRef = searchParams.get('paystack_ref') || searchParams.get('reference');
    if (paystackRef && /^TUBE_[A-Z0-9_-]+$/i.test(paystackRef)) {
      restorePaystackPass(paystackRef)
        .then(() => {
          searchParams.delete('paystack_ref');
          searchParams.delete('reference');
          const cleanSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
          setHasActivePass(true);
          void refreshAccessState();

          // Restore where the viewer left off
          const returnVideoId =
            sessionStorage.getItem('tubetv_paywall_target_video_id') ||
            localStorage.getItem('tubetv_last_watched_video_id');
          if (returnVideoId) {
            const targetVideo = videos.find((v) => v.id === returnVideoId);
            if (targetVideo) {
              window.history.replaceState({}, '', `${videoPath(targetVideo.id)}${cleanSearch}`);
              setActiveHeroVideo(targetVideo);
              return;
            }
          }
          window.history.replaceState({}, '', `${window.location.pathname}${cleanSearch}`);
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('tubetv:pass-updated', handlePassUpdate);
      window.removeEventListener('tubetv:device-switched', handleDeviceSwitched);
    };
  }, [refreshAccessState]);

  const handleReclaimPassOnThisDevice = async () => {
    const targetPhone = deviceSwitchedNotice?.phone || getRememberedPhone();
    if (!targetPhone) {
      setDeviceSwitchedNotice(null);
      handleNavigate(ViewState.SETTINGS, 'pass');
      return;
    }
    try {
      setReclaimingPass(true);
      const res = await restorePassByPhone({ phone: targetPhone, forceSwitch: true });
      if (res.success && res.pass) {
        setHasActivePass(true);
        setDeviceSwitchedNotice(null);
        trackEvent('pass_restored', { tier: res.pass.tier, source: 'device_switched_banner', switched: true });
      } else {
        handleNavigate(ViewState.SETTINGS, 'pass');
      }
    } finally {
      setReclaimingPass(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const userId = currentUser?.id;
    const reloadLocalViewerState = () => {
      Promise.all([loadPreferences(userId), loadWatchList(userId), loadProgress(userId)]).then(
        ([nextPreferences, nextWatchLater, nextProgress]) => {
          if (cancelled) return;
          setPreferences(nextPreferences);
          setWatchLater(nextWatchLater);
          setWatchProgress(nextProgress);
        },
      );
    };
    reloadLocalViewerState();
    window.addEventListener('tubetv:viewer-state-synced', reloadLocalViewerState);
    return () => {
      cancelled = true;
      window.removeEventListener('tubetv:viewer-state-synced', reloadLocalViewerState);
    };
  }, [currentUser?.id]);

  const handlePreferencesChange = (nextPreferences: PlaybackPreferences) => {
    setPreferences(nextPreferences);
    void savePreferences(currentUser?.id, nextPreferences);
  };

  const handleWatchProgress = (videoId: string, progress: WatchProgress) => {
    setWatchProgress((current) => ({ ...current, [videoId]: progress }));
    void saveProgress(currentUser?.id, videoId, progress);
  };

  const isAdmin = isAdminUser(currentUser);

  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isRealContent, setIsRealContent] = useState(false);
  const [catalogueError, setCatalogueError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadVideos = async (fresh = false) => {
      if (!isSupabaseConfigured && import.meta.env.DEV) {
        setVideos(DEMO_VIDEOS);
        setIsRealContent(false);
        setIsLoadingVideos(false);
        return;
      }
      setIsLoadingVideos(true);
      setCatalogueError('');
      try {
        const bunnyItems = await fetchBunnyVideos(false, fresh);
        if (cancelled) return;
        if (bunnyItems.length > 0) {
          const mapped = bunnyItems.map(bunnyVideoToVideo) as Video[];
          const publicItems = mapped.filter((video) => !video.muted);
          const visible = CONTENT_RATING_ENFORCED
            ? publicItems.filter((video) => PUBLIC_CONTENT_RATINGS.includes(normalizeContentRating(video.contentRating)))
            : publicItems.filter((video) => normalizeContentRating(video.contentRating) !== '18');
          setVideos(visible.length > 0 ? visible : []);
          setIsRealContent(true);
        } else {
          setVideos([]);
          setIsRealContent(true);
        }
      } catch (err) {
        console.error('Catalogue load failed:', err);
        if (!cancelled) {
          setVideos([]);
          setIsRealContent(false);
          setCatalogueError('The catalogue could not be loaded. Please try again.');
        }
      } finally {
        if (!cancelled) setIsLoadingVideos(false);
      }
    };

    void loadVideos(false);

    const onVisibilityChange = (event: Event) => {
      const { videoId, hidden } = (event as CustomEvent<{ videoId: string; hidden: boolean }>).detail;
      if (hidden) {
        setVideos((current) => current.filter((video) => video.id !== videoId));
      } else {
        void loadVideos(true);
      }
    };
    const onCatalogueChange = () => {
      void loadVideos(true);
    };

    window.addEventListener('tube-visibility-change', onVisibilityChange);
    window.addEventListener('tube-catalogue-change', onCatalogueChange);
    return () => {
      cancelled = true;
      window.removeEventListener('tube-visibility-change', onVisibilityChange);
      window.removeEventListener('tube-catalogue-change', onCatalogueChange);
    };
  }, []);

  // Enforce viewer maximumRating across discovery shelves, hero, recommendations, and Shorts
  const ratingFilteredVideos = useMemo(
    () => filterVideosByRating(videos, preferences.maximumRating, CONTENT_RATING_ENFORCED),
    [videos, preferences.maximumRating],
  );

  const realShorts = useMemo(() => {
    const fromVideos = ratingFilteredVideos
      .filter((v) => v.category === 'Shorts')
      .map((v) => ({
        id: v.id,
        thumbnail: v.thumbnail,
        author: v.author,
        description: v.description || v.title,
        likes: 0,
        comments: 0,
        videoUrl: v.url || '',
      }));

    if (isLoadingVideos) return [];
    return fromVideos.length > 0 ? fromVideos : isRealContent ? [] : MOCK_SHORTS;
  }, [ratingFilteredVideos, isLoadingVideos, isRealContent]);

  useEffect(() => {
    if (isLoadingVideos) return;
    trackEvent('catalogue_view', { videoCount: ratingFilteredVideos.length, source: isRealContent ? 'bunny' : 'demo' });
  }, [isLoadingVideos, isRealContent, ratingFilteredVideos.length]);

  const [navItems, setNavItems] = useState<NavItem[]>(() => {
    try {
      const saved = localStorage.getItem('tube_nav_items');
      if (saved) {
        const parsed = JSON.parse(saved) as NavItem[];
        const gamingCount = parsed.filter((item) => item.labelKey === 'nav.gaming').length;
        if (gamingCount > 1) {
          localStorage.removeItem('tube_nav_items');
          return INITIAL_NAV_ITEMS;
        }

        if (!parsed.some((item) => item.id === ViewState.MICRO_DRAMAS)) {
          parsed.splice(1, 0, INITIAL_NAV_ITEMS[1]);
        } else {
          const micro = parsed.find((item) => item.id === ViewState.MICRO_DRAMAS);
          if (micro && !micro.labelKey) micro.labelKey = 'nav.microDramas';
        }

        if (!parsed.some((item) => item.id === ViewState.GENRES)) {
          const originalsIdx = parsed.findIndex((item) => item.id === ViewState.ORIGINALS);
          parsed.splice(originalsIdx >= 0 ? originalsIdx + 1 : 3, 0, INITIAL_NAV_ITEMS[3]);
        }

        return parsed.map((item) => ({
          ...item,
          icon: ICON_MAP[item.iconName || 'PlayCircle'] || PlayCircle,
        }));
      }
    } catch {
      // Ignore storage error
    }
    return INITIAL_NAV_ITEMS;
  });

  useEffect(() => {
    const serializable = navItems.map(({ icon, ...rest }) => rest);
    try {
      localStorage.setItem('tube_nav_items', JSON.stringify(serializable));
    } catch {
      // Ignore storage error
    }
  }, [navItems]);

  const [heroIndex, setHeroIndex] = useState(0);
  const heroMovies = useMemo(() => featuredMovies(ratingFilteredVideos), [ratingFilteredVideos]);
  const [activeHeroVideo, setActiveHeroVideo] = useState<Video | null>(null);

  useEffect(() => {
    if (!activeHeroVideo) return;
    const previous = document.activeElement as HTMLElement | null;
    const close = playerDialogRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close player"]');
    close?.focus();
    const trap = (event: KeyboardEvent) => {
      if (paywallVideo || event.key !== 'Tab') return;
      const controls = playerDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [activeHeroVideo?.id, paywallVideo]);

  const openVideo = useCallback(
    (video: Video, options?: { autoPlay?: boolean }) => {
      try {
        sessionStorage.setItem('tubetv_paywall_target_video_id', video.id);
        localStorage.setItem('tubetv_last_watched_video_id', video.id);
      } catch {}

      if (!isLongFormatVideo(video) && isVideoLocked(video, hasActivePass)) {
        setPaywallVideo(video);
        return;
      }
      setIsVideoFinished(false);
      setModalAutoPlay(options?.autoPlay ?? true);
      window.history.pushState({}, '', videoPath(video.id));
      setActiveHeroVideo(video);
    },
    [hasActivePass],
  );

  const closeVideo = useCallback(() => {
    setIsVideoFinished(false);
    if (window.location.pathname.startsWith('/watch/')) {
      window.history.pushState({}, '', '/');
    }
    setActiveHeroVideo(null);
  }, []);

  const [playerShareCopied, setPlayerShareCopied] = useState(false);

  const handleShareCurrentVideo = async (video: Video) => {
    const shareUrl = `${window.location.origin}/watch/${encodeURIComponent(video.id)}`;
    const shareTitle = video.seriesTitle || video.title;
    const shareText = `Watch "${shareTitle}" on TubeTV: ${shareUrl}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Watch ${video.title} on TubeTV`,
          url: shareUrl,
        });
        trackEvent('video_shared', { videoId: video.id, method: 'native_share' });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setPlayerShareCopied(true);
        setTimeout(() => setPlayerShareCopied(false), 2500);
        trackEvent('video_shared', { videoId: video.id, method: 'clipboard' });
      } catch {
        const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        window.open(waUrl, '_blank', 'noopener');
      }
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(waUrl, '_blank', 'noopener');
    }
  };

  const handleVideoEnded = (videoId: string) => {
    // Only auto-advance modal playback, never hijack screen when an inline browse card ends
    if (!activeHeroVideo || activeHeroVideo.id !== videoId) return;
    setIsVideoFinished(true);
    if (!preferences.autoplay || shouldSaveData(preferences.dataSaver)) return;
    const nextVideo = nextEpisode(ratingFilteredVideos, videoId);
    if (nextVideo) {
      if (!isLongFormatVideo(nextVideo) && isVideoLocked(nextVideo, hasActivePass)) {
        setPaywallVideo(nextVideo);
      } else {
        trackEvent('episode_next', { fromVideoId: videoId, toVideoId: nextVideo.id, automatic: true });
        openVideo(nextVideo);
      }
    }
  };

  const playerRecommendations = useMemo(() => {
    if (!activeHeroVideo) return [];
    return getRelatedVideos(activeHeroVideo, ratingFilteredVideos, 8);
  }, [activeHeroVideo, ratingFilteredVideos]);

  useEffect(() => {
    let active = true;
    const syncRoute = async () => {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const shortParam = params.get('short');
      if (viewParam === ViewState.SHORTS) {
        setCurrentView(ViewState.SHORTS);
        setSelectedShortId(shortParam || undefined);
      }

      const match = window.location.pathname.match(/^\/watch\/([^/]+)$/);
      const queryVideoId = params.get('v') || params.get('watch');
      const seriesParam = params.get('series') || params.get('drama');

      let id = match ? decodeURIComponent(match[1]) : queryVideoId ? decodeURIComponent(queryVideoId) : '';

      if (!id && seriesParam) {
        const needle = decodeURIComponent(seriesParam).toLowerCase();
        const matched = videos
          .filter((v) =>
            (v.seriesTitle && v.seriesTitle.toLowerCase().includes(needle)) ||
            (v.title && v.title.toLowerCase().includes(needle))
          )
          .sort(compareEpisodes);
        if (matched[0]) {
          id = matched[0].id;
        }
      }

      if (!id) {
        setActiveHeroVideo(null);
        return;
      }
      const video = videos.find((item) => item.id === id);
      if (video) {
        if (!isLongFormatVideo(video) && isVideoLocked(video, hasActivePass)) {
          setPaywallVideo(video);
        } else {
          setActiveHeroVideo(video);
        }
        return;
      }

      try {
        const item = await fetchBunnyVideoById(id);
        if (active && item) {
          const directVideo = bunnyVideoToVideo(item) as Video;
          if (directVideo.muted || normalizeContentRating(directVideo.contentRating) === '18') return;
          if (!isLongFormatVideo(directVideo) && isVideoLocked(directVideo, hasActivePass)) {
            setPaywallVideo(directVideo);
          } else {
            setActiveHeroVideo(directVideo);
          }
        }
      } catch {
        // Leave activeHeroVideo unchanged on error
      }
    };
    void syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => {
      active = false;
      window.removeEventListener('popstate', syncRoute);
    };
  }, [videos, hasActivePass]);

  useEffect(() => {
    const pathname = window.location.pathname;
    if (pathname === '/privacy' || pathname === '/terms') return;
    setVideoMetadata(activeHeroVideo || undefined);
  }, [activeHeroVideo]);

  useEffect(() => {
    if (!activeHeroVideo) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (paywallVideo) return;
      if (event.key === 'Escape') closeVideo();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeHeroVideo, paywallVideo, closeVideo]);

  const recommendations = useMemo(
    () => recommendVideos(ratingFilteredVideos, watchProgress, watchLater),
    [ratingFilteredVideos, watchProgress, watchLater],
  );

  const availableGenres = useMemo(() => {
    const seen = new Set(BASE_GENRES.map((g) => g.toLowerCase()));
    const dynamic: string[] = [...BASE_GENRES];
    for (const v of ratingFilteredVideos) {
      const raw = v.genre?.trim();
      if (!raw) continue;
      for (const part of raw.split(/[,/&]/).map((s) => s.trim()).filter(Boolean)) {
        const lower = part.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          dynamic.push(part.charAt(0).toUpperCase() + part.slice(1));
        }
      }
    }
    return dynamic;
  }, [ratingFilteredVideos]);

  const translatedNavItems = navItems.map((item) => ({
    ...item,
    label: item.labelKey ? t(item.labelKey as TranslationKey) : item.label,
  }));

  const [activeSubCategory, setActiveSubCategory] = useState('Trending');

  const getSubCategories = (view: ViewStateOrString) => {
    switch (view) {
      case ViewState.EDUCATION:
        return ['All', 'CBC', 'High School', 'Revision', 'AI Learning', 'Teachers'];
      case ViewState.FARMERS:
        return ['All', 'Crops', 'Livestock', 'Climate', 'Agribusiness', 'Dairy'];
      case ViewState.FAITH:
        return ['All', 'Sermons', 'Kids Bible', 'Worship', 'Devotion'];
      case ViewState.DIASPORA:
        return ['All', 'East Africa', 'West Africa', 'Southern Africa', 'Diaspora Stories', 'Investments', 'Events', 'News', 'Culture'];
      case ViewState.KIDS:
        return ['All', 'Cartoons', 'Learning', 'Songs', 'Stories'];
      case ViewState.ORIGINALS:
        return ['All', 'Series', 'Movies', 'Micro Dramas', 'Drama', 'Comedy', 'Action', 'Romance', 'Animation', 'Swahili'];
      case ViewState.GENRES:
        return ['All', ...availableGenres];
      case ViewState.LIVE:
        return ['All', 'Sports', 'News', 'Events'];
      case ViewState.HOME:
        return ['Trending', 'New Releases', 'Most Watched'];
      case ViewState.MICRO_DRAMAS:
        return ['All'];
      default:
        return ['All'];
    }
  };

  const currentSubCategories = getSubCategories(currentView);

  const handleUploadComplete = (newVideo: Video) => {
    setVideos((prev) => [newVideo, ...prev.filter((video) => video.id !== newVideo.id)]);
  };

  const handleAddCategory = (name: string, iconName: string) => {
    const newId = `CAT_${name.toUpperCase().replace(/\s+/g, '_')}`;
    const newItem: NavItem = {
      id: newId,
      label: name,
      iconName,
      icon: ICON_MAP[iconName] || Star,
      isCustom: true,
    };

    setNavItems((prev) => {
      const watchListIndex = prev.findIndex((i) => i.id === ViewState.WATCH_LATER);
      const newItems = [...prev];
      if (watchListIndex !== -1) {
        newItems.splice(watchListIndex, 0, newItem);
      } else {
        newItems.push(newItem);
      }
      return newItems;
    });
  };

  const handleRemoveCategory = (id: string) => {
    setNavItems((prev) => prev.filter((item) => item.id !== id));
    if (currentView === id) {
      setCurrentView(ViewState.HOME);
    }
  };

  const customCategory = navItems.find((item) => item.id === currentView && item.isCustom)?.label;
  const filteredVideos = useMemo(
    () => filterDiscoveryVideos(ratingFilteredVideos, currentView, activeSubCategory, searchQuery, customCategory),
    [ratingFilteredVideos, currentView, activeSubCategory, searchQuery, customCategory],
  );

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [currentView, activeSubCategory]);

  const toggleWatchLater = (id: string) => {
    const shouldSave = !watchLater.includes(id);
    setWatchLater((current) => (shouldSave ? [...current, id] : current.filter((videoId) => videoId !== id)));
    void persistWatchLater(currentUser?.id, id, shouldSave);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value && mainRef.current) mainRef.current.scrollTop = 0;
    if (e.target.value && currentView !== ViewState.HOME) {
      setCurrentView(ViewState.HOME);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleNavigate = (view: ViewStateOrString, category?: string) => {
    if (view === ViewState.SETTINGS) {
      const validTabs: SettingsTabId[] = ['general', 'pass', 'account', 'privacy'];
      setSettingsInitialTab(validTabs.includes(category as SettingsTabId) ? (category as SettingsTabId) : 'general');
    }
    if (view === ViewState.ADMIN && !isAdmin) {
      return;
    }
    if (view !== ViewState.SHORTS) {
      setSelectedShortId(undefined);
    }
    const item = navItems.find((i) => i.id === view);
    if (item?.restricted && !isAuthenticated) {
      setShowLogin(true);
    } else {
      if (view !== ViewState.SETTINGS) {
        setActiveSubCategory(category || getSubCategories(view)[0]);
      }
      setSearchQuery('');
      setCurrentView(view);
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  };

  const handleLogout = async () => {
    clearLocalAuthSession();
    clearStoredPass();
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setHasActivePass(false);
    setCurrentView(ViewState.HOME);
  };

  const userPhone = currentUser?.phone || null;

  // Render statutory legal pages immediately without blocking on auth or catalogue network calls
  const legalKind =
    typeof window !== 'undefined'
      ? window.location.pathname === '/privacy'
        ? 'privacy'
        : window.location.pathname === '/terms'
          ? 'terms'
          : null
      : null;
  if (legalKind) {
    return <LegalPage kind={legalKind} />;
  }

  if (isAuthLoading) {
    return (
      <div className="bg-zinc-950 h-screen w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  const hasMicroDramas = ratingFilteredVideos.some(isMicroDrama);

  const renderContent = () => {
    if (catalogueError) {
      return (
        <div role="alert" className="mx-auto max-w-lg p-12 text-center">
          <h1 className="font-serif text-3xl">Catalogue unavailable</h1>
          <p className="mt-4 text-zinc-400">{catalogueError}</p>
          <button
            type="button"
            className="cinema-primary mt-6"
            onClick={() => window.dispatchEvent(new Event('tube-catalogue-change'))}
          >
            {t('common.tryAgain')}
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
              <p className="text-zinc-400 font-medium">{t('common.loading')}</p>
            </div>
          );
        }
        return (
          <ShortsPlayer
            shorts={realShorts}
            initialShortId={selectedShortId}
            onExit={() => {
              setSelectedShortId(undefined);
              handleNavigate(ViewState.HOME);
            }}
          />
        );
      case ViewState.LIVE:
        return <LiveSection videos={isRealContent ? ratingFilteredVideos : []} />;
      case ViewState.SETTINGS:
        return (
          <SettingsSection
            initialTab={settingsInitialTab}
            initialCreatorCode={initialCreatorCode}
            videos={videos}
            currentUser={currentUser}
            userPhone={userPhone}
            onLogout={handleLogout}
            onLocalDataCleared={() => {
              setWatchLater([]);
              setWatchProgress({});
              setHasActivePass(false);
            }}
            preferences={preferences}
            onPreferencesChange={handlePreferencesChange}
          />
        );
      case ViewState.UPLOAD:
        if (!isAuthenticated) {
          return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <UploadCloud className="w-12 h-12 text-zinc-600 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Sign in to access creator tools</h2>
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-lg transition-colors"
              >
                {t('nav.login')}
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
                TubeTV is approving creators before opening uploads. This keeps the library trusted while creator tools
                are finalized.
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
                type="button"
                onClick={() => setShowLogin(true)}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-lg transition-colors"
              >
                {t('nav.login')}
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
                Creator dashboards will open after verified uploads and real engagement tracking are connected.
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
            videos={ratingFilteredVideos}
            watchLaterIds={watchLater}
            onToggleWatchLater={toggleWatchLater}
          />
        );

      default: {
        const genreCarousels =
          currentView === ViewState.GENRES && activeSubCategory === 'All'
            ? availableGenres
                .map((genre) => {
                  const genreVideos =
                    genre === 'Kids'
                      ? ratingFilteredVideos.filter(isKidsVideo)
                      : ratingFilteredVideos.filter(
                          (v) =>
                            (v.genre || '').toLowerCase().includes(genre.toLowerCase()) ||
                            (v.tags || []).some((tag) => tag.toLowerCase().includes(genre.toLowerCase())),
                        );
                  return { genre, videos: genreVideos };
                })
                .filter((g) => g.videos.length > 0)
            : [];

        return (
          <div
            className={
              currentView === ViewState.HOME && !searchQuery
                ? 'catalogue-page landing-page p-4 md:p-8 pb-24'
                : 'catalogue-page p-4 md:p-8 pb-24'
            }
          >
            {currentView === ViewState.HOME &&
              !searchQuery &&
              (() => {
                const featuredVideos = heroMovies.length ? heroMovies : !isRealContent ? ratingFilteredVideos.slice(0, 5) : [];
                const hero = featuredVideos.length ? featuredVideos[heroIndex % featuredVideos.length] : null;
                if (!hero) return null;
                return (
                  <>
                    <LandingHero
                      video={hero}
                      featuredVideos={featuredVideos}
                      real={isRealContent}
                      saved={watchLater.includes(hero.id)}
                      hasActivePass={hasActivePass}
                      dataSaver={shouldSaveData(preferences.dataSaver)}
                      onPlay={() => openVideo(hero, { autoPlay: true })}
                      onMoreInfo={() => openVideo(hero, { autoPlay: false })}
                      onSave={() => toggleWatchLater(hero.id)}
                      onRequireUnlock={(v) => setPaywallVideo(v)}
                      count={featuredVideos.length}
                      index={heroIndex % featuredVideos.length}
                      onSelect={setHeroIndex}
                    />
                    <LandingPassRibbon
                      hasActivePass={hasActivePass}
                      onUnlockPass={() => setPaywallVideo(hero)}
                    />
                  </>
                );
              })()}

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

            {!searchQuery && (
              <div className="flex gap-2.5 overflow-x-auto pb-4 mb-6 no-scrollbar sticky top-0 z-10 bg-zinc-950/90 backdrop-blur py-2 -mx-4 px-4 md:-mx-8 md:px-8">
                {currentSubCategories.map((cat) => {
                  const pillEmoji =
                    cat === 'Trending'
                      ? '🔥 '
                      : cat === 'Movies'
                        ? '🎬 '
                        : cat === 'Series'
                          ? '📺 '
                          : cat === 'Micro Dramas'
                            ? '📱 '
                            : cat === 'Diaspora'
                              ? '🌍 '
                              : cat === 'Farmers'
                                ? '🌾 '
                                : cat === 'Kids'
                                  ? '🧒 '
                                  : cat === 'Education'
                                    ? '🎓 '
                                    : cat === 'Faith'
                                      ? '✨ '
                                      : '';
                  return (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setActiveSubCategory(cat)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                        activeSubCategory === cat
                          ? 'bg-white text-black border-white shadow-sm'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:text-white'
                      }`}
                    >
                      {pillEmoji}
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}

            {currentView === ViewState.HOME && !searchQuery && !isLoadingVideos && !hasMicroDramas && (
              <MicroDramaComingSoon compact onExplore={() => handleNavigate(ViewState.MICRO_DRAMAS)} />
            )}
            {currentView === ViewState.HOME && !searchQuery && !isLoadingVideos && hasMicroDramas && (
              <SeriesCarousel
                title={t('shelf.microDramas')}
                videos={ratingFilteredVideos.filter(isMicroDrama)}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={isAuthenticated}
                onPlay={openVideo}
              />
            )}

            {currentView === ViewState.HOME && !searchQuery && recommendations.continueWatching.length > 0 && (
              <VideoCarousel
                title={t('shelf.continueWatching')}
                videos={recommendations.continueWatching}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={isAuthenticated}
              />
            )}
            {currentView === ViewState.HOME && !searchQuery && recommendations.forYou.length > 0 && (
              <VideoCarousel
                title={t('shelf.forYou')}
                videos={recommendations.forYou}
                watchLaterIds={watchLater}
                onToggleWatchLater={toggleWatchLater}
                isAuthenticated={isAuthenticated}
              />
            )}

            {currentView === ViewState.HOME && !searchQuery && realShorts.length > 0 && (
              <ShortsShelf
                shorts={realShorts}
                onShortClick={(shortId) => {
                  setSelectedShortId(shortId);
                  setCurrentView(ViewState.SHORTS);
                }}
              />
            )}

            {(searchQuery ||
              (currentView === ViewState.HOME && activeSubCategory !== 'Trending') ||
              (currentView === ViewState.ORIGINALS && activeSubCategory === 'All') ||
              (!Object.values(ViewState).includes(currentView as ViewState) && !searchQuery) ||
              ([ViewState.EDUCATION, ViewState.FARMERS, ViewState.FAITH, ViewState.KIDS, ViewState.DIASPORA].includes(
                currentView as ViewState,
              ) &&
                !searchQuery)) && (
              <div className="catalogue-section-heading">
                <h2>
                  {searchQuery
                    ? language === 'sw'
                      ? 'Matokeo yanayolingana'
                      : 'Matching titles'
                    : currentView === ViewState.ORIGINALS
                      ? language === 'sw'
                        ? 'Mkusanyiko kamili'
                        : 'The complete collection'
                      : activeSubCategory === 'All'
                        ? language === 'sw'
                          ? 'Video zote'
                          : 'All titles'
                        : activeSubCategory}
                </h2>
                {!isRealContent && !isLoadingVideos && <span className="catalogue-demo-label">DEMO</span>}
              </div>
            )}

            {isLoadingVideos || (!isRealContent && ratingFilteredVideos.length === 0) ? (
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
              <div className="space-y-2 animate-in fade-in duration-500">
                <TopTenCarousel
                  videos={ratingFilteredVideos}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                />

                <VideoCarousel
                  key="Trending"
                  title={t('shelf.trendingNow')}
                  videos={[...ratingFilteredVideos].sort((a, b) => b.views - a.views).slice(0, 20)}
                  watchLaterIds={watchLater}
                  onToggleWatchLater={toggleWatchLater}
                  isAuthenticated={isAuthenticated}
                />

                {ratingFilteredVideos.some(
                  (v) => (v.category === 'Series' || (v.category === 'Originals' && Boolean(seriesKey(v)))) && !isMicroDrama(v),
                ) && (
                  <SeriesCarousel
                    title={t('nav.series')}
                    onPlay={openVideo}
                    videos={ratingFilteredVideos.filter(
                      (v) => (v.category === 'Series' || (v.category === 'Originals' && Boolean(seriesKey(v)))) && !isMicroDrama(v),
                    )}
                    watchLaterIds={watchLater}
                    onToggleWatchLater={toggleWatchLater}
                    isAuthenticated={isAuthenticated}
                  />
                )}

                <CreatorOriginalsSpotlight
                  videos={ratingFilteredVideos}
                  onSelectVideo={openVideo}
                  onApplyToPublish={() => setShowFilmmakerForm(true)}
                />

                {['Movies', 'Farmers', 'Education', 'Faith', 'Kids', 'Diaspora'].map((cat) => {
                  const catVideos =
                    cat === 'Kids'
                      ? ratingFilteredVideos.filter(isKidsVideo)
                      : ratingFilteredVideos.filter((v) => v.category === cat || (cat === 'Movies' && v.category === 'Originals'));
                  const label =
                    cat === 'Movies'
                      ? t('shelf.kenyanMovies')
                      : cat === 'Kids'
                        ? t('shelf.watotoKids')
                        : cat === 'Farmers'
                          ? t('nav.farmers')
                          : cat === 'Education'
                            ? t('nav.education')
                            : cat === 'Faith'
                              ? t('nav.faith')
                              : t('nav.diaspora');
                  if (catVideos.length === 0) return null;
                  return (
                    <VideoCarousel
                      key={cat}
                      title={label}
                      videos={catVideos}
                      watchLaterIds={watchLater}
                      onToggleWatchLater={toggleWatchLater}
                      isAuthenticated={isAuthenticated}
                    />
                  );
                })}
              </div>
            ) : currentView === ViewState.MICRO_DRAMAS && !searchQuery ? (
              hasMicroDramas ? (
                <SeriesCarousel
                  title={t('nav.microDramas')}
                  videos={ratingFilteredVideos.filter(isMicroDrama)}
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
              <div className="space-y-2 animate-in fade-in duration-500">
                {activeSubCategory === 'All' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredVideos.map((video) => (
                      <div key={video.id}>
                        <VideoCard
                          video={video}
                          isWatchLater={watchLater.includes(video.id)}
                          onToggleWatchLater={toggleWatchLater}
                        />
                      </div>
                    ))}
                  </div>
                ) : activeSubCategory === 'Micro Dramas' ? (
                  hasMicroDramas ? (
                    <SeriesCarousel
                      title={t('nav.microDramas')}
                      videos={ratingFilteredVideos.filter(isMicroDrama)}
                      watchLaterIds={watchLater}
                      onToggleWatchLater={toggleWatchLater}
                      isAuthenticated={isAuthenticated}
                      onPlay={openVideo}
                    />
                  ) : (
                    <MicroDramaComingSoon
                      onMovies={() => handleNavigate(ViewState.ORIGINALS, 'Movies')}
                      onSeries={() => handleNavigate(ViewState.ORIGINALS, 'Series')}
                    />
                  )
                ) : activeSubCategory === 'Series' ? (
                  <>
                    {filteredVideos.length > 0 && (
                      <SeriesCarousel
                        title={t('nav.series')}
                        videos={filteredVideos}
                        watchLaterIds={watchLater}
                        onToggleWatchLater={toggleWatchLater}
                        onPlay={openVideo}
                      />
                    )}
                  </>
                ) : activeSubCategory === 'Movies' ? (
                  <>
                    {filteredVideos.length > 0 && (
                      <VideoCarousel
                        title={t('nav.movies')}
                        videos={filteredVideos}
                        watchLaterIds={watchLater}
                        onToggleWatchLater={toggleWatchLater}
                        isAuthenticated={isAuthenticated}
                      />
                    )}
                    {availableGenres.map((genre) => {
                      const genreVideos = filteredVideos.filter(
                        (v) =>
                          (v.genre || '').toLowerCase().includes(genre.toLowerCase()) ||
                          (v.tags || []).some((tag) => tag.toLowerCase().includes(genre.toLowerCase())),
                      );
                      if (genreVideos.length === 0) return null;
                      return (
                        <VideoCarousel
                          key={genre}
                          title={`${genre} Movies`}
                          videos={genreVideos}
                          watchLaterIds={watchLater}
                          onToggleWatchLater={toggleWatchLater}
                          isAuthenticated={isAuthenticated}
                        />
                      );
                    })}
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredVideos.map((video) => (
                      <div key={video.id}>
                        <VideoCard
                          video={video}
                          isWatchLater={watchLater.includes(video.id)}
                          onToggleWatchLater={toggleWatchLater}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : currentView === ViewState.GENRES && !searchQuery ? (
              <div className="space-y-4 animate-in fade-in duration-500">
                {activeSubCategory === 'All' ? (
                  genreCarousels.length > 0 ? (
                    genreCarousels.map(({ genre, videos: genreVideos }) => (
                      <VideoCarousel
                        key={genre}
                        title={`${genre} Stories`}
                        videos={genreVideos}
                        watchLaterIds={watchLater}
                        onToggleWatchLater={toggleWatchLater}
                        isAuthenticated={isAuthenticated}
                      />
                    ))
                  ) : null
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredVideos.map((video) => (
                      <div id={`video-${video.id}`} key={video.id}>
                        <VideoCard
                          video={video}
                          isWatchLater={watchLater.includes(video.id)}
                          onToggleWatchLater={toggleWatchLater}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                {filteredVideos.map((video) => (
                  <div id={`video-${video.id}`} key={video.id}>
                    <VideoCard
                      video={video}
                      isWatchLater={watchLater.includes(video.id)}
                      onToggleWatchLater={toggleWatchLater}
                    />
                  </div>
                ))}
              </div>
            )}

            {!isLoadingVideos &&
              !(currentView === ViewState.MICRO_DRAMAS && !searchQuery) &&
              !(currentView === ViewState.ORIGINALS && activeSubCategory === 'Micro Dramas' && !searchQuery) &&
              (currentView === ViewState.HOME && !searchQuery && activeSubCategory === 'Trending'
                ? ratingFilteredVideos.length === 0
                : currentView === ViewState.GENRES && !searchQuery && activeSubCategory === 'All'
                  ? genreCarousels.length === 0
                  : filteredVideos.length === 0) && (
                <CatalogueEmptyState
                  search={searchQuery}
                  subcategory={activeSubCategory}
                  onClearSearch={clearSearch}
                  onShowAll={() => setActiveSubCategory('All')}
                  onBrowse={() => handleNavigate(ViewState.HOME)}
                />
              )}

            {currentView === ViewState.HOME && !searchQuery && (
              <ViewerWelcome navigate={handleNavigate} hasMicroDramas={hasMicroDramas} />
            )}
          </div>
        );
      }
    }
  };

  return (
    <PlaybackProvider
      value={{
        preferences,
        getProgress: (videoId) => watchProgress[videoId],
        onEnded: handleVideoEnded,
        onProgress: handleWatchProgress,
        hasActivePass,
        isLocked: (video) => !isLongFormatVideo(video) && isVideoLocked(video, hasActivePass),
        onRequireUnlock: (video) => setPaywallVideo(video),
        onSelectVideo: openVideo,
        onOpenSettings: () => {
          closeVideo();
          handleNavigate(ViewState.SETTINGS, 'general');
        },
      }}
    >
      <div className="flex h-screen bg-zinc-950 text-white font-sans selection:bg-red-500 selection:text-white">
        {showLogin && !isAuthenticated && (
          <Suspense fallback={<LoadingPanel label={t('common.loading')} />}>
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

        {showFilmmakerForm && (
          <Suspense fallback={<LoadingPanel label={t('common.loading')} />}>
            <FilmmakerSubmissionModal onClose={() => setShowFilmmakerForm(false)} />
          </Suspense>
        )}

        {paywallVideo && (
          <Suspense fallback={<LoadingPanel label={t('common.loading')} />}>
            <PaywallModal
              video={paywallVideo}
              onSuccess={() => {
                const returnId =
                  paywallVideo?.id ||
                  sessionStorage.getItem('tubetv_paywall_target_video_id') ||
                  localStorage.getItem('tubetv_last_watched_video_id');
                const target = paywallVideo || (returnId ? videos.find((v) => v.id === returnId) : null);
                setPaywallVideo(null);
                setHasActivePass(true);
                if (target) {
                  window.history.pushState({}, '', videoPath(target.id));
                  setActiveHeroVideo(target);
                }
                void refreshAccessState().then(() => {
                  setHasActivePass(true);
                  if (target) {
                    setActiveHeroVideo(target);
                  }
                });
              }}
              onClose={() => setPaywallVideo(null)}
            />
          </Suspense>
        )}

        {activeHeroVideo && (
          <div
            ref={playerDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Playing ${activeHeroVideo.title}`}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 md:p-8"
            onClick={closeVideo}
          >
            <div
              className={`cinema-player relative w-full max-h-[90vh] overflow-y-auto ${
                isMicroDrama(activeHeroVideo) ? 'cinema-player-vertical max-w-sm' : 'max-w-5xl'
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="cinema-player-header">
                <button type="button" aria-label={t('player.backToBrowsing')} onClick={closeVideo}>
                  ←
                </button>
                <span className="cinema-logo">
                  Tube<span>TV</span>
                </span>
                <div className="flex items-center gap-2 mr-7">
                  <button
                    type="button"
                    onClick={() => handleShareCurrentVideo(activeHeroVideo)}
                    title={language === 'sw' ? 'Shiriki kipindi hiki' : 'Share this video'}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/90 px-3 py-1 text-xs font-bold text-zinc-200 hover:border-zinc-500 hover:text-white transition-all active:scale-95 cursor-pointer"
                  >
                    {playerShareCopied ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
                    <span>{playerShareCopied ? (language === 'sw' ? 'Imenakiliwa!' : 'Copied!') : (language === 'sw' ? 'Shiriki' : 'Share')}</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close player"
                onClick={closeVideo}
                className="absolute top-3 right-3 z-50 rounded-full p-2 text-white hover:bg-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
              <Suspense fallback={<LoadingPanel label={t('common.loading')} />}>
                <VideoCard
                  key={`${activeHeroVideo.id}:${replayNonce}`}
                  video={activeHeroVideo}
                  autoPlay={modalAutoPlay}
                  playerOnly
                  nextEpisode={nextEpisode(ratingFilteredVideos, activeHeroVideo.id)}
                  onNextEpisode={() => {
                    const next = nextEpisode(ratingFilteredVideos, activeHeroVideo.id);
                    if (next) {
                      if (isVideoLocked(next, hasActivePass)) {
                        setPaywallVideo(next);
                      } else {
                        trackEvent('episode_next', {
                          fromVideoId: activeHeroVideo.id,
                          toVideoId: next.id,
                          automatic: false,
                        });
                        openVideo(next);
                      }
                    }
                  }}
                />
                {isVideoFinished && !nextEpisode(ratingFilteredVideos, activeHeroVideo.id) && (
                  <div className="bg-gradient-to-r from-red-950/80 via-zinc-900 to-zinc-950 border-b border-red-500/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-300">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/80 border border-red-500/30 px-2 py-0.5 rounded">
                        {t('player.storyFinished')}
                      </span>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {t('player.finishedWatching', { title: activeHeroVideo.seriesTitle || activeHeroVideo.title })}
                      </p>
                      <p className="text-xs text-zinc-400">{t('player.finishedHint')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleWatchProgress(activeHeroVideo.id, {
                            positionSeconds: 0,
                            durationSeconds: watchProgress[activeHeroVideo.id]?.durationSeconds || 0,
                            completed: false,
                          });
                          setIsVideoFinished(false);
                          setReplayNonce((n) => n + 1);
                        }}
                        className="cinema-secondary text-xs py-1.5 px-3"
                      >
                        ↺ {t('player.replay')}
                      </button>
                      {playerRecommendations[0] && (
                        <button
                          type="button"
                          onClick={() => openVideo(playerRecommendations[0])}
                          className="cinema-primary text-xs py-1.5 px-3.5 whitespace-nowrap"
                        >
                          ▶ {t('player.watchNext')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="cinema-player-info bg-zinc-950 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span className="rounded border border-zinc-700 px-2 py-1">
                      {activeHeroVideo.contentRating || 'UNRATED'}
                    </span>
                    {isVideoLocked(activeHeroVideo, false) && (
                      <span className="rounded border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300">
                        {t('player.premium')}
                      </span>
                    )}
                    <span>{activeHeroVideo.category}</span>
                    <span>{activeHeroVideo.author}</span>
                  </div>
                  <h1 className="mt-3 text-xl font-bold">{activeHeroVideo.seriesTitle || activeHeroVideo.title}</h1>
                  {seriesKey(activeHeroVideo) && (
                    <p className="mt-1 text-sm text-zinc-300">
                      Season {activeHeroVideo.season || 1} · Episode {activeHeroVideo.episode || 1}
                    </p>
                  )}
                  {(activeHeroVideo.episodeSynopsis || activeHeroVideo.description) && (
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      {activeHeroVideo.episodeSynopsis || activeHeroVideo.description}
                    </p>
                  )}
                  {!modalAutoPlay && (
                    <button
                      type="button"
                      className="cinema-primary mt-4 w-full sm:w-auto px-6 py-2.5 font-bold"
                      onClick={() => setModalAutoPlay(true)}
                    >
                      ▶ {t('home.watchEpisode')}
                    </button>
                  )}
                  {nextEpisode(ratingFilteredVideos, activeHeroVideo.id) && (
                    <button
                      type="button"
                      className="cinema-primary mt-4 w-full"
                      onClick={() => {
                        const next = nextEpisode(ratingFilteredVideos, activeHeroVideo.id);
                        if (next) {
                          if (isVideoLocked(next, hasActivePass)) {
                            setPaywallVideo(next);
                          } else {
                            trackEvent('episode_next', {
                              fromVideoId: activeHeroVideo.id,
                              toVideoId: next.id,
                              automatic: false,
                            });
                            openVideo(next);
                          }
                        }
                      }}
                    >
                      ▶ {t('player.nextEpisode')}{' '}
                      {isVideoLocked(nextEpisode(ratingFilteredVideos, activeHeroVideo.id)!, hasActivePass) ? '🔒' : ''}
                    </button>
                  )}
                  <div className="mt-4">
                    <PushNotificationPrompt inline seriesTitle={activeHeroVideo.seriesTitle} />
                  </div>
                  {activeHeroVideo.transcript && (
                    <details className="mt-4 border-t border-zinc-800 pt-4">
                      <summary className="cursor-pointer font-medium">{t('player.transcript')}</summary>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                        {activeHeroVideo.transcript}
                      </p>
                    </details>
                  )}
                </div>
                {seriesKey(activeHeroVideo) && (
                  <details className="cinema-player-episodes">
                    <summary>
                      {t('player.episodes')} <span>{t('player.seeAll')}</span>
                    </summary>
                    {activeHeroVideo.seriesSynopsis && <p>{activeHeroVideo.seriesSynopsis}</p>}
                    {ratingFilteredVideos
                      .filter((video) => seriesKey(video) === seriesKey(activeHeroVideo))
                      .sort(compareEpisodes)
                      .map((video) => {
                        const locked = isVideoLocked(video, hasActivePass);
                        return (
                          <button
                            type="button"
                            key={video.id}
                            aria-current={video.id === activeHeroVideo.id ? 'true' : undefined}
                            onClick={() => openVideo(video)}
                          >
                            <CatalogueArtwork
                              src={video.thumbnail}
                              className={`cinema-player-episode-art ${
                                isMicroDrama(video) ? 'cinema-player-episode-art-vertical' : ''
                              }`}
                            />
                            <span className="cinema-player-episode-copy">
                              <span className="flex items-center gap-1.5">
                                S{video.season || 1} · E{video.episode || 1} — {video.title}
                                {locked && (
                                  <span className="text-[10px] text-amber-400 font-bold">🔒 {t('player.locked')}</span>
                                )}
                              </span>
                              <small>{video.episodeSynopsis || video.description}</small>
                            </span>
                          </button>
                        );
                      })}
                  </details>
                )}

                {playerRecommendations.length > 0 && (
                  <div className="cinema-player-recommended bg-zinc-950 p-5 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="text-red-500">★</span> {t('player.recommended')}
                      </h3>
                      <span className="text-xs text-zinc-500">{t('player.moreLikeThis')}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {playerRecommendations.slice(0, 4).map((rec) => {
                        const recLocked = isVideoLocked(rec, hasActivePass);
                        return (
                          <button
                            type="button"
                            key={rec.id}
                            onClick={() => openVideo(rec, { autoPlay: false })}
                            onDoubleClick={() => openVideo(rec, { autoPlay: true })}
                            className="group flex flex-col text-left overflow-hidden rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition"
                          >
                            <div className="aspect-video w-full relative overflow-hidden bg-zinc-800">
                              <CatalogueArtwork
                                src={rec.thumbnail}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <span className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] text-zinc-300 font-mono">
                                {rec.duration}
                              </span>
                              {recLocked && (
                                <span className="absolute top-1 left-1 bg-amber-500/90 text-black px-1.5 py-0.5 rounded text-[9px] font-bold">
                                  {t('player.premium')}
                                </span>
                              )}
                            </div>
                            <div className="p-2 flex flex-col gap-0.5">
                              <span className="text-xs font-semibold text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                                {rec.seriesTitle || rec.title}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                                <span>{rec.genre || rec.category}</span>
                                <span>·</span>
                                <span className="truncate">{rec.author}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Suspense>
            </div>
          </div>
        )}

        <div
          className={`cinema-shell flex-1 flex flex-col h-screen overflow-hidden relative ${
            currentView === ViewState.SHORTS ? 'shorts-shell' : ''
          }`}
        >
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

          {deviceSwitchedNotice && (
            <div
              role="status"
              className="bg-amber-950/90 border-b border-amber-500/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-100 z-40"
            >
              <div className="flex items-center gap-2">
                <Smartphone size={15} className="text-amber-400 shrink-0" />
                <span>
                  Your TubeTV pass was switched to another device (1 active screen at a time).
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={reclaimingPass}
                  onClick={() => void handleReclaimPassOnThisDevice()}
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-3 py-1 font-bold text-black transition-colors"
                >
                  {reclaimingPass ? 'Switching...' : 'Switch back to this device'}
                </button>
                <button
                  type="button"
                  aria-label="Dismiss device notice"
                  onClick={() => setDeviceSwitchedNotice(null)}
                  className="text-amber-300 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {expiringSoonMinutes !== null && !dismissedExpiryNotice && (
            <div
              role="status"
              className="bg-emerald-950/90 border-b border-emerald-500/40 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-100 z-40"
            >
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-emerald-400 shrink-0" />
                <span>
                  Your TubeTV Pass expires in <strong>{expiringSoonMinutes}m</strong>. Top up anytime so your episode isn&apos;t interrupted.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = activeHeroVideo || ratingFilteredVideos[0];
                    if (target) setPaywallVideo(target);
                  }}
                  className="rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1 font-bold text-black transition-colors"
                >
                  Top Up Pass
                </button>
                <button
                  type="button"
                  aria-label="Dismiss pass expiry notice"
                  onClick={() => setDismissedExpiryNotice(true)}
                  className="text-emerald-300 hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <main
            ref={mainRef}
            className={`flex-1 overflow-y-auto overflow-x-hidden relative bg-zinc-950 no-scrollbar ${
              currentView === ViewState.HOME && !searchQuery ? 'landing-main' : ''
            } ${currentView === ViewState.SHORTS ? 'shorts-main' : ''}`}
          >
            <Suspense fallback={<LoadingPanel label={t('common.loading')} />}>
              {renderContent()}
              {(currentView === ViewState.HOME ||
                currentView === ViewState.ORIGINALS ||
                currentView === ViewState.MICRO_DRAMAS ||
                currentView === ViewState.GENRES ||
                [
                  ViewState.EDUCATION,
                  ViewState.FARMERS,
                  ViewState.FAITH,
                  ViewState.KIDS,
                  ViewState.DIASPORA,
                  ViewState.LIVE,
                  ViewState.WATCH_LATER,
                ].includes(currentView as ViewState) ||
                navItems.some((item) => item.id === currentView && item.isCustom)) && (
                <LandingFooter navigate={handleNavigate} />
              )}
            </Suspense>
          </main>

          {/* Mobile Bottom Nav */}
          <div
            className={`md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around p-3 z-50 pb-safe ${
              currentView === ViewState.SHORTS ? 'shorts-hidden-mobile' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => handleNavigate(ViewState.HOME)}
              className={`flex flex-col items-center gap-1 ${
                currentView === ViewState.HOME ? 'text-white' : 'text-zinc-500'
              }`}
            >
              <Home size={20} />
              <span className="text-[10px]">{t('nav.home')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(ViewState.MICRO_DRAMAS)}
              className={`flex flex-col items-center gap-1 ${
                currentView === ViewState.MICRO_DRAMAS ? 'text-red-500' : 'text-zinc-500'
              }`}
            >
              <div className="w-5 h-5 border-2 border-current rounded-sm" />
              <span className="text-[10px]">{t('nav.microDramas')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(ViewState.SHORTS)}
              className={`flex flex-col items-center gap-1 ${
                currentView === ViewState.SHORTS ? 'text-white' : 'text-zinc-500'
              }`}
            >
              <PlayCircle size={20} />
              <span className="text-[10px]">{t('nav.shorts')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(ViewState.WATCH_LATER)}
              className={`flex flex-col items-center gap-1 ${
                currentView === ViewState.WATCH_LATER ? 'text-white' : 'text-zinc-500'
              }`}
            >
              <Clock size={20} />
              <span className="text-[10px]">{t('nav.myList')}</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleNavigate(ViewState.ANALYTICS)}
                className={`flex flex-col items-center gap-1 ${
                  currentView === ViewState.ANALYTICS ? 'text-white' : 'text-zinc-500'
                }`}
              >
                <BarChart2 size={20} />
                <span className="text-[10px]">{t('nav.studioShort')}</span>
              </button>
            )}
          </div>

          {/* Smart PWA Install Banner */}
          <PWAInstallBanner />
        </div>
      </div>
    </PlaybackProvider>
  );
};

export default App;
