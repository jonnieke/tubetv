import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  ChevronUp,
  Heart,
  ListVideo,
  Lock,
  MessageCircle,
  Play,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import type { Video } from '../types';
import { buildComingSoonSchedule, isMicroDrama, isNewEpisode } from '../lib/series';
import { getFreeEpisodeCount } from '../lib/monetization';
import {
  fetchEpisodeEngagement,
  fetchEpisodePoll,
  getSavedViewerHandle,
  postEpisodeComment,
  toggleEpisodeLike,
  voteEpisodePoll,
  type EpisodeComment,
  type EpisodePollStats,
  type EpisodeReaction,
  type PollChoice,
} from '../lib/engagement';
import { trackEvent } from '../lib/analytics';

interface MicroDramaPlayerLayoutProps {
  activeVideo: Video;
  episodes: Video[];
  hasActivePass: boolean;
  isWatchLater: boolean;
  modalAutoPlay: boolean;
  language: string;
  isLocked: (video: Video) => boolean;
  onSelectEpisode: (video: Video) => void;
  onStartPlayback: () => void;
  onToggleWatchLater: (videoId: string) => void;
  onShare: (video: Video) => void;
  onOpenTrailer?: (url: string) => void;
  onClose: () => void;
  showEndedRecommendations?: boolean;
  recommendedVideos?: Video[];
  onSelectRecommended?: (video: Video) => void;
  onReplay?: () => void;
  playerSlot: React.ReactNode;
}

const PAGE_SIZE = 30;

const REACTION_CHIPS: Array<{ id: EpisodeReaction; emoji: string; label: string }> = [
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'shock', emoji: '😱', label: 'Twist!' },
  { id: 'cry', emoji: '😭', label: 'Emotional' },
  { id: 'heart', emoji: '❤️', label: 'Love it' },
];

