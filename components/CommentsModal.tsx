
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, ThumbsUp, MessageCircle, User } from 'lucide-react';
import {
  VideoComment,
  getComments,
  addComment,
  toggleCommentLike,
  commentTimeAgo,
  getDeviceId,
} from '../lib/videoComments';

interface Props {
  videoId: string;
  videoTitle: string;
  authorName?: string; // logged-in user display name
  onClose: () => void;
}

// Deterministic avatar colour from name
const AVATAR_COLORS = ['bg-red-600', 'bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-amber-500', 'bg-teal-600'];
const avatarColor = (name: string) =>
  AVATAR_COLORS[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const initials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const CommentsModal: React.FC<Props> = ({ videoId, videoTitle, authorName, onClose }) => {
  const [comments, setComments] = useState<VideoComment[]>(() => getComments(videoId));
  const [text, setText]         = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
    const deviceId = getDeviceId();
    return new Set(getComments(videoId).filter(c => c.likedBy.includes(deviceId)).map(c => c.id));
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const refresh = () => {
    const fresh = getComments(videoId);
    setComments(fresh);
    const deviceId = getDeviceId();
    setLikedIds(new Set(fresh.filter(c => c.likedBy.includes(deviceId)).map(c => c.id)));
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    addComment(videoId, text, authorName || 'Guest');
    setText('');
    refresh();
  };

  const handleLike = (id: string) => {
    toggleCommentLike(id);
    refresh();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle size={15} className="text-zinc-400" />
            <span className="text-white font-black text-sm">Comments</span>
            <span className="text-zinc-600 text-xs">· {comments.length}</span>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Video title */}
        <div className="px-4 py-2 border-b border-zinc-800/50 flex-shrink-0">
          <p className="text-zinc-500 text-xs truncate">{videoTitle}</p>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageCircle className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-zinc-500 text-sm font-bold">No comments yet</p>
              <p className="text-zinc-700 text-xs mt-1">Be the first to share your thoughts!</p>
            </div>
          ) : (
            comments.map(c => (
              <div key={c.id} className="flex gap-3 px-4 py-3">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full ${avatarColor(c.author)} flex items-center justify-center flex-shrink-0 text-white text-xs font-black`}>
                  {initials(c.author)}
                </div>
                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-zinc-300 text-xs font-bold">{c.author}</span>
                    <span className="text-zinc-700 text-[10px]">{commentTimeAgo(c.createdAt)}</span>
                  </div>
                  <p className="text-zinc-400 text-sm mt-0.5 leading-relaxed break-words">{c.text}</p>
                  <button
                    onClick={() => handleLike(c.id)}
                    className={`mt-1.5 flex items-center gap-1 text-[11px] font-bold transition-colors ${likedIds.has(c.id) ? 'text-green-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                  >
                    <ThumbsUp size={11} className={likedIds.has(c.id) ? 'fill-green-400' : ''} />
                    {c.likes > 0 && <span>{c.likes}</span>}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800 px-4 py-3 flex gap-3 items-end flex-shrink-0">
          <div className={`w-8 h-8 rounded-full ${avatarColor(authorName || 'Guest')} flex items-center justify-center flex-shrink-0 text-white text-xs font-black`}>
            {authorName ? initials(authorName) : <User size={14} />}
          </div>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Add a comment…"
            rows={1}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="w-9 h-9 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send size={15} className="text-white ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentsModal;
