import React, { useEffect, useRef, useState } from 'react';
import { Check, Info, Play, Plus, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type Hls from 'hls.js';
import { Video } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { loadHls } from '../lib/hlsLoader';
import { buildHlsConfig } from '../lib/hlsConfig';
import { getFreeEpisodeCount, LONG_FORMAT_PREVIEW_SECONDS } from '../lib/monetization';
import {
  detectDefaultRegion,
  getRegionalPassCopy,
  resolveAuthorizedPlaybackUrl,
  type RegionCode,
} from '../lib/subscriptions';
import { isMicroDrama } from '../lib/series';
import { publicMediaUrl } from '../lib/mediaUrl';
import CatalogueArtwork from './CatalogueArtwork';

/** Skip the first 60 seconds (1 minute) of hero movies/episodes to avoid opening studio logos and credits. */
const HERO_START_OFFSET_SECONDS = 60;

interface Props {
  video: Video;
  featuredVideos?: Video[];
  seriesEpisodeCount?: number;
  real: boolean;
  saved: boolean;
  hasActivePass?: boolean;
  regionCode?: RegionCode;
  dataSaver?: boolean;
  onPlay: () => void;
  onMoreInfo?: () => void;
  onWatchTrailer?: (url: string, video: Video) => void;
  onSave: () => void;
  onRequireUnlock?: (video: Video) => void;
  count: number;
  index: number;
  onSelect: (index: number) => void;
}

export default function LandingHero({
  video,
  featuredVideos = [],
  seriesEpisodeCount,
  real,
  saved,
  hasActivePass = false,
  regionCode,
  dataSaver = false,
  onPlay,
  onMoreInfo,
  onWatchTrailer,
  onSave,
  count,
  index,
  onSelect,
}: Props) {
  const { language, t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const startOffsetRef = useRef<number>(0);
  const hasAdvancedRef = useRef<boolean>(false);

  const [trailerReady, setTrailerReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [previewRemaining, setPreviewRemaining] = useState<number | null>(null);
  const [slideProgress, setSlideProgress] = useState<number>(0);
  const [detectedRegion, setDetectedRegion] = useState<RegionCode>(() => regionCode || detectDefaultRegion());

  useEffect(() => {
    if (regionCode) {
      setDetectedRegion(regionCode);
      return;
    }
    const onRegionUpdate = () => setDetectedRegion(detectDefaultRegion());
    window.addEventListener('tubetv:region-updated', onRegionUpdate);
    return () => window.removeEventListener('tubetv:region-updated', onRegionUpdate);
  }, [regionCode]);

  const passCopy = getRegionalPassCopy(regionCode || detectedRegion, language);

  // Preload the next hero slide artwork so carousel transitions happen without a flash.
  useEffect(() => {
    if (dataSaver || count <= 1 || featuredVideos.length <= 1) return;
    const nextVideo = featuredVideos[(index + 1) % featuredVideos.length];
    const nextSrc = nextVideo?.seriesPosterUrl || nextVideo?.thumbnail;
    if (!nextSrc || typeof Image === 'undefined') return;
    const img = new Image();
    img.decoding = 'async';
    img.src = nextSrc;
  }, [dataSaver, count, featuredVideos, index]);

  const advanceToNextSlide = () => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    if (count > 1) {
      onSelect((index + 1) % count);
    } else if (videoRef.current) {
      // Single hero item: loop back to the 1-minute mark
      hasAdvancedRef.current = false;
      videoRef.current.currentTime = startOffsetRef.current;
      videoRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    setTrailerReady(false);
    setPreviewRemaining(null);
    setSlideProgress(0);
    startOffsetRef.current = 0;
    hasAdvancedRef.current = false;

    // Fallback slide timer (e.g. if Data Saver is active or stream doesn't autoplay)
    const fallbackSlideTimer =
      count > 1
        ? window.setTimeout(() => {
            if (!videoRef.current || videoRef.current.paused) {
              advanceToNextSlide();
            }
          }, (LONG_FORMAT_PREVIEW_SECONDS + 2) * 1000)
        : undefined;

    if (dataSaver || (!video.url && !video.id)) {
      return () => {
        if (fallbackSlideTimer) window.clearTimeout(fallbackSlideTimer);
      };
    }

    let cancelled = false;

    const isMicro = isMicroDrama(video);
    const applyOneMinuteStartOffset = (el: HTMLVideoElement) => {
      if (isMicro) {
        startOffsetRef.current = 0;
        try {
          el.currentTime = 0;
        } catch {
          // Ignore seek errors before buffer is ready
        }
        return;
      }
      const dur = el.duration;
      // Start at 60s (1 minute) to skip opening credits if the video is long enough; otherwise 20% in
      const offset =
        Number.isFinite(dur) && dur > HERO_START_OFFSET_SECONDS + LONG_FORMAT_PREVIEW_SECONDS + 5
          ? HERO_START_OFFSET_SECONDS
          : Number.isFinite(dur) && dur > 20
            ? Math.floor(dur * 0.2)
            : 0;
      startOffsetRef.current = offset;
      if (offset > 0) {
        try {
          el.currentTime = offset;
        } catch {
          // Ignore seek errors before buffer is ready
        }
      }
    };

    const startTimer = window.setTimeout(async () => {
      if (cancelled) return;
      const publicTrailer = publicMediaUrl(video.seriesTrailerUrl || video.trailerUrl);
      const resolved = await resolveAuthorizedPlaybackUrl(video.id, video.url, false);
      if (cancelled) return;
      // Only fall back to public trailer when playback-access reports the title is locked,
      // avoiding failed 403 fetches against token-protected Bunny streams.
      const streamUrl = resolved.url || (resolved.locked ? publicTrailer : video.url) || '';
      const el = videoRef.current;
      if (!el || !streamUrl) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      el.muted = true;
      setIsMuted(true);

      const onLoadedMetadata = () => {
        if (cancelled) return;
        applyOneMinuteStartOffset(el);
        el.play().catch(() => {});
      };

      el.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });

      if (streamUrl.includes('.m3u8')) {
        if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = streamUrl;
        } else {
          const HlsClass = await loadHls();
          if (cancelled || !videoRef.current) return;
          if (HlsClass && HlsClass.isSupported()) {
            const hls = new HlsClass({
              ...buildHlsConfig({ profile: 'preview' }),
              startPosition: isMicro ? 0 : HERO_START_OFFSET_SECONDS,
            });
            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(el);
            hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
              if (!cancelled) {
                el.play().catch(() => {});
              }
            });
          }
        }
      } else {
        el.src = streamUrl;
      }
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      if (fallbackSlideTimer) window.clearTimeout(fallbackSlideTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
      }
    };
  }, [video.id, video.url, dataSaver, index, count]);

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    const elapsed = Math.max(0, el.currentTime - startOffsetRef.current);
    const rem = Math.max(0, Math.ceil(LONG_FORMAT_PREVIEW_SECONDS - elapsed));
    setPreviewRemaining(rem);
    setSlideProgress(Math.min(100, (elapsed / LONG_FORMAT_PREVIEW_SECONDS) * 100));

    if (elapsed >= LONG_FORMAT_PREVIEW_SECONDS) {
      el.pause();
      setTrailerReady(false);
      setPreviewRemaining(null);
      advanceToNextSlide();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    const nextMuted = !isMuted;
    el.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const isMicro = isMicroDrama(video);
  const heroArtSrc = video.seriesPosterUrl || video.thumbnail;
  const isStandaloneMovie = !isMicro && !video.episode && !video.seriesTitle;

  return (
    <section
      className="landing-hero group"
      aria-label="Featured content"
      onDoubleClick={onPlay}
    >
      {/* Ambient blurred widescreen backdrop on desktop when showcasing vertical 9:16 Micro Dramas */}
      {isMicro && heroArtSrc && (
        <img
          src={heroArtSrc}
          alt=""
          aria-hidden="true"
          className="hidden md:block absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-45 pointer-events-none"
        />
      )}

      {/* Stage container: full-bleed widescreen for Movies/Series & mobile, crisp uncropped 9:16 frame on desktop for Micro Dramas */}
      <div
        className={
          isMicro
            ? 'absolute inset-0 md:inset-auto md:right-[clamp(32px,7vw,120px)] md:top-5 md:bottom-20 md:aspect-[9/16] md:rounded-2xl md:overflow-hidden md:border md:border-white/15 md:shadow-2xl md:shadow-black/80 md:bg-zinc-950 md:z-10'
            : 'absolute inset-0'
        }
      >
        <CatalogueArtwork
          src={heroArtSrc}
          priority
          className={`landing-hero-art ${isMicro ? '!object-[50%_20%] md:!object-center' : ''} transition-opacity duration-700 ${
            trailerReady ? 'opacity-25 scale-105' : 'opacity-100'
          }`}
        />
        {!dataSaver && (video.url || video.id) && (
          <video
            ref={videoRef}
            muted={isMuted}
            playsInline
            preload="metadata"
            onPlaying={() => setTrailerReady(true)}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => {
              setTrailerReady(false);
              advanceToNextSlide();
            }}
            className={`absolute inset-0 w-full h-full object-cover ${isMicro ? 'object-[50%_20%] md:object-center' : ''} pointer-events-none transition-opacity duration-700 ${
              trailerReady ? 'opacity-90' : 'opacity-0'
            }`}
          />
        )}
      </div>
      <div className="landing-hero-shade" />

      {/* Top-Right Live Motion Controls & 30s Slide Countdown */}
      <div className="absolute top-5 right-5 z-20 flex items-center gap-2.5">
        {trailerReady && previewRemaining !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/75 border border-amber-500/40 px-3 py-1 text-[11px] font-bold text-amber-300 backdrop-blur-md">
            <Sparkles size={12} className="text-amber-400" />
            {language === 'sw'
              ? `Onyesho · sek ${previewRemaining}`
              : `${hasActivePass ? 'Next slide' : 'Free Preview'} · ${previewRemaining}s`}
          </span>
        )}
        {trailerReady && (
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute trailer' : 'Mute trailer'}
            className="inline-flex items-center gap-1.5 rounded-full bg-black/70 hover:bg-black/90 border border-white/25 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition"
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} className="text-red-400" />}
            <span className="hidden sm:inline">
              {isMuted
                ? language === 'sw'
                  ? 'Washa Sauti'
                  : 'Unmute Trailer'
                : language === 'sw'
                  ? 'Zima Sauti'
                  : 'Mute'}
            </span>
          </button>
        )}
      </div>

      <div className="landing-hero-copy z-10">
        {/* Rich Cinema Metadata Strip */}
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <span className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow">
            {isMicro ? 'MICRO DRAMA' : (real ? 'TUBETV ORIGINAL' : 'DEMO PREMIERE')}
          </span>
          {(isMicro || video.episode) && !hasActivePass && (() => {
            const freeCount = getFreeEpisodeCount(video, seriesEpisodeCount);
            if (freeCount <= 0) return null;
            return (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                {language === 'sw'
                  ? freeCount === 2
                    ? 'VIPINDI 1 & 2 BURE'
                    : `VIPINDI 1–${freeCount} BURE`
                  : freeCount === 2
                    ? 'EP 1 & 2 FREE'
                    : `EP 1–${freeCount} FREE`}
              </span>
            );
          })()}
          {video.episode && (
            <span className="rounded border border-white/20 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-zinc-200">
              {language === 'sw' ? `Kipindi cha ${video.episode}` : `Ep ${video.episode}`}
            </span>
          )}
          <span className="text-[11px] font-semibold text-zinc-300">
            {video.contentRating || 'PG'} · {video.genre || video.category}
            {video.duration ? ` · ${video.duration}` : ''} · EN · SW
          </span>
        </div>

        <p className="cinema-eyebrow">
          {isMicro
            ? language === 'sw'
              ? 'Mfululizo Asili wa Kenya · Drama Fupi'
              : 'Kenyan Original · Micro Drama Series'
            : (real ? 'TubeTV Originals' : language === 'sw' ? 'Orodha ya majaribio' : 'Demo catalogue') +
              ` · ${video.genre || video.category}`}
        </p>
        <h1>{video.seriesTitle || video.title}</h1>
        <p className="landing-hero-synopsis">
          {video.seriesSynopsis ||
            video.episodeSynopsis ||
            video.description ||
            (language === 'sw'
              ? 'Hadithi za kusisimua za Kenya. Tazama sekunde 30 bure au fungua mfululizo kamili kwa pasi ya TubeTV.'
              : 'Fast-paced Kenyan micro-dramas. Stream free previews or unlock the entire story with a TubeTV Pass.')}
        </p>

        {/* 3-Action Conversion Bar */}
        <div className="cinema-actions flex flex-wrap items-center gap-3">
          <button type="button" className="cinema-primary shadow-lg shadow-red-950/50" onClick={onPlay}>
            <Play size={16} fill="currentColor" />
            {video.episode
              ? language === 'sw'
                ? `Tazama Kipindi cha ${video.episode}`
                : `Watch Episode ${video.episode}`
              : isMicro
                ? (language === 'sw' ? 'Tazama Kipindi cha 1' : 'Watch Episode 1')
                : t('hero.watchNow')}
          </button>
          <button
            type="button"
            className="cinema-secondary"
            onClick={onMoreInfo || onPlay}
          >
            <Info size={16} />
            {isStandaloneMovie
              ? language === 'sw'
                ? 'Maelezo ya Filamu'
                : 'Movie Info'
              : language === 'sw'
                ? 'Maelezo & Vipindi'
                : 'Episodes & Info'}
          </button>
          {(() => {
            const trailerLink = publicMediaUrl(video.seriesTrailerUrl || video.trailerUrl);
            if (!trailerLink || !onWatchTrailer) return null;
            return (
              <button
                type="button"
                className="cinema-secondary"
                onClick={() => onWatchTrailer(trailerLink, video)}
              >
                <Play size={16} />
                {language === 'sw' ? 'Tazama Trela' : 'Trailer'}
              </button>
            );
          })()}
          <button type="button" className="cinema-secondary" onClick={onSave}>
            {saved ? <Check size={16} /> : <Plus size={16} />}
            {saved ? (language === 'sw' ? 'Imehifadhiwa' : 'In Watch List') : t('hero.watchLater')}
          </button>
          {!hasActivePass && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-950/60 px-3 py-1.5 text-[11px] font-bold text-emerald-300">
              {passCopy.heroBadge}
            </span>
          )}
        </div>

        {count > 1 && (
          <nav className="landing-hero-dots" aria-label="Featured titles">
            <button
              type="button"
              className="landing-hero-arrow"
              aria-label="Previous featured title"
              onClick={() => onSelect((index - 1 + count) % count)}
            >
              ‹
            </button>
            {Array.from({ length: count }, (_, i) => (
              <button
                type="button"
                key={i}
                aria-label={`Show featured title ${i + 1}`}
                aria-pressed={i === index}
                onClick={() => onSelect(i)}
              />
            ))}
            <button
              type="button"
              className="landing-hero-arrow"
              aria-label="Next featured title"
              onClick={() => onSelect((index + 1) % count)}
            >
              ›
            </button>
            <span className="landing-hero-count">
              {index + 1} / {count}
            </span>
          </nav>
        )}
      </div>

      {/* Interactive Mini-Poster Scrubber Dock on Desktop with 30s Progress Bar */}
      {featuredVideos.length > 1 && (
        <div
          className="hidden lg:flex items-center gap-2.5 absolute right-8 bottom-7 z-20 bg-black/55 backdrop-blur-md p-2 rounded-xl border border-white/10"
          aria-label="Featured lineup"
        >
          {featuredVideos.slice(0, 5).map((item, idx) => {
            const active = idx === index;
            const itemIsMicro = isMicroDrama(item);
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect(idx)}
                onDoubleClick={onPlay}
                className={`group/dock relative ${itemIsMicro ? 'w-14 aspect-[2/3]' : 'w-24 aspect-video'} rounded-lg overflow-hidden border transition-all duration-300 text-left ${
                  active
                    ? 'border-red-500 ring-2 ring-red-500/40 scale-105'
                    : 'border-white/15 opacity-65 hover:opacity-100'
                }`}
                title={item.seriesTitle || item.title}
              >
                <CatalogueArtwork src={item.seriesPosterUrl || item.thumbnail} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                {item.episode && (
                  <span className="absolute top-1 left-1 rounded bg-red-600/90 px-1 py-0.5 text-[8px] font-extrabold uppercase text-white shadow">
                    Ep {item.episode}
                  </span>
                )}
                <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[9px] font-bold text-white truncate">
                  {item.seriesTitle || item.title}
                </span>
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                    <span
                      className="block h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${Math.max(8, slideProgress)}%` }}
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="landing-hero-motto">
        {language === 'sw' ? (
          <>
            Hadithi za kweli.
            <br />
            Kesho iliyo bora.
            <span />
            Hadithi za Kenya.
            <br />
            Afrika yenye mwanga.
          </>
        ) : (
          <>
            Real stories.
            <br />
            Bigger tomorrows.
            <span />
            Kenyan stories.
            <br />
            A brighter Africa.
          </>
        )}
      </p>
    </section>
  );
}
