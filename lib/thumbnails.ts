import type { Video } from '../types';

export type ThumbnailOrientation = 'landscape' | 'portrait';

export function thumbnailFor(video: Video, orientation: ThumbnailOrientation): string {
  const selected = orientation === 'portrait' ? video.thumbnailPortraitUrl : video.thumbnailLandscapeUrl;
  return selected || video.thumbnail;
}
