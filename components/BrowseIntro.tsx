import React from 'react';
import { ViewState, type ViewStateOrString } from '../types';

const sections: Partial<Record<ViewState, { label: string; description: string }>> = {
  [ViewState.MICRO_DRAMAS]: { label: 'Micro Dramas', description: 'Short-form stories made for a closer look. Our first vertical series are on the way.' },
  [ViewState.EDUCATION]: { label: 'Education', description: 'Discover lessons, ideas and practical knowledge.' },
  [ViewState.FARMERS]: { label: 'Farmers', description: 'Stories and knowledge from the people who grow our future.' },
  [ViewState.FAITH]: { label: 'Faith', description: 'Explore voices and stories of faith.' },
  [ViewState.KIDS]: { label: 'Kids', description: 'Stories, songs and learning for young viewers.' },
  [ViewState.DIASPORA]: { label: 'Diaspora', description: 'Discover stories connecting Kenyans across the world.' },
};

export function browseIdentity(view: ViewStateOrString, subcategory: string, customLabel?: string) {
  if (view === ViewState.ORIGINALS) {
    if (subcategory === 'Movies') return { label: 'Movies', description: 'Settle in for a bigger story.' };
    if (subcategory === 'Series') return { label: 'Series', description: 'Find a story worth following, episode by episode.' };
    if (subcategory === 'Micro Dramas') return sections[ViewState.MICRO_DRAMAS]!;
    return { label: 'Movies & Series', description: 'Discover films and stories worth following.' };
  }
  return sections[view as ViewState] || { label: customLabel || 'Explore TubeTV', description: 'Find more stories from the TubeTV catalogue.' };
}

export default function BrowseIntro({ view, subcategory, customLabel, search, resultCount, loading, onClearSearch }: {
  view: ViewStateOrString; subcategory: string; customLabel?: string; search: string; resultCount: number; loading: boolean; onClearSearch: () => void;
}) {
  const searching = Boolean(search.trim());
  const { label, description } = browseIdentity(view, subcategory, customLabel);
  return <section className="browse-intro" aria-label={searching ? 'Search results' : `${label} introduction`}>
    <p className="browse-intro-eyebrow">{searching ? 'SEARCH THE CATALOGUE' : 'EXPLORE TUBETV'}</p>
    <div className="browse-intro-row">
      <div>
        <h1>{searching ? 'Search results' : label}</h1>
        <p className="browse-intro-description">{searching ? <>Showing matches for <strong>“{search.trim()}”</strong> across all TubeTV categories.</> : description}</p>
      </div>
      {searching && <button className="browse-clear-search" onClick={onClearSearch}>Clear search</button>}
    </div>
    {!loading && <p className="browse-intro-count">{resultCount} {resultCount === 1 ? 'video' : 'videos'} {searching ? 'found' : 'in this selection'}</p>}
  </section>;
}
