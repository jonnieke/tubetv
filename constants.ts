
import { Video, ShortVideo } from './types';


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
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    author: '@crazy_kennar',
    description: 'When the teacher asks for homework #comedy #kenya',
    likes: 15400,
    comments: 342
  },
  {
    id: 's2',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    author: '@chef_ali',
    description: 'Quick Chapati recipe! #food #kenya',
    likes: 89000,
    comments: 1200
  },
  {
    id: 'ad1',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    author: 'Sponsor: Safaricom',
    description: 'Get the new 5G bundles today! Link in bio.',
    likes: 0,
    comments: 0,
    isAd: true
  },
  {
    id: 's3',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    author: '@travel_kenya',
    description: 'Diani Beach Vibes #tembeakenya',
    likes: 45000,
    comments: 890
  },
  {
    id: 's4',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    author: '@rugby_ke',
    description: 'Shujaa training session #kenya7s',
    likes: 12000,
    comments: 450
  },
  {
    id: 's5',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOverDriver.mp4',
    author: '@flaqo411',
    description: 'Mama Otis returns! #comedy',
    likes: 88000,
    comments: 2100
  },
  {
    id: 's6',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    author: '@tech_today',
    description: 'Unboxing the new phone in Nairobi #tech',
    likes: 34000,
    comments: 900
  }
];
