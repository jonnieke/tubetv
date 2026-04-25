import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Heart, DollarSign, Send, Radio, Calendar, 
  Users, Share2, Settings, Mic, Video as VideoIcon, 
  Copy, Check, BarChart2, Zap, MoreVertical, Smartphone, Bell, Loader2
} from 'lucide-react';
import { Video } from '../types';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

// Helper to convert VAPID string to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Mock Data for Live Context
const LIVE_CHANNELS = [
  { id: 'l1', user: 'DJ Kym Nickdee', title: 'Friday Night Mix Live 🎵', viewers: 12400, category: 'Music' },
  { id: 'l2', user: 'Citizen TV Kenya', title: 'News Gang Special Report', viewers: 45000, category: 'News' },
  { id: 'l3', user: 'Churchill Show', title: 'Live Recording at Carnivore', viewers: 8900, category: 'Comedy' },
];

const SCHEDULE = [
  { id: 1, time: '14:00', title: 'Tech Talk Kenya', user: 'Tech Weez' },
  { id: 2, time: '16:00', title: 'Sauti Sol Virtual Concert', user: 'Sauti Sol' },
  { id: 3, time: '19:00', title: 'Premier League Watchalong', user: 'Carol Radull' },
];

const MOCK_CHAT = [
  { user: 'Wanjiku', message: 'This mix is fire! 🔥', color: 'text-pink-400' },
  { user: 'Kamau_254', message: 'Big up from Diaspora! 🇬🇧', color: 'text-blue-400' },
  { user: 'Ochieng', message: 'Tuma paybill number', color: 'text-green-400' },
  { user: 'Stacy', message: 'Sound clarity is top notch today.', color: 'text-purple-400' },
];

interface LiveSectionProps {
  isAuthenticated?: boolean;
}

