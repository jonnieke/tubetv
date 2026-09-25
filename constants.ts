
import { Video, ShortVideo, DailyStat } from './types';

// ─── Feature Flags ────────────────────────────────────────────────────────────

// Test phase: unrated titles remain visible until TubeTV completes KFCB onboarding.
// Set to true before public market launch to hide UNRATED content.
export const CONTENT_RATING_ENFORCED = import.meta.env.VITE_CONTENT_RATING_ENFORCED === 'true';

export const MOCK_VIDEOS: Video[] = [
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
