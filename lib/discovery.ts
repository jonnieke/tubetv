import type { Video, ViewStateOrString } from '../types';
import { ViewState } from '../types';
import { canWatchContent, normalizeContentRating } from './contentRating';
import { isMicroDrama } from './series';

const categoryForView: Partial<Record<ViewState, string>> = {
  [ViewState.MICRO_DRAMAS]: 'Micro Dramas',
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
      result = result.filter((video) => video.category === category || (view === ViewState.MICRO_DRAMAS && isMicroDrama(video)));
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
