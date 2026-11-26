import { ViewState, type ViewStateOrString } from '../types';

export interface CategoryRouteConfig {
  slug: string;
  path: string;
  view: ViewState;
  title: string;
  description: string;
  categoryMatch: string;
}

export const CATEGORY_ROUTES: CategoryRouteConfig[] = [
  {
    slug: 'school-flix',
    path: '/school-flix',
    view: ViewState.SCHOOL_FLIX,
    title: 'TubeTV School Flix | Kenyan High School, Campus & Youth Films',
    description:
      'Watch Kenyan high school drama, campus stories, music, comedy, and next-generation student cinema on TubeTV School Flix.',
    categoryMatch: 'school flix',
  },
  {
    slug: 'kids',
    path: '/kids',
    view: ViewState.KIDS,
    title: 'TubeTV Watoto Kids | Safe Kenyan Cartoons, Stories & Learning',
    description:
      'Family-safe GE-rated Kenyan cartoons, bedtime stories, songs, and kids learning programmes on TubeTV Watoto.',
    categoryMatch: 'kids',
  },
  {
    slug: 'diaspora',
    path: '/diaspora',
    view: ViewState.DIASPORA,
    title: 'TubeTV Diaspora | Kenyan & East African Stories Worldwide',
    description:
      'Stream Kenyan dramas, movies, culture, news, and Diaspora stories anywhere in the US, UK, Europe, and worldwide on TubeTV.',
    categoryMatch: 'diaspora',
  },
  {
    slug: 'shorts',
    path: '/shorts',
    view: ViewState.SHORTS,
    title: 'TubeTV Shorts | Free Viral Kenyan Clips & Teasers',
    description:
      'Watch free bite-sized Kenyan video clips, behind-the-scenes reels, and drama teasers on TubeTV Shorts.',
    categoryMatch: 'shorts',
  },
  {
    slug: 'education',
    path: '/education',
    view: ViewState.EDUCATION,
    title: 'TubeTV Education | CBC, High School Revision & AI Learning',
    description:
      'Stream Kenyan CBC lessons, KCSE revision tutorials, teacher guides, and AI learning videos on TubeTV Education.',
    categoryMatch: 'education',
  },
  {
    slug: 'farmers',
    path: '/farmers',
    view: ViewState.FARMERS,
    title: 'TubeTV Farmers | Kenyan Agribusiness, Crops, Dairy & Livestock',
    description:
      'Practical Kenyan farming guides, agribusiness tips, climate-smart crops, dairy, and livestock programmes on TubeTV Farmers.',
    categoryMatch: 'farmers',
  },
  {
    slug: 'faith',
    path: '/faith',
    view: ViewState.FAITH,
    title: 'TubeTV Faith | Sermons, Worship, Devotion & Kids Bible',
    description:
      'Watch inspiring Kenyan sermons, gospel worship, daily devotions, and family faith stories on TubeTV Faith.',
    categoryMatch: 'faith',
  },
  {
    slug: 'live',
    path: '/live',
    view: ViewState.LIVE,
    title: 'TubeTV Live | Kenyan Live Streams, Events & News',
    description:
      'Watch live Kenyan events, sports, news, and community broadcasts streaming in real time on TubeTV Live.',
    categoryMatch: 'live',
  },
  {
    slug: 'genres',
    path: '/genres',
    view: ViewState.GENRES,
    title: 'TubeTV Genres | Drama, Comedy, Action, Romance & Swahili',
    description:
      'Explore Kenyan and East African dramas, comedies, thrillers, romance, animations, and Swahili stories by genre on TubeTV.',
    categoryMatch: '',
  },
];

const BY_PATH = new Map(CATEGORY_ROUTES.map((r) => [r.path, r]));
const BY_VIEW = new Map<ViewStateOrString, CategoryRouteConfig>(CATEGORY_ROUTES.map((r) => [r.view, r]));

export function categoryRouteFromPath(pathname: string): CategoryRouteConfig | undefined {
  const clean = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return BY_PATH.get(clean);
}

export function categoryRouteFromView(view: ViewStateOrString): CategoryRouteConfig | undefined {
  return BY_VIEW.get(view);
}
