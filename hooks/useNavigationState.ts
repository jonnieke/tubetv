import { useState, useEffect, useMemo, useCallback } from 'react';
import { ViewState, type NavItem, type ViewStateOrString } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { TranslationKey } from '../translations';
import {
  Home,
  Clapperboard,
  Smartphone,
  GraduationCap,
  Sprout,
  Heart,
  Globe,
  PlayCircle,
  Clock,
  Star,
  Gamepad2,
  Utensils,
  Cpu,
  BookOpen,
  Coffee,
  Briefcase,
  Anchor,
  Zap,
  Film,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
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
  Star,
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
  { id: ViewState.MICRO_DRAMAS, label: 'Micro Dramas', iconName: 'Smartphone', icon: Smartphone },
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

export function useNavigationState() {
  const { t } = useLanguage();
  const [currentView, setCurrentView] = useState<ViewStateOrString>(ViewState.HOME);
  const [activeSubCategory, setActiveSubCategory] = useState('Trending');
  const [searchQuery, setSearchQuery] = useState('');

  const [navItems, setNavItems] = useState<NavItem[]>(() => {
    try {
      const saved = localStorage.getItem('tube_nav_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        const gamingCount = parsed.filter((item: any) => item.labelKey === 'nav.gaming').length;
        if (gamingCount > 1) {
          localStorage.removeItem('tube_nav_items');
          return INITIAL_NAV_ITEMS;
        }
        if (!parsed.some((item: NavItem) => item.id === ViewState.MICRO_DRAMAS)) {
          parsed.splice(1, 0, INITIAL_NAV_ITEMS[1]);
        }
        return parsed.map((item: NavItem) => ({
          ...item,
          icon: ICON_MAP[item.iconName || 'PlayCircle'] || PlayCircle,
        }));
      }
    } catch {}
    return INITIAL_NAV_ITEMS;
  });

  useEffect(() => {
    const serializable = navItems.map(({ icon, ...rest }) => rest);
    try {
      localStorage.setItem('tube_nav_items', JSON.stringify(serializable));
    } catch {}
  }, [navItems]);

  const translatedNavItems = useMemo(() => {
    return navItems.map((item) => ({
      ...item,
      label: item.labelKey ? t(item.labelKey as TranslationKey) : item.label,
    }));
  }, [navItems, t]);

  const getSubCategories = (view: ViewStateOrString) => {
    switch (view) {
      case ViewState.EDUCATION:
        return ['All', 'CBC', 'High School', 'Revision', 'AI Learning', 'Teachers'];
      case ViewState.FARMERS:
        return ['All', 'Crops', 'Livestock', 'Climate', 'Agribusiness', 'Dairy'];
      case ViewState.FAITH:
        return ['All', 'Sermons', 'Kids Bible', 'Worship', 'Devotion'];
      case ViewState.DIASPORA:
        return ['All', 'Investments', 'Events', 'News', 'Culture'];
      case ViewState.KIDS:
        return ['All', 'Cartoons', 'Learning', 'Songs', 'Stories'];
      case ViewState.ORIGINALS:
        return ['All', 'Micro Dramas', 'Series', 'Movies'];
      case ViewState.LIVE:
        return ['Sports', 'News', 'Events'];
      case ViewState.HOME:
        return ['Trending', 'New Releases', 'Most Watched'];
      case ViewState.MICRO_DRAMAS:
        return ['All'];
      default:
        return ['All'];
    }
  };

  const currentSubCategories = useMemo(() => getSubCategories(currentView), [currentView]);

  const handleNavigate = useCallback((view: ViewStateOrString, subCategory?: string) => {
    setCurrentView(view);
    if (subCategory) {
      setActiveSubCategory(subCategory);
    } else {
      setActiveSubCategory(view === ViewState.HOME ? 'Trending' : 'All');
    }
  }, []);

  const handleAddCategory = useCallback((name: string, iconName: string) => {
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
  }, []);

  const handleRemoveCategory = useCallback((id: string) => {
    setNavItems((prev) => prev.filter((item) => item.id !== id));
    setCurrentView((current) => (current === id ? ViewState.HOME : current));
  }, []);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value) {
      setCurrentView(ViewState.HOME);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const customCategory = navItems.find((item) => item.id === currentView && item.isCustom)?.label;

  return {
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
  };
}
