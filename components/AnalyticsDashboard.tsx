import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { generateAnalyticsInsights, generateVideoSpecificInsights } from '../services/geminiService';
import {
  Sparkles, Eye, Users, Film, ArrowLeft, Clock,
  Plus, Trash2, LayoutGrid, Tag, Star, Music, Gamepad2,
  Coffee, Briefcase, Anchor, Zap, Cpu, BookOpen, Utensils, RefreshCcw, Loader2,
  Search, SlidersHorizontal, X, CalendarRange,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { NavItem } from '../types';
import { BunnyVideoItem, bunnyVideoToVideo, getThumbnailUrl } from '../services/bunnyService';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { error as logError } from '../lib/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
};

const formatDay = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' });
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DailyRow { day: string; views: number }

interface VideoRow {
  id: string;
  title: string;
  category: string;
  genre?: string;
  author?: string;
  thumbnail_url: string;
  created_at: string;
  lifetimeViews: number;
  recentViews: number;
  duration: string;
  /** Raw duration in seconds for range filtering */
  durationSecs: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

const CATEGORY_COLORS = [
  '#ef4444','#3b82f6','#10b981','#f59e0b',
  '#8b5cf6','#ec4899','#14b8a6','#f97316',
];

const AVAILABLE_ICONS = [
  { name: 'Star', icon: Star }, { name: 'Music', icon: Music },
  { name: 'Game', icon: Gamepad2 }, { name: 'Food', icon: Utensils },
  { name: 'Tech', icon: Cpu }, { name: 'News', icon: BookOpen },
  { name: 'Lifestyle', icon: Coffee }, { name: 'Business', icon: Briefcase },
  { name: 'Travel', icon: Anchor }, { name: 'Trending', icon: Zap },
  { name: 'Movie', icon: Film },
];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AnalyticsDashboardProps {
  currentNavItems: NavItem[];
  onAddCategory: (name: string, iconName: string) => void;
  onRemoveCategory: (id: string) => void;
  videos?: BunnyVideoItem[];
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

const StatCard = ({ title, value, icon: Icon, sub }: {
  title: string; value: string | number; icon: React.ElementType; sub?: string;
}) => (
  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
    <div className="absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br from-red-600/20 to-purple-600/20 rounded-full blur-2xl group-hover:bg-red-600/30 transition-all duration-500" />
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className="p-3 bg-zinc-800 rounded-lg group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-6 h-6 text-red-500" />
      </div>
    </div>
    <div className="relative z-10">
      <p className="text-zinc-400 text-sm mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-white">{value}</h3>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  </div>
);

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export default function AnalyticsDashboard({
  currentNavItems,
  onAddCategory,
  onRemoveCategory,
  videos = [],
}: AnalyticsDashboardProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'videos' | 'menu'>('overview');
  const [selectedVideo, setSelectedVideo] = useState<VideoRow | null>(null);

  // Supabase-derived state
  const [dailyViews, setDailyViews] = useState<DailyRow[]>([]);
  const [subscriberCount, setSubscriberCount] = useState<number>(0);
  const [isLoadingLive, setIsLoadingLive] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);

  // AI state
  const [channelInsight, setChannelInsight] = useState('');
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [videoInsight, setVideoInsight] = useState('');
  const [isVideoInsightLoading, setIsVideoInsightLoading] = useState(false);

  // Menu manager state
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Star');

  // ─── Video filter state ─────────────────────────────────────────────────────
  const [filterTitle, setFilterTitle] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterDuration, setFilterDuration] = useState('');   // '' | '<5' | '5-15' | '15-30' | '30-60' | '>60'
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Derived from Bunny props ───────────────────────────────────────────────

