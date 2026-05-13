import React, { useEffect, useRef, useState } from 'react';
import {
  Play, Tv, GraduationCap, Sprout, Heart, Globe, Radio,
  Smartphone, Clapperboard, ChevronRight, Star, Users,
  Zap, Shield, Wifi, ArrowRight, CheckCircle2, ChevronLeft, Flame,
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
  onSignIn: () => void;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '500K+', label: 'Monthly Viewers' },
  { value: '1,200+', label: 'Videos' },
  { value: '100%', label: 'Kenyan Content' },
  { value: 'Free', label: 'Always' },
];

const TRENDING_SHOWS = [
  { id: 1, title: 'The Landlord', subtitle: 'S3 E1 — New Episode', genre: 'Comedy Series', gradient: 'from-orange-950 via-zinc-900 to-zinc-950', accent: '#f97316', tag: 'TRENDING', eps: 36, rating: 9.1 },
  { id: 2, title: 'Nairobi Chronicles', subtitle: 'Season 1 · 12 Episodes', genre: 'Urban Drama', gradient: 'from-blue-950 via-zinc-900 to-zinc-950', accent: '#3b82f6', tag: 'NEW', eps: 12, rating: 8.7 },
  { id: 3, title: 'Shamba Smart', subtitle: 'S3 · 48 Episodes', genre: 'Farming · Education', gradient: 'from-green-950 via-zinc-900 to-zinc-950', accent: '#22c55e', tag: 'POPULAR', eps: 48, rating: 9.3 },
  { id: 4, title: 'KCSE Champions', subtitle: 'Form 4 · Mathematics', genre: 'Education', gradient: 'from-purple-950 via-zinc-900 to-zinc-950', accent: '#a855f7', tag: 'EXAM PREP', eps: 120, rating: 9.8 },
  { id: 5, title: 'Mombasa Nights', subtitle: 'S2 E3', genre: 'Romance · Drama', gradient: 'from-rose-950 via-zinc-900 to-zinc-950', accent: '#f43f5e', tag: 'HOT', eps: 18, rating: 8.9 },
  { id: 6, title: 'Sunday Service', subtitle: 'Live Every Sunday', genre: 'Faith · Worship', gradient: 'from-amber-950 via-zinc-900 to-zinc-950', accent: '#f59e0b', tag: 'LIVE', eps: 200, rating: 9.5 },
  { id: 7, title: 'Diaspora Diaries', subtitle: 'S1 E4 · Nairobi to London', genre: 'Documentary', gradient: 'from-teal-950 via-zinc-900 to-zinc-950', accent: '#14b8a6', tag: 'NEW', eps: 8, rating: 8.4 },
  { id: 8, title: 'Kiswahili Masters', subtitle: 'All Levels · CBC Aligned', genre: 'Education', gradient: 'from-indigo-950 via-zinc-900 to-zinc-950', accent: '#6366f1', tag: 'POPULAR', eps: 60, rating: 9.0 },
];

const CATEGORIES = [
  { icon: Clapperboard, label: 'Originals',   desc: 'Drama, comedy & series made in Kenya',    gradient: 'from-red-600/20 to-orange-600/5',    border: 'border-red-500/20',    iconColor: 'text-red-400' },
  { icon: GraduationCap, label: 'Education',  desc: 'CBC, KCSE revision & university content', gradient: 'from-blue-600/20 to-cyan-600/5',     border: 'border-blue-500/20',   iconColor: 'text-blue-400' },
  { icon: Sprout,        label: 'Farmers',    desc: 'Modern farming & agribusiness tips',      gradient: 'from-green-600/20 to-emerald-600/5', border: 'border-green-500/20',  iconColor: 'text-green-400' },
  { icon: Radio,         label: 'Live',       desc: 'Sports, news & events streaming live',    gradient: 'from-purple-600/20 to-pink-600/5',   border: 'border-purple-500/20', iconColor: 'text-purple-400' },
  { icon: Heart,         label: 'Faith',      desc: 'Sermons, worship & devotional content',   gradient: 'from-amber-600/20 to-yellow-600/5',  border: 'border-amber-500/20',  iconColor: 'text-amber-400' },
  { icon: Globe,         label: 'Diaspora',   desc: 'Content for Kenyans living abroad',       gradient: 'from-teal-600/20 to-sky-600/5',      border: 'border-teal-500/20',   iconColor: 'text-teal-400' },
  { icon: Smartphone,    label: 'Shorts',     desc: 'Quick clips, comedy & viral moments',     gradient: 'from-rose-600/20 to-pink-600/5',     border: 'border-rose-500/20',   iconColor: 'text-rose-400' },
  { icon: Tv,            label: 'Kids',       desc: 'Safe, fun & educational kids content',    gradient: 'from-indigo-600/20 to-violet-600/5', border: 'border-indigo-500/20', iconColor: 'text-indigo-400' },
];

