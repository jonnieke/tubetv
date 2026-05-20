
export interface VideoComment {
  id: string;
  videoId: string;
  author: string;
  text: string;
  createdAt: number;
  likes: number;
  likedBy: string[];
}

const KEY       = 'tube_video_comments';
const DEVICE_KEY = 'tube_device_id';

export const getDeviceId = (): string => {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
};

const load = (): VideoComment[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};
const persist = (c: VideoComment[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(c.slice(0, 500))); } catch {}
};

export const getComments = (videoId: string): VideoComment[] =>
  load()
    .filter(c => c.videoId === videoId)
    .sort((a, b) => b.createdAt - a.createdAt);

export const getCommentCount = (videoId: string): number =>
  load().filter(c => c.videoId === videoId).length;

export const addComment = (
  videoId: string,
  text: string,
  author = 'Guest',
): VideoComment => {
  const comment: VideoComment = {
    id: Math.random().toString(36).slice(2),
    videoId,
    author,
    text: text.trim(),
    createdAt: Date.now(),
    likes: 0,
    likedBy: [],
  };
  persist([comment, ...load()]);
  return comment;
};

export const toggleCommentLike = (commentId: string): number => {
  const deviceId = getDeviceId();
  const all = load();
  const idx = all.findIndex(c => c.id === commentId);
  if (idx === -1) return 0;
  const c = all[idx];
  if (c.likedBy.includes(deviceId)) {
    all[idx] = { ...c, likes: Math.max(0, c.likes - 1), likedBy: c.likedBy.filter(d => d !== deviceId) };
  } else {
    all[idx] = { ...c, likes: c.likes + 1, likedBy: [...c.likedBy, deviceId] };
  }
  persist(all);
  return all[idx].likes;
};

export const commentTimeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
