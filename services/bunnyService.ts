// 🔒 SECURED: Calls are now proxied through Supabase Edge Functions
// The sensitive BUNNY_ACCESS_KEY is now stored in Supabase Secrets.
import { normalizeContentRating } from '../lib/contentRating';
import { supabase } from '../lib/supabase';
import { LOCAL_ADMIN_PIN } from '../lib/localAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const BASE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/bunny-api` : '';
const VISIBILITY_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/content-visibility` : '';
const PULL_ZONE = (import.meta.env.VITE_BUNNY_PULL_ZONE as string) || '';
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

const getHeaders = async (extra = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${session?.access_token || ANON_KEY}`,
    ...extra
  };
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BunnyVideoItem {
  guid: string;
  title: string;
  /** Duration in seconds */
  length: number;
  views: number;
  /**
   * Encoding status:
   *  0 = Queued, 1 = Processing, 2 = Encoding, 3 = Failed, 4 = Finished
   */
  status: number;
  encodeProgress: number;
  thumbnailFileName: string;
  dateUploaded: string;
  storageSize: number;
  collectionId?: string;
  metaTags: { property: string; value: string }[];
  availableResolutions?: string;
}

interface BunnyVideoListResponse {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  items: BunnyVideoItem[];
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Formats seconds → "M:SS" or "H:MM:SS" */
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Read a metaTag value by property name (set in the Bunny dashboard) */
const getMeta = (tags: BunnyVideoItem['metaTags'], prop: string): string =>
  tags?.find((t) => t.property.toLowerCase() === prop.toLowerCase())?.value || '';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a video entry in Bunny.net to get a Video GUID.
 */
export const createVideoEntry = async (title: string): Promise<{ guid: string } | null> => {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ title }),
    });
    if (!response.ok) throw new Error(`Failed to create video: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Bunny Create Error:', error);
    return null;
  }
};

/**
 * Updates video metadata (like title and metaTags) in Bunny.net.
 */
export const updateVideoMetadata = async (
  videoId: string,
  payload: { title?: string; metaTags?: { property: string; value: string }[] }
): Promise<any> => {
  try {
    const response = await fetch(`${BASE_URL}/${videoId}`, {
      method: 'POST',
      headers: await getHeaders({ 'x-admin-pin': LOCAL_ADMIN_PIN }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to update video: ${response.statusText} - ${err}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Bunny Update Error:', error);
    return null;
  }
};

/**
 * Hides or shows a title in the public catalogue by persisting the legacy
 * `muted` metadata flag in Bunny. Existing installations already understand
 * this flag, so restoring it keeps previously hidden titles hidden.
 */
export const setVideoMuted = async (
  videoId: string,
  muted: boolean,
): Promise<boolean> => {
  if (!VISIBILITY_URL) return false;

  try {
    const response = await fetch(VISIBILITY_URL, {
      method: 'POST',
      headers: await getHeaders({ 'x-admin-pin': LOCAL_ADMIN_PIN }),
      body: JSON.stringify({ videoId, hidden: muted }),
    });
    if (!response.ok) {
      console.error('Visibility update failed:', response.status, await response.text());
      return false;
    }
  } catch (error) {
    console.error('Visibility update failed:', error);
    return false;
  }

  window.dispatchEvent(
    new CustomEvent('tube-visibility-change', {
      detail: { videoId, hidden: muted },
    }),
  );
  return true;
};

/**
 * Uploads a video file using XMLHttpRequest so we can track progress.
 */
export const uploadVideoFile = async (
  file: File,
  videoId: string,
  onProgress: (percent: number) => void
): Promise<void> => {
  const headers = await getHeaders();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${BASE_URL}/${videoId}`, true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('apikey', ANON_KEY);
    xhr.setRequestHeader('Authorization', headers.Authorization);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
};

/** Constructs the HLS playlist URL for a video GUID. */
export const getStreamUrl = (videoId: string): string => {
  const host = PULL_ZONE.replace(/\/$/, '');
  return `https://${host}/${videoId}/playlist.m3u8`;
};

/** Constructs the CDN thumbnail URL for a video GUID. */
export const getThumbnailUrl = (videoId: string, filename?: string): string => {
  const host = PULL_ZONE ? PULL_ZONE.replace(/\/$/, '') : 'vz-0fe79b1a-8ad.b-cdn.net';
  const name = filename || 'thumbnail.jpg';
  // Add a cache-busting random string to the end so when we upload a new one, it updates instantly
  return `https://${host}/${videoId}/${name}?v=${Math.floor(Date.now() / 3600000)}`;
};

