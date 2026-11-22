import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Lock, Play, Plus, Share2, X } from 'lucide-react';
import type { Video } from '../types';
import { buildComingSoonSchedule, getSeriesEntryEpisode, isMicroDrama, isNewEpisode, seriesSlug } from '../lib/series';
import { isVideoLocked } from '../lib/monetization';
import { publicMediaUrl } from '../lib/mediaUrl';
import { usePlayback } from '../contexts/PlaybackContext';
import { useLanguage } from '../contexts/LanguageContext';
import CatalogueArtwork from './CatalogueArtwork';
import SponsorBanner from './SponsorBanner';
import { TrailerModal } from './TrailerModal';

interface Props {
  episodes: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onPlay: (video: Video) => void;
  onClose: () => void;
}

export default function SeriesDetails({ episodes, watchLaterIds, onToggleWatchLater, onPlay, onClose }: Props) {
  const { isLocked } = usePlayback();
  const { language, t } = useLanguage();
  const first = episodes[0];
  const portrait = isMicroDrama(first);
  const poster = episodes.map((episode) => publicMediaUrl(episode.seriesPosterUrl)).find(Boolean);
  const trailer = episodes.map((episode) => publicMediaUrl(episode.seriesTrailerUrl)).find(Boolean);
  const synopsis = episodes.find((episode) => episode.seriesSynopsis)?.seriesSynopsis;
  const seasons = [...new Set(episodes.map((episode) => episode.season || 1))].sort((a, b) => a - b);
  const [season, setSeason] = useState(first.season || 1);
  const [seriesCopied, setSeriesCopied] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [episodeRangeStart, setEpisodeRangeStart] = useState(0);
  const { entryEpisode, newEpisodes, hasNewBatch } = getSeriesEntryEpisode(episodes);
  const hasSeparateNewBatch = hasNewBatch && entryEpisode.id !== first.id;
  const upcomingSlots = buildComingSoonSchedule(episodes, 60);

  const handleShareSeries = async () => {
    const slug = seriesSlug(first);
    const shareUrl = `${window.location.origin}/series/${encodeURIComponent(slug)}`;
    const showName = first.seriesTitle || first.title;
    const shareText = `Watch "${showName}" on TubeTV (Ep 1 & 2 free): ${shareUrl}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `${showName} | TubeTV`, text: shareText, url: shareUrl });
        return;
      } catch {
        // Fallback to clipboard / WhatsApp
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setSeriesCopied(true);
        setTimeout(() => setSeriesCopied(false), 2500);
        return;
      } catch {
        // Fallback to WhatsApp
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener');
  };
  const seasonEpisodes = episodes.filter((episode) => (episode.season || 1) === season);
  const seasonSynopsis = seasonEpisodes.find((episode) => episode.seasonSynopsis)?.seasonSynopsis;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close series details"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), select:not(:disabled), [href], [tabindex="0"]',
      );
      if (!controls?.length) return;
      const firstControl = controls[0];
      const lastControl = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);

  const content = (
    <div
      className="series-details-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="series-details-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="series-details-title"
      >
        <header className="series-details-bar">
          <span className="cinema-card-kicker">
            {portrait ? 'MICRO DRAMA' : 'SERIES'} · {episodes.length} {episodes.length === 1 ? 'EPISODE' : 'EPISODES'}
          </span>
          <button type="button" onClick={onClose} aria-label="Close series details">
            <X size={20} />
          </button>
        </header>
        <div className="series-details-scroll">
          <div className={`series-details-feature ${portrait || poster ? 'series-details-feature-portrait' : ''}`}>
            <CatalogueArtwork src={poster || first.thumbnail} className="series-details-art" />
            <div className="series-details-feature-copy">
              <h2 id="series-details-title">{first.seriesTitle || first.title}</h2>
              <p className="series-details-meta">
                {first.author}
                {first.genre ? ` · ${first.genre}` : ''}
                {portrait ? (language === 'sw' ? ' · Vipindi vya wima' : ' · Vertical episodes') : ''}
              </p>
              {synopsis && (
                <>
                  <p className="series-details-label">{language === 'sw' ? 'Hadithi' : 'The story'}</p>
                  <p className="series-details-synopsis">{synopsis}</p>
                </>
              )}
              <div className="series-details-actions">
                {hasSeparateNewBatch && (
                  <button type="button" className="cinema-primary" onClick={() => onPlay(entryEpisode)}>
                    <Play size={15} fill="currentColor" />{' '}
                    {language === 'sw'
                      ? `Tazama Mpya (Ep ${entryEpisode.episode || 1})`
                      : `Watch New (Ep ${entryEpisode.episode || 1})`}
                  </button>
                )}
                <button
                  type="button"
                  className={hasSeparateNewBatch ? 'cinema-secondary' : 'cinema-primary'}
                  onClick={() => onPlay(seasonEpisodes[0])}
                >
                  <Play size={15} fill="currentColor" />{' '}
                  {language === 'sw' ? `Anza msimu wa ${season}` : `Start season ${season} (Ep 1)`}
                </button>
                {trailer && (
                  <a
                    className="cinema-secondary"
                    href={trailer}
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTrailer(true);
                    }}
                    aria-label={`Watch trailer for ${first.seriesTitle || first.title}`}
                  >
                    <Play size={15} /> Watch trailer
                  </a>
                )}
                <button
                  type="button"
                  className="cinema-secondary"
                  onClick={handleShareSeries}
                >
                  {seriesCopied ? <Check size={15} /> : <Share2 size={15} />}
                  <span>{seriesCopied ? (language === 'sw' ? 'Imenakiliwa' : 'Link copied') : (language === 'sw' ? 'Shiriki' : 'Share series')}</span>
                </button>
              </div>
            </div>
          </div>
          <SponsorBanner
            hasActivePass={false}
            seriesKeys={[first.seriesId || '', seriesSlug(first), first.seriesTitle || ''].filter(Boolean)}
            className="my-3 rounded-xl border border-amber-500/25 bg-gradient-to-r from-zinc-900/90 via-zinc-900/80 to-amber-950/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
          />
          <div className="series-details-episode-heading">
            <div>
              <p className="series-details-label">{language === 'sw' ? 'CHAGUA MSIMU' : 'CHOOSE A SEASON'}</p>
              <h3>{language === 'sw' ? `Msimu wa ${season}` : `Season ${season}`}</h3>
            </div>
            {seasons.length > 1 ? (
              <label>
                {language === 'sw' ? 'Msimu' : 'Season'}{' '}
                <select value={season} onChange={(event) => setSeason(Number(event.target.value))}>
                  {seasons.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span>{language === 'sw' ? `Msimu wa ${season}` : `Season ${season}`}</span>
            )}
          </div>
          <div className="series-details-season-intro">
            <p className="series-details-label">
              {language === 'sw' ? 'MSIMU HUU' : 'THIS SEASON'} · {seasonEpisodes.length}{' '}
              {seasonEpisodes.length === 1 ? 'EPISODE' : 'EPISODES'}
            </p>
            <p>
              {seasonSynopsis ||
                (portrait
                  ? language === 'sw'
                    ? 'Chagua kipindi kuanza tamthilia hii fupi.'
                    : 'Choose an episode to start this micro drama.'
                  : language === 'sw'
                    ? 'Chagua kipindi kuanza msimu huu.'
                    : 'Choose an episode to start this season.')}
            </p>
          </div>
          {seasonEpisodes.length > 20 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {Array.from({ length: Math.ceil(seasonEpisodes.length / 20) }).map((_, idx) => {
                const start = idx * 20;
                const end = Math.min(start + 20, seasonEpisodes.length);
                return (
                  <button
                    key={start}
                    type="button"
                    onClick={() => setEpisodeRangeStart(start)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      episodeRangeStart === start
                        ? 'bg-red-600 text-white border-red-500'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    Ep {start + 1}–{end}
                  </button>
                );
              })}
            </div>
          )}
          <ol className={`series-details-episodes ${portrait ? '' : 'series-details-episodes-horizontal'}`}>
            {(seasonEpisodes.length > 20
              ? seasonEpisodes.slice(episodeRangeStart, episodeRangeStart + 20)
              : seasonEpisodes
            ).map((episode) => {
              const epLocked = isLocked ? isLocked(episode) : isVideoLocked(episode, false);
              const epNew = isNewEpisode(episode);
              return (
                <li key={episode.id}>
                  <button
                    type="button"
                    onClick={() => onPlay(episode)}
                    className="series-details-episode-play"
                    aria-label={`Watch episode ${episode.episode || 1}: ${episode.title}`}
                  >
                    <CatalogueArtwork
                      src={episode.thumbnail}
                      className={`series-details-episode-art ${portrait ? 'series-details-episode-art-portrait' : ''}`}
                    />
                    <span className="series-details-episode-copy">
                      <span className="series-details-episode-kicker inline-flex items-center gap-2 flex-wrap">
                        <span>
                          EPISODE {episode.episode || 1}
                          {episode.duration ? ` · ${episode.duration}` : ''}
                        </span>
                        {epNew && (
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            NEW
                          </span>
                        )}
                        {epLocked && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Lock size={10} />
                            {t('player.locked')}
                          </span>
                        )}
                      </span>
                      <strong>{episode.title}</strong>
                      {(episode.episodeSynopsis || episode.description) && (
                        <span className="series-details-episode-synopsis">
                          {episode.episodeSynopsis || episode.description}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${watchLaterIds.includes(episode.id) ? 'Remove' : 'Save'} ${episode.title}`}
                    onClick={() => onToggleWatchLater(episode.id)}
                    className="series-details-save"
                  >
                    {watchLaterIds.includes(episode.id) ? <Check size={18} /> : <Plus size={18} />}
                  </button>
                </li>
              );
            })}
          </ol>
          {upcomingSlots.length > 0 && (
            <details className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
                <span>Coming Soon · Next {upcomingSlots.length} Episodes Schedule</span>
                <span className="text-[11px] text-amber-300">Release Dates</span>
              </summary>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
                {upcomingSlots.map((slot) => (
                  <div
                    key={`${slot.season}-${slot.episode}`}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-2 text-left"
                  >
                    <div className="text-xs font-bold text-white">Episode {slot.episode}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{slot.releaseDate}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
      {showTrailer && trailer && (
        <TrailerModal
          url={trailer}
          title={first.seriesTitle || first.title}
          onClose={() => setShowTrailer(false)}
          onWatchFull={() => onPlay(entryEpisode)}
          watchLabel={`Watch Ep ${entryEpisode.episode || 1}`}
        />
      )}
    </div>
  );
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
