
import { Video, ShortVideo, DailyStat } from './types';

// ─── Feature Flags ────────────────────────────────────────────────────────────

// Test phase: unrated titles remain visible until TubeTV completes KFCB onboarding.
// Set to true before public market launch to hide UNRATED content.
export const CONTENT_RATING_ENFORCED = import.meta.env.VITE_CONTENT_RATING_ENFORCED === 'true';

export const MOCK_VIDEOS: Video[] = [
  // ─── Micro Dramas (Flagship Hero Lineup) ──────────────────────────────────
  {
    id: 'micro-roommates-ep1',
    title: 'Roommates: Episode 1 · The New Tenant',
    seriesTitle: 'Roommates',
    seriesSynopsis: 'Three Nairobi university students rent an apartment in Roysambu, but an unexpected housemate brings secrets that threaten to tear their lives apart.',
    episodeSynopsis: 'Faith and Achieng find an uninvited guest unpacking in their living room with a signed lease from their missing landlord.',
    thumbnail: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
    seriesPosterUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
    views: 3450000,
    duration: '2m 15s',
    isPremium: false,
    author: 'TubeTV Originals',
    category: 'Micro Dramas',
    seriesFormat: 'micro-drama',
    seriesId: 'series-roommates',
    season: 1,
    episode: 1,
    freeEpisodes: 2,
    contentRating: 'PG',
    tags: ['Micro Drama', 'Campus', 'Drama', 'Comedy']
  },
  {
    id: 'micro-nairobi-secret-ep1',
    title: 'A Nairobi Secret: Episode 1 · Wrong Number',
    seriesTitle: 'A Nairobi Secret',
    seriesSynopsis: 'One text message sent to the wrong phone reveals a double life in Kilimani. Two lovers, one secret, and nowhere to hide.',
    episodeSynopsis: 'At 11 PM on a rainy Tuesday, Brenda receives an intimate photo and a location pin meant for her fiancé.',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80',
    seriesPosterUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80',
    views: 2890000,
    duration: '1m 58s',
    isPremium: false,
    author: 'TubeTV Studios',
    category: 'Micro Dramas',
    seriesFormat: 'micro-drama',
    seriesId: 'series-nairobi-secret',
    season: 1,
    episode: 1,
    freeEpisodes: 2,
    contentRating: '16',
    tags: ['Micro Drama', 'Romance', 'Thriller', 'Nairobi']
  },
  {
    id: 'micro-after-wedding-ep1',
    title: 'After the Wedding: Episode 1 · The Toast',
    seriesTitle: 'After the Wedding',
    seriesSynopsis: 'A lavish Karen wedding celebration takes a dramatic turn when an uninvited guest stands up during the vows with undeniable proof.',
    episodeSynopsis: 'As the champagne is poured, the bride receives a whisper that turns her dream wedding into an absolute nightmare.',
    thumbnail: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&auto=format&fit=crop&q=80',
    seriesPosterUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&auto=format&fit=crop&q=80',
    views: 2450000,
    duration: '2m 30s',
    isPremium: false,
    author: 'Nairobi Film Hub',
    category: 'Micro Dramas',
    seriesFormat: 'micro-drama',
    seriesId: 'series-after-wedding',
    season: 1,
    episode: 1,
    freeEpisodes: 2,
    contentRating: 'PG',
    tags: ['Micro Drama', 'Wedding', 'Family', 'Drama']
  },
  {
    id: 'micro-last-matatu-ep1',
    title: 'The Last Matatu: Episode 1 · Midnight Route 44',
    seriesTitle: 'The Last Matatu',
    seriesSynopsis: 'It is 11:45 PM in downtown Nairobi. Seven strangers board the last Route 44 matatu to Githurai, unaware the driver has a score to settle.',
    episodeSynopsis: 'The conductor locks the side door and turns the bass up high as the matatu skips all the scheduled stops.',
    thumbnail: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&auto=format&fit=crop&q=80',
    seriesPosterUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&auto=format&fit=crop&q=80',
    views: 1980000,
    duration: '2m 10s',
    isPremium: false,
    author: 'Ghetto Wave',
    category: 'Micro Dramas',
    seriesFormat: 'micro-drama',
    seriesId: 'series-last-matatu',
    season: 1,
    episode: 1,
    freeEpisodes: 2,
    contentRating: '16',
    tags: ['Micro Drama', 'Suspense', 'Matatu', 'Action']
  },
  {
    id: 'micro-her-second-life-ep1',
    title: 'Her Second Life: Episode 1 · The Return',
    seriesTitle: 'Her Second Life',
    seriesSynopsis: 'Betrayed by her partner and left with nothing, Zawadi returns to the city three years later under an assumed identity to take back her empire.',
    episodeSynopsis: 'Zawadi walks into the high-stakes board meeting of the company she built, dressed as the new majority shareholder.',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&auto=format&fit=crop&q=80',
    seriesPosterUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&auto=format&fit=crop&q=80',
    views: 2150000,
    duration: '2m 05s',
    isPremium: false,
    author: 'Savannah Pictures',
    category: 'Micro Dramas',
    seriesFormat: 'micro-drama',
    seriesId: 'series-her-second-life',
    season: 1,
    episode: 1,
    freeEpisodes: 2,
    contentRating: 'PG',
    tags: ['Micro Drama', 'Revenge', 'Business', 'Drama']
  },
  // Trending / General
  {
    id: '1',
    title: 'Nairobi Nightlife: Hidden Gems',
    thumbnail: 'https://picsum.photos/800/450?random=1',
    views: 1200000,
    duration: '24m',
    isPremium: false,
    author: 'Discover 254',
    category: 'Trending',
    tags: ['Lifestyle', 'Travel']
  },
  {
    id: '2',
    title: 'Matatu Culture: The Art of Moving',
    thumbnail: 'https://picsum.photos/800/450?random=2',
    views: 890000,
    duration: '45m',
    isPremium: false,
    author: 'Urban Pulse',
    category: 'Originals',
    tags: ['Documentary', 'Culture']
  },
  
  // Originals (Kenyan Drama/Comedy)
  {
    id: '3',
    title: 'The Landlord: Episode 1',
    thumbnail: 'https://picsum.photos/800/450?random=3',
    views: 3400000,
    duration: '22m',
    isPremium: false,
    author: 'Laugh Industry',
    category: 'Originals',
    tags: ['Comedy', 'Series']
  },
  {
    id: '4',
    title: 'Campus Diaries: Semester 1',
    thumbnail: 'https://picsum.photos/800/450?random=4',
    views: 450000,
    duration: '30m',
    isPremium: false,
    author: 'Youth TV',
    category: 'Originals',
    tags: ['Drama', 'Youth']
  },

  // Education
  {
    id: 'edu1',
    title: 'Grade 4 CBC Math: Fractions made Easy',
    thumbnail: 'https://picsum.photos/800/450?random=5',
    views: 12000,
    duration: '15m',
    isPremium: false,
    author: 'Teacher Wanjiku',
    category: 'Education',
    tags: ['CBC', 'Math', 'Primary']
  },
  {
    id: 'edu2',
    title: 'KCSE Revision: Biology Paper 1',
    thumbnail: 'https://picsum.photos/800/450?random=6',
    views: 85000,
    duration: '1h 10m',
    isPremium: false,
    author: 'Smart Brains Academy',
    category: 'Education',
    tags: ['High School', 'Revision']
  },
  {
    id: 'edu3',
    title: 'Intro to AI for Kids',
    thumbnail: 'https://picsum.photos/800/450?random=7',
    views: 5000,
    duration: '10m',
    isPremium: false,
    author: 'Soma AI',
    category: 'Education',
    tags: ['Tech', 'Kids']
  },

  // Farmers
  {
    id: 'farm1',
    title: 'How to Grow Avocados for Export',
    thumbnail: 'https://picsum.photos/800/450?random=8',
    views: 230000,
    duration: '18m',
    isPremium: false,
    author: 'Shamba Shape Up Fan',
    category: 'Farmers',
    tags: ['Agribusiness', 'Crops']
  },
  {
    id: 'farm2',
    title: 'Modern Dairy Farming Techniques',
    thumbnail: 'https://picsum.photos/800/450?random=9',
    views: 150000,
    duration: '25m',
    isPremium: false,
    author: 'AgriBiz Kenya',
    category: 'Farmers',
    tags: ['Livestock', 'Dairy']
  },

  // Faith
  {
    id: 'faith1',
    title: 'Sunday Service Live: Hope and Restoration',
    thumbnail: 'https://picsum.photos/800/450?random=10',
    views: 45000,
    duration: '1h 30m',
    isPremium: false,
    author: 'City Church',
    category: 'Faith',
    tags: ['Worship', 'Live']
  },
  {
    id: 'faith2',
    title: 'Bible Stories for Kids: David and Goliath',
    thumbnail: 'https://picsum.photos/800/450?random=11',
    views: 8000,
    duration: '5m',
    isPremium: false,
    author: 'Faith Kids',
    category: 'Faith',
    tags: ['Kids', 'Bible']
  },

  // Kids
  {
    id: 'kid1',
    title: 'Learn Swahili Alphabet Song',
    thumbnail: 'https://picsum.photos/800/450?random=12',
    views: 560000,
    duration: '3m',
    isPremium: false,
    author: 'Watoto TV',
    category: 'Kids',
    tags: ['Learning', 'Music']
  },
  {
    id: 'kid2',
    title: 'Tales by Moonlight: The Tortoise',
    thumbnail: 'https://picsum.photos/800/450?random=13',
    views: 120000,
    duration: '10m',
    isPremium: false,
    author: 'African Tales',
    category: 'Kids',
    tags: ['Folktales']
  },

  // Diaspora
  {
    id: 'dia1',
    title: 'Investing in Real Estate from Abroad',
    thumbnail: 'https://picsum.photos/800/450?random=14',
    views: 95000,
    duration: '40m',
    isPremium: false,
    author: 'Diaspora Connect',
    category: 'Diaspora',
    tags: ['Investment', 'Real Estate']
  },
  {
    id: 'dia2',
    title: 'Mugithi Night Live in London',
    thumbnail: 'https://picsum.photos/800/450?random=15',
    views: 210000,
    duration: '2h',
    isPremium: false,
    author: 'Events 254',
    category: 'Diaspora',
    tags: ['Music', 'Events']
  },

  // Live
  {
    id: 'live1',
    title: 'Live: Safari Rally Highlights',
    thumbnail: 'https://picsum.photos/800/450?random=16',
    views: 300000,
    duration: 'Live',
    isPremium: false,
    author: 'Sports Kenya',
    category: 'Live',
    tags: ['Sports']
  }
];

// ─── Shorts — real MP4 video URLs ─────────────────────────────────────────────
export const MOCK_SHORTS: ShortVideo[] = [
  {
    id: 's1',
    thumbnail: 'https://picsum.photos/seed/tubetv-short-1/450/800',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Comedy preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  },
  {
    id: 's2',
    thumbnail: 'https://picsum.photos/seed/tubetv-short-2/450/800',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Food preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  },
  {
    id: 'ad1',
    thumbnail: 'https://picsum.photos/seed/tubetv-short-ad/450/800',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: 'TubeTV demo sponsor',
    description: 'Example sponsored placement',
    likes: 0,
    comments: 0,
    isAd: true
  },
  {
    id: 's3',
    thumbnail: 'https://picsum.photos/seed/tubetv-short-3/450/800',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Travel preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  },
  {
    id: 's4',
    thumbnail: 'https://picsum.photos/seed/tubetv-short-4/450/800',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Sports preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  },
  {
    id: 's5',
    thumbnail: 'https://picsum.photos/seed/tubetv-short-5/450/800',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Series preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  },
  {
    id: 's6',
    thumbnail: 'https://picsum.photos/seed/tubetv-short-6/450/800',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Technology preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  }
];
