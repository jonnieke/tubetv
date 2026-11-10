import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { invokeEdge } from '../lib/edgeInvoke';

type Status = 'new' | 'reviewing' | 'accepted' | 'declined';

interface Submission {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  studio_name: string | null;
  film_title: string;
  format: string;
  synopsis: string;
  trailer_url: string;
  screener_url: string | null;
  status: Status;
  admin_notes: string | null;
  reviewed_at: string | null;
}

const STATUS_STYLES: Record<Status, string> = {
  new: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  reviewing: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  accepted: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  declined: 'bg-zinc-700/40 text-zinc-300 border-zinc-600',
};

export default function FilmmakerSubmissionsQueue() {
  const [filter, setFilter] = useState<'all' | Status>('new');
  const [items, setItems] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await invokeEdge<{ submissions?: Submission[]; counts?: Record<string, number> }>(
      'filmmaker-submissions',
      { action: 'list', status: filter === 'all' ? '' : filter },
    );
    if (result.ok) {
      setItems(result.submissions || []);
      setCounts(result.counts || {});
      setNotes((prev) => {
        const next = { ...prev };
        for (const s of result.submissions || []) if (next[s.id] === undefined) next[s.id] = s.admin_notes || '';
        return next;
      });
    } else {
      setError(result.error || 'Could not load submissions.');
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (item: Submission, status: Status) => {
    setSavingId(item.id);
    const result = await invokeEdge('filmmaker-submissions', {
      action: 'update',
      id: item.id,
      status,
      adminNotes: notes[item.id] || '',
    });
    setSavingId(null);
    if (result.ok) void load();
    else setError(result.error || 'Could not save review.');
  };

  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Filmmaker submissions</h2>
            <p className="text-xs text-zinc-400">Applications from the “Apply to Publish” form on the landing page.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['new', 'reviewing', 'accepted', 'declined', 'all'] as const).map((value) => (
          <button
            type="button"
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize ${
              filter === value ? 'border-white bg-white text-black' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
            }`}
          >
            {value}
            {value !== 'all' && counts[value] !== undefined ? ` · ${counts[value]}` : ''}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}
      {loading && items.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      )}
      {!loading && items.length === 0 && !error && (
        <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">No submissions in this view yet.</p>
      )}

      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{item.film_title}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[item.status]}`}>
                    {item.status}
                  </span>
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] uppercase text-zinc-300">{item.format}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {item.full_name}
                  {item.studio_name ? ` · ${item.studio_name}` : ''}
                  {item.country ? ` · ${item.country}` : ''} · {new Date(item.created_at).toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  <a className="text-sky-300 hover:underline" href={`mailto:${item.email}`}>{item.email}</a>
                  {item.phone ? ` · ${item.phone}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={item.trailer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
                >
                  <ExternalLink size={13} /> Trailer
                </a>
                {item.screener_url && (
                  <a
                    href={item.screener_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
                  >
                    <ExternalLink size={13} /> Screener
                  </a>
                )}
              </div>
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{item.synopsis}</p>

            <textarea
              aria-label={`Internal notes for ${item.film_title}`}
              rows={2}
              value={notes[item.id] ?? ''}
              onChange={(event) => setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))}
              placeholder="Internal notes (never shown to the filmmaker)"
              className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {(['reviewing', 'accepted', 'declined'] as const).map((status) => (
                <button
                  type="button"
                  key={status}
                  disabled={savingId === item.id || item.status === status}
                  onClick={() => void review(item, status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize disabled:opacity-40 ${
                    status === 'accepted'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : status === 'declined'
                        ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                        : 'bg-amber-500 text-black hover:bg-amber-400'
                  }`}
                >
                  {savingId === item.id ? '…' : `Mark ${status}`}
                </button>
              ))}
              <button
                type="button"
                disabled={savingId === item.id}
                onClick={() => void review(item, item.status)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                Save notes
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
