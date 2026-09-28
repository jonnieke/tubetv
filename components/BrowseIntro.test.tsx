import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ViewState } from '../types';
import BrowseIntro, { browseIdentity } from './BrowseIntro';
import CatalogueEmptyState from './CatalogueEmptyState';

const props = { onClearSearch: () => {}, resultCount: 2, loading: false, search: '' };

describe('browse presentation', () => {
  it('names movies, series and micro dramas specifically', () => {
    expect(browseIdentity(ViewState.ORIGINALS, 'Movies').label).toBe('Movies');
    expect(browseIdentity(ViewState.ORIGINALS, 'Series').label).toBe('Series');
    expect(browseIdentity(ViewState.ORIGINALS, 'Micro Dramas').label).toBe('Micro Dramas');
    expect(browseIdentity(ViewState.ORIGINALS, 'All').label).toBe('Movies & Series');
  });

  it('uses a custom category name and an accurate video count', () => {
    const html = renderToStaticMarkup(<BrowseIntro {...props} view="CUSTOM_ID" subcategory="All" customLabel="Music" />);
    expect(html).toContain('<h1>Music</h1>');
    expect(html).toContain('2 videos in this selection');
  });

  it('keeps search results distinct from the current category', () => {
    const html = renderToStaticMarkup(<BrowseIntro {...props} view={ViewState.ORIGINALS} subcategory="Movies" search="Nairobi" />);
    expect(html).toContain('<h1>Search results</h1>');
    expect(html).toContain('Nairobi');
    expect(html).toContain('Clear search');
    expect(html).not.toContain('<h1>Movies</h1>');
  });

  it('offers an exit from empty search and category selections', () => {
    const search = renderToStaticMarkup(<CatalogueEmptyState search="missing" subcategory="All" onClearSearch={() => {}} onShowAll={() => {}} onBrowse={() => {}} />);
    const category = renderToStaticMarkup(<CatalogueEmptyState search="" subcategory="Series" onClearSearch={() => {}} onShowAll={() => {}} onBrowse={() => {}} />);
    expect(search).toContain('Clear search');
    expect(category).toContain('Show all titles');
    expect(category).toContain('Explore TubeTV');
  });
});
