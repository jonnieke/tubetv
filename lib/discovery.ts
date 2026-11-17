import type { Video, ViewStateOrString } from '../types';
import { ViewState } from '../types';
import { canWatchContent, normalizeContentRating } from './contentRating';
import { isMicroDrama } from './series';

const categoryForView: Partial<Record<ViewState, string>> = {
  [ViewState.MICRO_DRAMAS]: 'Micro Dramas',
  [ViewState.SCHOOL_FLIX]: 'School Flix',
  [ViewState.EDUCATION]: 'Education',
  [ViewState.FARMERS]: 'Farmers',
  [ViewState.FAITH]: 'Faith',
  [ViewState.DIASPORA]: 'Diaspora',
  [ViewState.KIDS]: 'Kids',
  [ViewState.LIVE]: 'Live',
};

const KIDS_WORD_RE = /\b(kids?|watoto|cartoons?|tamariki)\b/i;

export function filterVideosByRating(
  videos: Video[],
  maximumRating: 'GE' | 'PG' | '16',
  enforceUnrated = false,
): Video[] {
  return videos.filter((video) => {
    const rating = normalizeContentRating(video.contentRating);
    if (rating === '18') return false;
    if (rating === 'UNRATED') {
      if (enforceUnrated) return false;
      // When unrated titles are allowed during rollout, still hide them if the viewer
      // explicitly restricted playback to GE or PG family mode.
      return maximumRating === '16';
    }
    return canWatchContent(rating, maximumRating);
  });
}

export function isKidsVideo(video: Video): boolean {
  const rating = normalizeContentRating(video.contentRating);
  // Strict KFCB Kids guardrail: never admit PG, 16, or 18 content into Kids
  if (rating === 'PG' || rating === '16' || rating === '18') return false;

  if (video.category === 'Kids') return true;
  const tags = video.tags || [];
  if (tags.some((t) => KIDS_WORD_RE.test(t))) return true;
  if (video.genre && KIDS_WORD_RE.test(video.genre)) return true;
  if (rating === 'GE' && /\banimation\b/i.test(video.genre || '')) return true;
  if (/\b(kids?|watoto)\b/i.test(video.title)) return true;
  return false;
}

