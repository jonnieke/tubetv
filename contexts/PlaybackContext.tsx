import { createContext, useContext } from 'react';
import type { Video } from '../types';
import type { PlaybackPreferences, WatchProgress } from '../lib/viewerState';
import { DEFAULT_PLAYBACK_PREFERENCES } from '../lib/viewerState';

interface PlaybackContextValue {
  preferences: PlaybackPreferences;
  getProgress: (videoId: string) => WatchProgress | undefined;
  onProgress: (videoId: string, progress: WatchProgress) => void;
  onEnded: (videoId: string) => void;
  hasActivePass?: boolean;
  isLocked?: (video: Video) => boolean;
  onRequireUnlock?: (video: Video) => void;
  onOpenSettings?: () => void;
  onSelectVideo?: (video: Video, options?: { autoPlay?: boolean }) => void;
}

const PlaybackContext = createContext<PlaybackContextValue>({
  preferences: DEFAULT_PLAYBACK_PREFERENCES,
  getProgress: () => undefined,
  onProgress: () => undefined,
  onEnded: () => undefined,
  isLocked: undefined,
  onRequireUnlock: undefined,
  onOpenSettings: undefined,
});

export const PlaybackProvider = PlaybackContext.Provider;
export const usePlayback = () => useContext(PlaybackContext);
