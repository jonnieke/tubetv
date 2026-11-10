import React, { useEffect, useRef, useState } from 'react';
import { Check, Info, Play, Plus, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type Hls from 'hls.js';
import { Video } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { loadHls } from '../lib/hlsLoader';
import { LONG_FORMAT_PREVIEW_SECONDS } from '../lib/monetization';
import { resolveAuthorizedPlaybackUrl } from '../lib/subscriptions';
import CatalogueArtwork from './CatalogueArtwork';

interface Props {
  video: Video;
  featuredVideos?: Video[];
  real: boolean;
  saved: boolean;
  hasActivePass?: boolean;
  dataSaver?: boolean;
  onPlay: () => void;
  onMoreInfo?: () => void;
  onSave: () => void;
  onRequireUnlock?: (video: Video) => void;
  count: number;
  index: number;
  onSelect: (index: number) => void;
}

export default function LandingHero({
  video,
  featuredVideos = [],
  real,
  saved,
  hasActivePass = false,
  dataSaver = false,
  onPlay,
  onMoreInfo,
  onSave,
  onRequireUnlock,
  count,
  index,
  onSelect,
}: Props) {
  const { language, t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [trailerReady, setTrailerReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [previewRemaining, setPreviewRemaining] = useState<number | null>(null);

  useEffect(() => {
    setTrailerReady(false);
    setPreviewRemaining(null);
    if (dataSaver || !video.url) return;

    let cancelled = false;
    const startTimer = window.setTimeout(async () => {
      if (cancelled) return;
      const resolved = await resolveAuthorizedPlaybackUrl(video.id, video.url, false);
      if (cancelled) return;
      const streamUrl = resolved.url || video.url;
      const el = videoRef.current;
      if (!el || !streamUrl) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      el.muted = true;
      setIsMuted(true);

      if (streamUrl.includes('.m3u8')) {
        if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = streamUrl;
          el.play().catch(() => {});
        } else {
          const HlsClass = await loadHls();
          if (cancelled || !videoRef.current) return;
          if (HlsClass && HlsClass.isSupported()) {
            const hls = new HlsClass({
              enableWorker: true,
              maxBufferLength: 15,
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
        el.play().catch(() => {});
      }
    }, 1100);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
      }
    };
  }, [video.id, video.url, dataSaver]);

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    if (!hasActivePass) {
      const rem = Math.max(0, Math.ceil(LONG_FORMAT_PREVIEW_SECONDS - el.currentTime));
      setPreviewRemaining(rem);
      if (el.currentTime >= LONG_FORMAT_PREVIEW_SECONDS) {
        el.pause();
        el.currentTime = 0;
        setTrailerReady(false);
        setPreviewRemaining(null);
        onRequireUnlock?.(video);
      }
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

  return (
    <section
      className="landing-hero group"
      aria-label="Featured content"
      onDoubleClick={onPlay}
    >
      <CatalogueArtwork
        src={video.thumbnail}
        priority
        className={`landing-hero-art transition-opacity duration-700 ${
          trailerReady ? 'opacity-25 scale-105' : 'opacity-100'
        }`}
      />
      {!dataSaver && video.url && (
        <video
          ref={videoRef}
          muted={isMuted}
          playsInline
          preload="metadata"
          onPlaying={() => setTrailerReady(true)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setTrailerReady(false)}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700 ${
            trailerReady ? 'opacity-90' : 'opacity-0'
          }`}
        />
      )}
      <div className="landing-hero-shade" />

      {/* Top-Right Live Motion Controls & Preview Countdown */}
      <div className="absolute top-5 right-5 z-20 flex items-center gap-2.5">
        {trailerReady && !hasActivePass && previewRemaining !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/75 border border-amber-500/40 px-3 py-1 text-[11px] font-bold text-amber-300 backdrop-blur-md">
            <Sparkles size={12} className="text-amber-400" />
            {language === 'sw' ? `Onyesho · sek ${previewRemaining}` : `Free Preview · ${previewRemaining}s`}
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
            {real ? 'TUBE ORIGINAL' : 'DEMO PREMIERE'}
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            #{index + 1} {language === 'sw' ? 'INAYOVUMA LEO' : 'IN KENYA & DIASPORA'}
          </span>
          <span className="rounded border border-white/25 bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200">
            {video.contentRating || 'PG'}
          </span>
          <span className="rounded border border-white/20 bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
            HD
          </span>
          <span className="rounded border border-white/20 bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
            EN · SW
          </span>
          {video.duration && (
            <span className="text-xs font-medium text-zinc-300">· {video.duration}</span>
          )}
        </div>

        <p className="cinema-eyebrow">
          {real ? video.author || 'TubeTV Studios' : language === 'sw' ? 'Orodha ya majaribio' : 'Demo catalogue'} ·{' '}
          {video.genre || video.category}
        </p>
        <h1>{video.seriesTitle || video.title}</h1>
        <p className="landing-hero-synopsis">
          {video.seriesSynopsis ||
            video.description ||
            (language === 'sw'
              ? 'Hadithi za kweli za Kenya. Tazama sekunde 30 bure au fungua filamu kamili kwa pasi ya TubeTV.'
              : 'Real stories. Bigger tomorrows. Stream the first 30 seconds free or unlock unlimited cinema with a TubeTV Pass.')}
        </p>

        {/* 3-Action Conversion Bar */}
        <div className="cinema-actions flex flex-wrap items-center gap-3">
          <button type="button" className="cinema-primary shadow-lg shadow-red-950/50" onClick={onPlay}>
            <Play size={16} fill="currentColor" />
            {video.episode
              ? language === 'sw'
                ? `Tazama Kipindi ${video.episode}`
                : `Stream Episode ${video.episode}`
              : t('hero.watchNow')}
          </button>
          <button
            type="button"
            className="cinema-secondary"
            onClick={onMoreInfo || onPlay}
          >
            <Info size={16} />
            {language === 'sw' ? 'Maelezo & Pendekezo' : 'More Info & Similar'}
          </button>
          <button type="button" className="cinema-secondary" onClick={onSave}>
            {saved ? <Check size={16} /> : <Plus size={16} />}
            {saved ? (language === 'sw' ? 'Imehifadhiwa' : 'In Watch List') : t('hero.watchLater')}
          </button>
        </div>

        {count > 1 && (
          <nav className="landing-hero-dots" aria-label="Featured titles">
            <button
              type="button"
              className="landing-hero-arrow"
              aria-label="Previous featured movie"
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
              aria-label="Next featured movie"
              onClick={() => onSelect((index + 1 + count) % count)}
            >
              ›
            </button>
            <span className="landing-hero-count">
              {index + 1} / {count}
            </span>
          </nav>
        )}
      </div>

      {/* Interactive Mini-Poster Scrubber Dock on Desktop */}
      {featuredVideos.length > 1 && (
        <div
          className="hidden lg:flex items-center gap-2.5 absolute right-8 bottom-7 z-20 bg-black/55 backdrop-blur-md p-2 rounded-xl border border-white/10"
          aria-label="Featured lineup"
        >
          {featuredVideos.slice(0, 5).map((item, idx) => {
            const active = idx === index;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect(idx)}
                onDoubleClick={onPlay}
                className={`group/dock relative w-24 aspect-video rounded-lg overflow-hidden border transition-all duration-300 text-left ${
                  active
                    ? 'border-red-500 ring-2 ring-red-500/40 scale-105'
                    : 'border-white/15 opacity-65 hover:opacity-100'
                }`}
                title={item.seriesTitle || item.title}
              >
                <CatalogueArtwork src={item.thumbnail} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <span className="absolute bottom-1 left-1.5 right-1.5 text-[9px] font-bold text-white truncate">
                  {item.seriesTitle || item.title}
                </span>
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
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
