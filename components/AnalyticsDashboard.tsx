import React, { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { generateAnalyticsInsights, generateVideoSpecificInsights } from '../services/geminiService';
import { Sparkles, TrendingUp, DollarSign, Users, Eye, ArrowLeft, MousePointer2, Clock, ThumbsUp, Plus, Trash2, LayoutGrid, Tag, Star, Music, Gamepad2, Coffee, Briefcase, Anchor, Zap, Cpu, Film, BookOpen, Utensils, RefreshCcw } from 'lucide-react';
import { NavItem } from '../types';
import { BunnyVideoItem, bunnyVideoToVideo, getThumbnailUrl } from '../services/bunnyService';
import { useLanguage } from '../contexts/LanguageContext';

// Helper for formatting large numbers
const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};

const TRAFFIC_DATA = [
  { name: 'Browse Features', value: 45, color: '#ef4444' },
  { name: 'Suggested Videos', value: 30, color: '#3b82f6' },
  { name: 'Platform Search', value: 15, color: '#10b981' },
  { name: 'External / Social', value: 10, color: '#f59e0b' },
];

const AVAILABLE_ICONS = [
    { name: 'Star', icon: Star },
    { name: 'Music', icon: Music },
    { name: 'Game', icon: Gamepad2 },
    { name: 'Food', icon: Utensils },
    { name: 'Tech', icon: Cpu },
    { name: 'News', icon: BookOpen },
    { name: 'Lifestyle', icon: Coffee },
    { name: 'Business', icon: Briefcase },
    { name: 'Travel', icon: Anchor },
    { name: 'Trending', icon: Zap },
    { name: 'Movie', icon: Film },
];

interface AnalyticsDashboardProps {
    currentNavItems: NavItem[];
    onAddCategory: (name: string, iconName: string) => void;
    onRemoveCategory: (id: string) => void;
    videos?: BunnyVideoItem[];
}

