
import { Video, ShortVideo, DailyStat } from './types';

// ─── Feature Flags ────────────────────────────────────────────────────────────

// Test phase: unrated titles remain visible until TubeTV completes KFCB onboarding.
// Set to true before public market launch to hide UNRATED content.
export const CONTENT_RATING_ENFORCED = import.meta.env.VITE_CONTENT_RATING_ENFORCED === 'true';

export const MOCK_VIDEOS: Video[] = [
  // Micro Dramas (Kenyan Vertical Episodic Stories)
  {
    id: 'micro-ns-1',
    title: 'The Stolen Ledger',
    seriesTitle: 'Nairobi Secrets',
    seriesId: 'nairobi-secrets',
    seriesFormat: 'micro-drama',
    seriesSynopsis: 'When a junior accountant at a Kilimani tech firm discovers an offshore fraud scheme, she becomes the target of a high-stakes corporate syndicate.',
    seasonSynopsis: 'Season 1: Survival in the City.',
    episodeSynopsis: 'Wanjiku stumbles upon an encrypted flash drive after her boss mysteriously vanishes from his penthouse.',
    season: 1,
    episode: 1,
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    views: 450000,
    duration: '1m 45s',
    isPremium: false,
    author: 'TubeTV Originals',
    category: 'Micro Dramas',
    introEndSeconds: 5,
    outroStartSeconds: 95,
    contentRating: 'PG',
    tags: ['Drama', 'Thriller', 'Nairobi']
  },
  {
    id: 'micro-ns-2',
    title: 'Midnight Call',
    seriesTitle: 'Nairobi Secrets',
    seriesId: 'nairobi-secrets',
    seriesFormat: 'micro-drama',
    seriesSynopsis: 'When a junior accountant at a Kilimani tech firm discovers an offshore fraud scheme, she becomes the target of a high-stakes corporate syndicate.',
    seasonSynopsis: 'Season 1: Survival in the City.',
    episodeSynopsis: 'An unknown caller gives Wanjiku 30 minutes to drop the drive at Westlands roundabout or her family faces the consequences.',
    season: 1,
    episode: 2,
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    views: 380000,
    duration: '2m 10s',
    isPremium: true,
    author: 'TubeTV Originals',
    category: 'Micro Dramas',
    introEndSeconds: 4,
    outroStartSeconds: 120,
    contentRating: 'PG',
    tags: ['Drama', 'Thriller', 'Nairobi']
  },
  {
    id: 'micro-ns-3',
    title: 'The Trap in Westlands',
    seriesTitle: 'Nairobi Secrets',
    seriesId: 'nairobi-secrets',
    seriesFormat: 'micro-drama',
    seriesSynopsis: 'When a junior accountant at a Kilimani tech firm discovers an offshore fraud scheme, she becomes the target of a high-stakes corporate syndicate.',
    seasonSynopsis: 'Season 1: Survival in the City.',
    episodeSynopsis: 'Wanjiku arrives at the drop point with an undercover DCI detective, only to find the caller was waiting for someone else.',
    season: 1,
    episode: 3,
    thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    views: 290000,
    duration: '2m 05s',
    isPremium: true,
    author: 'TubeTV Originals',
    category: 'Micro Dramas',
    introEndSeconds: 5,
    outroStartSeconds: 115,
    contentRating: 'PG',
    tags: ['Drama', 'Thriller', 'Nairobi']
  },
  {
    id: 'micro-ns-4',
    title: 'Syndicate Exposed',
    seriesTitle: 'Nairobi Secrets',
    seriesId: 'nairobi-secrets',
    seriesFormat: 'micro-drama',
    seriesSynopsis: 'When a junior accountant at a Kilimani tech firm discovers an offshore fraud scheme, she becomes the target of a high-stakes corporate syndicate.',
    seasonSynopsis: 'Season 1: Survival in the City.',
    episodeSynopsis: 'Cornered in an underground garage on Parklands Road, Wanjiku must choose between signing away her life or hitting the decrypt broadcast switch.',
    season: 1,
    episode: 4,
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
    views: 180000,
    duration: '2m 15s',
    isPremium: true,
    author: 'TubeTV Originals',
    category: 'Micro Dramas',
    introEndSeconds: 5,
    outroStartSeconds: 125,
    contentRating: 'PG',
    tags: ['Drama', 'Thriller', 'Nairobi']
  },

  // Trending / General
  {
    id: '1',
    title: 'Nairobi Nightlife: Hidden Gems',
    thumbnail: 'https://picsum.photos/800/450?random=1',
    views: 1200000,
    duration: '24m',
    isPremium: true,
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
    isPremium: true,
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
    isPremium: true,
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
    isPremium: true,
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
    isPremium: false, // Selected free educational preview
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
    isPremium: true,
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
    isPremium: true,
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
    isPremium: true,
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
    isPremium: true,
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
    isPremium: true,
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
    isPremium: true,
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
    isPremium: false, // Selected free kids song
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
    isPremium: true,
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
    isPremium: true,
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
    isPremium: true,
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
    isPremium: true,
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
