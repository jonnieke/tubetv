import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Play, Plus, Share2, X, Clock, Film } from 'lucide-react';
import type { Video } from '../types';
import { isFreeVideo, isMicroDrama, seriesKey } from '../lib/series';
import CatalogueArtwork from './CatalogueArtwork';

interface Props {
  movie: Video;
  allVideos: Video[];
  watchLaterIds: string[];
  onToggleWatchLater: (id: string) => void;
  onPlay: (movie: Video) => void;
  onClose: () => void;
  onSelectMovie?: (movie: Video) => void;
}

export default function MovieDetails({
  movie,
  allVideos,
  watchLaterIds,
  onToggleWatchLater,
  onPlay,
  onClose,
  onSelectMovie,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isSaved = watchLaterIds.includes(movie.id);

  // Keyboard accessibility and scroll lock
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close movie details"]')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), select:not(:disabled), [href], [tabindex="0"]'
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

  // Similar Recommended Movies Belt:
  // Match same category, genre, or other standalone movies/films, excluding current title
  const similarMovies = useMemo(() => {
    const others = allVideos.filter(
      (v) => v.id !== movie.id && !isMicroDrama(v) && !seriesKey(v)
    );
    // Prioritize same genre or category
    const related = others.filter(
      (v) => (movie.genre && v.genre === movie.genre) || v.category === movie.category
    );
    const remainder = others.filter((v) => !related.some((r) => r.id === v.id));
    return [...related, ...remainder].slice(0, 10);
  }, [allVideos, movie]);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = encodeURIComponent(
      `Watch "${movie.title}" on TubeTV: ${window.location.origin}/watch/${encodeURIComponent(movie.id)}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
  };

  const synopsis =
    movie.description ||
    movie.seriesSynopsis ||
    movie.episodeSynopsis ||
    'Experience this feature film on TubeTV.';

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
        aria-labelledby="movie-details-title"
      >
        <header className="series-details-bar">
          <span className="cinema-card-kicker flex items-center gap-2">
            <Film size={14} className="text-red-500" />
            <span>
              {movie.category === 'Movies' ? 'FEATURE FILM' : movie.category.toUpperCase()} ·{' '}
              {movie.duration || 'Feature'} · {movie.contentRating || 'UNRATED'}
            </span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close movie details">
            <X size={20} />
          </button>
        </header>

        <div className="series-details-scroll">
          {/* Main Movie Feature Header */}
          <div className="series-details-feature">
            <div className="relative group/art flex-none">
              <CatalogueArtwork src={movie.thumbnail} className="series-details-art shadow-xl" />
              {isFreeVideo(movie) && (
                <div className="absolute top-2 left-2 rounded bg-emerald-600/95 px-2 py-0.5 text-[10px] font-black tracking-wider text-white shadow-md uppercase">
                  FREE
                </div>
              )}
            </div>

            <div className="series-details-feature-copy">
              <h2 id="movie-details-title">{movie.title}</h2>
              <p className="series-details-meta">
                {movie.author}
                {movie.genre ? ` · ${movie.genre}` : ''}
                {movie.productionYear ? ` · ${movie.productionYear}` : ''}
                {movie.views ? ` · ${movie.views.toLocaleString()} views` : ''}
              </p>

              <p className="series-details-label">The story</p>
              <p className="series-details-synopsis">{synopsis}</p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  className="cinema-primary flex items-center gap-2 px-5 py-2.5 shadow-lg"
                  onClick={() => onPlay(movie)}
                >
                  <Play size={16} fill="currentColor" />
                  <span>Play Movie</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleWatchLater(movie.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-bold transition-all ${
                    isSaved
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-white'
                  }`}
                  aria-label={`${isSaved ? 'Remove' : 'Save'} ${movie.title} to watch later`}
                >
                  {isSaved ? <Check size={16} className="text-emerald-400" /> : <Plus size={16} />}
                  <span>{isSaved ? 'In Watch Later' : 'Add to Watch Later'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-xs font-bold transition-all text-zinc-300 hover:text-white"
                  title="Share on WhatsApp"
                  aria-label={`Share ${movie.title} on WhatsApp`}
                >
                  <Share2 size={16} />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Similar Recommended Movies Belt */}
          {similarMovies.length > 0 && (
            <div className="pt-4 pb-6">
              <div className="series-details-episode-heading">
                <div>
                  <p className="series-details-label">MORE LIKE THIS</p>
                  <h3>Recommended Movies</h3>
                </div>
                <span className="text-xs text-zinc-400">
                  {similarMovies.length} titles to explore
                </span>
              </div>

              <ol className="series-details-episodes series-details-episodes-horizontal">
                {similarMovies.map((similar) => {
                  const similarSaved = watchLaterIds.includes(similar.id);
                  return (
                    <li key={similar.id} className="group/item">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectMovie) onSelectMovie(similar);
                          else onPlay(similar);
                        }}
                        className="series-details-episode-play"
                        aria-label={`View movie ${similar.title}`}
                      >
                        <div className="relative w-full">
                          <CatalogueArtwork
                            src={similar.thumbnail}
                            className="series-details-episode-art"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg">
                              <Play size={18} fill="currentColor" className="ml-0.5" />
                            </span>
                          </div>
                          {similar.duration && (
                            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1">
                              <Clock size={10} />
                              {similar.duration}
                            </span>
                          )}
                          {isFreeVideo(similar) && (
                            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white font-black text-[9px] uppercase tracking-wider">
                              FREE
                            </span>
                          )}
                        </div>

                        <span className="series-details-episode-copy">
                          <span className="series-details-episode-kicker">
                            {similar.category.toUpperCase()}
                            {similar.genre ? ` · ${similar.genre}` : ''}
                          </span>
                          <strong>{similar.title}</strong>
                          <span className="text-[11px] text-zinc-400 block mt-0.5">
                            {similar.author}
                          </span>
                          {similar.description && (
                            <span className="series-details-episode-synopsis">
                              {similar.description}
                            </span>
                          )}
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-label={`${similarSaved ? 'Remove' : 'Save'} ${similar.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWatchLater(similar.id);
                        }}
                        className={`series-details-save ${
                          similarSaved
                            ? 'text-emerald-400 border-emerald-500 bg-emerald-950/40'
                            : ''
                        }`}
                        title={similarSaved ? 'Remove from Watch Later' : 'Add to Watch Later'}
                      >
                        {similarSaved ? <Check size={18} /> : <Plus size={18} />}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
