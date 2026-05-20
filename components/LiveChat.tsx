
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  author: string;
  text: string;
  ts: number;
  color: string; // deterministic avatar color from author hash
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLORS = [
  'text-red-400', 'text-orange-400', 'text-amber-400',
  'text-green-400', 'text-teal-400', 'text-blue-400',
  'text-indigo-400', 'text-violet-400', 'text-pink-400',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function colorFor(author: string): string {
  return COLORS[hashStr(author) % COLORS.length];
}

/** Persistent anonymous display name — "Mtumiaji" + 4 random digits stored in sessionStorage */
function getAnonName(): string {
  try {
    const stored = sessionStorage.getItem('tube_anon_name');
    if (stored) return stored;
    const name = 'Mtumiaji' + String(Math.floor(1000 + Math.random() * 9000));
    sessionStorage.setItem('tube_anon_name', name);
    return name;
  } catch {
    return 'Mtumiaji';
  }
}

const MAX_MESSAGES = 100;
const RATE_LIMIT_MS = 3000; // 3 seconds between messages

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Supabase channel name — one per live stream */
  channelId?: string;
  /** Collapse the panel when false (controlled from parent) */
  isOpen: boolean;
  onClose: () => void;
}

const LiveChat: React.FC<Props> = ({ channelId = 'live-chat-global', isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [lastSent, setLastSent] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const anonName = useRef(getAnonName());

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Connect / disconnect Supabase Realtime broadcast channel
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase.channel(channelId, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages(prev => {
          const next = [...prev, msg];
          return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
        });
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [isOpen, channelId]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !channelRef.current) return;

    const now = Date.now();
    if (now - lastSent < RATE_LIMIT_MS) return; // rate limit
    setLastSent(now);

    const msg: ChatMessage = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      author: anonName.current,
      text,
      ts: now,
      color: colorFor(anonName.current),
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat',
      payload: msg,
    });

    setInput('');
  }, [input, lastSent]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-red-400" />
          <span className="text-white font-bold text-sm">Live Chat</span>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
          {isConnected && <span className="text-[10px] text-green-400 font-medium">Connected</span>}
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2 no-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
              <MessageCircle size={18} className="text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-sm font-medium">Hakuna ujumbe bado</p>
            <p className="text-zinc-700 text-xs mt-1">Be the first to say something!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="group">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className={`text-[11px] font-bold flex-shrink-0 ${msg.color}`}>
                  {msg.author === anonName.current ? 'Mimi' : msg.author}
                </span>
                <span className="text-[10px] text-zinc-600">{formatTime(msg.ts)}</span>
              </div>
              <p className="text-zinc-200 text-[13px] leading-snug mt-0.5 break-words">{msg.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Input row */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? 'Andika ujumbe...' : 'Inaunganisha...'}
              disabled={!isConnected}
              maxLength={200}
              className="w-full bg-zinc-900 border border-zinc-700 hover:border-zinc-600 focus:border-zinc-500 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-colors disabled:opacity-50"
            />
            {input.length > 150 && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">
                {200 - input.length}
              </span>
            )}
          </div>
          <button
            onClick={sendMessage}
            disabled={!isConnected || !input.trim() || Date.now() - lastSent < RATE_LIMIT_MS}
            className="w-9 h-9 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-[10px] text-zinc-700 mt-1.5 px-1">
          Chatting as <span className="text-zinc-500">{anonName.current}</span>
        </p>
      </div>
    </div>
  );
};

export default LiveChat;