const FEATURES = [
  { icon: Star,         title: 'Original Kenyan Content',    desc: 'Drama series, comedy and documentaries produced right here in Kenya — stories told by us, for us.',              color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20'  },
  { icon: GraduationCap, title: 'Education for Every Level', desc: 'From Grade 1 CBC to KCSE and beyond — quality content aligned with the Kenyan curriculum.',                     color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20'   },
  { icon: Wifi,         title: 'Works on Any Network',       desc: 'Adaptive streaming adjusts to your connection — 2G, 3G, 4G or Wi-Fi. Watch clearly even on slower data.',        color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  { icon: Shield,       title: 'Safe & Family Friendly',     desc: 'Dedicated Kids section with age-appropriate content. PIN-protected accounts keep your family safe online.',       color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { icon: Zap,          title: 'Live Events & Streams',      desc: 'Catch sports, concerts and breaking news as they happen. Real-time streaming powered by Bunny Stream RTMP.',     color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20'    },
  { icon: Users,        title: 'Built for All Kenyans',      desc: 'Available in English and Swahili. Content spanning every county, culture and community across Kenya.',           color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-500/20'  },
];

const TESTIMONIALS = [
  {
    name: 'Amina K.',
    location: 'Nairobi',
    initials: 'AK',
    colorFrom: 'from-red-500',
    colorTo: 'to-orange-500',
    quote: 'Finally a platform that feels like home. The KCSE content helped my daughter score an A in Mathematics this year!',
    stars: 5,
  },
  {
    name: 'Peter Owino',
    location: 'Kisumu',
    initials: 'PO',
    colorFrom: 'from-green-500',
    colorTo: 'to-teal-500',
    quote: 'The Shamba Smart tutorials changed my farming completely. My maize yields are up 40% this season. Asante sana!',
    stars: 5,
  },
  {
    name: 'Wanjiku M.',
    location: 'London, UK',
    initials: 'WM',
    colorFrom: 'from-blue-500',
    colorTo: 'to-indigo-500',
    quote: 'Being in the diaspora, Tube TV keeps me connected to home. The Kenyan drama series are absolutely fire 🔥',
    stars: 5,
  },
];

const COMING_SOON = [
  { label: 'M-Pesa One-Tap Billing',  sub: 'No card — pay with your airtime' },
  { label: 'Offline Downloads',        sub: 'Save episodes for when you roam' },
  { label: 'Creator Monetisation',     sub: 'Earn from your Kenyan audience' },
  { label: 'Multilingual Captions',    sub: 'Swahili, Kikuyu, Luo & more' },
];

// Tag colours map
const TAG_CLASSES: Record<string, string> = {
  LIVE:       'bg-red-600 text-white',
  NEW:        'bg-emerald-600 text-white',
  TRENDING:   'bg-orange-600 text-white',
  HOT:        'bg-rose-600 text-white',
  POPULAR:    'bg-blue-600 text-white',
  'EXAM PREP':'bg-purple-600 text-white',
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCountUp(target: string, duration = 1800) {
  const [display, setDisplay] = useState('0');
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const numeric = parseFloat(target.replace(/[^0-9.]/g, ''));
    if (isNaN(numeric)) { setDisplay(target); return; }
    const suffix = target.replace(/[0-9.]/g, '');
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(numeric * eased);
      setDisplay(current >= 1000 ? `${(current / 1000).toFixed(0)}K${suffix}` : `${current}${suffix}`);
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(target);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return display;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatItem: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const display = useCountUp(value);
  return (
    <div className="text-center px-2">
      <p className="text-3xl md:text-4xl font-black text-white tabular-nums">{display}</p>
      <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
};

interface TShow { id:number; title:string; subtitle:string; genre:string; gradient:string; accent:string; tag:string; eps:number; rating:number; }

const ShowCard: React.FC<{ show: TShow; onClick: () => void }> = ({ show, onClick }) => {
  const initials = show.title.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const tagClass = TAG_CLASSES[show.tag] ?? 'bg-zinc-700 text-zinc-200';
  return (
    <div className="group relative min-w-[200px] w-[200px] md:min-w-[240px] md:w-[240px] flex-shrink-0 cursor-pointer" onClick={onClick}>
      <div className={`relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br ${show.gradient} border border-white/[0.05] shadow-xl`}>
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 25% 65%, ${show.accent}35 0%, transparent 65%)` }} />
        {/* Giant watermark initials */}
        <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
          <p className="text-white/[0.06] text-[80px] md:text-[96px] font-black leading-none tracking-tighter">{initials}</p>
        </div>
        {/* Bottom gradient + title */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end px-3 pb-2.5">
          <p className="text-white text-xs font-bold leading-tight line-clamp-1">{show.title}</p>
          <p className="text-zinc-400 text-[10px] mt-0.5">{show.subtitle}</p>
        </div>
        {/* Tag */}
        <div className="absolute top-2 left-2">
          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide shadow ${tagClass} ${show.tag === 'LIVE' ? 'animate-pulse' : ''}`}>
            {show.tag === 'LIVE' && '● '}{show.tag}
          </span>
        </div>
        {/* Rating */}
        <div className="absolute top-2 right-2">
          <span className="text-[9px] bg-black/70 backdrop-blur text-amber-400 px-1.5 py-0.5 rounded-md border border-white/10 flex items-center gap-0.5">
            ★ {show.rating}
          </span>
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/30 scale-75 group-hover:scale-100 transition-transform duration-200 shadow-xl">
            <Play size={16} className="text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>
      <div className="mt-2.5 space-y-0.5">
        <h3 className="text-white text-sm font-bold line-clamp-1 group-hover:text-red-400 transition-colors">{show.title}</h3>
        <p className="text-zinc-500 text-[11px]">{show.genre} · {show.eps} Eps</p>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp, onSignIn }) => {
  const [scrollY, setScrollY] = useState(0);
  const trendingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const heroOpacity = Math.max(0, 1 - scrollY / 600);

  const scrollTrending = (dir: 'left' | 'right') => {
    if (!trendingRef.current) return;
    const { scrollLeft, clientWidth } = trendingRef.current;
    trendingRef.current.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.7 : scrollLeft + clientWidth * 0.7,
      behavior: 'smooth',
    });
  };

  return (
    <div className="bg-zinc-950 text-white min-h-screen overflow-x-hidden">

      {/* ── Live Now Ticker ───────────────────────────────────────────────────── */}
      <div className="bg-red-600/95 text-white text-[11px] font-bold py-1.5 px-4 flex items-center gap-3 overflow-hidden relative">
        <span className="flex items-center gap-1.5 flex-shrink-0 bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-widest text-[9px]">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          LIVE NOW
        </span>
        <div className="flex items-center gap-8 animate-[marquee_30s_linear_infinite] whitespace-nowrap">
          {['🎬 The Landlord S3 E1 — Just Dropped', '⚽ Nairobi FC vs AFC Leopards · Kickoff 3pm', '📖 KCSE Maths Paper 2 Revision · Starting Now', '🙏 Sunday Service Live · Overflow Church Nairobi', '🌽 Shamba Smart: Drip Irrigation Masterclass'].map(item => (
            <span key={item} className="mr-8">{item}</span>
          ))}
        </div>
      </div>

      {/* ── Fixed Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-3.5 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-black text-sm shadow-lg shadow-red-600/40">T</div>
          <span className="text-xl font-black tracking-tight">Tube<span className="text-red-500">TV</span></span>
        </div>
        <div className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
          <a href="#trending"   className="hover:text-white transition-colors">Trending</a>
          <a href="#categories" className="hover:text-white transition-colors">Categories</a>
          <a href="#features"   className="hover:text-white transition-colors">Features</a>
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
      <section className="relative min-h-[92vh] flex flex-col items-center justify-center overflow-hidden pt-8 pb-16">

        {/* Background: content grid hint */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: heroOpacity * 0.18 }}>
          <div className="absolute inset-0 grid grid-cols-5 grid-rows-3 gap-2 p-4 rotate-[-3deg] scale-110">
            {TRENDING_SHOWS.concat(TRENDING_SHOWS).slice(0, 15).map((s, i) => (
              <div key={i} className={`rounded-lg bg-gradient-to-br ${s.gradient} border border-white/5 aspect-video`} />
            ))}
          </div>
        </div>

        {/* Radial glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.18) 0%, transparent 70%)', opacity: heroOpacity }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(234,88,12,0.07) 0%, transparent 70%)' }} />
          <div className="absolute top-0 right-0 w-[450px] h-[350px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)' }} />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }} />
        </div>

        {/* Hero content */}
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/25 text-red-400 text-[11px] font-bold px-4 py-1.5 rounded-full mb-8 uppercase tracking-widest shadow-inner">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            Kenya's #1 Streaming Platform
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-[88px] font-black leading-[0.92] tracking-tight mb-7">
            <span className="block text-white">Stream Kenya.</span>
            <span className="block mt-2" style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #f97316 45%, #eab308 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Watch Everything.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
            Drama, comedy, education, farming, faith &amp; live events —<br className="hidden md:block" />
            all 100% made in Kenya. Watch free on any device.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
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

          {/* Stats row */}
          <div className="inline-flex flex-wrap items-center justify-center gap-x-8 gap-y-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-10 py-5 backdrop-blur shadow-inner">
            {STATS.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <div className="hidden sm:block w-px h-8 bg-zinc-800" />}
                <StatItem value={s.value} label={s.label} />
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Floating decorative cards */}
        <div className="absolute left-8 top-1/3 hidden xl:block rotate-[-10deg] opacity-50 pointer-events-none">
          <div className="w-44 h-26 rounded-2xl bg-gradient-to-br from-orange-950 to-zinc-900 border border-white/10 p-3 shadow-2xl overflow-hidden">
            <div className="w-full h-16 rounded-xl bg-gradient-to-br from-orange-900/60 to-zinc-800 mb-2 flex items-center justify-center">
              <span className="text-white/20 text-3xl font-black">TL</span>
            </div>
            <div className="h-2 w-3/4 bg-zinc-700 rounded mb-1" />
            <div className="h-1.5 w-1/2 bg-zinc-800 rounded" />
            <span className="absolute top-2 right-2 text-[8px] bg-orange-600 text-white px-1.5 py-0.5 rounded-full font-bold">TRENDING</span>
          </div>
        </div>
        <div className="absolute right-8 top-[45%] hidden xl:block rotate-[8deg] opacity-40 pointer-events-none">
          <div className="w-44 h-26 rounded-2xl bg-gradient-to-br from-green-950 to-zinc-900 border border-white/10 p-3 shadow-2xl overflow-hidden">
            <div className="w-full h-16 rounded-xl bg-gradient-to-br from-green-900/60 to-zinc-800 mb-2 flex items-center justify-center">
              <span className="text-white/20 text-3xl font-black">SS</span>
            </div>
            <div className="h-2 w-2/3 bg-zinc-700 rounded mb-1" />
            <div className="h-1.5 w-2/5 bg-zinc-800 rounded" />
            <span className="absolute top-2 right-2 text-[8px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold">POPULAR</span>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-zinc-700 text-[11px] animate-bounce">
          <span className="uppercase tracking-widest text-[9px]">Scroll</span>
          <div className="w-px h-7 bg-gradient-to-b from-zinc-600 to-transparent" />
        </div>
      </section>

      {/* ── Trending in Kenya ──────────────────────────────────────────────────── */}
      <section id="trending" className="py-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-7 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
              <div>
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-orange-500" />
                  <h2 className="text-2xl md:text-3xl font-black text-white">Trending in Kenya</h2>
                </div>
                <p className="text-zinc-500 text-xs mt-0.5">What Kenyans are watching right now</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => scrollTrending('left')}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white border border-zinc-700 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => scrollTrending('right')}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white border border-zinc-700 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
        <div ref={trendingRef} className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pl-6 md:pl-12 pr-6 pb-3">
          {TRENDING_SHOWS.map(show => (
            <ShowCard key={show.id} show={show} onClick={onEnterApp} />
          ))}
          {/* "Browse all" card */}
          <div
            className="min-w-[200px] w-[200px] md:min-w-[240px] md:w-[240px] flex-shrink-0 cursor-pointer group"
            onClick={onEnterApp}
          >
            <div className="aspect-video rounded-xl border-2 border-dashed border-zinc-700 group-hover:border-red-600/50 flex flex-col items-center justify-center transition-colors bg-zinc-900/30 group-hover:bg-red-600/5">
              <ChevronRight size={28} className="text-zinc-600 group-hover:text-red-500 transition-colors mb-1" />
              <p className="text-zinc-500 group-hover:text-zinc-300 text-xs font-bold transition-colors">Browse All</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────────────────────────── */}
      <section id="categories" className="py-20 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-red-500 text-xs font-bold uppercase tracking-[0.2em] mb-3">Browse by Category</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Everything Kenyan,<br />
            <span className="text-zinc-500">All In One Place</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat.label}
              onClick={onEnterApp}
              className={`group relative bg-gradient-to-br ${cat.gradient} border ${cat.border} rounded-2xl p-5 md:p-6 text-left hover:scale-[1.04] hover:shadow-2xl transition-all duration-200 overflow-hidden active:scale-[0.98]`}
            >
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.04] transition-colors rounded-2xl" />
              <div className="relative">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-black/20 border border-white/10`}>
                  <cat.icon size={20} className={cat.iconColor} />
                </div>
                <p className="font-black text-white text-base leading-tight mb-1">{cat.label}</p>
                <p className="text-zinc-500 text-xs leading-snug">{cat.desc}</p>
              </div>
              <ArrowRight size={13} className="absolute bottom-4 right-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </section>

      {/* ── Cinematic Quote ─────────────────────────────────────────────────────── */}
      <div className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-950/30 via-zinc-900/80 to-red-950/30" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #ef4444 0, #ef4444 1px, transparent 0, transparent 50%)',
          backgroundSize: '20px 20px',
        }} />
        <div className="relative z-10 text-center px-6">
          <div className="w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <span className="text-red-400 text-xl font-black">"</span>
          </div>
          <p className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight max-w-3xl mx-auto">
            "The stories of Kenya
            <span className="block mt-1" style={{
              background: 'linear-gradient(90deg, #ef4444, #f97316)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              deserve to be seen."
            </span>
          </p>
          <p className="text-zinc-600 mt-6 text-xs uppercase tracking-[0.3em]">— 100% Made in Kenya</p>
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-red-500 text-xs font-bold uppercase tracking-[0.2em] mb-3">Why Tube TV</p>
          <h2 className="text-4xl md:text-5xl font-black text-white">
            Built Different.<br />
            <span className="text-zinc-500">Built for Kenya.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className={`group rounded-2xl border p-6 ${f.bg} hover:scale-[1.02] transition-all duration-200`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.bg}`}>
                <f.icon size={22} className={f.color} />
              </div>
              <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-red-500 text-xs font-bold uppercase tracking-[0.2em] mb-3">What Kenyans Say</p>
          <h2 className="text-4xl md:text-5xl font-black text-white">
            Loved by Millions.<br />
            <span className="text-zinc-500">Trusted by Families.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-6 flex flex-col gap-4 transition-colors hover:bg-zinc-900/80 group">
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} size={13} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              {/* Quote */}
              <p className="text-zinc-300 text-sm leading-relaxed flex-1">"{t.quote}"</p>
              {/* User */}
              <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.colorFrom} ${t.colorTo} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <span className="text-white text-[11px] font-black">{t.initials}</span>
                </div>
                <div>
                  <p className="text-white text-sm font-bold">{t.name}</p>
                  <p className="text-zinc-600 text-[11px]">{t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Watch Anywhere ───────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Text */}
            <div className="p-10 md:p-14 flex flex-col justify-center">
              <p className="text-red-500 text-xs font-bold uppercase tracking-[0.2em] mb-4">Watch Anywhere</p>
              <h2 className="text-4xl font-black text-white mb-4 leading-tight">
                Your screen.<br />Your schedule.
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed mb-8">
                Whether you're on a phone in Mombasa, a laptop in Nairobi, or a TV in London —
                Tube TV follows you everywhere.
              </p>
              <ul className="space-y-3 mb-10">
                {[
                  'Adaptive quality for 2G to 4G networks',
                  'Phone, tablet, laptop & smart TV',
                  'Installable as a PWA — works offline too',
                  'Swahili & English interface',
                ].map(pt => (
                  <li key={pt} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 size={15} className="text-red-500 flex-shrink-0" />
                    {pt}
                  </li>
                ))}
              </ul>
              <button
                onClick={onEnterApp}
                className="self-start flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-red-600/30 active:scale-[0.97]"
              >
                Start Watching <Play size={15} className="fill-white" />
              </button>
            </div>

            {/* Phone mockup */}
            <div className="relative p-8 flex items-center justify-center min-h-[320px] bg-gradient-to-br from-red-950/20 to-zinc-950">
              {/* Phone */}
              <div className="relative w-44 h-[340px] bg-zinc-900 rounded-[2.5rem] border-[5px] border-zinc-700/80 shadow-2xl flex flex-col overflow-hidden z-10">
                {/* Notch */}
                <div className="h-7 bg-zinc-950 flex items-center justify-center flex-shrink-0">
                  <div className="w-20 h-1.5 bg-zinc-800 rounded-full" />
                </div>
                {/* Screen */}
                <div className="flex-1 bg-zinc-950 overflow-hidden flex flex-col">
                  {/* Mini nav */}
                  <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
                    <span className="text-white text-[8px] font-black">Tube<span className="text-red-500">TV</span></span>
                    <div className="w-4 h-4 bg-zinc-800 rounded-full" />
                  </div>
                  {/* Hero thumb */}
                  <div className="mx-2 h-20 bg-gradient-to-br from-orange-900/80 to-zinc-800 rounded-lg mb-2 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                    <span className="text-white/10 text-3xl font-black">TL</span>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
                        <Play size={10} className="fill-white text-white ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute top-1 left-1.5 text-[7px] bg-orange-600 text-white px-1 py-0.5 rounded font-bold">TRENDING</span>
                  </div>
                  {/* Content list */}
                  {[
                    { c: 'from-blue-900/70 to-zinc-800', label: 'NC' },
                    { c: 'from-green-900/70 to-zinc-800', label: 'SS' },
                    { c: 'from-purple-900/70 to-zinc-800', label: 'KC' },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-2 px-2 mb-1.5">
                      <div className={`w-11 h-7 bg-gradient-to-br ${item.c} rounded flex-shrink-0 flex items-center justify-center`}>
                        <span className="text-white/20 text-[9px] font-black">{item.label}</span>
                      </div>
                      <div className="flex-1 flex flex-col justify-center gap-1">
                        <div className="h-1.5 bg-zinc-700 rounded w-4/5" />
                        <div className="h-1 bg-zinc-800 rounded w-2/5" />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Bottom bar */}
                <div className="h-5 bg-zinc-950 flex items-center justify-center flex-shrink-0">
                  <div className="w-10 h-1 bg-zinc-700 rounded-full" />
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute top-10 right-10 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-xl px-3.5 py-2.5 shadow-xl z-20 hidden sm:block">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-white text-[11px] font-bold">Live Now</span>
                </div>
                <p className="text-zinc-500 text-[10px] mt-0.5">12.4K watching</p>
              </div>
              <div className="absolute bottom-10 left-10 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-xl px-3.5 py-2.5 shadow-xl z-20 hidden sm:block">
                <p className="text-white text-[11px] font-bold">✨ New Episode</p>
                <p className="text-zinc-500 text-[10px] mt-0.5">The Landlord S3 E1</p>
              </div>

              {/* BG glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Coming Soon ──────────────────────────────────────────────────────────── */}
      <section id="coming" className="py-20 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-red-500 text-xs font-bold uppercase tracking-[0.2em] mb-3">Coming Soon</p>
          <h2 className="text-4xl md:text-5xl font-black text-white">
            The future of Kenyan<br />
            <span className="text-zinc-500">streaming is almost here.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {COMING_SOON.map(item => (
            <div key={item.label} className="flex items-start gap-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all">
              <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap size={14} className="text-red-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">{item.label}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Final CTA */}
        <div className="relative rounded-3xl overflow-hidden text-center py-20 px-8">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/50 via-zinc-900 to-zinc-950" />
          <div className="absolute inset-0 opacity-[0.035]" style={{
            backgroundImage: 'radial-gradient(circle, #ef4444 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          {/* Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-40 rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.2) 0%, transparent 70%)' }} />
          <div className="relative z-10">
            <h3 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              Start watching today.
              <span className="block text-red-500">It's completely free.</span>
            </h3>
            <p className="text-zinc-400 text-base max-w-md mx-auto mb-10 leading-relaxed">
              No subscription, no credit card, no catch.<br />
              Sign up with your phone number in 30 seconds.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onEnterApp}
                className="group relative flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white font-black text-lg px-10 py-4 rounded-2xl transition-all shadow-2xl shadow-red-600/40 overflow-hidden active:scale-[0.97]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Play size={20} className="relative fill-white flex-shrink-0" />
                <span className="relative">Watch Free Now</span>
              </button>
              <button
                onClick={onSignIn}
                className="flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-bold text-base px-8 py-4 rounded-2xl transition-all hover:bg-white/5 active:scale-[0.97]"
              >
                Create Account <ArrowRight size={16} />
              </button>
            </div>
            <p className="text-zinc-700 text-xs mt-6">🔒 No SMS charges · Secure PIN login · Kenyan-built</p>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900 py-10 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-red-600 rounded-md flex items-center justify-center font-black text-xs shadow-md shadow-red-600/30">T</div>
            <span className="text-lg font-black tracking-tight">Tube<span className="text-red-500">TV</span></span>
            <span className="text-zinc-700 text-sm ml-1">· Kenya's Streaming Platform</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-600">
            <button onClick={onEnterApp} className="hover:text-zinc-300 transition-colors">Browse</button>
            <button onClick={onSignIn}   className="hover:text-zinc-300 transition-colors">Sign In</button>
            <a href="#trending"          className="hover:text-zinc-300 transition-colors">Trending</a>
            <a href="#categories"        className="hover:text-zinc-300 transition-colors">Categories</a>
            <a href="mailto:hello@tubekenya.co.ke" className="hover:text-zinc-300 transition-colors">Contact</a>
          </div>
          <p className="text-zinc-700 text-xs text-center md:text-right">
            © {new Date().getFullYear()} Tube TV · Made with ❤️ in Kenya
          </p>
        </div>
      </footer>

      {/* Marquee keyframe */}
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
