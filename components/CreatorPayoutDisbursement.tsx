import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Send, X } from 'lucide-react';
import { invokeEdge } from '../lib/edgeInvoke';
import { CreatorPayoutProfile, CreatorRoyaltySummary } from '../lib/royalties';

interface Props {
  creators: CreatorRoyaltySummary[];
  profiles: Record<string, CreatorPayoutProfile>;
  periodLabel: string;
}

interface Outcome {
  creatorName: string;
  status: 'initiated' | 'skipped' | 'failed';
  message: string;
  netKes?: number;
}

interface PayoutRow {
  creator_name: string;
  amount_kes: number;
  status: 'pending' | 'otp' | 'success' | 'failed' | 'reversed';
  failure_reason: string | null;
  destination_hint: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<PayoutRow['status'], string> = {
  pending: 'text-amber-300',
  otp: 'text-orange-300',
  success: 'text-emerald-400',
  failed: 'text-red-400',
  reversed: 'text-red-400',
};

const normalizePeriod = (label: string) => label.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const isMpesa = (rail?: string) => /m-?pesa/i.test(rail || '');
const validMsisdn = (value?: string) => /^(?:\+?254|0)?[17]\d{8}$/.test((value || '').replace(/[\s()-]/g, ''));

export default function CreatorPayoutDisbursement({ creators, profiles, periodLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'dry' | 'send' | 'list' | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [isDryRun, setIsDryRun] = useState(false);
  const [error, setError] = useState('');
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);

  const period = normalizePeriod(periodLabel);
  const allTime = /all\s*time/i.test(period);

  const rows = useMemo(
    () =>
      creators
        .filter((c) => c.isEligibleForPayout)
        .map((c) => {
          const profile = profiles[c.creator];
          const gross = Math.round(c.netEarningsKes);
          const wht = Number(profile?.withholding_tax_percent) || 0;
          const net = gross - Math.round(gross * (wht / 100));
          const ready = Boolean(profile && isMpesa(profile.payout_rail) && validMsisdn(profile.payout_account));
          const alreadyPaid = payouts.some(
            (p) => p.creator_name === c.creator && ['pending', 'otp', 'success'].includes(p.status),
          );
          return { creator: c.creator, gross, net, ready, alreadyPaid, profile };
        }),
    [creators, profiles, payouts],
  );

  const sendable = rows.filter((r) => r.ready && !r.alreadyPaid);
  const totalNet = sendable.reduce((sum, r) => sum + r.net, 0);

  const loadStatuses = useCallback(async () => {
    if (allTime) return;
    setBusy('list');
    const result = await invokeEdge<{ payouts?: PayoutRow[] }>('creator-payouts', { action: 'list', periodLabel: period });
    if (result.ok) setPayouts(result.payouts || []);
    else setError(result.error || 'Could not load payout statuses.');
    setBusy(null);
  }, [period, allTime]);

  useEffect(() => {
    if (open) void loadStatuses();
  }, [open, loadStatuses]);

  const run = async (dryRun: boolean) => {
    setError('');
    setBusy(dryRun ? 'dry' : 'send');
    const result = await invokeEdge<{ outcomes?: Outcome[]; dryRun?: boolean }>('creator-payouts', {
      action: 'disburse',
      periodLabel: period,
      dryRun,
      items: sendable.map((r) => ({ creatorName: r.creator, grossKes: r.gross })),
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.error || 'Disbursement failed.');
      return;
    }
    setIsDryRun(Boolean(result.dryRun));
    setOutcomes(result.outcomes || []);
    setConfirmText('');
    void loadStatuses();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 rounded-xl text-sm font-black shadow-md transition-all hover:scale-[1.02]"
        title="Send eligible M-Pesa royalties directly through Paystack Transfers"
      >
        <Send className="w-4 h-4" />
        <span>Disburse via Paystack</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/85 p-3" role="dialog" aria-modal="true" aria-label="Disburse creator royalties">
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <X size={18} />
            </button>
            <h3 className="text-xl font-black text-white">Disburse royalties — {period}</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Sends M-Pesa transfers from your Paystack balance. Destinations come from the saved Payout Directory, and each creator can be paid only once per period.
            </p>

            {allTime && (
              <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
                Choose a single monthly cycle (not “All Time”) before disbursing.
              </p>
            )}

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Creator</th>
                    <th className="px-3 py-2 text-right">Gross</th>
                    <th className="px-3 py-2 text-right">Net to send</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-zinc-500">No creators have reached the KSh 1,000 threshold this cycle.</td></tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.creator}>
                      <td className="px-3 py-2 font-semibold text-white">{r.creator}</td>
                      <td className="px-3 py-2 text-right text-zinc-300">KSh {r.gross.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-300">KSh {r.net.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {r.alreadyPaid ? (
                          <span className="text-emerald-400">Already paid / in-flight</span>
                        ) : r.ready ? (
                          <span className="text-zinc-300">Ready</span>
                        ) : (
                          <span className="text-amber-300">Needs M-Pesa number in Payout Directory</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {outcomes && (
              <div className="mt-4 space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4" role="status">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{isDryRun ? 'Dry-run result (nothing was sent)' : 'Disbursement result'}</p>
                {outcomes.map((o, index) => (
                  <p key={`${o.creatorName}-${index}`} className="flex items-start gap-2 text-xs">
                    {o.status === 'initiated' ? (
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${o.status === 'failed' ? 'text-red-400' : 'text-amber-300'}`} />
                    )}
                    <span className="text-zinc-200"><strong className="text-white">{o.creatorName}</strong> — {o.message}</span>
                  </p>
                ))}
              </div>
            )}

            {payouts.length > 0 && (
              <div className="mt-4 rounded-xl border border-zinc-800 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Transfer history · {period}</p>
                  <button type="button" onClick={() => void loadStatuses()} className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-white">
                    <RefreshCw size={12} className={busy === 'list' ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>
                <ul className="divide-y divide-zinc-800 text-xs">
                  {payouts.map((p, index) => (
                    <li key={`${p.creator_name}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span className="text-zinc-200">{p.creator_name} · KSh {Number(p.amount_kes).toLocaleString()} {p.destination_hint ? `→ ${p.destination_hint}` : ''}</span>
                      <span className={`font-bold uppercase ${STATUS_STYLE[p.status]}`}>
                        {p.status}{p.failure_reason ? ` · ${p.failure_reason}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}

            <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-zinc-800 pt-4">
              <button
                type="button"
                disabled={busy !== null || sendable.length === 0 || allTime}
                onClick={() => void run(true)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
              >
                {busy === 'dry' ? 'Checking…' : 'Dry run (sends nothing)'}
              </button>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="payout-confirm" className="mb-1 block text-[11px] font-semibold text-zinc-400">
                    Type SEND to release KSh {totalNet.toLocaleString()} to {sendable.length} creator{sendable.length === 1 ? '' : 's'}
                  </label>
                  <input
                    id="payout-confirm"
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    autoComplete="off"
                    className="w-36 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy !== null || sendable.length === 0 || confirmText.trim() !== 'SEND' || allTime}
                  onClick={() => void run(false)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-black text-black hover:bg-emerald-400 disabled:opacity-40"
                >
                  {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
