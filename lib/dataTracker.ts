// MB per minute estimates by quality level
const MB_PER_MIN: Record<string, number> = {
  'hd':    18.75,  // 2.5 Mbps — 720p+
  '720p':  18.75,
  '1080p': 37.5,
  '480p':  5.63,   // 750 kbps
  '360p':  2.25,   // 300 kbps
  'Auto':  10,     // conservative average
};

const DATA_KEY   = 'tube_data_usage';
const BUDGET_KEY = 'tube_data_budget_mb';
const OFFLINE_KEY = 'tube_offline_saves';

export interface UsageRecord {
  videoId: string;
  title: string;
  seconds: number;
  quality: string;
  mb: number;
  timestamp: number;
}

export interface DailyUsage {
  date: string;       // YYYY-MM-DD
  totalMb: number;
  records: UsageRecord[];
}

export interface OfflineSave {
  id: string;
  title: string;
  thumbnail: string;
  author: string;
  duration: string;
  category: string;
  savedAt: number;
}

const today = (): string => new Date().toISOString().slice(0, 10);

export function getDailyUsage(): DailyUsage {
  try {
    const stored: DailyUsage = JSON.parse(localStorage.getItem(DATA_KEY) || '{}');
    if (stored.date === today()) return stored;
    return { date: today(), totalMb: 0, records: [] };
  } catch {
    return { date: today(), totalMb: 0, records: [] };
  }
}

export function recordWatchTime(videoId: string, title: string, seconds: number, quality: string): void {
  if (seconds < 3) return;
  const mb = (seconds / 60) * (MB_PER_MIN[quality] ?? MB_PER_MIN['Auto']);
  const usage = getDailyUsage();
  const record: UsageRecord = {
    videoId, title,
    seconds: Math.floor(seconds),
    quality,
    mb: Math.round(mb * 100) / 100,
    timestamp: Date.now(),
  };
  const updated: DailyUsage = {
    date: usage.date,
    totalMb: Math.round((usage.totalMb + mb) * 100) / 100,
    records: [...usage.records, record].slice(-100),
  };
  try { localStorage.setItem(DATA_KEY, JSON.stringify(updated)); } catch {}
}

export function getBudgetMb(): number {
  try { return Number(localStorage.getItem(BUDGET_KEY) || '500'); } catch { return 500; }
}

export function setBudgetMb(mb: number): void {
  try { localStorage.setItem(BUDGET_KEY, String(mb)); } catch {}
}

export function getUsagePercent(): number {
  const budget = getBudgetMb();
  if (budget <= 0) return 0;
  return Math.min(100, (getDailyUsage().totalMb / budget) * 100);
}

// ─── Offline saves ────────────────────────────────────────────────────────────

export function getOfflineSaves(): OfflineSave[] {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); } catch { return []; }
}

export function saveOffline(video: OfflineSave): void {
  const saves = getOfflineSaves().filter(s => s.id !== video.id);
  try { localStorage.setItem(OFFLINE_KEY, JSON.stringify([video, ...saves])); } catch {}
}

export function removeOffline(id: string): void {
  const saves = getOfflineSaves().filter(s => s.id !== id);
  try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(saves)); } catch {}
}

export function isOfflineSaved(id: string): boolean {
  return getOfflineSaves().some(s => s.id === id);
}
