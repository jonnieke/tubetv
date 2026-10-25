
import { Video, ShortVideo, DailyStat } from './types';

// ─── Feature Flags ────────────────────────────────────────────────────────────

// Test phase: unrated titles remain visible until TubeTV completes KFCB onboarding.
// Set to true before public market launch to hide UNRATED content.
export const CONTENT_RATING_ENFORCED = import.meta.env.VITE_CONTENT_RATING_ENFORCED === 'true';

export const MOCK_VIDEOS: Video[] = [
  // Micro Dramas (Kenyan Vertical Episodic Stories)
  {
    id: 'micro-ns-1',
    featuredInBanner: true,
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
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=75',
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
    featuredInBanner: true,
    title: 'The Landlord: Episode 1',
    thumbnail: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=75',
    views: 450000,
    duration: '30m',
    isPremium: true,
    author: 'Youth TV',
    category: 'Originals',
    tags: ['Drama', 'Youth']
  },

  // School Flix
  {
    id: 'sf1',
    featuredInBanner: true,
    title: 'National Drama Festivals: Echoes of the Mau',
    thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=75',
    views: 185000,
    duration: '38m',
    isPremium: false,
    author: 'Kenya National Drama Festivals',
    category: 'School Flix',
    genre: 'Drama',
    tags: ['High School', 'National Drama', 'Performances']
  },
  {
    id: 'sf2',
    title: 'Kakamega High Choral Verse: Mwamba Imara',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=75',
    views: 142000,
    duration: '15m',
    isPremium: false,
    author: 'Schools Arts Kenya',
    category: 'School Flix',
    genre: 'Music Festival',
    tags: ['Music Festivals', 'Choral', 'High School']
  },

  // Music
  {
    id: 'mus1',
    featuredInBanner: true,
    title: 'Live Session: Nairobi Afro-Soul & Gengetone Beats',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=75',
    views: 320000,
    duration: '45m',
    isPremium: false,
    author: 'TubeTV Music',
    category: 'Music',
    genre: 'Music',
    tags: ['Afrobeats', 'Live Sessions', 'Gengetone']
  },
  {
    id: 'mus2',
    title: 'Benga Legends: Roots of Kenyan Sound',
    thumbnail: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=75',
    views: 198000,
    duration: '52m',
    isPremium: false,
    author: 'Sound of Kenya',
    category: 'Music',
    genre: 'Music',
    tags: ['Benga', 'Afrobeats', 'Live Sessions']
  },

  // Documentary
  {
    id: 'doc1',
    featuredInBanner: true,
    title: 'The Great Rift: Heartbeat of the Savannah',
    thumbnail: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=75',
    views: 260000,
    duration: '58m',
    isPremium: false,
    author: 'Wild Kenya Media',
    category: 'Documentary',
    genre: 'Documentary',
    tags: ['Wildlife', 'Culture', 'History']
  },
  {
    id: 'doc2',
    title: 'Untold History: Freedom Fighters of Mount Kenya',
    thumbnail: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=75',
    views: 310000,
    duration: '1h 12m',
    isPremium: false,
    author: 'Heritage Kenya Films',
    category: 'Documentary',
    genre: 'Documentary',
    tags: ['History', 'Investigative', 'Biographies']
  },

  // Education
  {
    id: 'edu1',
    title: 'Grade 4 CBC Math: Fractions made Easy',
    thumbnail: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=75',
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
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=450&h=800&q=75',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Comedy preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  },
  {
    id: 's2',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=450&h=800&q=75',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Food preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  },
  {
    id: 'ad1',
    thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=450&h=800&q=75',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: 'TubeTV demo sponsor',
    description: 'Example sponsored placement',
    likes: 0,
    comments: 0,
    isAd: true
  },
  {
    id: 's3',
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=450&h=800&q=75',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Travel preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  },
  {
    id: 's4',
    thumbnail: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=450&h=800&q=75',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Sports preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  },
  {
    id: 's5',
    thumbnail: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=450&h=800&q=75',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Series preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  },
  {
    id: 's6',
    thumbnail: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=450&h=800&q=75',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    author: '@tubetv_demo',
    description: 'Technology preview from the TubeTV demo catalogue',
    likes: 0,
    comments: 0
  }
];
