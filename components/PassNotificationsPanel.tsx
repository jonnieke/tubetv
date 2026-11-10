import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2, MessageSquare, Send } from 'lucide-react';
import { invokeEdge } from '../lib/edgeInvoke';

interface LogRow {
  kind: string;
  channel: string;
  status: string;
  detail: string | null;
  created_at: string;
}

export default function PassNotificationsPanel() {
  const [configured, setConfigured] = useState<{ whatsapp: boolean; sms: boolean } | null>(null);
  const [recent, setRecent] = useState<LogRow[]>([]);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<'status' | 'test' | 'sweep' | null>('status');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setBusy('status');
    const result = await invokeEdge<{ configured?: { whatsapp: boolean; sms: boolean }; recent?: LogRow[] }>(
      'pass-notifications',
      { action: 'status' },
    );
    if (result.ok) {
      setConfigured(result.configured || null);
      setRecent(result.recent || []);
    } else {
      setMessage(result.error || 'Could not load notification status.');
    }
    setBusy(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendTest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!phone.trim()) return;
    setBusy('test');
    setMessage('');
    const result = await invokeEdge<{ delivered?: boolean }>('pass-notifications', { action: 'test', phone: phone.trim() });
    setMessage(
      result.ok
        ? result.delivered
          ? '✓ Test message accepted by the carrier / WhatsApp.'
          : 'Not delivered — see the log below for the reason.'
        : result.error || 'Test failed.',
    );
    setBusy(null);
    void refresh();
  };

  const runSweep = async () => {
    setBusy('sweep');
    setMessage('');
    const result = await invokeEdge<{ receipts?: number; reminders?: number; skipped?: string }>('pass-notifications', {
      action: 'sweep',
    });
    setMessage(
      result.ok
        ? result.skipped
          ? 'No channel is configured yet — add SMS or WhatsApp secrets first.'
          : `✓ Sent ${result.receipts ?? 0} receipt(s) and ${result.reminders ?? 0} expiry reminder(s).`
        : result.error || 'Sweep failed.',
    );
    setBusy(null);
    void refresh();
  };

  const pill = (on: boolean | undefined, label: string) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
        on ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
      {label}: {on ? 'connected' : 'not configured'}
    </span>
  );

  return (
    <div className="space-y-5 pb-12">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Pass receipts &amp; expiry alerts</h2>
            <p className="text-xs text-zinc-400">
              Sends a receipt when a pass is bought and a reminder about an hour before it ends. WhatsApp is preferred; SMS is the fallback.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {pill(configured?.whatsapp, 'WhatsApp')}
          {pill(configured?.sms, "Africa's Talking SMS")}
          {busy === 'status' && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
        </div>

        <form onSubmit={sendTest} className="mt-5 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="notify-test-phone" className="mb-1 block text-xs font-semibold text-zinc-300">Send a test message to</label>
            <input
              id="notify-test-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0712 345 678"
              className="w-56 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <button type="submit" disabled={busy !== null || !phone.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
            {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test
          </button>
          <button type="button" onClick={() => void runSweep()} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50">
            {busy === 'sweep' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />} Run sweep now
          </button>
        </form>
        {message && <p role="status" className="mt-3 text-sm text-zinc-200">{message}</p>}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
        <h3 className="text-sm font-bold text-white">Recent deliveries</h3>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">Nothing sent yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800 text-xs">
            {recent.map((row, index) => (
              <li key={`${row.created_at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-zinc-300">
                  <strong className="text-white">{row.kind.replace('_', ' ')}</strong> via {row.channel}
                </span>
                <span className={row.status === 'sent' ? 'text-emerald-400' : row.status === 'failed' ? 'text-red-400' : 'text-zinc-400'}>
                  {row.status}
                  {row.detail ? ` · ${row.detail}` : ''}
                </span>
                <span className="text-zinc-500">{new Date(row.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