export function filterDiscoveryVideos(
  videos: Video[],
  view: ViewStateOrString,
  subcategory: string,
  search: string,
  customCategory?: string,
): Video[] {
  const query = search.trim().toLocaleLowerCase();
  if (query) {
    return videos.filter((video) =>
      [video.title, video.seriesTitle, video.description, video.author, video.category, video.genre, ...(video.tags || [])]
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }

  let result = videos;
  if (view === ViewState.ORIGINALS) {
    result = result.filter((video) => ['Movies', 'Series', 'Originals'].includes(video.category) || isMicroDrama(video));
  } else if (view === ViewState.KIDS) {
    result = result.filter(isKidsVideo);
  } else if (view === ViewState.GENRES) {
    result = videos;
  } else {
    const category = categoryForView[view as ViewState];
    if (category) {
      result = result.filter(
        (video) =>
          video.category === category ||
          (view === ViewState.MICRO_DRAMAS && isMicroDrama(video)) ||
          (view === ViewState.SCHOOL_FLIX && video.category?.toLowerCase().replace(/\s+/g, '') === 'schoolflix'),
      );
    } else if (customCategory) {
      result = result.filter(
        (video) =>
          video.category.toLocaleLowerCase().includes(customCategory.toLocaleLowerCase()) ||
          video.tags?.some((tag) => tag.toLocaleLowerCase().includes(customCategory.toLocaleLowerCase())),
      );
    }
  }

  if (!subcategory || subcategory === 'All') return result;

  if (view === ViewState.ORIGINALS) {
    if (subcategory === 'Micro Dramas') return result.filter((video) => isMicroDrama(video));
    if (subcategory === 'Movies') return result.filter((video) => ['Movies', 'Originals'].includes(video.category) && !isMicroDrama(video));
    if (subcategory === 'Series') return result.filter((video) => video.category === 'Series');
    const genreTerm = subcategory.toLocaleLowerCase();
    return result.filter(
      (video) =>
        video.genre?.toLocaleLowerCase().includes(genreTerm) ||
        video.tags?.some((tag) => tag.toLocaleLowerCase().includes(genreTerm)),
    );
  }

  if (view === ViewState.KIDS) {
    const term = subcategory.toLocaleLowerCase();
    if (term === 'cartoons' || term === 'animation') {
      return result.filter(
        (v) =>
          /\b(animation|cartoons?)\b/i.test(v.genre || '') ||
          (v.tags || []).some((t) => /\b(animation|cartoons?)\b/i.test(t)),
      );
    }
    if (term === 'songs') {
      return result.filter(
        (v) =>
          /\b(music|songs?|wimbo|nyimbo)\b/i.test(v.genre || '') ||
          (v.tags || []).some((t) => /\b(songs?|music|wimbo|nyimbo)\b/i.test(t)) ||
          /\b(songs?|wimbo|nyimbo)\b/i.test(v.title),
      );
    }
    if (term === 'stories') {
      return result.filter(
        (v) =>
          (v.tags || []).some((t) => /\b(stor(y|ies)|tales?|fables?|hadithi)\b/i.test(t)) ||
          /\b(stor(y|ies)|tales?|fables?|hadithi)\b/i.test(v.title),
      );
    }
    if (term === 'learning') {
      return result.filter(
        (v) =>
          /\b(education|learning|elimu)\b/i.test(v.genre || '') ||
          (v.tags || []).some((t) => /\b(learning|learn|education|school|alphabet|cbc|elimu)\b/i.test(t)) ||
          /\b(learn|learning|alphabet|cbc|elimu)\b/i.test(v.title),
      );
    }
    return result.filter(
      (video) =>
        video.genre?.toLocaleLowerCase().includes(term) ||
        video.tags?.some((tag) => tag.toLocaleLowerCase().includes(term)) ||
        video.title.toLocaleLowerCase().includes(term),
    );
  }

  if (view === ViewState.GENRES) {
    const term = subcategory.toLocaleLowerCase();
    return result.filter(
      (video) =>
        video.genre?.toLocaleLowerCase().includes(term) ||
        video.tags?.some((tag) => tag.toLocaleLowerCase().includes(term)) ||
        video.category.toLocaleLowerCase().includes(term),
    );
  }

  if (view === ViewState.HOME && subcategory === 'Trending') return result;
  if (view === ViewState.HOME && subcategory === 'Most Watched') {
    return [...result].sort(
      (a, b) => b.views - a.views || (Date.parse(b.uploadDate || '') || 0) - (Date.parse(a.uploadDate || '') || 0),
    );
  }
  if (view === ViewState.HOME && subcategory === 'New Releases') {
    return [...result].sort((a, b) => (Date.parse(b.uploadDate || '') || 0) - (Date.parse(a.uploadDate || '') || 0));
  }
  const term = subcategory.toLocaleLowerCase();
  return result.filter(
    (video) =>
      video.genre?.toLocaleLowerCase().includes(term) ||
      video.tags?.some((tag) => tag.toLocaleLowerCase().includes(term)) ||
      video.title.toLocaleLowerCase().includes(term),
  );
}

export type CatalogSortMode = 'latest' | 'views' | 'title';

/** Returns a comparable epoch timestamp (ms) for sorting catalogue items by platform ingest date. */
export function getVideoTimestamp(video: Video): number {
  const uploadMs = video.uploadDate ? Date.parse(video.uploadDate) : NaN;
  if (Number.isFinite(uploadMs)) return uploadMs;
  const editorialMs = video.editorialUpdatedAt ? Date.parse(video.editorialUpdatedAt) : NaN;
  if (Number.isFinite(editorialMs)) return editorialMs;
  if (video.productionYear && Number.isFinite(video.productionYear)) {
    return Date.UTC(video.productionYear, 0, 1);
  }
  return 0;
}

/** Returns UTC midnight timestamp (ms) for the day the item was ingested onto the platform. */
export function getIngestDayTimestamp(video: Video): number {
  const ts = getVideoTimestamp(video);
  if (!ts) return 0;
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Returns true when a title is a standalone movie/film (not a Short, Series, or Micro Drama). */
export function isStandaloneMovie(video: Video): boolean {
  if (video.category === 'Shorts' || video.isShort) return false;
  if (isMicroDrama(video) || video.category === 'Series' || Boolean(video.seriesTitle?.trim())) return false;
  return ['Movies', 'Originals'].includes(video.category);
}

/** Builds the homepage Latest carousel ordered by platform ingest day descending (movies first within the same day). */
export function getLatestWithMoviesFirst(videos: Video[], limit = 24): Video[] {
  return videos
    .filter((v) => v.category !== 'Shorts' && !v.isShort)
    .sort((a, b) => {
      const dayDiff = getIngestDayTimestamp(b) - getIngestDayTimestamp(a);
      if (dayDiff !== 0) return dayDiff;
      const movieDiff = (isStandaloneMovie(b) ? 1 : 0) - (isStandaloneMovie(a) ? 1 : 0);
      if (movieDiff !== 0) return movieDiff;
      return getVideoTimestamp(b) - getVideoTimestamp(a) || (b.views || 0) - (a.views || 0);
    })
    .slice(0, limit);
}

/** Builds Trending Now by ranking recent momentum (recency + views) while excluding the Top 10 chart when enough titles exist. */
export function getTrendingVideos(videos: Video[], limit = 20, now = Date.now()): Video[] {
  const topTenIds = new Set(
    [...videos]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)
      .map((v) => v.id),
  );
  const candidates = videos.filter((v) => v.category !== 'Shorts' && !v.isShort);
  const nonTopTen = candidates.filter((v) => !topTenIds.has(v.id));
  const pool = nonTopTen.length >= 5 ? nonTopTen : candidates;

  const momentumScore = (v: Video) => {
    const ts = getVideoTimestamp(v);
    const ageDays = ts > 0 ? Math.max(0, (now - ts) / 86_400_000) : 180;
    const recencyBoost = Math.max(0, 60 - ageDays) * 1.5;
    const viewScore = Math.log10((v.views || 0) + 1) * 20;
    return recencyBoost + viewScore;
  };

  return [...pool]
    .sort((a, b) => momentumScore(b) - momentumScore(a) || (b.views || 0) - (a.views || 0))
    .slice(0, limit);
}

function extractGenresFromVideo(video: Video): string[] {
  const genres: string[] = [];
  if (video.genre) {
    for (const part of video.genre.split(',')) {
      const clean = part.trim();
      if (clean) genres.push(clean);
    }
  }
  return genres;
}

/** Organizes a Movies, Series, or Micro Dramas section by date, genre, and sort mode. */
export function organizeCatalogByDateAndGenre(
  videos: Video[],
  sortMode: CatalogSortMode = 'latest',
  selectedGenre = 'All',
) {
  const sortFn = (a: Video, b: Video) => {
    if (sortMode === 'views') {
      return (b.views || 0) - (a.views || 0) || getVideoTimestamp(b) - getVideoTimestamp(a);
    }
    if (sortMode === 'title') {
      return a.title.localeCompare(b.title);
    }
    return getVideoTimestamp(b) - getVideoTimestamp(a) || (b.views || 0) - (a.views || 0);
  };

  const genreMap = new Map<string, string>();
  for (const v of videos) {
    for (const g of extractGenresFromVideo(v)) {
      const key = g.toLowerCase();
      if (!genreMap.has(key)) genreMap.set(key, g);
    }
  }
  const genres = Array.from(genreMap.values()).sort((a, b) => a.localeCompare(b));

  const matchesGenre = (video: Video, genre: string) => {
    const term = genre.toLowerCase();
    return (
      extractGenresFromVideo(video).some((g) => g.toLowerCase() === term) ||
      (video.tags || []).some((t) => t.toLowerCase() === term)
    );
  };

  const sortedAll = [...videos].sort(sortFn);
  const filtered =
    !selectedGenre || selectedGenre === 'All'
      ? sortedAll
      : sortedAll.filter((v) => matchesGenre(v, selectedGenre));

  const genreShelves = genres
    .map((genre) => ({
      genre,
      videos: sortedAll.filter((v) => matchesGenre(v, genre)),
    }))
    .filter((shelf) => shelf.videos.length > 0);

  return {
    genres,
    filtered,
    genreShelves,
  };
}
