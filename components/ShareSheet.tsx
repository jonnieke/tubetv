
import React, { useState } from 'react';
import { X, Copy, Check, MessageCircle } from 'lucide-react';
import {
  buildShareUrl, buildShareText,
  openWhatsApp, openTwitter, openFacebook, copyToClipboard,
} from '../lib/share';

interface Props {
  videoId: string;
  title: string;
  thumbnail?: string;
  currentTime?: number;
  onClose: () => void;
}

const ShareSheet: React.FC<Props> = ({ videoId, title, thumbnail, currentTime = 0, onClose }) => {
  const [copied, setCopied] = useState(false);

  const url  = buildShareUrl(videoId, currentTime);
  const text = buildShareText(title, url);

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const TARGETS = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: (
        // WhatsApp brand SVG (single path)
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
      bg: 'bg-[#25D366]/15 hover:bg-[#25D366]/25',
      color: 'text-[#25D366]',
      action: () => openWhatsApp(text),
    },
    {
      id: 'twitter',
      label: 'X (Twitter)',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 5.676zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      bg: 'bg-zinc-100/10 hover:bg-zinc-100/15',
      color: 'text-white',
      action: () => openTwitter(`Tazama "${title}" kwenye Tube TV 🇰🇪`, url),
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      bg: 'bg-[#1877F2]/15 hover:bg-[#1877F2]/25',
      color: 'text-[#1877F2]',
      action: () => openFacebook(url),
    },
  ] as const;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-zinc-900 border border-zinc-700/60 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-250"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-zinc-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            {thumbnail && (
              <img src={thumbnail} alt="" onError={e => { e.currentTarget.style.opacity = '0'; }} className="w-10 h-7 rounded-lg object-cover flex-shrink-0 bg-zinc-800" />
            )}
            <div className="min-w-0">
              <p className="text-white font-black text-sm leading-tight truncate">{title}</p>
              <p className="text-zinc-500 text-[11px] truncate">{url.replace(/^https?:\/\//, '')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors flex-shrink-0 ml-2">
            <X size={18} />
          </button>
        </div>

        {/* Share targets */}
        <div className="px-5 py-4">
          <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest mb-3">Share via</p>
          <div className="flex gap-3 mb-4">
            {TARGETS.map(t => (
              <button
                key={t.id}
                onClick={() => { t.action(); onClose(); }}
                className={`flex-1 flex flex-col items-center gap-2 py-3.5 rounded-2xl ${t.bg} ${t.color} transition-all active:scale-95`}
              >
                {t.icon}
                <span className="text-[10px] font-bold">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Copy link */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 rounded-2xl transition-all group"
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${copied ? 'bg-green-500/20' : 'bg-zinc-700 group-hover:bg-zinc-600'}`}>
              {copied
                ? <Check size={15} className="text-green-400" />
                : <Copy size={15} className="text-zinc-400" />
              }
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-white text-sm font-bold">{copied ? 'Copied!' : 'Copy link'}</p>
              <p className="text-zinc-500 text-[11px] truncate">{url}</p>
            </div>
            {copied && <span className="text-green-400 text-xs font-bold flex-shrink-0">✓</span>}
          </button>

          {/* SMS / Messages */}
          <button
            onClick={() => {
              window.open(`sms:?body=${encodeURIComponent(text)}`, '_self');
              onClose();
            }}
            className="mt-2.5 w-full flex items-center gap-3 px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-2xl transition-all"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <MessageCircle size={15} className="text-blue-400" />
            </div>
            <p className="text-white text-sm font-bold">Send via SMS</p>
          </button>
        </div>

        <div className="h-safe-area-bottom" />
      </div>
    </div>
  );
};

export default ShareSheet;