  const { myVideos, totalLifetimeViews, categoryData } = useMemo(() => {
    const catCounts: Record<string, number> = {};
    let total = 0;

    const mapped: VideoRow[] = videos.map(item => {
      const v = bunnyVideoToVideo(item);
      const lv = item.views ?? 0;
      total += lv;
      const cat = v.category || 'Other';
      catCounts[cat] = (catCounts[cat] || 0) + lv;
      return {
        id: item.guid,
        title: v.title || item.title || 'Untitled',
        category: cat,
        genre: v.genre || undefined,
        author: v.author && v.author !== 'Tube Creator' ? v.author : undefined,
        thumbnail_url: getThumbnailUrl(item.guid, item.thumbnailFileName),
        created_at: item.dateUploaded || new Date().toISOString(),
        lifetimeViews: lv,
        recentViews: 0, // filled in after Supabase fetch
        duration: v.duration,
        durationSecs: item.length ?? 0,
      };
    }).sort((a, b) => b.lifetimeViews - a.lifetimeViews);

    const catData = Object.entries(catCounts)
      .map(([name, views], i) => ({ name, views, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
      .sort((a, b) => b.views - a.views);

    return { myVideos: mapped, totalLifetimeViews: total, categoryData: catData };
  }, [videos]);

  // ─── Supabase: 7-day view trend + subscriber count ─────────────────────────

  const loadLiveData = useCallback(async () => {
    setIsLoadingLive(true);
    setLiveError(null);
    try {
      // 7-day rolling view counts
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: viewRows, error: viewErr } = await supabase
        .from('video_views')
        .select('viewed_at')
        .gte('viewed_at', since);

      if (viewErr) throw viewErr;

      // Aggregate by day (Nairobi time)
      const dayCounts: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayCounts[d.toISOString().split('T')[0]] = 0;
      }
      (viewRows ?? []).forEach(row => {
        const day = row.viewed_at.split('T')[0];
        if (day in dayCounts) dayCounts[day] = (dayCounts[day] || 0) + 1;
      });
      setDailyViews(
        Object.entries(dayCounts).map(([day, views]) => ({ day: formatDay(day), views }))
      );

      // Subscriber count = number of users in auth (via profiles if available, else count)
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      setSubscriberCount(count ?? 0);

    } catch (err) {
      logError('Analytics load error:', err);
      setLiveError('Could not load real-time data. Showing available data.');
      // Fill 7-day chart with zeros so the chart still renders
      const fallback: DailyRow[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        fallback.push({ day: formatDay(d.toISOString().split('T')[0]), views: 0 });
      }
      setDailyViews(fallback);
    } finally {
      setIsLoadingLive(false);
    }
  }, []);

  useEffect(() => { loadLiveData(); }, [loadLiveData]);

  // ─── AI: channel insight (runs once data is ready) ─────────────────────────

  useEffect(() => {
    if (isLoadingLive || !import.meta.env.VITE_API_KEY) {
      if (!import.meta.env.VITE_API_KEY) setChannelInsight('Add VITE_API_KEY to your .env to enable AI insights.');
      return;
    }
    let mounted = true;
    setIsInsightLoading(true);
    generateAnalyticsInsights(
      dailyViews.map(d => ({ day: d.day, views: d.views }))
    ).then(text => {
      if (mounted) { setChannelInsight(text); setIsInsightLoading(false); }
    });
    return () => { mounted = false; };
  }, [isLoadingLive, dailyViews]);

  // ─── AI: per-video insight ─────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedVideo) return;
    let mounted = true;
    setIsVideoInsightLoading(true);
    generateVideoSpecificInsights(selectedVideo.title, {
      views: selectedVideo.lifetimeViews,
      retention: 0,
      ctr: 0,
    }).then(text => {
      if (mounted) { setVideoInsight(text); setIsVideoInsightLoading(false); }
    });
    return () => { mounted = false; };
  }, [selectedVideo]);

  // ─── Derived filter options ────────────────────────────────────────────────

  const uniqueCategories = useMemo(() =>
    Array.from(new Set(myVideos.map(v => v.category).filter(Boolean))).sort(), [myVideos]);

  const uniqueGenres = useMemo(() =>
    Array.from(new Set(myVideos.map(v => v.genre).filter((g): g is string => Boolean(g)))).sort(), [myVideos]);

  const uniqueAuthors = useMemo(() =>
    Array.from(new Set(myVideos.map(v => v.author).filter((a): a is string => Boolean(a)))).sort(), [myVideos]);

  const activeFilterCount = [filterTitle, filterCategory, filterGenre, filterAuthor, filterDateFrom, filterDateTo, filterDuration].filter(Boolean).length;

  const clearFilters = () => {
    setFilterTitle('');
    setFilterCategory('');
    setFilterGenre('');
    setFilterAuthor('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterDuration('');
    setCurrentPage(1);
  };

  // ─── Reset to page 1 whenever any filter changes ──────────────────────────

  useEffect(() => { setCurrentPage(1); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterTitle, filterCategory, filterGenre, filterAuthor, filterDateFrom, filterDateTo, filterDuration]);

  // ─── Apply filters ─────────────────────────────────────────────────────────

  const filteredMyVideos = useMemo(() => {
    const titleQ = filterTitle.toLowerCase().trim();
    const fromMs = filterDateFrom ? new Date(filterDateFrom).getTime() : null;
    const toMs = filterDateTo ? new Date(filterDateTo + 'T23:59:59').getTime() : null;

    return myVideos.filter(v => {
      if (titleQ && !v.title.toLowerCase().includes(titleQ)) return false;
      if (filterCategory && v.category !== filterCategory) return false;
      if (filterGenre && v.genre !== filterGenre) return false;
      if (filterAuthor && v.author !== filterAuthor) return false;

      if (fromMs || toMs) {
        const uploadMs = new Date(v.created_at).getTime();
        if (fromMs && uploadMs < fromMs) return false;
        if (toMs && uploadMs > toMs) return false;
      }

      if (filterDuration) {
        const secs = v.durationSecs;
        if (filterDuration === '<5'    && secs >= 5 * 60) return false;
        if (filterDuration === '5-15'  && (secs < 5 * 60 || secs >= 15 * 60)) return false;
        if (filterDuration === '15-30' && (secs < 15 * 60 || secs >= 30 * 60)) return false;
        if (filterDuration === '30-60' && (secs < 30 * 60 || secs >= 60 * 60)) return false;
        if (filterDuration === '>60'   && secs < 60 * 60) return false;
      }

      return true;
    });
  }, [myVideos, filterTitle, filterCategory, filterGenre, filterAuthor, filterDateFrom, filterDateTo, filterDuration]);

  // ─── Pagination ────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filteredMyVideos.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedVideos = filteredMyVideos.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const goToPage = (p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages)));

  // ─── Video detail view ─────────────────────────────────────────────────────

  if (selectedVideo) {
    return (
      <div className="p-4 md:p-8 pb-24">
        <button
          onClick={() => setSelectedVideo(null)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={18} /> Back to Analytics
        </button>

        <div className="flex items-start gap-4 mb-8">
          <img
            src={selectedVideo.thumbnail_url}
            alt={selectedVideo.title}
            className="w-32 h-20 object-cover rounded-xl bg-zinc-800"
            onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
          />
          <div>
            <h1 className="text-2xl font-bold text-white">{selectedVideo.title}</h1>
            <p className="text-zinc-400 text-sm mt-1">{selectedVideo.category} · {selectedVideo.duration}</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard title="Lifetime Views" value={formatNumber(selectedVideo.lifetimeViews)} icon={Eye} />
          <StatCard title="7-Day Views" value={formatNumber(selectedVideo.recentViews)} icon={TrendingIcon} sub="from Supabase" />
          <StatCard title="Duration" value={selectedVideo.duration} icon={Clock} />
        </div>

        {/* AI insight */}
        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-purple-500/20 rounded-full">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">AI Performance Tips</h3>
              {isVideoInsightLoading ? (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                </div>
              ) : (
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{videoInsight}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main dashboard ────────────────────────────────────────────────────────

  const recentTotal = dailyViews.reduce((s, d) => s + d.views, 0);

  return (
    <div className="p-4 md:p-8 overflow-y-auto pb-24">

      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">{t('studio.welcome')}</h1>
          <p className="text-zinc-400 text-sm">{t('studio.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadLiveData}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Refresh live data"
          >
            <RefreshCcw size={16} className={isLoadingLive ? 'animate-spin' : ''} />
          </button>
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            {(['overview', 'videos', 'menu'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize
                  ${activeTab === tab ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
              >
                {tab === 'overview' ? t('studio.overview') : tab === 'menu' ? t('studio.menu') : 'Content'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {liveError && (
        <div className="mb-6 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm flex items-center gap-2">
          <span>⚠</span> {liveError}
        </div>
      )}

      {/* ─── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-8">

          {/* AI Insight */}
          <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500" />
            <div className="flex items-start gap-4">
              <div className="p-2 bg-purple-500/20 rounded-full animate-pulse">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">Gemini AI Insights</h3>
                {isInsightLoading || isLoadingLive ? (
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analysing your channel data...
                  </div>
                ) : (
                  <p className="text-zinc-200 text-sm leading-relaxed">{channelInsight || 'No insights yet. Upload more videos to get started.'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Lifetime Views"
              value={formatNumber(totalLifetimeViews)}
              icon={Eye}
              sub="all videos · from Bunny CDN"
            />
            <StatCard
              title="7-Day Views"
              value={isLoadingLive ? '…' : formatNumber(recentTotal)}
              icon={TrendingIcon}
              sub="tracked plays · live"
            />
            <StatCard
              title="Subscribers"
              value={isLoadingLive ? '…' : formatNumber(subscriberCount)}
              icon={Users}
              sub="registered accounts"
            />
            <StatCard
              title="Videos"
              value={myVideos.length}
              icon={Film}
              sub="published on Bunny CDN"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* 7-day view trend (real) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">7-Day View Trend</h3>
                {isLoadingLive && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
              </div>
              <p className="text-xs text-zinc-500 mb-4">Tracked plays recorded in real time</p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyViews}>
                    <defs>
                      <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="day" stroke="#71717a" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis stroke="#71717a" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="views" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#viewGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Views by category (real, from Bunny) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-1">Views by Category</h3>
              <p className="text-xs text-zinc-500 mb-4">Lifetime views · from Bunny CDN</p>
              {categoryData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-zinc-500 text-sm">No data yet</div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis type="number" stroke="#71717a" tickLine={false} axisLine={false} tickFormatter={v => formatNumber(v)} />
                      <YAxis type="category" dataKey="name" stroke="#71717a" tickLine={false} axisLine={false} width={80} tick={{ fontSize: 11 }} />
                      <Tooltip
                        cursor={{ fill: '#27272a' }}
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(v: number) => [formatNumber(v), 'Views']}
                      />
                      <Bar dataKey="views" radius={[0, 4, 4, 0]}>
                        {categoryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Top 5 Videos quick list */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Top Videos</h3>
              <button
                onClick={() => setActiveTab('videos')}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                View all →
              </button>
            </div>
            {myVideos.slice(0, 5).map((v, i) => (
              <div
                key={v.id}
                onClick={() => setSelectedVideo(v)}
                className="flex items-center gap-4 px-6 py-3 hover:bg-zinc-800/50 cursor-pointer border-b border-zinc-800/50 last:border-0 transition-colors"
              >
                <span className="text-zinc-500 text-sm font-mono w-4">{i + 1}</span>
                <img src={v.thumbnail_url} alt={v.title} className="w-14 h-8 object-cover rounded bg-zinc-800" onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate font-medium">{v.title}</p>
                  <p className="text-xs text-zinc-500">{v.category}</p>
                </div>
                <span className="text-sm text-white font-mono">{formatNumber(v.lifetimeViews)}</span>
              </div>
            ))}
            {myVideos.length === 0 && (
              <p className="px-6 py-8 text-center text-zinc-500 text-sm">No videos uploaded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ─── VIDEOS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'videos' && (
        <div className="animate-in fade-in duration-300 space-y-4">

          {/* Filter bar toggle + pill strip */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search title…"
                  value={filterTitle}
                  onChange={e => setFilterTitle(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors w-52"
                />
              </div>

              {/* Toggle advanced filters */}
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${showFilters ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'}`}
              >
                <SlidersHorizontal size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 bg-white text-red-600 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Clear all */}
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>

            {/* Results count + page info */}
            <p className="text-xs text-zinc-500">
              {filteredMyVideos.length === 0
                ? 'No results'
                : filteredMyVideos.length === myVideos.length
                  ? `${myVideos.length} video${myVideos.length !== 1 ? 's' : ''}`
                  : `${filteredMyVideos.length} of ${myVideos.length} videos`}
              {totalPages > 1 && ` · page ${safePage} of ${totalPages}`}
            </p>
          </div>

          {/* Advanced filter panel */}
          {showFilters && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

                {/* Date From */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1">
                    <CalendarRange size={12} /> Upload Date From
                  </label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1">
                    <CalendarRange size={12} /> Upload Date To
                  </label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                  />
                </div>

                {/* Duration range */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1">
                    <Clock size={12} /> Duration
                  </label>
                  <select
                    value={filterDuration}
                    onChange={e => setFilterDuration(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                  >
                    <option value="">Any length</option>
                    <option value="<5">Short (&lt; 5 min)</option>
                    <option value="5-15">Medium (5–15 min)</option>
                    <option value="15-30">Long (15–30 min)</option>
                    <option value="30-60">Extended (30–60 min)</option>
                    <option value=">60">Feature (&gt; 60 min)</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Category</label>
                  <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                  >
                    <option value="">All categories</option>
                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Genre */}
                {uniqueGenres.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Genre</label>
                    <select
                      value={filterGenre}
                      onChange={e => setFilterGenre(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                    >
                      <option value="">All genres</option>
                      {uniqueGenres.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                )}

                {/* Author */}
                {uniqueAuthors.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Author / Creator</label>
                    <select
                      value={filterAuthor}
                      onChange={e => setFilterAuthor(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                    >
                      <option value="">All authors</option>
                      {uniqueAuthors.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-800">
                <tr>
                  <th className="p-4">Video</th>
                  <th className="p-4 hidden sm:table-cell">Author</th>
                  <th className="p-4 hidden md:table-cell">Genre</th>
                  <th className="p-4 text-center whitespace-nowrap">Uploaded</th>
                  <th className="p-4 text-center">Views</th>
                  <th className="p-4 text-center hidden sm:table-cell">Duration</th>
                  <th className="p-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {paginatedVideos.map(video => (
                  <tr
                    key={video.id}
                    onClick={() => setSelectedVideo(video)}
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={video.thumbnail_url}
                          className="w-16 h-9 object-cover rounded bg-zinc-800 flex-shrink-0"
                          alt=""
                          onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                        />
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm truncate group-hover:text-red-400 transition-colors">{video.title}</p>
                          <p className="text-zinc-500 text-xs">{video.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell text-zinc-400 text-sm truncate max-w-[120px]">
                      {video.author || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="p-4 hidden md:table-cell text-zinc-400 text-sm">
                      {video.genre
                        ? <span className="px-2 py-0.5 bg-purple-500/15 text-purple-300 rounded-full text-xs">{video.genre}</span>
                        : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="p-4 text-center text-zinc-400 text-sm whitespace-nowrap">
                      {new Date(video.created_at).toLocaleDateString('en-KE')}
                    </td>
                    <td className="p-4 text-center text-white text-sm font-mono">{formatNumber(video.lifetimeViews)}</td>
                    <td className="p-4 text-center text-zinc-400 text-sm font-mono hidden sm:table-cell">{video.duration}</td>
                    <td className="p-4 text-right">
                      <span className="text-blue-400 hover:text-blue-300 text-xs font-bold px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 whitespace-nowrap">
                        View →
                      </span>
                    </td>
                  </tr>
                ))}
                {paginatedVideos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-zinc-500">
                      {myVideos.length === 0 ? 'No videos uploaded yet.' : 'No videos match the current filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* ── Pagination footer ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-zinc-800">

                {/* Left: rows info */}
                <p className="text-xs text-zinc-500 hidden sm:block">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredMyVideos.length)} of {filteredMyVideos.length}
                </p>

                {/* Center: page buttons */}
                <div className="flex items-center gap-1 mx-auto sm:mx-0">
                  {/* First */}
                  <button
                    onClick={() => goToPage(1)}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="First page"
                  >
                    <ChevronsLeft size={16} />
                  </button>

                  {/* Prev */}
                  <button
                    onClick={() => goToPage(safePage - 1)}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Page number pills */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                    .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '…'
                        ? <span key={`ellipsis-${idx}`} className="px-1 text-zinc-600 text-sm">…</span>
                        : (
                          <button
                            key={p}
                            onClick={() => goToPage(p as number)}
                            className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors
                              ${p === safePage
                                ? 'bg-red-600 text-white shadow'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                          >
                            {p}
                          </button>
                        )
                    )}

                  {/* Next */}
                  <button
                    onClick={() => goToPage(safePage + 1)}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>

                  {/* Last */}
                  <button
                    onClick={() => goToPage(totalPages)}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Last page"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>

                {/* Right: per-page hint */}
                <p className="text-xs text-zinc-600 hidden sm:block">{PAGE_SIZE} per page</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MENU MANAGER TAB ─────────────────────────────────────────────── */}
      {activeTab === 'menu' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Add category */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6 text-xl font-bold text-white">
                <LayoutGrid className="text-purple-500" />
                <h3>Add New Category</h3>
              </div>
              <form onSubmit={e => { e.preventDefault(); if (newCatName.trim()) { onAddCategory(newCatName.trim(), newCatIcon); setNewCatName(''); setNewCatIcon('Star'); } }} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Category Name</label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="e.g. Technology, Gaming, Recipes"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Select Icon</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setNewCatIcon(name)}
                        className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all border
                          ${newCatIcon === name
                            ? 'bg-red-600 border-red-500 text-white shadow-lg scale-105'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                      >
                        <Icon size={20} />
                        <span className="text-[10px]">{name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus size={20} /> Add to Menu
                </button>
              </form>
            </div>

            {/* Active items */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6 text-xl font-bold text-white">
                <Tag className="text-blue-500" />
                <h3>Active Menu Items</h3>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {currentNavItems.filter(item => !item.restricted && item.id !== 'SETTINGS').map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl group hover:border-zinc-700 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
                        {item.icon && <item.icon size={18} />}
                      </div>
                      <div>
                        <p className="font-medium text-white">{item.label}</p>
                        <p className="text-xs text-zinc-500">{item.isCustom ? 'Custom Category' : 'System Page'}</p>
                      </div>
                    </div>
                    {item.isCustom && (
                      <button
                        onClick={() => onRemoveCategory(item.id)}
                        className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small inline icon to avoid unused-import issues
const TrendingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);