/**
 * Uploads a custom thumbnail image directly to the Bunny Stream video.
 * Bunny's thumbnail endpoint expects the raw image binary POSTed directly.
 * Returns the new thumbnailFileName from the refreshed video record, or null on failure.
 */
export const uploadCustomThumbnail = async (videoId: string, file: File): Promise<string | null> => {
  try {
    // Convert file to ArrayBuffer for raw binary upload
    const arrayBuffer = await file.arrayBuffer();

    const response = await fetch(`${BASE_URL}/${videoId}/thumbnail`, {
      method: 'POST',
      headers: await getHeaders({
        'Content-Type': file.type || 'image/jpeg',
        'x-admin-pin': LOCAL_ADMIN_PIN,
      }),
      body: arrayBuffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Thumbnail upload failed:', response.status, errText);
      return null;
    }

    // Re-fetch the video to get the updated thumbnailFileName Bunny assigned
    const videoRes = await fetch(`${BASE_URL}/${videoId}`, {
      headers: await getHeaders(),
    });
    if (videoRes.ok) {
      const videoData = await videoRes.json();
      return videoData.thumbnailFileName || 'thumbnail.jpg';
    }

    return 'thumbnail.jpg';
  } catch (error) {
    console.error('Thumbnail upload failed:', error);
    return null;
  }
};

/**
 * Polls the encoding status of a specific video.
 * Status 4 = finished, encodeProgress = 0-100.
 */
export const getVideoStatus = async (videoId: string): Promise<{ status: number; encodeProgress: number }> => {
  try {
    const response = await fetch(`${BASE_URL}/${videoId}`, {
      headers: await getHeaders(),
    });
    if (!response.ok) return { status: 0, encodeProgress: 0 };
    const data = await response.json();
    return { status: data.status, encodeProgress: data.encodeProgress };
  } catch {
    return { status: 0, encodeProgress: 0 };
  }
};

// ─── Library fetch ────────────────────────────────────────────────────────────

/**
 * Fetches ALL finished (status=4) videos from the Bunny video library.
 * Auto-paginates in batches of 100 until all videos are retrieved.
 */
export const fetchBunnyVideos = async (): Promise<BunnyVideoItem[]> => {
  if (!BASE_URL || !ANON_KEY) {
    console.warn('Bunny/Supabase environment variables are missing. Using demo content.');
    return [];
  }

  const all: BunnyVideoItem[] = [];
  let page = 1;

  try {
    while (true) {
      const res = await fetch(
        `${BASE_URL}?page=${page}&itemsPerPage=100&orderBy=date`,
        { headers: await getHeaders() }
      );

      if (!res.ok) {
        console.error(`Bunny library fetch failed: ${res.status} ${res.statusText}`);
        break;
      }

      const data: BunnyVideoListResponse = await res.json();

      // Only include videos that have finished encoding
      all.push(...data.items.filter((v) => v.status === 4));

      // Stop when we have consumed all pages
      if (page * 100 >= data.totalItems) break;
      page++;
    }

    // Deduplicate by GUID in case of overlapping pages or CDN sync issues
    const uniqueAll = Array.from(new Map(all.map(item => [item.guid, item])).values());

    console.log(`✅ Loaded ${uniqueAll.length} unique videos from Bunny library`);
    return uniqueAll;
  } catch (error) {
    console.error('fetchBunnyVideos failed:', error);
    return [];
  }
};

/**
 * Maps a Bunny API item to the app's Video shape.
 *
 * Creators can tag videos in the Bunny dashboard (Video › Edit › Meta Tags):
 *   category   → "Farmers" | "Education" | "Faith" | "Originals" | etc.
 *   author     → Channel/creator name shown on the card
 *   isPremium  → "true" to gate behind Ndovu subscription
 *   tags       → Comma-separated strings, e.g. "farming,maize,kenya"
 */
export const bunnyVideoToVideo = (item: BunnyVideoItem) => {
  // Merge any local overrides from the Admin Dashboard
  let activeItem = item;
  try {
    const overridesStr = localStorage.getItem('tube_content_overrides');
    if (overridesStr) {
      const overrides = JSON.parse(overridesStr);
      const o = overrides[item.guid];
      if (o) {
        activeItem = {
          ...item,
          title: o.title || item.title,
          metaTags: [
            ...(item.metaTags || []).filter(t => !['category','author','genre','description','thumbnailurl','trailerurl','productionyear','ispremium','tags','season','episode','seriestitle','contentrating','classificationnumber','transcript','transcripturl'].includes(t.property.toLowerCase())),
            ...(Object.entries(o).map(([k, v]) => ({ property: k, value: String(v) }))),
          ],
        } as BunnyVideoItem;
      }
    }
  } catch (e) {
    // Ignore localStorage errors (e.g. SSR or incognito mode)
  }

  const rawCategory = getMeta(activeItem.metaTags, 'category') || 'Uncategorized';
  
  const categoryMap: Record<string, string> = {
    'farmers': 'Farmers',
    'farming': 'Farmers',
    'agriculture': 'Farmers',
    'education': 'Education',
    'shule': 'Education',
    'faith': 'Faith',
    'diaspora': 'Diaspora',
    'kids': 'Kids',
    'watoto': 'Kids',
    'movies': 'Movies',
    'originals – movies': 'Movies',
    'movie': 'Movies',
    'series': 'Series',
    'originals – series': 'Series',
    'originals': 'Movies', // Legacy fallback
    'trending': 'Trending',
    'live': 'Live',
  };

  const normalized = rawCategory.toLowerCase().trim();
  const category = categoryMap[normalized] || (normalized.charAt(0).toUpperCase() + normalized.slice(1));

  // Parse season/episode from metaTags or from title pattern "S01E03 Title"
  const rawSeason = getMeta(activeItem.metaTags, 'season');
  const rawEpisode = getMeta(activeItem.metaTags, 'episode');
  const rawSeriesTitle = getMeta(activeItem.metaTags, 'seriesTitle') || getMeta(activeItem.metaTags, 'series');

  // Also attempt to extract S/E from title if not in metaTags
  const seMatch = activeItem.title?.match(/^S(\d+)\s*E(\d+)\s*[-–:]?\s*/i);
  const parsedSeason = rawSeason ? parseInt(rawSeason) : (seMatch ? parseInt(seMatch[1]) : undefined);
  const parsedEpisode = rawEpisode ? parseInt(rawEpisode) : (seMatch ? parseInt(seMatch[2]) : undefined);
  const cleanTitle = seMatch ? activeItem.title.replace(seMatch[0], '').trim() : activeItem.title;

  const productionYearRaw = getMeta(activeItem.metaTags, 'productionYear') || getMeta(activeItem.metaTags, 'year');

  return {
    id: activeItem.guid,
    title: cleanTitle || 'Untitled',
    description: getMeta(activeItem.metaTags, 'description'),
    thumbnail: getMeta(activeItem.metaTags, 'thumbnailUrl') || getThumbnailUrl(activeItem.guid, activeItem.thumbnailFileName),
    url: getStreamUrl(activeItem.guid),
    duration: formatDuration(activeItem.length),
    views: activeItem.views ?? 0,
    isPremium: getMeta(activeItem.metaTags, 'isPremium') === 'true',
    author: getMeta(activeItem.metaTags, 'author') || getMeta(activeItem.metaTags, 'creator') || 'Tube Creator',
    category,
    tags: getMeta(activeItem.metaTags, 'tags')
      ? getMeta(activeItem.metaTags, 'tags').split(',').map((t) => t.trim())
      : [],
    // Series fields
    seriesTitle: rawSeriesTitle || undefined,
    season: parsedSeason,
    episode: parsedEpisode,
    genre: getMeta(activeItem.metaTags, 'genre') || undefined,
    productionYear: productionYearRaw ? parseInt(productionYearRaw) : undefined,
    trailerUrl: getMeta(activeItem.metaTags, 'trailerUrl') || undefined,
    contentRating: normalizeContentRating(getMeta(activeItem.metaTags, 'contentRating')),
    classificationNumber: getMeta(activeItem.metaTags, 'classificationNumber') || undefined,
    transcript: getMeta(activeItem.metaTags, 'transcript') || undefined,
    transcriptUrl: getMeta(activeItem.metaTags, 'transcriptUrl') || undefined,
    uploadDate: activeItem.dateUploaded || undefined,
    muted: getMeta(activeItem.metaTags, 'muted') === 'true',
  };
};
