
import { LucideIcon } from 'lucide-react';

import type { ContentRating } from './lib/contentRating';
export enum ViewState {
  HOME = 'HOME',
  ORIGINALS = 'ORIGINALS',
  SHORTS = 'SHORTS',
  EDUCATION = 'EDUCATION',
  FARMERS = 'FARMERS',
  FAITH = 'FAITH',
  KIDS = 'KIDS',
  DIASPORA = 'DIASPORA',
  LIVE = 'LIVE',
  ANALYTICS = 'ANALYTICS',
  UPLOAD = 'UPLOAD',
  WATCH_LATER = 'WATCH_LATER',
  SETTINGS = 'SETTINGS',
  ADMIN = 'ADMIN'
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
  thumbnail: string;
  views: number;
  duration: string;
  isPremium: boolean;
  author: string;
  description?: string;
  category: string;
  tags?: string[];
  url?: string;
  captionsUrl?: string;
  contentRating?: ContentRating;
  classificationNumber?: string;
  transcript?: string;
  transcriptUrl?: string;
  uploadDate?: string;
  // Series metadata
  seriesTitle?: string;   // Parent series name, e.g. "Nairobi Noir"
  season?: number;        // Season number
  episode?: number;       // Episode number within season
  genre?: string;         // e.g. "Drama"
  productionYear?: number;
  trailerUrl?: string;
  muted?: boolean;        // Hidden from the public catalogue by an admin
}

export interface ShortVideo {
  id: string;
  thumbnail: string;
  videoUrl: string;
  author: string;
  description: string;
  likes: number;
  comments: number;
  isAd?: boolean;
}

export interface AnalyticsMetric {
  name: string;
  value: number;
  change: number; 
}

export interface DailyStat {
  day: string;
  views: number;
  revenue: number;
  subs: number;
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
