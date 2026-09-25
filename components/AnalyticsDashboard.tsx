import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, LayoutGrid, Tag, Star, Music, Gamepad2, Coffee, Briefcase, Anchor, Zap, Cpu, Film, BookOpen, Utensils } from 'lucide-react';
import { NavItem } from '../types';
import { BunnyVideoItem, bunnyVideoToVideo } from '../services/bunnyService';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

// Helper for formatting large numbers
const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};

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
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Star');
  const [funnel, setFunnel] = useState<{since:string;counts:Record<string,number>} | null>(null);
  useEffect(() => {
    let active = true;
    const loadMeasured = async () => {
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const {data:{session}} = await supabase.auth.getSession();
      if (!url || !session) return;
      try {
        const response = await fetch(`${url}/functions/v1/analytics-summary`, {headers:{apikey:import.meta.env.VITE_SUPABASE_ANON_KEY || '',Authorization:`Bearer ${session.access_token}`}});
        if (response.ok && active) setFunnel(await response.json());
      } catch { /* Measured events remain unavailable; never synthesize them. */ }
    };
    void loadMeasured();
    return () => { active = false; };
  }, []);

  const { myVideos, totalViews, categoryData } = useMemo(() => {
    let views = 0;
    const categoryCounts = new Map<string, {titles: number; lifetimeViews: number}>();
    const rows = videos.map(item => {
      const video = bunnyVideoToVideo(item);
      const count = Number(item.views) || 0;
      views += count;
      const category = video.category || 'Other';
      const previous = categoryCounts.get(category) || {titles: 0, lifetimeViews: 0};
      categoryCounts.set(category, {titles: previous.titles + 1, lifetimeViews: previous.lifetimeViews + count});
      return { id: item.guid, title: item.title, category, thumbnail: video.thumbnail,
        date: item.dateUploaded, views: count, duration: video.duration };
    }).sort((a, b) => b.views - a.views);
    return { myVideos: rows, totalViews: views,
      categoryData: [...categoryCounts].map(([category, totals]) => ({category, ...totals})) };
  }, [videos]);

  // --- ACTIONS ---
  const handleAddCategory = (e: React.FormEvent) => {
      e.preventDefault();
      if (newCatName.trim()) {
          onAddCategory(newCatName.trim(), newCatIcon);
          setNewCatName('');
          setNewCatIcon('Star');
      }
  };


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

      {activeTab === 'overview' && <section aria-label="Measured catalogue totals" className="space-y-6">
        <p className="text-sm text-zinc-400">Bunny reports lifetime views for each video. Daily views, retention and traffic sources will appear when verified measurements are connected.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-zinc-400">Published titles</p><strong className="text-3xl">{myVideos.length}</strong></div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-zinc-400">Lifetime views</p><strong className="text-3xl">{formatNumber(totalViews)}</strong></div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-zinc-400">Categories</p><strong className="text-3xl">{categoryData.length}</strong></div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-2 text-xl font-semibold">Measured playback events · last 7 days</h2>
          {funnel ? <div className="grid gap-4 sm:grid-cols-3">
            {([['playback_start','Playback starts'],['playback_first_frame','First frames'],['playback_complete','Completed plays'],['episode_next','Next episodes'],['playback_error','Playback errors'],['playback_buffer','Buffer events']] as const).map(([name,label]) => <div key={name}><p className="text-sm text-zinc-400">{label}</p><strong className="text-2xl">{formatNumber(funnel.counts[name] || 0)}</strong></div>)}
          </div> : <p className="text-sm text-zinc-400">Measured events are not connected yet.</p>}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="mb-4 text-xl font-semibold">Views by category</h2>
            <ul className="space-y-3">{categoryData.map(row => <li key={row.category} className="flex justify-between border-b border-zinc-800 pb-2"><span>{row.category} <small className="text-zinc-500">({row.titles} titles)</small></span><strong>{formatNumber(row.lifetimeViews)}</strong></li>)}</ul>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="mb-4 text-xl font-semibold">Top titles by lifetime views</h2>
            <ul className="space-y-3">{myVideos.slice(0, 20).map(video => <li key={video.id} className="flex justify-between gap-3 border-b border-zinc-800 pb-2"><span className="truncate">{video.title}</span><strong>{formatNumber(video.views)}</strong></li>)}</ul>
          </div>
        </div>
      </section>}

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
