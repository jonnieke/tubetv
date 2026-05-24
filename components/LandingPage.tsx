import React, { useEffect, useRef, useState } from 'react';
import {
  Play, ChevronRight, ArrowRight,
  CheckCircle2, Flame, Lock, Eye,
} from 'lucide-react';
import { makeThumbErrorHandler, onThumbError } from '../lib/thumbnail';
import { Video } from '../types';

interface LandingPageProps {
  videos: Video[];
  isLoadingVideos: boolean;
  onEnterApp: () => void;
  onSignIn: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatViews = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)}K`
  : String(n);

// ── Sub-components ────────────────────────────────────────────────────────────

/** Real video card using actual Bunny CDN thumbnail */
const VideoPreviewCard: React.FC<{ video: Video; onClick: () => void }> = ({ video, onClick }) => (
  <div
    className="group relative min-w-[200px] w-[200px] md:min-w-[230px] md:w-[230px] flex-shrink-0 cursor-pointer"
    onClick={onClick}
  >
    <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-white/[0.05] shadow-xl">
      <img
        src={video.thumbnail}
        alt={video.title}
        loading="lazy"
        decoding="async"
        onError={makeThumbErrorHandler(video.thumbnailFallback)}
        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
      />
      {/* Category badge */}
      <div className="absolute top-2 left-2">
        <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide bg-black/70 backdrop-blur text-zinc-200 border border-white/10">
          {video.category}
        </span>
      </div>
      {/* Duration */}
      {video.duration && (
        <div className="absolute bottom-2 right-2">
          <span className="text-[9px] bg-black/80 text-zinc-300 px-1.5 py-0.5 rounded font-medium">
            {video.duration}
          </span>
        </div>
      )}
      {/* Hover play overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30 scale-75 group-hover:scale-100 transition-transform duration-200 shadow-xl">
          <Play size={16} className="text-white fill-white ml-0.5" />
        </div>
      </div>
    </div>
    <div className="mt-2.5 space-y-0.5">
      <h3 className="text-white text-sm font-bold line-clamp-1 group-hover:text-red-400 transition-colors">{video.title}</h3>
      <div className="flex items-center gap-2 text-zinc-500 text-[11px]">
        <span className="flex items-center gap-1"><Eye size={9} /> {formatViews(video.views)}</span>
        {video.author && video.author !== 'Tube Creator' && (
          <><span>·</span><span className="truncate max-w-[100px]">{video.author}</span></>
        )}
      </div>
    </div>
  </div>
);

/** Skeleton card shown while videos are loading */
const SkeletonCard: React.FC = () => (
  <div className="min-w-[200px] w-[200px] md:min-w-[230px] md:w-[230px] flex-shrink-0">
    <div className="aspect-video rounded-xl bg-zinc-800 animate-pulse" />
    <div className="mt-2.5 space-y-2">
      <div className="h-3.5 bg-zinc-800 rounded animate-pulse w-4/5" />
      <div className="h-2.5 bg-zinc-800/60 rounded animate-pulse w-2/5" />
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

const LandingPage: React.FC<LandingPageProps> = ({ videos, isLoadingVideos, onEnterApp, onSignIn }) => {
  const [scrollY, setScrollY] = useState(0);
  const trendingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const heroOpacity = Math.max(0, 1 - scrollY / 500);

  const scrollRow = (dir: 'left' | 'right') => {
    if (!trendingRef.current) return;
    const { scrollLeft, clientWidth } = trendingRef.current;
    trendingRef.current.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.7 : scrollLeft + clientWidth * 0.7,
      behavior: 'smooth',
    });
  };

  // Top 12 by views — the real pulse of the library
  const trending = [...videos].sort((a, b) => b.views - a.views).slice(0, 12);
  const videoCount = videos.length;

  return (
    <div className="bg-zinc-950 text-white min-h-screen overflow-x-hidden">

      {/* ── Nav ───────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-3.5 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-black text-sm shadow-lg shadow-red-600/40">T</div>
          <span className="text-xl font-black tracking-tight">Tube<span className="text-red-500">TV</span></span>
        </div>
        <div className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
          <a href="#trending" className="hover:text-white transition-colors">Trending</a>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onSignIn} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden sm:block px-3 py-1.5">
            Sign In
          </button>
          <button
            onClick={onEnterApp}
            className="bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-5 py-2 rounded-full transition-all shadow-lg shadow-red-600/30 flex items-center gap-1.5 active:scale-95"
          >
            Watch Free <ChevronRight size={14} />
          </button>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[88vh] flex flex-col items-center justify-center overflow-hidden pb-16 pt-8">

        {/* Background: blurred mosaic of real thumbnails */}
        {trending.length > 0 && (
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ opacity: heroOpacity * 0.12 }}
          >
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-1 p-2 rotate-[-2deg] scale-110">
              {[...trending, ...trending].slice(0, 12).map((v, i) => (
                <img
                  key={i}
                  src={v.thumbnail}
                  alt=""
                  loading="eager"
                  decoding="async"
                  onError={onThumbError}
                  className="w-full h-full object-cover rounded"
                />
              ))}
            </div>
            {/* Heavy fade so text stays readable */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/60 to-zinc-950/90" />
          </div>
        )}

        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: heroOpacity }}>
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.16) 0%, transparent 70%)' }} />
        </div>

        {/* Hero content */}
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/25 text-red-400 text-[11px] font-bold px-4 py-1.5 rounded-full mb-8 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            Kenya's Streaming Platform
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[82px] font-black leading-[0.92] tracking-tight mb-6">
            <span className="block text-white">Stream Kenya.</span>
            <span className="block mt-2" style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Watch Everything.
            </span>
          </h1>

          <p className="text-zinc-400 text-lg md:text-xl max-w-xl mx-auto leading-relaxed mb-10">
            Drama, education, farming, faith &amp; live events —<br className="hidden md:block" />
            100% made in Kenya. Free on any device.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <button
              onClick={onEnterApp}
              className="group relative flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white font-black text-lg px-10 py-4 rounded-2xl transition-all shadow-2xl shadow-red-600/40 overflow-hidden active:scale-[0.97]"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Play size={20} className="relative fill-white flex-shrink-0" />
              <span className="relative">Start Watching — It's Free</span>
            </button>
            <button
              onClick={onSignIn}
              className="flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-bold text-base px-8 py-4 rounded-2xl transition-all bg-white/5 hover:bg-white/10 active:scale-[0.97]"
            >
              Sign In <ArrowRight size={16} />
            </button>
          </div>

          {/* Real stats */}
          <div className="inline-flex flex-wrap items-center justify-center gap-x-8 gap-y-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-8 py-5 backdrop-blur">
            {[
              { value: videoCount > 0 ? `${videoCount}+` : '…', label: 'Videos' },
              { value: '100%', label: 'Kenyan Content' },
              { value: 'Free', label: 'No subscription' },
              { value: '2G–4G', label: 'Any network' },
            ].map((s, i, arr) => (
              <React.Fragment key={s.label}>
                {i > 0 && <div className="hidden sm:block w-px h-7 bg-zinc-800" />}
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-black text-white">{s.value}</p>
                  <p className="text-zinc-500 text-[11px] uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-zinc-700 animate-bounce">
          <span className="uppercase tracking-widest text-[9px]">Scroll</span>
          <div className="w-px h-6 bg-gradient-to-b from-zinc-600 to-transparent" />
        </div>
      </section>

      {/* ── Trending Now — real library content ───────────────────────────────── */}
      <section id="trending" className="py-14 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
            <div>
              <div className="flex items-center gap-2">
                <Flame size={15} className="text-orange-500" />
                <h2 className="text-2xl md:text-3xl font-black text-white">Trending in Kenya</h2>
              </div>
              <p className="text-zinc-500 text-xs mt-0.5">
                {isLoadingVideos ? 'Loading content…' : `${trending.length} most-watched videos right now`}
              </p>
            </div>
          </div>
          {!isLoadingVideos && trending.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={() => scrollRow('left')}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center border border-zinc-700 transition-colors">
                <ChevronRight size={16} className="rotate-180" />
              </button>
              <button onClick={() => scrollRow('right')}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center border border-zinc-700 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div ref={trendingRef} className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pl-6 md:pl-12 pr-6 pb-3">
          {isLoadingVideos
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : trending.map(v => <VideoPreviewCard key={v.id} video={v} onClick={onEnterApp} />)
          }
          {/* Browse all card */}
          {!isLoadingVideos && (
            <div
              className="min-w-[200px] w-[200px] md:min-w-[230px] md:w-[230px] flex-shrink-0 cursor-pointer group"
              onClick={onEnterApp}
            >
              <div className="aspect-video rounded-xl border-2 border-dashed border-zinc-700 group-hover:border-red-600/50 flex flex-col items-center justify-center gap-2 transition-colors bg-zinc-900/30 group-hover:bg-red-600/5">
                <Play size={22} className="text-zinc-600 group-hover:text-red-500 transition-colors" />
                <p className="text-zinc-500 group-hover:text-zinc-300 text-xs font-bold transition-colors">Browse All</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 md:px-12 max-w-5xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden text-center py-16 px-8 bg-gradient-to-br from-red-950/40 via-zinc-900 to-zinc-950 border border-red-900/20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-32 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.18) 0%, transparent 70%)' }} />
          <div className="relative z-10">
            <h3 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
              Start watching today.
              <span className="block text-red-500">It's completely free.</span>
            </h3>
            <p className="text-zinc-400 text-base max-w-sm mx-auto mb-8 leading-relaxed">
              No subscription required. Sign up with your phone number in under a minute.
            </p>

            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-400 mb-8">
              {[
                'No credit card',
                'Works on 2G',
                'Swahili & English',
                'Install as app',
              ].map(pt => (
                <li key={pt} className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-red-500 flex-shrink-0" />
                  {pt}
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onEnterApp}
                className="group relative flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white font-black text-base px-9 py-4 rounded-2xl transition-all shadow-2xl shadow-red-600/40 overflow-hidden active:scale-[0.97]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Play size={18} className="relative fill-white flex-shrink-0" />
                <span className="relative">Watch Free Now</span>
              </button>
              <button
                onClick={onSignIn}
                className="flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-bold px-7 py-4 rounded-2xl transition-all hover:bg-white/5 active:scale-[0.97]"
              >
                Create Account <ArrowRight size={15} />
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-zinc-600 text-xs mt-6">
              <Lock size={10} />
              <span>Secure · Kenyan-built · No hidden charges</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900 py-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-red-600 rounded-md flex items-center justify-center font-black text-xs shadow-md shadow-red-600/30">T</div>
            <span className="text-base font-black tracking-tight">Tube<span className="text-red-500">TV</span></span>
            <span className="text-zinc-700 text-sm ml-1">· Kenya's Streaming Platform</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-600">
            <button onClick={onEnterApp} className="hover:text-zinc-300 transition-colors">Browse</button>
            <button onClick={onSignIn}   className="hover:text-zinc-300 transition-colors">Sign In</button>
            <a href="#trending"          className="hover:text-zinc-300 transition-colors">Trending</a>
            <a href="mailto:hello@tubekenya.co.ke" className="hover:text-zinc-300 transition-colors">Contact</a>
          </div>
          <p className="text-zinc-700 text-xs">© {new Date().getFullYear()} Tube TV · Made in Kenya</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
