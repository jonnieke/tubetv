import React from 'react';
import { ViewState, type ViewStateOrString } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const sections: Partial<Record<ViewState, { label: string; description: string; swLabel: string; swDescription: string }>> = {
  [ViewState.MICRO_DRAMAS]: {
    label: 'Micro Dramas',
    swLabel: 'Tamthilia Fupi',
    description: 'Short-form vertical stories built for mobile — start free with opening episodes.',
    swDescription: 'Tamthilia fupi za wima kwa simu — anza bure na vipindi vya kwanza.',
  },
  [ViewState.EDUCATION]: {
    label: 'Education',
    swLabel: 'Elimu',
    description: 'Discover lessons, ideas and practical knowledge.',
    swDescription: 'Gundua masomo, mawazo na ujuzi wa vitendo.',
  },
  [ViewState.FARMERS]: {
    label: 'Farmers',
    swLabel: 'Wakulima',
    description: 'Stories and knowledge from the people who grow our future.',
    swDescription: 'Hadithi na ujuzi wa kilimo kutoka kwa wakulima wetu.',
  },
  [ViewState.FAITH]: {
    label: 'Faith',
    swLabel: 'Imani',
    description: 'Explore voices and stories of faith.',
    swDescription: 'Chunguza sauti na jumbe za imani.',
  },
  [ViewState.KIDS]: {
    label: 'Kids',
    swLabel: 'Watoto',
    description: 'General Exhibition (GE) stories, songs and learning for young viewers.',
    swDescription: 'Hadithi, nyimbo na mafunzo salama (GE) kwa watoto.',
  },
  [ViewState.GENRES]: {
    label: 'Genres',
    swLabel: 'Mada & Aina',
    description: 'Explore stories by taste — Kenyan drama, comedy, action, romance, animation and more.',
    swDescription: 'Chunguza hadithi kulingana na ladha yako — tamthilia, vichekesho, mapenzi na zaidi.',
  },
  [ViewState.DIASPORA]: {
    label: 'Diaspora',
    swLabel: 'Diaspora',
    description: 'Discover stories connecting Kenyans across the world.',
    swDescription: 'Hadithi zinazowaunganisha Wakenya kote duniani.',
  },
};

export function browseIdentity(view: ViewStateOrString, subcategory: string, customLabel?: string) {
  if (view === ViewState.ORIGINALS) {
    if (subcategory === 'Movies') return { label: 'Movies', description: 'Settle in for a bigger story.' };
    if (subcategory === 'Series') return { label: 'Series', description: 'Find a story worth following, episode by episode.' };
    if (subcategory === 'Micro Dramas') {
      return {
        label: sections[ViewState.MICRO_DRAMAS]!.label,
        description: sections[ViewState.MICRO_DRAMAS]!.description,
      };
    }
    if (subcategory && subcategory !== 'All') {
      return {
        label: `${subcategory} — Series & Movies`,
        description: `Discover ${subcategory.toLowerCase()} stories and films.`,
      };
    }
    return { label: 'Movies & Series', description: 'Discover films and stories worth following.' };
  }
  if (view === ViewState.GENRES) {
    if (subcategory && subcategory !== 'All') {
      return {
        label: `${subcategory} Stories`,
        description: `The best of ${subcategory.toLowerCase()} streaming on TubeTV.`,
      };
    }
    return { label: sections[ViewState.GENRES]!.label, description: sections[ViewState.GENRES]!.description };
  }
  const matched = sections[view as ViewState];
  if (matched) return { label: matched.label, description: matched.description };
  return {
    label: customLabel || 'Explore TubeTV',
    description: 'Find more stories from the TubeTV catalogue.',
  };
}

export default function BrowseIntro({
  view,
  subcategory,
  customLabel,
  search,
  resultCount,
  loading,
  onClearSearch,
}: {
  view: ViewStateOrString;
  subcategory: string;
  customLabel?: string;
  search: string;
  resultCount: number;
  loading: boolean;
  onClearSearch: () => void;
}) {
  const { language, t } = useLanguage();
  const searching = Boolean(search.trim());
  const base = browseIdentity(view, subcategory, customLabel);
  const swSection = sections[view as ViewState];
  const label = language === 'sw' && swSection && (!subcategory || subcategory === 'All') ? swSection.swLabel : base.label;
  const description =
    language === 'sw' && swSection && (!subcategory || subcategory === 'All')
      ? swSection.swDescription
      : base.description;

  return (
    <section className="browse-intro" aria-label={searching ? 'Search results' : `${base.label} introduction`}>
      <p className="browse-intro-eyebrow">
        {searching
          ? language === 'sw'
            ? 'TAFUTA KWENYE ORODHA'
            : 'SEARCH THE CATALOGUE'
          : language === 'sw'
            ? 'GUNDUA TUBETV'
            : 'EXPLORE TUBETV'}
      </p>
      <div className="browse-intro-row">
        <div>
          <h1>{searching ? (language === 'sw' ? 'Matokeo ya utafutaji' : 'Search results') : label}</h1>
          <p className="browse-intro-description">
            {searching ? (
              language === 'sw' ? (
                <>
                  Inaonyesha matokeo ya <strong>“{search.trim()}”</strong> kwenye vipengele vyote vya TubeTV.
                </>
              ) : (
                <>
                  Showing matches for <strong>“{search.trim()}”</strong> across all TubeTV categories.
                </>
              )
            ) : (
              description
            )}
          </p>
        </div>
        {searching && (
          <button type="button" className="browse-clear-search" onClick={onClearSearch}>
            {t('common.clearSearch')}
          </button>
        )}
      </div>
      {!loading && (
        <p className="browse-intro-count">
          {language === 'sw'
            ? `${resultCount} video ${searching ? 'zimepatikana' : 'kwenye chaguo hili'}`
            : `${resultCount} ${resultCount === 1 ? 'video' : 'videos'} ${searching ? 'found' : 'in this selection'}`}
        </p>
      )}
    </section>
  );
}