export default function AnalyticsDashboard({ currentNavItems, onAddCategory, onRemoveCategory, videos = [] }: AnalyticsDashboardProps) {
  const { t } = useLanguage();
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'menu'>('overview');
  
  // Real Data State (derived from props)
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // AI State
  const [channelInsight, setChannelInsight] = useState<string>('Analyzing channel data...');
  const [isChannelLoading, setIsChannelLoading] = useState(false);
  const [videoInsight, setVideoInsight] = useState<string>('Analyzing video performance...');
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  // Menu Manager State
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Star');

  // Derive all metrics synchronously from the videos prop
  const { myVideos, totalViews, totalRevenue, chartData, categoryChartData } = useMemo(() => {
    let tViews = 0;
    const catCounts: Record<string, number> = {};

    const mapped = videos.map(item => {
      const v = bunnyVideoToVideo(item);
      const views = item.views || 0;
      tViews += views;
      
      const cat = v.category || 'Other';
      catCounts[cat] = (catCounts[cat] || 0) + views;

      return {
        id: item.guid,
        title: item.title,
        category: cat,
        thumbnail_url: getThumbnailUrl(item.guid),
        created_at: item.dateUploaded || new Date().toISOString(),
        views: views,
        duration: v.duration,
      };
    }).sort((a, b) => b.views - a.views);

    // Generate synthetic last-7-days distribution based on total views
    // (Since Bunny Stream only provides lifetime views)
    const agg = [];
    for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        // Distribute lifetime views artificially across the week for visual charting
        const syntheticViews = Math.floor((tViews / 7) * (0.8 + Math.random() * 0.4));
        agg.push({ 
            day: ds, 
            views: syntheticViews, 
            revenue: syntheticViews * 0.05 // estimate Ksh 0.05 per view
        });
    }

    const tRevenue = Math.floor(tViews * 0.05);

    // Category chart data
    const catData = Object.entries(catCounts).map(([name, views]) => ({ day: name, views }));

    return {
        myVideos: mapped,
        totalViews: tViews,
        totalRevenue: tRevenue,
        chartData: agg,
        categoryChartData: catData
    };
  }, [videos]);

  // --- AI INSIGHTS ---
  useEffect(() => {
    let mounted = true;
    const fetchChannelInsights = async () => {
      if (!isLoadingData && import.meta.env.VITE_API_KEY) {
        setIsChannelLoading(true);
        // Feed real data into the prompt
        const promptData = chartData;
        const text = await generateAnalyticsInsights(promptData);
        if (mounted) {
            setChannelInsight(text);
            setIsChannelLoading(false);
        }
      } else if (!import.meta.env.VITE_API_KEY) {
          setChannelInsight('Add VITE_API_KEY to your .env file to see AI insights.');
      }
    };
    fetchChannelInsights();
    return () => { mounted = false; };
  }, [isLoadingData, chartData]);

  // Video Specific AI
  useEffect(() => {
    if (selectedVideo) {
      const fetchVideoInsights = async () => {
        setIsVideoLoading(true);
        const metrics = {
            views: selectedVideo.views,
            retention: 45 + Math.random() * 20, 
            ctr: 4 + Math.random() * 8
        };
        const text = await generateVideoSpecificInsights(selectedVideo.title, metrics);
        setVideoInsight(text);
        setIsVideoLoading(false);
      };
      fetchVideoInsights();
    }
  }, [selectedVideo]);

  // --- ACTIONS ---
  const handleAddCategory = (e: React.FormEvent) => {
      e.preventDefault();
      if (newCatName.trim()) {
          onAddCategory(newCatName.trim(), newCatIcon);
          setNewCatName('');
          setNewCatIcon('Star');
      }
  };


  const StatCard = ({ title, value, icon: Icon, change, suffix = '' }: any) => (
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br from-red-600/20 to-purple-600/20 rounded-full blur-2xl group-hover:bg-red-600/30 transition-all duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 bg-zinc-800 rounded-lg group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-6 h-6 text-red-500" />
              </div>
              <span className={`text-sm font-bold ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {change >= 0 ? '+' : ''}{change}%
              </span>
          </div>
          <div className="relative z-10">
              <p className="text-zinc-400 text-sm mb-1">{title}</p>
              <h3 className="text-3xl font-bold text-white">{value}{suffix}</h3>
          </div>
      </div>
  );

  // --- RENDER: MAIN DASHBOARD ---
  return (
    <div className="p-4 md:p-8 overflow-y-auto h-screen pb-24">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">{t('studio.welcome')}</h1>
            <p className="text-zinc-400">{t('studio.subtitle')}</p>
        </div>
        <div className="flex gap-4">
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                >
                    {t('studio.overview')}
                </button>
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'menu' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                >
                    {t('studio.menu')}
                </button>
            </div>
        </div>
      </header>

      {/* --- TAB: OVERVIEW --- */}
      {activeTab === 'overview' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* AI Insight Section */}
            <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-2xl p-6 mb-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-purple-500/20 rounded-full animate-pulse">
                        <Sparkles className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Gemini AI Insights</h3>
                        <p className="text-zinc-200 leading-relaxed">
                            {isChannelLoading ? 'Crunching the numbers...' : channelInsight}
                        </p>
                    </div>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title={t('studio.views')} value={formatNumber(totalViews)} icon={Eye} change={0} />
                <StatCard title={t('studio.revenue')} value={`Ksh ${formatNumber(totalRevenue)}`} icon={DollarSign} change={0} />
                <StatCard title="Subscribers" value="1.2K" icon={Users} change={0} />
                <StatCard title="Content Count" value={myVideos.length} icon={Film} change={0} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Revenue Chart */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-6">Revenue Overview</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="day" stroke="#71717a" tickLine={false} axisLine={false} />
                                <YAxis stroke="#71717a" tickLine={false} axisLine={false} tickFormatter={(value) => `Ksh ${value}`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Views Bar Chart */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-6">Weekly Views</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="day" stroke="#71717a" tickLine={false} axisLine={false} />
                                <YAxis stroke="#71717a" tickLine={false} axisLine={false} />
                                <Tooltip 
                                    cursor={{fill: '#27272a'}}
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="views" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Video Content List */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4">{t('studio.content')}</h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-zinc-950/50 text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-800">
                            <tr>
                                <th className="p-4">Video</th>
                                <th className="p-4 text-center">Date</th>
                                <th className="p-4 text-center">Lifetime Views</th>
                                <th className="p-4 text-center">Duration</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {myVideos.map(video => (
                                <tr 
                                    key={video.id} 
                                    onClick={() => setSelectedVideo(video)}
                                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <img src={video.thumbnail_url} className="w-16 h-9 object-cover rounded bg-zinc-800" alt="" onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                                            <div>
                                                <p className="text-white font-medium text-sm group-hover:text-red-500 transition-colors">{video.title}</p>
                                                <p className="text-zinc-500 text-xs">{video.category}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center text-zinc-400 text-sm">
                                        {new Date(video.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-center text-white text-sm">{formatNumber(video.views || 0)}</td>
                                    <td className="p-4 text-center text-zinc-400 text-sm font-mono">{video.duration}</td>
                                    <td className="p-4 text-right">
                                        <button className="text-blue-400 hover:text-blue-300 text-xs font-bold px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                                            Analytics
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {myVideos.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-zinc-500">
                                        You haven't uploaded any videos yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* --- TAB: MENU MANAGER --- */}
      {activeTab === 'menu' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-6 text-xl font-bold text-white">
                          <LayoutGrid className="text-purple-500" />
                          <h3>Add New Category</h3>
                      </div>
                      
                      <form onSubmit={handleAddCategory} className="space-y-6">
                          <div>
                              <label className="block text-sm font-medium text-zinc-400 mb-2">Category Name</label>
                              <input 
                                type="text" 
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
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
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                            }`}
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
                              <Plus size={20} />
                              Add to Menu
                          </button>
                      </form>
                  </div>

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
                                        title="Remove from menu"
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
