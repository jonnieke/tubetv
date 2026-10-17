import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { type ContentRating, ratingDescription } from '../lib/contentRating';

interface Submission {
  id: string;
  series_title: string;
  season_number: number;
  episode_number: number;
  episode_title: string;
  synopsis?: string;
  raw_video_url: string;
  thumbnail_url?: string;
  intro_end_seconds?: number;
  outro_start_seconds?: number;
  kfcb_rating: ContentRating;
  status: string;
  created_at: string;
}

export const ModerationQueue: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignedRating, setAssignedRating] = useState<ContentRating>('GE');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_submissions')
        .select('*')
        .eq('status', 'review_pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSubmissions(data || []);
      if (data && data.length > 0 && !selectedSub) {
        setSelectedSub(data[0]);
        setAssignedRating((data[0].kfcb_rating as ContentRating) || 'GE');
      }
    } catch {
      // Local/mock fallback when Supabase is disconnected
      const mockQueue: Submission[] = [
        {
          id: 'sub-001',
          series_title: 'Nairobi Hustle',
          season_number: 1,
          episode_number: 1,
          episode_title: 'The CBD Meeting',
          synopsis: 'A young tech graduate lands a mysterious interview in downtown Nairobi.',
          raw_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnail_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
          intro_end_seconds: 4,
          outro_start_seconds: 90,
          kfcb_rating: 'GE',
          status: 'review_pending',
          created_at: new Date().toISOString(),
        },
      ];
      setSubmissions(mockQueue);
      setSelectedSub(mockQueue[0]);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!selectedSub) return;
    setIsProcessing(true);
    setActionMessage(null);

    try {
      const { data, error } = await supabase.rpc('publish_content_submission', {
        p_submission_id: selectedSub.id,
        p_decision: decision,
        p_kfcb_rating: assignedRating,
        p_notes: reviewNotes,
      });

      if (error) {
        // Fallback for mock environment
        setActionMessage({
          type: 'success',
          text: `Submission #${selectedSub.id.slice(0, 8)} marked ${decision} (Local Simulation).`,
        });
      } else {
        setActionMessage({
          type: 'success',
          text: `Submission successfully ${decision}.`,
        });
      }

      // Remove from list
      setSubmissions((prev) => prev.filter((s) => s.id !== selectedSub.id));
      setSelectedSub(null);
      setReviewNotes('');
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Operation failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Editorial Gatekeeper & KFCB Compliance
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Content Moderation & Ingestion</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review creator submissions, verify vertical formatting, assign KFCB ratings, and approve to live catalogue.
          </p>
        </div>

        <button
          onClick={loadQueue}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-slate-300 transition flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Queue
        </button>
      </div>

      {actionMessage && (
        <div
          className={`mt-4 p-4 rounded-xl text-sm font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="my-16 text-center text-slate-500">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center text-2xl">
            ✨
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Moderation Queue is Clear</h3>
          <p className="text-sm max-w-sm mx-auto">
            All creator uploads have been reviewed and published. New submissions will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6">
          {/* Submissions List (Left 4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 px-1">
              Pending Submissions ({submissions.length})
            </h3>
            {submissions.map((sub) => {
              const isSelected = selectedSub?.id === sub.id;
              return (
                <div
                  key={sub.id}
                  onClick={() => {
                    setSelectedSub(sub);
                    setAssignedRating((sub.kfcb_rating as ContentRating) || 'GE');
                  }}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex gap-3 ${
                    isSelected
                      ? 'bg-white/10 border-red-500/80 shadow-lg'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="w-16 h-24 bg-slate-900 rounded-lg overflow-hidden shrink-0 border border-white/10">
                    {sub.thumbnail_url ? (
                      <img src={sub.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">
                        9:16
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                    <div>
                      <div className="text-xs font-bold text-red-400">
                        {sub.series_title} • S{sub.season_number}E{sub.episode_number}
                      </div>
                      <div className="text-sm font-semibold text-white truncate mt-0.5">
                        {sub.episode_title}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-snug">
                        {sub.synopsis || 'No synopsis provided.'}
                      </p>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(sub.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Review & Decision Panel (Right 8 cols) */}
          {selectedSub && (
            <div className="lg:col-span-8 bg-white/[0.02] border border-white/10 rounded-2xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 9:16 Video Player Preview */}
                <div className="flex flex-col items-center">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 self-start">
                    Player Verification (9:16 Aspect)
                  </div>
                  <div className="w-full max-w-[240px] aspect-[9/16] bg-black rounded-2xl overflow-hidden border border-white/20 shadow-2xl relative">
                    <video
                      src={selectedSub.raw_video_url}
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Metadata & Decision Form */}
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedSub.episode_title}</h2>
                    <p className="text-xs text-red-400 font-semibold mt-0.5">
                      {selectedSub.series_title} — Season {selectedSub.season_number}, Episode {selectedSub.episode_number}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Synopsis
                    </label>
                    <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl leading-relaxed">
                      {selectedSub.synopsis || 'No synopsis provided by creator.'}
                    </p>
                  </div>

                  {/* KFCB Rating Selector */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      KFCB Content Rating
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['GE', 'PG', '16', '18'] as ContentRating[]).map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setAssignedRating(rating)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                            assignedRating === rating
                              ? 'bg-red-600 text-white border-red-500'
                              : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/30'
                          }`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 italic">
                      {ratingDescription(assignedRating)}
                    </p>
                  </div>

                  {/* Editorial Notes */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Editorial Feedback / Rejection Reason
                    </label>
                    <textarea
                      rows={3}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add notes for the creator (required if rejecting)..."
                      className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={() => handleDecision('approved')}
                      disabled={isProcessing}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {isProcessing ? 'Publishing...' : 'Approve & Publish'}
                    </button>
                    <button
                      onClick={() => handleDecision('rejected')}
                      disabled={isProcessing || !reviewNotes.trim()}
                      className="px-5 py-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold text-xs uppercase tracking-wider transition disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
