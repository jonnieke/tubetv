// Local-only verification fixture. Vite's production entry does not import this.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import SeriesCarousel from '../components/SeriesCarousel';
import VideoCard from '../components/VideoCard';
import { nextEpisode } from '../lib/series';
import type { Video } from '../types';
import '../index.css';

const episodes: Video[] = [2, 1, 3].map(number => ({
  id: `fixture-${number}`, title: `Chapter ${number}`, category: 'Micro Dramas',
  seriesId: 'fixture-series', seriesTitle: 'Verification story', seriesFormat: 'micro-drama',
  seriesSynopsis: 'MAIN SYNOPSIS: A family reunites after an unexpected letter.',
  episodeSynopsis: `EPISODE ${number} SYNOPSIS: The letter reveals a new clue.`,
  season: 1, episode: number, contentRating: 'GE', author: 'QA fixture',
  thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="270" height="480"%3E%3Crect width="270" height="480" fill="%2318181b"/%3E%3C/svg%3E', views: 0, duration: '0:05', isPremium: false,
  url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
}));
const Preview: React.FC = () => {
  const [playing, setPlaying] = useState<Video | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  return <main className="min-h-screen bg-zinc-950 p-5 text-white">
    <h1 className="mb-5 text-xl">Local series verification · fixture content</h1>
    <SeriesCarousel title="Micro Dramas" videos={episodes} onPlay={setPlaying} watchLaterIds={saved} onToggleWatchLater={id => setSaved(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id])} />
    {playing && <section aria-label="Episode player" className="max-w-sm">
      <VideoCard key={playing.id} video={playing} autoPlay />
      <p>{playing.episodeSynopsis}</p>
      {nextEpisode(episodes, playing.id) && <button onClick={() => setPlaying(nextEpisode(episodes, playing.id)!)}>Next episode</button>}
    </section>}
  </main>;
};
createRoot(document.getElementById('root')!).render(<Preview />);
