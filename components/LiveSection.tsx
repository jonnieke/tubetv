import React, { useState } from 'react';
import { Radio, Calendar, Bell, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { error as logError } from '../lib/logger';

const UPCOMING = [
  { id: 1, time: '14:00', title: 'Tech Talk Kenya', user: 'Tech Weez', category: 'Technology' },
  { id: 2, time: '16:00', title: 'Sauti Sol Virtual Concert', user: 'Sauti Sol', category: 'Music' },
  { id: 3, time: '19:00', title: 'Premier League Watchalong', user: 'Carol Radull', category: 'Sports' },
];

interface LiveSectionProps {
  isAuthenticated?: boolean;
}

const LiveSection: React.FC<LiveSectionProps> = ({ isAuthenticated = false }) => {
  const [notified, setNotified] = useState<Set<number>>(new Set());
  const [notifying, setNotifying] = useState<number | null>(null);

  const handleNotify = async (id: number) => {
    if (!isAuthenticated) return;
    setNotifying(id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('live_notifications').upsert({
          user_id: userData.user.id,
          schedule_id: id,
          created_at: new Date().toISOString(),
        });
        setNotified(prev => new Set(prev).add(id));
      }
    } catch (err) {
      logError('Failed to save notification preference:', err);
    } finally {
      setNotifying(null);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-24 max-w-3xl mx-auto">
      {/* Coming Soon Banner */}
      <div className="mb-10 rounded-2xl overflow-hidden bg-gradient-to-br from-red-900/40 to-zinc-900 border border-red-500/20 p-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-red-600/20 rounded-full">
            <Radio className="w-8 h-8 text-red-400 animate-pulse" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-3">Live is Coming</h1>
        <p className="text-zinc-400 text-base max-w-md mx-auto leading-relaxed">
          Real-time streams, live chats, and events — powered by Bunny Stream RTMP.
          We're in the final stages of setup. Stay tuned.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          {['Live Streams', 'Live Chat', 'Go Live', 'M-Pesa Tips'].map(feat => (
            <span key={feat} className="px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-full border border-zinc-700">
              {feat}
            </span>
          ))}
        </div>
      </div>

      {/* Upcoming Schedule */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-zinc-800 rounded-full">
            <Calendar className="w-5 h-5 text-zinc-300" />
          </div>
          <h2 className="text-xl font-bold text-white">Upcoming Today</h2>
        </div>

        <div className="space-y-3">
          {UPCOMING.map(event => (
            <div key={event.id} className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors">
              <div className="text-center min-w-[52px]">
                <span className="text-sm font-bold text-white">{event.time}</span>
                <p className="text-[10px] text-zinc-500 uppercase">Today</p>
              </div>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{event.title}</p>
                <p className="text-xs text-zinc-500">{event.user} · {event.category}</p>
              </div>
              <button
                onClick={() => handleNotify(event.id)}
                disabled={!isAuthenticated || notified.has(event.id) || notifying === event.id}
                title={!isAuthenticated ? 'Login to get notified' : undefined}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all flex-shrink-0
                  ${notified.has(event.id)
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : isAuthenticated
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-red-600 hover:text-white border border-zinc-700'
                    : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800 cursor-not-allowed'}`}
              >
                {notifying === event.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : notified.has(event.id) ? (
                  <><CheckCircle2 className="w-3 h-3" /> Notified</>
                ) : (
                  <><Bell className="w-3 h-3" /> Notify Me</>
                )}
              </button>
            </div>
          ))}
        </div>

        {!isAuthenticated && (
          <p className="text-center text-zinc-500 text-sm mt-6">
            <span className="text-zinc-400 font-medium">Login</span> to receive notifications when streams go live.
          </p>
        )}
      </div>
    </div>
  );
};

export default LiveSection;
