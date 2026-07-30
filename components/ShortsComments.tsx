import React, { useState } from 'react';
import { X, Send, Heart, MoreVertical, MessageSquare } from 'lucide-react';
import { ShortComment } from '../types';

interface ShortsCommentsProps {
    isOpen: boolean;
    onClose: () => void;
    shortId: string;
    commentCount: number;
}

const MOCK_COMMENTS: ShortComment[] = [
    {
        id: 'c1',
        author: '@kenyan_vibes',
        text: 'This is exactly what Nairobi looks like on a Friday night! 🔥',
        timestamp: '2h ago',
        likes: 124,
        avatar: 'K'
    },
    {
        id: 'c2',
        author: '@chef_mambo',
        text: 'Can you share the recipe for those bhajias? They look amazing!',
        timestamp: '5h ago',
        likes: 45,
        avatar: 'C'
    },
    {
        id: 'c3',
        author: '@tech_guru',
        text: 'The production quality on these shorts is getting better and better. Keep it up!',
        timestamp: '1d ago',
        likes: 89,
        avatar: 'T'
    }
];

const ShortsComments: React.FC<ShortsCommentsProps> = ({ isOpen, onClose, shortId, commentCount }) => {
    const [comments, setComments] = useState<ShortComment[]>(MOCK_COMMENTS);
    const [newComment, setNewComment] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        const comment: ShortComment = {
            id: Date.now().toString(),
            author: '@You',
            text: newComment,
            timestamp: 'Just now',
            likes: 0,
            avatar: 'Y'
        };

        setComments([comment, ...comments]);
        setNewComment('');
    };

    if (!isOpen) return null;

    return (
        <div 
            className="absolute inset-0 z-50 flex flex-col justify-end pointer-events-none"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Backdrop for mobile feel, only active on top half */}
            <div className="flex-1" onClick={onClose} />

            {/* Comments Drawer */}
            <div 
                className="w-full h-[70%] bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl shadow-2xl flex flex-col pointer-events-auto border-t border-white/10 animate-in slide-in-from-bottom duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-zinc-400" />
                        <span className="font-bold text-white">{commentCount + (comments.length - MOCK_COMMENTS.length)} Comments</span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-zinc-400" />
                    </button>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6">
                    {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 group">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 flex items-center justify-center font-bold text-sm flex-shrink-0 text-white">
                                {comment.avatar || comment.author[1].toUpperCase()}
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-400">{comment.author}</span>
                                    <span className="text-[10px] text-zinc-500">{comment.timestamp}</span>
                                </div>
                                <p className="text-sm text-zinc-200 leading-relaxed">
                                    {comment.text}
                                </p>
                                <div className="flex items-center gap-4 pt-1">
                                    <button className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-500 transition-colors">
                                        <Heart className="w-3 h-3" />
                                        {comment.likes}
                                    </button>
                                    <button className="text-[11px] text-zinc-500 hover:text-white transition-colors">Reply</button>
                                </div>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 p-1 self-start text-zinc-500">
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    
                    {comments.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2">
                            <MessageSquare className="w-12 h-12 opacity-20" />
                            <p>No comments yet. Be the first!</p>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-zinc-900 border-t border-white/5 pb-8 md:pb-4">
                    <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-bold text-xs flex-shrink-0 text-white">
                            Y
                        </div>
                        <div className="relative flex-1">
                            <input 
                                type="text" 
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="w-full bg-zinc-800 border-none rounded-full py-2.5 px-4 text-sm text-white placeholder-zinc-500 focus:ring-1 focus:ring-red-500 transition-all outline-none"
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={!newComment.trim()}
                            className={`p-2 rounded-full transition-all ${newComment.trim() ? 'bg-red-600 text-white scale-100' : 'bg-zinc-800 text-zinc-600 scale-90'}`}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ShortsComments;
