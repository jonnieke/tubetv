export const translations = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.trending': 'Trending',
    'nav.live': 'Live',
    'nav.originals': 'Tube Originals',
    'nav.movies': 'Movies',
    'nav.music': 'Music',
    'nav.gaming': 'Gaming',
    'nav.news': 'News',
    'nav.studio': 'Creator Studio',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    'nav.login': 'Login',
    'nav.shorts': 'Shorts',
    'nav.schoolflix': 'School Flix',
    'nav.documentary': 'Documentary',
    'nav.education': 'Education',
    'nav.farmers': 'Farmers',
    'nav.faith': 'Faith',
    'nav.kids': 'Kids',
    'nav.diaspora': 'Diaspora',
    'nav.watchlist': 'Watch List',

    // Live Section
    'live.now': 'Live Now',
    'live.schedule': 'Up Next',
    'live.notify': 'Notify Me',
    'live.subscribed': 'Subscribed',
    'live.tips': 'Recent Simba Tips',
    'live.chat': 'Live Chat',
    'live.viewers': 'viewers',


    // Creator Studio
    'studio.welcome': 'Creator Studio',
    'studio.subtitle': 'Welcome back! Manage your content and performance.',
    'studio.overview': 'Overview',
    'studio.menu': 'Menu Manager',
    'studio.views': 'Total Views',
    'studio.content': 'Your Content',
    'studio.analytics': 'Analytics',

    // Common
    'common.search': 'Search videos...',
    'common.loading': 'Loading...',
    'common.language': 'Language',
  },
  sw: {
    // Navigation
    'nav.home': 'Nyumbani',
    'nav.trending': 'Zinazovuma',
    'nav.live': 'Moja kwa Moja',
    'nav.originals': 'Originals za Tube',
    'nav.movies': 'Filamu',
    'nav.music': 'Muziki',
    'nav.gaming': 'Michezo',
    'nav.news': 'Habari',
    'nav.studio': 'Studio ya Muundaji',
    'nav.settings': 'Mipangilio',
    'nav.logout': 'Ondoka',
    'nav.login': 'Ingia',
    'nav.shorts': 'Shorts',
    'nav.schoolflix': 'School Flix',
    'nav.documentary': 'Makala',
    'nav.education': 'Elimu',
    'nav.farmers': 'Wakulima',
    'nav.faith': 'Imani',
    'nav.kids': 'Watoto',
    'nav.diaspora': 'Diaspora',
    'nav.watchlist': 'Orodha Yangu',

    // Live Section
    'live.now': 'Moja kwa Moja Sasa',
    'live.schedule': 'Zinazofuata',
    'live.notify': 'Nijulishe',
    'live.subscribed': 'Umejiunga',
    'live.tips': 'Michango ya Simba hivi karibuni',
    'live.chat': 'Mazungumzo ya Moja kwa Moja',
    'live.viewers': 'watazamaji',


    // Creator Studio
    'studio.welcome': 'Studio ya Muundaji',
    'studio.subtitle': 'Karibu tena! Simamia maudhui na utendaji wako.',
    'studio.overview': 'Muhtasari',
    'studio.menu': 'Meneja wa Menyu',
    'studio.views': 'Jumla ya Watazamaji',
    'studio.content': 'Maudhui Yako',
    'studio.analytics': 'Uchambuzi',

    // Common
    'common.search': 'Tafuta video...',
    'common.loading': 'Inapakia...',
    'common.language': 'Lugha',
  }
};

export type Language = 'en' | 'sw';
export type TranslationKey = keyof typeof translations.en;
