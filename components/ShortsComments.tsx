import React, { useState, useEffect, useCallback } from 'react';
import { X, Send, Heart, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sanitizeText } from '../lib/sanitize';
import { error as logError } from '../lib/logger';

interface Comment {
  id: string;
  author: string;
  text: string;
  likes: number;
  created_at: string;
}

interface ShortsCommentsProps {
  isOpen: boolean;
  onClose: () => void;
  shortId: string;
  commentCount: number;
}

const ShortsComments: React.FC<ShortsCommentsProps> = ({ isOpen, onClose, shortId, commentCount }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (!shortId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('short_comments')
        .select('id, author, text, likes, created_at')
        .eq('short_id', shortId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setComments(data ?? []);
    } catch (err) {
      logError('Failed to load comments:', err);
      setLoadError('Could not load comments. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [shortId]);

  useEffect(() => {
    if (isOpen) loadComments();
  }, [isOpen, loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = sanitizeText(newComment);
    if (!text) return;

    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const author = userData?.user?.user_metadata?.phone || '@viewer';

      const { data, error } = await supabase
        .from('short_comments')
        .insert({ short_id: shortId, author, text, likes: 0 })
        .select()
        .single();

      if (error) throw error;
      setComments(prev => [data, ...prev]);
      setNewComment('');
    } catch (err) {
      logError('Failed to post comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (commentId: string, currentLikes: number) => {
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes: c.likes + 1 } : c));
    await supabase.from('short_comments').update({ likes: currentLikes + 1 }).eq('id', commentId);
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end pointer-events-none">
      <div className="flex-1" onClick={onClose} />
      <div
        className="w-full h-[70%] bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl shadow-2xl flex flex-col pointer-events-auto border-t border-white/10 animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-zinc-400" />
            <span className="font-bold text-white">{commentCount + comments.length} Comments</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6">
          {isLoading ? (
            <div className="flex justify-center pt-8">
              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
            </div>
          ) : loadError ? (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm mb-3">{loadError}</p>
              <button onClick={loadComments} className="text-red-400 text-sm hover:text-red-300">Retry</button>
            </div>
          ) : comments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2 pt-12">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <p>No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 flex items-center justify-center font-bold text-sm flex-shrink-0 text-white">
                  {comment.author.replace('@', '')[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-400">{comment.author}</span>
                    <span className="text-[10px] text-zinc-500">{formatTime(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed">{comment.text}</p>
                  <button
                    onClick={() => handleLike(comment.id, comment.likes)}
                    className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Heart className="w-3 h-3" />
                    {comment.likes}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="p-4 bg-zinc-900 border-t border-white/5 pb-8 md:pb-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-bold text-xs flex-shrink-0 text-white">Y</div>
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              maxLength={300}
              className="flex-1 bg-zinc-800 rounded-full py-2.5 px-4 text-sm text-white placeholder-zinc-500 focus:ring-1 focus:ring-red-500 outline-none"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className={`p-2 rounded-full transition-all ${newComment.trim() && !isSubmitting ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-600'}`}
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ShortsComments;