const LiveSection: React.FC<LiveSectionProps> = ({ isAuthenticated = false }) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'watch' | 'golive'>('watch');

  // --- SUB-COMPONENT: STREAMER TOOLS (GO LIVE) ---
  const GoLiveTools = () => {
    const { language } = useLanguage();
    const [streamTitle, setStreamTitle] = useState('');
    const [isLive, setIsLive] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);

    const STREAM_URL = "rtmp://global-live.bunny.net/tubekenya";
    const STREAM_KEY = "Generates on Stream Start (Backend)";

    const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    };

    return (
      <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    <Radio className="text-red-500" /> {t('nav.studio')}: Live
                </h1>
                <p className="text-zinc-400">{t('studio.subtitle')}</p>
            </div>
            {isLive ? (
                <button 
                    onClick={() => setIsLive(false)}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold animate-pulse"
                >
                    {language === 'sw' ? 'Maliza Matangazo' : 'End Stream'}
                </button>
            ) : (
                <div className="flex gap-2">
                    <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-medium">
                        Test Stream
                    </button>
                    <button 
                        disabled={!streamTitle}
                        onClick={() => setIsLive(true)}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold"
                    >
                        {language === 'sw' ? 'Rusha Moja kwa Moja' : 'Go Live'}
                    </button>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Setup */}
            <div className="lg:col-span-2 space-y-6">
                {/* Preview Window */}
                <div className="aspect-video bg-black rounded-xl border border-zinc-800 flex items-center justify-center relative overflow-hidden">
                    {isLive ? (
                         <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center">
                            <Radio size={48} className="text-red-500 animate-pulse mb-4" />
                            <p className="text-white font-bold">You are LIVE</p>
                            <p className="text-zinc-500 text-sm">00:12:43</p>
                         </div>
                    ) : (
                        <div className="text-center text-zinc-500">
                            <VideoIcon size={48} className="mx-auto mb-2 opacity-50" />
                            <p>Stream Preview (Offline)</p>
                        </div>
                    )}
                </div>

                {/* Stream Details Form */}
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                    <h3 className="font-bold text-white mb-4">Stream Info</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Title</label>
                            <input 
                                type="text" 
                                value={streamTitle}
                                onChange={(e) => setStreamTitle(e.target.value)}
                                placeholder="e.g. Sunday Morning Worship"
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-white focus:border-red-500 focus:outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs text-zinc-400 mb-1">Category</label>
                                <select className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-white focus:border-red-500 focus:outline-none">
                                    <option>Just Chatting</option>
                                    <option>Gaming</option>
                                    <option>Music</option>
                                    <option>News</option>
                                    <option>Education</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Visibility</label>
                                <select className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-white focus:border-red-500 focus:outline-none">
                                    <option>Public</option>
                                    <option>Unlisted</option>
                                    <option>Premium Only</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Encoder Settings */}
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Settings size={18} /> Encoder Setup
                    </h3>
                    <p className="text-sm text-zinc-400 mb-4">
                        Copy these credentials into OBS Studio, vMix, or your preferred streaming software.
                    </p>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Server URL (RTMP)</label>
                            <div className="flex gap-2">
                                <input type="text" readOnly value={STREAM_URL} className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-300 font-mono text-sm" />
                                <button onClick={() => copyToClipboard(STREAM_URL)} className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-lg text-white">
                                    <Copy size={18} />
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Stream Key</label>
                            <div className="flex gap-2">
                                <input type="password" readOnly value={STREAM_KEY} className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-300 font-mono text-sm" />
                                <button onClick={() => copyToClipboard(STREAM_KEY)} className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-lg text-white">
                                    {copiedKey ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                </button>
                            </div>
                            <p className="text-xs text-red-400 mt-1">Do not share your stream key with anyone.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Col: Health & Chat */}
            <div className="space-y-6">
                {/* Health Monitor */}
                <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                     <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <BarChart2 size={18} /> Stream Health
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-400">Status</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${isLive ? 'bg-green-500/20 text-green-500' : 'bg-zinc-800 text-zinc-500'}`}>
                                {isLive ? 'Excellent' : 'Offline'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-400">Bitrate</span>
                            <span className="text-white font-mono">{isLive ? '4500 kbps' : '0 kbps'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-400">FPS</span>
                            <span className="text-white font-mono">{isLive ? '60' : '0'}</span>
                        </div>
                    </div>
                </div>
                
                {/* Creator Chat Preview */}
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 h-[400px] flex flex-col">
                    <div className="p-3 border-b border-zinc-800 font-bold text-sm">Live Chat</div>
                    <div className="flex-1 p-4 overflow-y-auto space-y-2">
                        <div className="text-zinc-500 text-sm text-center mt-10">Chat preview not available</div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  };

  // --- SUB-COMPONENT: VIEWER EXPERIENCE ---
  const WatchLive = () => {
    const [messages, setMessages] = useState(MOCK_CHAT);
    const [newMessage, setNewMessage] = useState('');
    const [showPaybill, setShowPaybill] = useState(false);
    const [reactionCount, setReactionCount] = useState(0);
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const [isSubscribingToPush, setIsSubscribingToPush] = useState(false);
    const [subscribedEvents, setSubscribedEvents] = useState<number[]>([]);

    // Auto-scroll chat
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Simulate incoming chat messages
    useEffect(() => {
        const interval = setInterval(() => {
        const randomMsg = MOCK_CHAT[Math.floor(Math.random() * MOCK_CHAT.length)];
        setMessages(prev => [...prev.slice(-50), { ...randomMsg, user: `${randomMsg.user}_${Math.floor(Math.random() * 100)}` }]);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        setMessages(prev => [...prev, { user: 'You', message: newMessage, color: 'text-white font-bold' }]);
        setNewMessage('');
    };

    const triggerReaction = () => {
        setReactionCount(prev => prev + 1);
        setTimeout(() => setReactionCount(prev => Math.max(0, prev - 1)), 2000);
    };

    const handleSubscribePush = async (eventId: number) => {
        try {
          setIsSubscribingToPush(true);
          if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            alert('Push notifications are not supported by your browser.');
            return;
          }
  
          const registration = await navigator.serviceWorker.ready;
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            alert('Permission for notifications was denied');
            return;
          }
  
          const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          if (!vapidPublicKey) {
             console.error('VITE_VAPID_PUBLIC_KEY is missing');
             return;
          }
  
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          });
  
          const subJson = subscription.toJSON();
          
          // Ensure user is logged in
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
              alert('Please login to subscribe to notifications.');
              return;
          }
  
          await supabase.from('push_subscriptions').upsert({
              user_id: session.user.id,
              endpoint: subJson.endpoint,
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth
          }, { onConflict: 'endpoint' });
  
          setSubscribedEvents(prev => [...prev, eventId]);
        } catch (err) {
          console.error('Error subscribing to push:', err);
          alert('Failed to subscribe to notifications.');
        } finally {
          setIsSubscribingToPush(false);
        }
      };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-4">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
                {/* Featured Player */}
                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden relative group shrink-0">
                    <div className="w-full h-full bg-zinc-800" />
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-2 animate-pulse">
                        <Radio size={16} /> LIVE
                    </div>
                    <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                        <Users size={16} /> 12,453
                    </div>
                    
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                            <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-1"></div>
                        </div>
                    </div>

                    {/* Reaction Float Zone (Visual Only for Demo) */}
                    <div className="absolute bottom-20 right-10 pointer-events-none">
                        {reactionCount > 0 && (
                            <div className="animate-ping absolute text-red-500">
                                <Heart fill="currentColor" size={32} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Stream Info & Actions */}
                <div className="mt-4 px-2">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 p-0.5">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=DJ`} className="w-full h-full rounded-full bg-zinc-900" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Friday Night Mix Live 🎵</h2>
                                <p className="text-zinc-400 text-sm">DJ Kym Nickdee • Music • Streaming for 2h 15m</p>
                                <div className="flex gap-2 mt-2">
                                    <span className="bg-zinc-800 text-xs px-2 py-1 rounded text-zinc-300">#Gengetone</span>
                                    <span className="bg-zinc-800 text-xs px-2 py-1 rounded text-zinc-300">#Nairobi</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
                                <Share2 size={18} /> <span className="hidden md:inline">Share</span>
                            </button>
                            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium">
                                Subscribe
                            </button>
                        </div>
                    </div>

                    {/* Donation / Paybill Section */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                                <DollarSign className="text-white" />
                            </div>
                            <div>
                                <p className="font-bold text-white">Support the Stream</p>
                                <p className="text-xs text-zinc-400">Send M-Pesa to Paybill: 247247</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowPaybill(!showPaybill)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
                        >
                            Tip Now
                        </button>
                    </div>
                    
                    {/* Discovery Rows */}
                    <div className="space-y-6 pb-12">
                        <div>
                            <h3 className="font-bold text-white mb-3 text-lg">{t('live.now')}</h3>
                            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                                {LIVE_CHANNELS.map(channel => (
                                    <div key={channel.id} className="min-w-[250px] cursor-pointer group">
                                        <div className="aspect-video bg-zinc-800 rounded-lg relative overflow-hidden mb-2">
                                            <div className="w-full h-full bg-zinc-800 group-hover:scale-105 transition-transform" />
                                            <div className="absolute top-2 left-2 bg-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded text-white">LIVE</div>
                                            <div className="absolute bottom-2 left-2 bg-black/60 text-[10px] px-1.5 py-0.5 rounded text-white flex items-center gap-1">
                                                <Users size={10} /> {(channel.viewers / 1000).toFixed(1)}K
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-white text-sm truncate">{channel.title}</h4>
                                        <p className="text-zinc-400 text-xs">{channel.user}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-bold text-white mb-3 text-lg flex items-center gap-2">
                                <Calendar size={18} className="text-blue-500" /> {t('live.schedule')}
                            </h3>
                            <div className="space-y-2">
                                {SCHEDULE.map((event, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-zinc-950 p-2 rounded text-center min-w-[60px]">
                                                <div className="text-blue-400 font-bold text-sm">{event.time}</div>
                                                <div className="text-zinc-500 text-[10px] uppercase">Today</div>
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{event.title}</p>
                                                <p className="text-zinc-400 text-xs">by {event.user}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleSubscribePush(event.id)}
                                            disabled={isSubscribingToPush || subscribedEvents.includes(event.id)}
                                            className={`text-xs border px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
                                                subscribedEvents.includes(event.id) 
                                                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' 
                                                : 'border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                                            }`}
                                        >
                                            {subscribedEvents.includes(event.id) ? (
                                                <><Check size={12} /> {t('live.subscribed')}</>
                                            ) : isSubscribingToPush ? (
                                                <><Loader2 size={12} className="animate-spin" /> ...</>
                                            ) : (
                                                <><Bell size={12} /> {t('live.notify')}</>
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Live Chat Column */}
            <div className="w-full lg:w-80 flex flex-col bg-zinc-900 border-l border-zinc-800 h-[400px] lg:h-auto rounded-t-xl lg:rounded-none overflow-hidden shrink-0">
                <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                    <span className="font-bold text-sm">Live Chat</span>
                    <MoreVertical size={16} className="text-zinc-400 cursor-pointer" />
                </div>

                {/* Pinned Poll */}
                <div className="p-3 bg-zinc-800/50 border-b border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-400">POLL</span>
                        <span className="text-[10px] text-zinc-500">Ends in 2m</span>
                    </div>
                    <p className="text-xs text-white mb-2 font-medium">Next song request genre?</p>
                    <div className="space-y-1">
                        <div className="relative h-6 bg-zinc-700 rounded overflow-hidden cursor-pointer group">
                            <div className="absolute inset-0 bg-blue-600/30 w-[70%]"></div>
                            <span className="absolute inset-0 flex items-center px-2 text-[10px] text-white justify-between">
                                <span>Amapiano</span>
                                <span>70%</span>
                            </span>
                        </div>
                        <div className="relative h-6 bg-zinc-700 rounded overflow-hidden cursor-pointer group">
                            <div className="absolute inset-0 bg-blue-600/30 w-[30%]"></div>
                            <span className="absolute inset-0 flex items-center px-2 text-[10px] text-white justify-between">
                                <span>Reggae</span>
                                <span>30%</span>
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-900 scroll-smooth">
                    {messages.map((msg, idx) => (
                        <div key={idx} className="text-sm break-words animate-in slide-in-from-bottom-2 duration-300">
                            <span className={`font-bold ${msg.color} mr-2 cursor-pointer hover:underline`}>{msg.user}:</span>
                            <span className="text-zinc-300">{msg.message}</span>
                        </div>
                    ))}
                    <div ref={chatBottomRef} />
                </div>

                {/* Chat Input */}
                <div className="p-3 border-t border-zinc-800 bg-zinc-900">
                    <form onSubmit={handleSendMessage} className="relative">
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Say something..."
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-full py-2 pl-4 pr-10 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                        <button 
                            type="submit"
                            className="absolute right-1 top-1 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors"
                        >
                            <Send size={14} />
                        </button>
                    </form>
                    <div className="flex justify-between items-center mt-2 px-1">
                        <div className="flex gap-2 text-zinc-400">
                            <DollarSign size={18} className="cursor-pointer hover:text-green-500 transition-colors" onClick={() => setShowPaybill(true)} />
                            <Settings size={18} className="cursor-pointer hover:text-white transition-colors" />
                        </div>
                        <button 
                            onClick={triggerReaction}
                            className="p-1.5 bg-zinc-800 rounded-full text-red-500 hover:bg-zinc-700 hover:scale-110 transition-all"
                        >
                            <Heart size={16} fill="currentColor" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="h-screen overflow-y-auto pb-24 bg-zinc-950">
        {/* Live Section Header/Tabs */}
        <div className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30 px-4 md:px-8 pt-4 pb-0">
            <div className="flex items-center gap-6">
                <button 
                    onClick={() => setActiveTab('watch')}
                    className={`pb-4 px-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'watch' ? 'border-red-600 text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}
                >
                    <Radio size={16} /> {language === 'sw' ? 'Tazama' : 'Watch Live'}
                </button>
                <button 
                    onClick={() => setActiveTab('golive')}
                    className={`pb-4 px-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'golive' ? 'border-red-600 text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}
                >
                    <Smartphone size={16} /> {language === 'sw' ? 'Rusha Matangazo' : 'Go Live'}
                </button>
            </div>
        </div>

        <div className="p-4 md:p-6 lg:px-8">
            {activeTab === 'watch' ? <WatchLive /> : <GoLiveTools />}
        </div>
    </div>
  );
};

export default LiveSection;
