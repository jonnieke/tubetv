import type { Video } from '../types';
import type { WatchProgress } from './viewerState';
import { compareEpisodes, isMicroDrama, nextEpisode, seriesKey } from './series';

interface Recommendations {
  continueWatching: Video[];
  forYou: Video[];
}

/** Small, explainable on-device ranking over the already-public catalogue. */
export function recommendVideos(
  videos: Video[],
  progress: Record<string, WatchProgress>,
  watchLater: string[],
  now = Date.now(),
): Recommendations {
  const byId = new Map(videos.map(video => [video.id, video]));
  const continueWatching: Video[] = [];
  const continuationIds = new Set<string>();
  const progressEntries = Object.entries(progress);

  for (const [id, state] of progressEntries) {
    const video = byId.get(id);
    if (!video || state.positionSeconds <= 0) continue;
    const continuation = state.completed ? nextEpisode(videos, id) : video;
    if (!continuation || progress[continuation.id]?.completed || continuationIds.has(continuation.id)) continue;
    continuationIds.add(continuation.id);
    continueWatching.push(continuation);
  }

  const interests = [...new Set([...watchLater, ...progressEntries.filter(([, state]) => state.positionSeconds > 0).map(([id]) => id)])]
    .map(id => byId.get(id)).filter((video): video is Video => Boolean(video));
  if (!interests.length) return { continueWatching: continueWatching.slice(0, 6), forYou: [] };

  const saved = new Set(watchLater);
  const seenSeries = new Set<string>();
  const firstEpisodeBySeries = new Map<string, string>();
  for (const video of [...videos].sort(compareEpisodes)) {
    const key = seriesKey(video);
    if (key && !firstEpisodeBySeries.has(key)) firstEpisodeBySeries.set(key, video.id);
  }
  const ranked = videos
    .filter(video => !saved.has(video.id) && !progress[video.id]?.positionSeconds && !continuationIds.has(video.id)
      && (!seriesKey(video) || firstEpisodeBySeries.get(seriesKey(video)!) === video.id))
    .map(video => {
      const tags = new Set((video.tags || []).map(tag => tag.toLocaleLowerCase()));
      let score = 0;
      for (const interest of interests) {
        if (video.category === interest.category) score += 3;
        if (video.genre && video.genre.toLocaleLowerCase() === interest.genre?.toLocaleLowerCase()) score += 4;
        if (isMicroDrama(video) && isMicroDrama(interest)) score += 2;
        if (seriesKey(video) && seriesKey(video) === seriesKey(interest)) score += 5;
        score += (interest.tags || []).filter(tag => tags.has(tag.toLocaleLowerCase())).length * 2;
      }
      const ageDays = (now - Date.parse(video.uploadDate || '')) / 86400000;
      if (Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= 90) score += 1;
      return { video, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.video.views - a.video.views || a.video.id.localeCompare(b.video.id));

  const forYou = ranked.filter(({ video }) => {
    const key = seriesKey(video);
    if (key && seenSeries.has(key)) return false;
    if (key) seenSeries.add(key);
    return true;
  }).slice(0, 12).map(({ video }) => video);
  return { continueWatching: continueWatching.slice(0, 6), forYou };
}
