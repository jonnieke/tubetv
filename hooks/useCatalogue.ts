import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Video, ShortVideo } from '../types';
import { fetchBunnyVideos, bunnyVideoToVideo } from '../services/bunnyService';
import { isSupabaseConfigured } from '../lib/supabase';
import { CONTENT_RATING_ENFORCED, MOCK_VIDEOS, MOCK_SHORTS } from '../constants';
import { normalizeContentRating, PUBLIC_CONTENT_RATINGS } from '../lib/contentRating';
import { trackEvent } from '../lib/analytics';

const DEMO_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const DEMO_VIDEOS: Video[] = MOCK_VIDEOS.map((video) => ({
  ...video,
  url: video.url || DEMO_VIDEO_URL,
  contentRating: (['Kids', 'Education', 'Farmers', 'Faith'].includes(video.category) ? 'GE' : 'PG') as Video['contentRating'],
}));

export function useCatalogue() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isRealContent, setIsRealContent] = useState(false);
  const [catalogueError, setCatalogueError] = useState('');

  const loadVideos = useCallback(async () => {
    if (!isSupabaseConfigured && import.meta.env.DEV) {
      setVideos(DEMO_VIDEOS);
      setIsRealContent(false);
      setIsLoadingVideos(false);
      return;
    }
    setIsLoadingVideos(true);
    setCatalogueError('');
    try {
      const bunnyItems = await fetchBunnyVideos();
      if (bunnyItems.length > 0) {
        const mapped = bunnyItems.map(bunnyVideoToVideo) as Video[];
        const publicItems = mapped.filter((video) => !video.muted);
        const visible = CONTENT_RATING_ENFORCED
          ? publicItems.filter((video) => PUBLIC_CONTENT_RATINGS.includes(normalizeContentRating(video.contentRating)))
          : publicItems.filter((video) => normalizeContentRating(video.contentRating) !== '18');

        setVideos(visible);
        setIsRealContent(true);
      } else {
        setVideos([]);
        setIsRealContent(true);
      }
    } catch (err) {
      console.error('Catalogue load failed:', err);
      setVideos([]);
      setIsRealContent(false);
      setCatalogueError('The catalogue could not be loaded. Please try again.');
    } finally {
      setIsLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos();

    const onVisibilityChange = (event: Event) => {
      const { videoId, hidden } = (event as CustomEvent<{ videoId: string; hidden: boolean }>).detail;
      if (hidden) {
        setVideos((current) => current.filter((video) => video.id !== videoId));
      } else {
        void loadVideos();
      }
    };

    window.addEventListener('tube-visibility-change', onVisibilityChange);
    window.addEventListener('tube-catalogue-change', loadVideos);

    return () => {
      window.removeEventListener('tube-visibility-change', onVisibilityChange);
      window.removeEventListener('tube-catalogue-change', loadVideos);
    };
  }, [loadVideos]);

  // Derive real shorts from the videos library (tagged with 'Shorts' category)
  const realShorts: ShortVideo[] = useMemo(() => {
    const fromVideos = videos
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
  }, [videos, isLoadingVideos, isRealContent]);

  useEffect(() => {
    if (isLoadingVideos) return;
    trackEvent('catalogue_view', { videoCount: videos.length, source: isRealContent ? 'bunny' : 'demo' });
  }, [isLoadingVideos, isRealContent, videos.length]);

  const handleUploadComplete = useCallback((newVideo: Video) => {
    setVideos((prev) => [newVideo, ...prev.filter((video) => video.id !== newVideo.id)]);
  }, []);

  return {
    videos,
    realShorts,
    isLoadingVideos,
    isRealContent,
    catalogueError,
    loadVideos,
    handleUploadComplete,
  };
}