function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTimeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export const MicroDramaPlayerLayout: React.FC<MicroDramaPlayerLayoutProps> = ({
  activeVideo,
  episodes,
  hasActivePass,
  isWatchLater,
  modalAutoPlay,
  language,
  isLocked,
  onSelectEpisode,
  onStartPlayback,
  onToggleWatchLater,
  onShare,
  onOpenTrailer,
  onClose,
  showEndedRecommendations = false,
  recommendedVideos = [],
  onSelectRecommended,
  onReplay,
  playerSlot,
}) => {
  const [plotExpanded, setPlotExpanded] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [dismissedForVideoId, setDismissedForVideoId] = useState<string | null>(null);
  const [mobileSheet, setMobileSheet] = useState<'none' | 'episodes' | 'comments'>('none');
  const [desktopTab, setDesktopTab] = useState<'episodes' | 'comments'>('episodes');
  // Mount playerSlot ONLY in the active viewport layout (never mount both mobile & desktop <video> elements!)
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktopLayout(e.matches);
    setIsDesktopLayout(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Real engagement state (Supabase-backed with optimistic local fallback)
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<EpisodeComment[]>([]);
  const [commentAuthor, setCommentAuthor] = useState(() => getSavedViewerHandle());
  const [commentBody, setCommentBody] = useState('');
  const [selectedReaction, setSelectedReaction] = useState<EpisodeReaction | undefined>(undefined);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [pollStats, setPollStats] = useState<EpisodePollStats>({ yesVotes: 0, noVotes: 0 });

  // Touch swipe tracking for DramaBox-style vertical episode navigation on mobile
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    setDismissedForVideoId(null);
    setPlotExpanded(false);
    setMobileSheet('none');
  }, [activeVideo.id]);

  useEffect(() => {
    let active = true;
    fetchEpisodeEngagement(activeVideo.id).then((res) => {
      if (!active) return;
      setIsLiked(res.isLiked);
      setLikeCount(res.likeCount);
      setComments(res.comments);
    });
    fetchEpisodePoll(activeVideo.id).then((res) => {
      if (!active) return;
      setPollStats(res);
    });
    return () => {
      active = false;
    };
  }, [activeVideo.id]);

  const handleVotePoll = (choice: PollChoice) => {
    setPollStats((prev) => {
      if (prev.userChoice === choice) return prev;
      const yesVotes =
        prev.yesVotes + (choice === 'yes' ? 1 : 0) - (prev.userChoice === 'yes' ? 1 : 0);
      const noVotes =
        prev.noVotes + (choice === 'no' ? 1 : 0) - (prev.userChoice === 'no' ? 1 : 0);
      return {
        yesVotes: Math.max(0, yesVotes),
        noVotes: Math.max(0, noVotes),
        userChoice: choice,
      };
    });
    void voteEpisodePoll(activeVideo.id, choice);
  };

  const handleToggleLike = () => {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    void toggleEpisodeLike(activeVideo.id, nextLiked);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || isPostingComment) return;
    setIsPostingComment(true);
    try {
      const created = await postEpisodeComment({
        videoId: activeVideo.id,
        seriesId: activeVideo.seriesId || activeVideo.seriesTitle,
        authorName: commentAuthor || 'TubeTV Fan',
        body: commentBody,
        reaction: selectedReaction,
      });
      if (created) {
        setComments((prev) => [created, ...prev]);
        setCommentBody('');
        setSelectedReaction(undefined);
        trackEvent('episode_comment_posted', {
          videoId: activeVideo.id,
          reaction: created.reaction || 'none',
        });
      }
    } finally {
      setIsPostingComment(false);
    }
  };

  const activeIdx = Math.max(
    0,
    episodes.findIndex((ep) => ep.id === activeVideo.id),
  );
  const prevEp = activeIdx > 0 ? episodes[activeIdx - 1] : undefined;
  const nextEp = activeIdx >= 0 && activeIdx < episodes.length - 1 ? episodes[activeIdx + 1] : undefined;

  const defaultRangeStart = Math.floor(activeIdx / PAGE_SIZE) * PAGE_SIZE;
  const [rangeStart, setRangeStart] = useState(defaultRangeStart);

  useEffect(() => {
    setRangeStart(Math.floor(activeIdx / PAGE_SIZE) * PAGE_SIZE);
  }, [activeIdx]);

  const pageCount = Math.max(1, Math.ceil(episodes.length / PAGE_SIZE));
  const safeStart = rangeStart < episodes.length ? rangeStart : 0;
  const visibleEpisodes =
    episodes.length > PAGE_SIZE ? episodes.slice(safeStart, safeStart + PAGE_SIZE) : episodes;

  const upcomingSlots = useMemo(() => buildComingSoonSchedule(episodes, 60), [episodes]);

  const seriesName = activeVideo.seriesTitle || activeVideo.title;
  const epNum = activeVideo.episode || activeIdx + 1;
  const freeEpCount = getFreeEpisodeCount(activeVideo, episodes.length);
  const plotText =
    activeVideo.episodeSynopsis ||
    activeVideo.description ||
    activeVideo.seriesSynopsis ||
    '';

  const topSixRecommended = useMemo(() => recommendedVideos.slice(0, 6), [recommendedVideos]);
  const isRecommendedModalOpen =
    Boolean(showEndedRecommendations) &&
    topSixRecommended.length > 0 &&
    dismissedForVideoId !== activeVideo.id;

  useEffect(() => {
    if (!isRecommendedModalOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setDismissedForVideoId(activeVideo.id);
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isRecommendedModalOpen, activeVideo.id]);

  // Keyboard up/down navigation for bingeing when not typing in comment inputs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.key === 'ArrowDown' || e.key === 'j') && nextEp) {
        e.preventDefault();
        trackEvent('microdrama_swipe_next', {
          fromVideoId: activeVideo.id,
          toVideoId: nextEp.id,
          input: 'keyboard',
        });
        onSelectEpisode(nextEp);
      } else if ((e.key === 'ArrowUp' || e.key === 'k') && prevEp) {
        e.preventDefault();
        onSelectEpisode(prevEp);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeVideo.id, nextEp, prevEp, onSelectEpisode]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (mobileSheet !== 'none') return;
    const t = e.touches[0];
    touchStartYRef.current = t.clientY;
    touchStartXRef.current = t.clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (mobileSheet !== 'none' || touchStartYRef.current === null || touchStartXRef.current === null) return;
    const t = e.changedTouches[0];
    const deltaY = touchStartYRef.current - t.clientY;
    const deltaX = Math.abs(touchStartXRef.current - t.clientX);
    touchStartYRef.current = null;
    touchStartXRef.current = null;

    // Require clear vertical swipe (avoid accidental taps or horizontal scrubs)
    if (Math.abs(deltaY) < 60 || deltaX > Math.abs(deltaY) * 0.8) return;

    if (deltaY > 0 && nextEp) {
      trackEvent('microdrama_swipe_next', {
        fromVideoId: activeVideo.id,
        toVideoId: nextEp.id,
        input: 'touch_swipe_up',
      });
      onSelectEpisode(nextEp);
    } else if (deltaY < 0 && prevEp) {
      onSelectEpisode(prevEp);
    }
  };

  const pills = useMemo(() => {
    const raw: string[] = [];
    if (activeVideo.genre) {
      activeVideo.genre.split(',').forEach((g) => {
        const clean = g.trim();
        if (clean) raw.push(clean);
      });
    }
    if (activeVideo.contentRating && activeVideo.contentRating !== 'UNRATED') {
      raw.push(activeVideo.contentRating);
    }
    raw.push('Micro Drama');
    if (activeVideo.author) raw.push(activeVideo.author);
    (activeVideo.tags || []).forEach((t) => {
      const clean = t.trim();
      if (clean && !raw.some((x) => x.toLowerCase() === clean.toLowerCase())) {
        raw.push(clean);
      }
    });
    return raw.slice(0, 6);
  }, [activeVideo]);

  const firstEp = episodes[0];

  const renderEpisodeGrid = (compact = false) => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {Array.from({ length: pageCount }).map((_, idx) => {
            const start = idx * PAGE_SIZE;
            const end = Math.min(start + PAGE_SIZE, episodes.length);
            const active = !showComingSoon && safeStart === start;
            return (
              <button
                key={start}
                type="button"
                onClick={() => {
                  setShowComingSoon(false);
                  setRangeStart(start);
                }}
                className={`text-sm font-bold transition-colors pb-1 border-b-2 ${
                  active
                    ? 'text-white border-red-500'
                    : 'text-zinc-400 border-transparent hover:text-zinc-200'
                }`}
              >
                {start + 1} - {end}
              </button>
            );
          })}
          {upcomingSlots.length > 0 && (
            <button
              type="button"
              onClick={() => setShowComingSoon((v) => !v)}
              className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${
                showComingSoon
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              Coming Soon ({upcomingSlots.length})
            </button>
          )}
        </div>

        {firstEp && !compact && (
          <button
            type="button"
            onClick={() => {
              setShowComingSoon(false);
              setRangeStart(0);
              onSelectEpisode(firstEp);
            }}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            <span>All Episodes ({episodes.length})</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {!showComingSoon ? (
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
          {activeVideo.seriesTrailerUrl && safeStart === 0 && onOpenTrailer && (
            <button
              type="button"
              onClick={() => onOpenTrailer(activeVideo.seriesTrailerUrl!)}
              className="relative h-12 rounded-lg border border-zinc-800 bg-zinc-900/90 hover:border-zinc-600 text-xs font-bold text-zinc-200 flex items-center justify-center transition-colors"
            >
              Trailer
            </button>
          )}
          {visibleEpisodes.map((ep) => {
            const locked = isLocked(ep);
            const isCurrent = ep.id === activeVideo.id;
            const isNew = isNewEpisode(ep);
            return (
              <button
                key={ep.id}
                type="button"
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => {
                  setMobileSheet('none');
                  onSelectEpisode(ep);
                }}
                className={`relative h-12 rounded-lg border text-sm font-bold flex items-center justify-center transition-all ${
                  isCurrent
                    ? 'bg-red-600/20 border-red-500 text-red-400 shadow-sm shadow-red-600/20'
                    : 'bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:border-zinc-600 hover:text-white'
                }`}
              >
                <span>{ep.episode || 1}</span>
                {locked && (
                  <Lock
                    size={11}
                    className="absolute top-1.5 right-1.5 text-zinc-400"
                    aria-label="Locked"
                  />
                )}
                {isNew && !locked && (
                  <span
                    className="absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400"
                    title="New"
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
          {upcomingSlots.map((slot) => (
            <div
              key={`${slot.season}-${slot.episode}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs"
            >
              <div className="font-bold text-white">
                S{slot.season} · Ep {slot.episode}
              </div>
              <div className="text-[11px] text-amber-300/90 mt-0.5">{slot.releaseDate}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCliffhangerPoll = () => {
    const totalVotes = pollStats.yesVotes + pollStats.noVotes;
    const yesPct = totalVotes > 0 ? Math.round((pollStats.yesVotes / totalVotes) * 100) : 50;
    const noPct = totalVotes > 0 ? 100 - yesPct : 50;
    const voted = Boolean(pollStats.userChoice);

    return (
      <div className="rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-950/30 via-zinc-900/90 to-zinc-950 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-rose-300">
            {language === 'sw' ? `Kura ya Kipindi ${epNum}` : `Ep ${epNum} Cliffhanger Verdict`}
          </p>
          {totalVotes > 0 && (
            <span className="text-[10px] font-semibold text-zinc-400">
              {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
            </span>
          )}
        </div>
        <p className="text-xs font-semibold text-white">
          {language === 'sw'
            ? 'Je, mabadiliko ya kipindi hiki yalikushangaza?'
            : 'Did this episode twist catch you off guard?'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleVotePoll('yes')}
            aria-pressed={pollStats.userChoice === 'yes'}
            className={`relative overflow-hidden rounded-lg border px-3 py-2 text-left text-xs font-bold transition-all ${
              pollStats.userChoice === 'yes'
                ? 'border-rose-500 bg-rose-600/25 text-white'
                : 'border-zinc-800 bg-zinc-900/90 text-zinc-200 hover:border-rose-500/50'
            }`}
          >
            {voted && (
              <span
                className="pointer-events-none absolute inset-y-0 left-0 bg-rose-500/20 transition-all duration-500"
                style={{ width: `${yesPct}%` }}
              />
            )}
            <span className="relative z-10 flex items-center justify-between gap-1">
              <span>🔥 {language === 'sw' ? 'Ndiyo!' : 'Shook!'}</span>
              {voted && <span className="text-[11px] text-rose-300">{yesPct}%</span>}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleVotePoll('no')}
            aria-pressed={pollStats.userChoice === 'no'}
            className={`relative overflow-hidden rounded-lg border px-3 py-2 text-left text-xs font-bold transition-all ${
              pollStats.userChoice === 'no'
                ? 'border-sky-500 bg-sky-600/25 text-white'
                : 'border-zinc-800 bg-zinc-900/90 text-zinc-200 hover:border-sky-500/50'
            }`}
          >
            {voted && (
              <span
                className="pointer-events-none absolute inset-y-0 left-0 bg-sky-500/20 transition-all duration-500"
                style={{ width: `${noPct}%` }}
              />
            )}
            <span className="relative z-10 flex items-center justify-between gap-1">
              <span>🧊 {language === 'sw' ? 'Nilijua' : 'Saw it'}</span>
              {voted && <span className="text-[11px] text-sky-300">{noPct}%</span>}
            </span>
          </button>
        </div>
        {voted && (
          <button
            type="button"
            onClick={() => onShare(activeVideo)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 py-1.5 text-[11px] font-bold text-emerald-300 transition-colors"
          >
            <Share2 size={12} />
            <span>
              {language === 'sw' ? 'Shiriki maoni yako WhatsApp' : 'Share this cliffhanger on WhatsApp'}
            </span>
          </button>
        )}
      </div>
    );
  };

  const renderCommentsPanel = () => (
    <div className="space-y-3">
      {renderCliffhangerPoll()}
      {/* Quick Reaction Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {REACTION_CHIPS.map((chip) => {
          const active = selectedReaction === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSelectedReaction(active ? undefined : chip.id)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                active
                  ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <span>{chip.emoji}</span>
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* Post Comment Form */}
      <form onSubmit={handlePostComment} className="space-y-2">
        <input
          type="text"
          value={commentAuthor}
          onChange={(e) => setCommentAuthor(e.target.value)}
          placeholder={language === 'sw' ? 'Jina lako (hiari)' : 'Your name (optional)'}
          maxLength={32}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-rose-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder={
              language === 'sw'
                ? `Toa maoni yako kuhusu Kipindi ${epNum}...`
                : `React to Episode ${epNum} cliffhanger...`
            }
            maxLength={280}
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-rose-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!commentBody.trim() || isPostingComment}
            aria-label="Post comment"
            className="inline-flex items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 px-3.5 py-2 text-xs font-bold text-white transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">
            {language === 'sw'
              ? 'Kuwa wa kwanza kutoa maoni kuhusu kipindi hiki!'
              : 'Be the first to react to this cliffhanger!'}
          </p>
        ) : (
          comments.map((c) => {
            const reactionEmoji = REACTION_CHIPS.find((r) => r.id === c.reaction)?.emoji;
            return (
              <div
                key={c.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-2 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-zinc-200 truncate">
                    {reactionEmoji ? `${reactionEmoji} ` : ''}
                    {c.authorName}
                  </span>
                  <span className="text-[10px] text-zinc-500 shrink-0">{formatTimeAgo(c.createdAt)}</span>
                </div>
                <p className="text-zinc-300 leading-relaxed break-words">{c.body}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ─── MOBILE FULL-SCREEN 100dvh SWIPE-UP BINGE STAGE (< lg) ─── */}
      <div
        className="lg:hidden relative h-[100dvh] w-full bg-black text-white overflow-hidden flex flex-col justify-center"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Floating Bar */}
        <div className="pointer-events-none absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-black/85 via-black/40 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6">
          <div className="pointer-events-auto flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back to browsing"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white active:scale-95 transition"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-tight text-white truncate">{seriesName}</p>
              <p className="text-[11px] font-semibold text-zinc-300">
                Ep {epNum} / {episodes.length}
                {!hasActivePass ? ` · Ep 1–${freeEpCount} Free` : ' · Pass Active'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileSheet('episodes')}
            className="pointer-events-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white"
          >
            <ListVideo size={13} className="text-rose-400" />
            <span>
              {epNum}/{episodes.length}
            </span>
          </button>
        </div>

        {/* Center Edge-to-Edge Vertical Video Stage */}
        <div className="relative flex-1 flex items-center justify-center w-full h-full bg-black">
          <div className="w-full max-w-[460px] mx-auto">{!isDesktopLayout ? playerSlot : null}</div>
        </div>

        {/* Right-Edge Floating Vertical Action Rail (DramaBox / TikTok style) */}
        <div className="absolute right-2.5 bottom-36 z-30 flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleLike}
            aria-pressed={isLiked}
            aria-label="Like episode"
            className="flex flex-col items-center gap-0.5 text-white active:scale-90 transition"
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md border ${
                isLiked
                  ? 'bg-rose-600/30 border-rose-500/70 text-rose-400'
                  : 'bg-black/55 border-white/15 text-white'
              }`}
            >
              <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
            </span>
            <span className="text-[10px] font-bold drop-shadow">{formatCompactCount(likeCount)}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileSheet('comments')}
            aria-label="Episode comments"
            className="flex flex-col items-center gap-0.5 text-white active:scale-90 transition"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white">
              <MessageCircle size={18} />
            </span>
            <span className="text-[10px] font-bold drop-shadow">{formatCompactCount(comments.length)}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleWatchLater(activeVideo.id)}
            aria-label={isWatchLater ? 'Remove from saved' : 'Save episode'}
            className="flex flex-col items-center gap-0.5 text-white active:scale-90 transition"
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md border ${
                isWatchLater
                  ? 'bg-amber-500/25 border-amber-400/70 text-amber-300'
                  : 'bg-black/55 border-white/15 text-white'
              }`}
            >
              <Bookmark size={18} fill={isWatchLater ? 'currentColor' : 'none'} />
            </span>
            <span className="text-[10px] font-bold drop-shadow">{isWatchLater ? 'Saved' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={() => onShare(activeVideo)}
            aria-label="Share on WhatsApp"
            className="flex flex-col items-center gap-0.5 text-white active:scale-90 transition"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white">
              <Share2 size={18} />
            </span>
            <span className="text-[10px] font-bold drop-shadow">Share</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileSheet('episodes')}
            aria-label="All episodes"
            className="flex flex-col items-center gap-0.5 text-white active:scale-90 transition"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-white">
              <ListVideo size={18} />
            </span>
            <span className="text-[10px] font-bold drop-shadow">Eps</span>
          </button>
        </div>

        {/* Bottom-Left Hook & Next Episode Controls */}
        <div className="pointer-events-none absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3.5 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))] pr-16">
          <div className="pointer-events-auto space-y-2">
            {plotText && (
              <div>
                <p
                  onClick={() => setPlotExpanded((v) => !v)}
                  className={`text-xs leading-snug text-zinc-200 drop-shadow cursor-pointer ${
                    plotExpanded ? '' : 'line-clamp-2'
                  }`}
                >
                  {plotText}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {!modalAutoPlay && (
                <button
                  type="button"
                  onClick={onStartPlayback}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-lg"
                >
                  <Play size={13} fill="currentColor" />
                  <span>{language === 'sw' ? 'Tazama' : 'Watch Now'}</span>
                </button>
              )}

              {nextEp && (
                <button
                  type="button"
                  onClick={() => {
                    trackEvent('microdrama_swipe_next', {
                      fromVideoId: activeVideo.id,
                      toVideoId: nextEp.id,
                      input: 'mobile_next_pill',
                    });
                    onSelectEpisode(nextEp);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 px-3 py-1.5 text-xs font-bold text-white"
                >
                  {isLocked(nextEp) ? (
                    <Lock size={12} className="text-amber-300" />
                  ) : (
                    <ChevronUp size={13} className="text-emerald-300" />
                  )}
                  <span>
                    {language === 'sw'
                      ? `Kipindi ${nextEp.episode || epNum + 1}`
                      : `Next: Ep ${nextEp.episode || epNum + 1}`}
                  </span>
                </button>
              )}

              {nextEp && (
                <span className="text-[10px] font-medium text-zinc-400">
                  ↑ {language === 'sw' ? 'Vuta juu' : 'Swipe up'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Slide-Up Bottom Sheet: Episodes OR Comments */}
        {mobileSheet !== 'none' && (
          <div
            className="fixed inset-0 z-40 flex items-end bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileSheet('none')}
          >
            <div
              className="w-full max-h-[75dvh] overflow-y-auto rounded-t-3xl border-t border-zinc-800 bg-[#111116] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto h-1 w-10 rounded-full bg-zinc-700" />
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-black text-white">
                    {mobileSheet === 'episodes'
                      ? `${seriesName} (${episodes.length} Eps)`
                      : `Episode ${epNum} Comments (${comments.length})`}
                  </h2>
                  {mobileSheet === 'episodes' && !hasActivePass && (
                    <p className="text-[11px] text-emerald-400 font-semibold">
                      {language === 'sw'
                        ? `Vipindi 1–${freeEpCount} ni bure`
                        : `Episodes 1–${freeEpCount} Free · Unlock all from KSh 10`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Close drawer"
                  onClick={() => setMobileSheet('none')}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300"
                >
                  <X size={15} />
                </button>
              </div>
              {mobileSheet === 'episodes' ? renderEpisodeGrid(true) : renderCommentsPanel()}
            </div>
          </div>
        )}
      </div>

      {/* ─── DESKTOP 2-COLUMN CINEMA STAGE (lg+) ─── */}
      <div
        className="hidden lg:grid relative w-full max-w-6xl max-h-[94dvh] overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#0b0b0e] text-white shadow-2xl grid-cols-[minmax(320px,430px)_1fr]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Vertical 9:16 Stage */}
        <div className="relative flex items-center justify-center bg-[#060608] p-5 border-r border-zinc-800/80">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to browsing"
            className="absolute top-3 left-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/90 border border-zinc-700/80 text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="w-full max-w-[360px] mx-auto rounded-xl overflow-hidden shadow-2xl border border-zinc-800/70 bg-black">
            {isDesktopLayout ? playerSlot : null}
          </div>
        </div>

        {/* Right: Metadata, Actions, Episode Grid & Live Comments */}
        <div className="flex flex-col max-h-[94dvh] overflow-y-auto bg-[#101014] p-6 space-y-5">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-zinc-400 flex-wrap">
            <button type="button" onClick={onClose} className="hover:text-white transition-colors">
              Home
            </button>
            <span>/</span>
            <span className="text-zinc-300 truncate max-w-[180px]">{seriesName}</span>
            <span>/</span>
            <span className="text-white font-semibold">Episode {epNum}</span>
            {!hasActivePass && (
              <span className="ml-auto rounded-full bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                Ep 1–{freeEpCount} Free
              </span>
            )}
          </nav>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white leading-snug">
              Episode {epNum} - {seriesName}
              {activeVideo.title && activeVideo.title !== seriesName ? ` · ${activeVideo.title}` : ''}
            </h1>
          </div>

          {/* Plot */}
          {plotText && (
            <div className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {language === 'sw' ? `Muhtasari wa Kipindi ${epNum}` : `Plot of Episode ${epNum}`}
              </h2>
              <p className={`text-sm leading-relaxed text-zinc-300 ${plotExpanded ? '' : 'line-clamp-2'}`}>
                {plotText}
              </p>
              {plotText.length > 110 && (
                <button
                  type="button"
                  onClick={() => setPlotExpanded((v) => !v)}
                  className="text-xs font-bold text-white hover:text-red-400 transition-colors"
                >
                  {plotExpanded ? 'Less' : 'More'}
                </button>
              )}
            </div>
          )}

          {/* Tag Pills */}
          {pills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full bg-zinc-800/90 border border-zinc-700/70 px-3 py-1 text-xs font-medium text-zinc-200"
                >
                  {pill}
                </span>
              ))}
            </div>
          )}

          {/* Action Row */}
          <div className="grid grid-cols-5 gap-2 border-y border-zinc-800/80 py-3">
            <button
              type="button"
              onClick={handleToggleLike}
              aria-pressed={isLiked}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
                isLiked ? 'text-rose-400 bg-rose-500/10' : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
              }`}
            >
              <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
              <span>{formatCompactCount(likeCount)}</span>
            </button>

            <button
              type="button"
              onClick={() => setDesktopTab(desktopTab === 'comments' ? 'episodes' : 'comments')}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
                desktopTab === 'comments'
                  ? 'text-rose-400 bg-rose-500/10'
                  : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
              }`}
            >
              <MessageCircle size={18} />
              <span>{formatCompactCount(comments.length)}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleWatchLater(activeVideo.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
                isWatchLater ? 'text-red-400 bg-red-500/10' : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
              }`}
            >
              <Bookmark size={18} fill={isWatchLater ? 'currentColor' : 'none'} />
              <span>{isWatchLater ? 'Saved' : 'Save'}</span>
            </button>

            <button
              type="button"
              onClick={() => onShare(activeVideo)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-colors"
            >
              <Share2 size={18} />
              <span>Share</span>
            </button>

            {!modalAutoPlay ? (
              <button
                type="button"
                onClick={onStartPlayback}
                className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                <Play size={18} fill="currentColor" />
                <span>Watch</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (nextEp ? onSelectEpisode(nextEp) : firstEp && onSelectEpisode(firstEp))}
                className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-colors"
              >
                <Sparkles size={18} className="text-amber-400" />
                <span>{nextEp ? `Ep ${nextEp.episode || epNum + 1}` : `Ep ${firstEp?.episode || 1}`}</span>
              </button>
            )}
          </div>

          {/* Desktop Tabs: Episodes vs Comments */}
          <div className="flex items-center gap-4 border-b border-zinc-800/80 pb-2">
            <button
              type="button"
              onClick={() => setDesktopTab('episodes')}
              className={`text-xs font-extrabold uppercase tracking-wider pb-1 border-b-2 transition-colors ${
                desktopTab === 'episodes'
                  ? 'text-white border-red-500'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              Episodes ({episodes.length})
            </button>
            <button
              type="button"
              onClick={() => setDesktopTab('comments')}
              className={`text-xs font-extrabold uppercase tracking-wider pb-1 border-b-2 transition-colors ${
                desktopTab === 'comments'
                  ? 'text-white border-red-500'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              Comments ({comments.length})
            </button>
          </div>

          {desktopTab === 'episodes' ? renderEpisodeGrid(false) : renderCommentsPanel()}
        </div>
      </div>

      {/* End-of-Microdrama Recommended Modal (Portrait 2:3 Posters for Micro Dramas) */}
      {isRecommendedModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="microdrama-recommended-title"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6"
          onClick={() => setDismissedForVideoId(activeVideo.id)}
        >
          <div
            className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-zinc-700/80 bg-[#121218] p-4 sm:p-6 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                  {language === 'sw' ? 'Umependa hii?' : 'Finished Watching'}
                </p>
                <h3 id="microdrama-recommended-title" className="text-lg sm:text-xl font-extrabold text-white">
                  {language === 'sw' ? 'Chagua Kipindi Kingine' : 'Recommended Next Shows'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {language === 'sw'
                    ? 'Chagua mojawapo ya maonyesho 6 hapa chini kuendelea kutazama.'
                    : 'Pick your next binge below to keep watching.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close recommendations"
                onClick={() => setDismissedForVideoId(activeVideo.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {topSixRecommended.map((rec) => {
                const locked = isLocked(rec);
                const label = rec.seriesTitle || rec.title;
                const portraitRec = isMicroDrama(rec) || Boolean(rec.seriesPosterUrl);
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => {
                      setDismissedForVideoId(activeVideo.id);
                      if (onSelectRecommended) {
                        onSelectRecommended(rec);
                      } else {
                        onSelectEpisode(rec);
                      }
                    }}
                    className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-left transition-all hover:border-rose-500/70 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <div
                      className={`relative w-full overflow-hidden bg-zinc-900 ${
                        portraitRec ? 'aspect-[2/3]' : 'aspect-video'
                      }`}
                    >
                      {rec.seriesPosterUrl || rec.thumbnail ? (
                        <img
                          src={rec.seriesPosterUrl || rec.thumbnail}
                          alt={label}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-600">
                          <Play size={22} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg">
                          {locked ? <Lock size={15} /> : <Play size={15} className="fill-current ml-0.5" />}
                        </span>
                      </div>
                      {locked && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/75 border border-zinc-700 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          <Lock size={10} />
                          Pass
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-bold text-white truncate">{label}</p>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                        {rec.seriesTitle && rec.episode
                          ? `Ep ${rec.episode} · ${rec.category || 'Micro Drama'}`
                          : rec.category || 'TubeTV'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3">
              <button
                type="button"
                onClick={() => {
                  setDismissedForVideoId(activeVideo.id);
                  onReplay?.();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-200 transition-colors"
              >
                <RotateCcw size={13} />
                {language === 'sw' ? 'Cheza Tena' : 'Replay'}
              </button>
              <button
                type="button"
                onClick={() => setDismissedForVideoId(activeVideo.id)}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                {language === 'sw' ? 'Funga' : 'Stay on episode list'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
