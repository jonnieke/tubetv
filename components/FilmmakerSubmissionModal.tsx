import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clapperboard, Loader2, ShieldCheck, X } from 'lucide-react';
import { invokeEdge } from '../lib/edgeInvoke';

interface Props {
  onClose: () => void;
}

const FORMATS: Array<[string, string]> = [
  ['feature', 'Feature film'],
  ['series', 'Series'],
  ['micro-drama', 'Micro-drama (vertical)'],
  ['documentary', 'Documentary'],
  ['short', 'Short film'],
  ['other', 'Other'],
];

const inputClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-red-500 focus:outline-none';
const labelClass = 'mb-1 block text-xs font-semibold text-zinc-300';

export default function FilmmakerSubmissionModal({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: 'Kenya',
    studioName: '',
    filmTitle: '',
    format: 'feature',
    synopsis: '',
    trailerUrl: '',
    screenerUrl: '',
    rightsConfirmed: false,
    website: '', // honeypot
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('input')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setStatus('sending');
    const result = await invokeEdge('filmmaker-submissions', { action: 'submit', ...form });
    if (result.ok) {
      setStatus('done');
    } else {
      setStatus('idle');
      setError(result.error || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filmmaker-form-title"
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl md:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close application form"
          className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X size={18} />
        </button>

        {status === 'done' ? (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <h2 className="mt-4 font-serif text-2xl text-white">Thank you — we've got it.</h2>
            <p className="mt-2 max-w-md text-sm text-zinc-300">
              Our curation team reviews every submission. If your project is a fit, we'll email you at{' '}
              <strong className="text-white">{form.email}</strong> about next steps and the 60% revenue-share agreement.
            </p>
            <button type="button" className="cinema-primary mt-6" onClick={onClose}>
              Back to TubeTV
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="flex items-center gap-2 text-amber-300">
              <Clapperboard size={18} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Publish on TubeTV</span>
            </div>
            <h2 id="filmmaker-form-title" className="mt-2 font-serif text-2xl text-white">
              Apply to publish your film or series
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Kenyan and African filmmakers keep ownership and earn 60% of the net revenue pool, paid out by M-Pesa.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="fm-name">Full name *</label>
                <input id="fm-name" className={inputClass} value={form.fullName} onChange={set('fullName')} autoComplete="name" required />
              </div>
              <div>
                <label className={labelClass} htmlFor="fm-email">Email *</label>
                <input id="fm-email" type="email" className={inputClass} value={form.email} onChange={set('email')} autoComplete="email" required />
              </div>
              <div>
                <label className={labelClass} htmlFor="fm-phone">Phone / WhatsApp</label>
                <input id="fm-phone" type="tel" className={inputClass} value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="0712 345 678" />
              </div>
              <div>
                <label className={labelClass} htmlFor="fm-country">Country</label>
                <input id="fm-country" className={inputClass} value={form.country} onChange={set('country')} />
              </div>
              <div>
                <label className={labelClass} htmlFor="fm-studio">Studio / production company</label>
                <input id="fm-studio" className={inputClass} value={form.studioName} onChange={set('studioName')} />
              </div>
              <div>
                <label className={labelClass} htmlFor="fm-format">Format *</label>
                <select id="fm-format" className={inputClass} value={form.format} onChange={set('format')}>
                  {FORMATS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="fm-title">Title of your project *</label>
                <input id="fm-title" className={inputClass} value={form.filmTitle} onChange={set('filmTitle')} required />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="fm-synopsis">Synopsis *</label>
                <textarea
                  id="fm-synopsis"
                  rows={4}
                  className={inputClass}
                  value={form.synopsis}
                  onChange={set('synopsis')}
                  placeholder="What is it about, who is it for, and where has it been seen before?"
                  maxLength={2000}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="fm-trailer">Trailer link * (public https://)</label>
                <input id="fm-trailer" type="url" className={inputClass} value={form.trailerUrl} onChange={set('trailerUrl')} placeholder="https://youtube.com/…" required />
              </div>
              <div>
                <label className={labelClass} htmlFor="fm-screener">Private screener link (optional)</label>
                <input id="fm-screener" type="url" className={inputClass} value={form.screenerUrl} onChange={set('screenerUrl')} placeholder="https://vimeo.com/… (password ok)" />
              </div>
            </div>

            {/* Honeypot — hidden from people, tempting to bots */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
              <label htmlFor="fm-website">Website</label>
              <input id="fm-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
            </div>

            <label className="mt-5 flex items-start gap-2.5 text-xs text-zinc-300">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-red-600"
                checked={form.rightsConfirmed}
                onChange={(event) => setForm((prev) => ({ ...prev, rightsConfirmed: event.target.checked }))}
              />
              <span>I own or control the rights to this work and I'm allowed to submit it for distribution. *</span>
            </label>

            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                <ShieldCheck size={14} className="text-emerald-400" />
                Only our curation team sees this. We never publish without your written agreement.
              </span>
              <button type="submit" disabled={status === 'sending'} className="cinema-primary disabled:opacity-60">
                {status === 'sending' ? <Loader2 size={16} className="animate-spin" /> : null}
                {status === 'sending' ? 'Sending…' : 'Submit for review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
