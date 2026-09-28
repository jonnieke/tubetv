import type { Video, ViewStateOrString } from '../types';
import { ViewState } from '../types';
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

export function filterDiscoveryVideos(videos: Video[], view: ViewStateOrString, subcategory: string, search: string, customCategory?: string): Video[] {
  const query = search.trim().toLocaleLowerCase();
  if (query) return videos.filter(video => [video.title, video.seriesTitle, video.description, video.author, video.category, video.genre, ...(video.tags || [])]
    .some(value => value?.toLocaleLowerCase().includes(query)));

  let result = videos;
  if (view === ViewState.ORIGINALS) result = result.filter(video => ['Movies', 'Series', 'Originals'].includes(video.category) || isMicroDrama(video));
  else {
    const category = categoryForView[view as ViewState];
    if (category) result = result.filter(video => video.category === category || (view === ViewState.MICRO_DRAMAS && isMicroDrama(video)));
    else if (customCategory) result = result.filter(video => video.category.toLocaleLowerCase().includes(customCategory.toLocaleLowerCase()) || video.tags?.some(tag => tag.toLocaleLowerCase().includes(customCategory.toLocaleLowerCase())));
  }

  if (!subcategory || subcategory === 'All') return result;
  if (view === ViewState.ORIGINALS) return result.filter(video => subcategory === 'Micro Dramas' ? isMicroDrama(video) : subcategory === 'Movies' ? ['Movies', 'Originals'].includes(video.category) && !isMicroDrama(video) : video.category === subcategory);
  if (view === ViewState.HOME && subcategory === 'Trending') return result;
  if (view === ViewState.HOME && subcategory === 'Most Watched') return result.filter(video => video.views > 1000);
  if (view === ViewState.HOME && subcategory === 'New Releases') return [...result].sort((a, b) => (Date.parse(b.uploadDate || '') || 0) - (Date.parse(a.uploadDate || '') || 0));
  const term = subcategory.toLocaleLowerCase();
  return result.filter(video => video.genre?.toLocaleLowerCase().includes(term) || video.tags?.some(tag => tag.toLocaleLowerCase().includes(term)) || video.title.toLocaleLowerCase().includes(term));
}
