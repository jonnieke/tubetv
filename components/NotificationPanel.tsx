
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, BellOff, Trash2, CheckCheck, Flame, Video, BellRing } from 'lucide-react';
import {
  TubeNotification,
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
  clearAll,
  timeAgo,
} from '../lib/notifications';
import { requestPushPermission, getPushPermission, isPushSubscribed } from '../lib/pushNotify';

interface Props {
  onNavigateVideo?: (id: string) => void;
}

const NotificationPanel: React.FC<Props> = ({ onNavigateVideo }) => {
  const [open, setOpen]               = useState(false);
  const [items, setItems]             = useState<TubeNotification[]>(getNotifications);
  const [unread, setUnread]           = useState<number>(getUnreadCount);
  const [pushPermission, setPushPermission] = useState<string>(() => getPushPermission());
  const [pushSubscribed, setPushSubscribed] = useState(() => isPushSubscribed());
  const [requestingPush, setRequestingPush] = useState(false);
  const panelRef                      = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setItems(getNotifications());
    setUnread(getUnreadCount());
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkAllRead = () => {
    markAllRead();
    refresh();
  };

  const handleClear = () => {
    clearAll();
    refresh();
  };

  const handleEnablePush = async () => {
    if (requestingPush) return;
    setRequestingPush(true);
    const result = await requestPushPermission();
    setPushPermission(result);
    if (result === 'granted') setPushSubscribed(true);
    setRequestingPush(false);
  };

  const handleClickItem = (n: TubeNotification) => {
    markRead(n.id);
    refresh();
    if (n.videoId && onNavigateVideo) {
      onNavigateVideo(n.videoId);
    }
    setOpen(false);
  };

  const TypeIcon = ({ type }: { type: TubeNotification['type'] }) => {
    if (type === 'trending') return <Flame size={10} className="text-orange-400" />;
    if (type === 'creator_upload') return <Video size={10} className="text-violet-400" />;
    return <Bell size={10} className="text-zinc-400" />;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative text-zinc-400 hover:text-white transition-colors"
        title="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-3 w-80 max-h-[480px] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[200] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-zinc-400" />
              <span className="text-white font-black text-sm">Notifications</span>
              {unread > 0 && (
                <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{unread}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-zinc-500 hover:text-green-400 transition-colors"
                  title="Mark all read"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-zinc-500 hover:text-red-400 transition-colors"
                  title="Clear all"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Push opt-in banner — show if permission not yet granted */}
          {pushPermission !== 'denied' && !pushSubscribed && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-950/40 border-b border-red-900/30">
              <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0">
                <BellRing size={14} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-bold leading-snug">Get push notifications</p>
                <p className="text-zinc-500 text-[10px]">Know when new content drops</p>
              </div>
              <button
                onClick={handleEnablePush}
                disabled={requestingPush}
                className="flex-shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-[11px] font-black rounded-lg transition-all active:scale-95"
              >
                {requestingPush ? '...' : 'Enable'}
              </button>
            </div>
          )}
          {pushSubscribed && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-950/30 border-b border-green-900/20">
              <BellRing size={12} className="text-green-400" />
              <span className="text-green-400 text-[11px] font-bold">Push notifications enabled</span>
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1 divide-y divide-zinc-800/50">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <BellOff className="w-10 h-10 text-zinc-700 mb-3" />
                <p className="text-zinc-500 text-sm font-bold">No notifications</p>
                <p className="text-zinc-700 text-xs mt-1">Follow creators to get updates when they upload</p>
              </div>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/60 transition-colors text-left ${!n.read ? 'bg-zinc-800/30' : ''}`}
                >
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-12 h-9 rounded-lg overflow-hidden bg-zinc-800">
                    {n.thumbnail ? (
                      <img src={n.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Bell size={14} className="text-zinc-600" />
                      </div>
                    )}
                    {!n.read && (
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <TypeIcon type={n.type} />
                      <span className={`text-[10px] font-bold truncate ${n.read ? 'text-zinc-500' : 'text-zinc-300'}`}>{n.title}</span>
                    </div>
                    <p className={`text-xs leading-snug line-clamp-2 ${n.read ? 'text-zinc-600' : 'text-zinc-400'}`}>{n.body}</p>
                    <p className="text-[10px] text-zinc-700 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
