import React, { createContext, useContext } from 'react';
import type { PlaybackPreferences, WatchProgress } from '../lib/viewerState';
import { DEFAULT_PLAYBACK_PREFERENCES } from '../lib/viewerState';

import type { Video } from '../types';

interface PlaybackContextValue {
  preferences: PlaybackPreferences;
  getProgress: (videoId: string) => WatchProgress | undefined;
  onProgress: (videoId: string, progress: WatchProgress) => void;
  onEnded: (videoId: string) => void;
  isAuthenticated?: boolean;
  onRequireLogin?: () => void;
  onOpenMovieDetails?: (video: Video) => void;
}

const PlaybackContext = createContext<PlaybackContextValue>({
  preferences: DEFAULT_PLAYBACK_PREFERENCES,
  getProgress: () => undefined,
  onProgress: () => undefined,
  onEnded: () => undefined,
  isAuthenticated: false,
  onRequireLogin: () => {},
  onOpenMovieDetails: () => {},
});

export const PlaybackProvider = PlaybackContext.Provider;
export const usePlayback = () => useContext(PlaybackContext);
