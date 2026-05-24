
import { LucideIcon } from 'lucide-react';

export enum ViewState {
  HOME = 'HOME',
  ORIGINALS = 'ORIGINALS',
  SHORTS = 'SHORTS',
  EDUCATION = 'EDUCATION',
  FARMERS = 'FARMERS',
  FAITH = 'FAITH',
  KIDS = 'KIDS',
  DIASPORA = 'DIASPORA',
  FASHION = 'FASHION',
  WILDLIFE = 'WILDLIFE',
  LIVE = 'LIVE',
  ANALYTICS = 'ANALYTICS',
  UPLOAD = 'UPLOAD',
  WATCH_LATER = 'WATCH_LATER',
  SETTINGS = 'SETTINGS',
  ADMIN = 'ADMIN',
  OFFLINE = 'OFFLINE',
  HISTORY = 'HISTORY',
  LIKED = 'LIKED',
  STUDIO = 'STUDIO'
}

// Allow ViewState to be treated as string for dynamic categories
export type ViewStateOrString = ViewState | string;

export interface NavItem {
  id: string;
  label: string;
  labelKey?: string; // Key for translation dictionary
  iconName: string; // Storing string name for serialization
  icon?: LucideIcon; // Runtime component
  restricted?: boolean;
  group?: string;
  isCustom?: boolean;
}

export interface Video {
  id: string;
  title: string;
  thumbnail: string;          // Primary URL (Optimizer CDN — WebP, resized)
  thumbnailFallback?: string; // Stream CDN fallback if primary 404s
  views: number;
  duration: string;
  isPremium: boolean;
  author: string;
  description?: string;
  category: string;
  tags?: string[];
  url?: string;
  // Series metadata
  seriesTitle?: string;   // Parent series name, e.g. "Nairobi Noir"
  season?: number;        // Season number
  episode?: number;       // Episode number within season
  genre?: string;         // e.g. "Drama"
  productionYear?: number;
  trailerUrl?: string;
  dateUploaded?: string;  // ISO 8601 from Bunny
  featured?: boolean;     // Pinned to the hero carousel by admin
  muted?: boolean;        // Hidden from public view by admin
}

export interface ShortVideo {
  id: string;
  url: string;
  title?: string;
  author: string;
  description: string;
  likes: number;
  comments: number;
  isAd?: boolean;
  isRecommended?: boolean;
  category?: string;
  videoUrl?: string;
}


export interface DailyStat {
  day: string;
  views: number;
}

export interface Caption {
  start: number;
  end: number;
  text: string;
}

export interface ShortComment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  likes: number;
  avatar?: string;
}
