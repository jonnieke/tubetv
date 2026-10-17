import React, { useState, useEffect } from 'react';
import {
  fetchCreatorMetrics,
  fetchCreatorPayoutHistory,
  requestMpesaWithdrawal,
  type CreatorMetrics,
  type PayoutRecord,
} from '../services/paymentService';

interface CreatorStudioProps {
  onClose?: () => void;
}

export const CreatorStudio: React.FC<CreatorStudioProps> = ({ onClose }) => {
  const [metrics, setMetrics] = useState<CreatorMetrics | null>(null);
  const [history, setHistory] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Withdrawal form state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('1000');
  const [mpesaPhone, setMpesaPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, h] = await Promise.all([
        fetchCreatorMetrics(),
        fetchCreatorPayoutHistory(),
      ]);
      setMetrics(m);
      setHistory(h);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const amountNum = parseFloat(withdrawAmount);

    if (isNaN(amountNum) || amountNum < 500) {
      setFeedback({ type: 'error', message: 'Minimum withdrawal amount is KES 500' });
      return;
    }

    if (metrics && amountNum > metrics.availableBalanceKes) {
      setFeedback({ type: 'error', message: 'Withdrawal amount exceeds your available balance' });
      return;
    }

    if (!mpesaPhone.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a valid Safaricom phone number' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestMpesaWithdrawal({
        amount: amountNum,
        phoneNumber: mpesaPhone,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'M-Pesa payout initiated successfully. Funds will arrive within minutes.',
        });
        await loadData();
        setTimeout(() => {
          setShowWithdrawModal(false);
          setFeedback(null);
        }, 2500);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Withdrawal failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'An unexpected error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Creator Economics & Revenue Share
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Creator Studio</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track episode coin unlocks, royalties (65% net split), and instant Safaricom M-Pesa B2C payouts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={!metrics || metrics.availableBalanceKes < 500}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Withdraw to M-Pesa
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-8">
        {/* Available Balance */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group hover:border-emerald-500/50 transition">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Available Balance
          </div>
          <div className="text-3xl font-black text-white">
            KES {metrics?.availableBalanceKes?.toLocaleString() ?? '0'}
          </div>
          <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-medium">
            <span>●</span> Ready for instant M-Pesa transfer
          </div>
        </div>

        {/* Total Earned */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group hover:border-amber-500/50 transition">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Lifetime Net Earnings
          </div>
          <div className="text-3xl font-black text-white">
            KES {metrics?.totalEarnedKes?.toLocaleString() ?? '0'}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Based on 65% creator rev-share
          </div>
        </div>

        {/* Total Withdrawn */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group hover:border-blue-500/50 transition">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Paid Out (M-Pesa)
          </div>
          <div className="text-3xl font-black text-white">
            KES {metrics?.totalWithdrawnKes?.toLocaleString() ?? '0'}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Pending: KES {metrics?.pendingWithdrawalKes?.toLocaleString() ?? '0'}
          </div>
        </div>

        {/* Total Episode Unlocks */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden group hover:border-purple-500/50 transition">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
            Total Episode Unlocks
          </div>
          <div className="text-3xl font-black text-white">
            {metrics?.totalEpisodeUnlocks?.toLocaleString() ?? '0'}
          </div>
          <div className="text-xs text-purple-400 mt-2">
            10 coins per unlock
          </div>
        </div>
      </div>

      {/* Calculator / Projection Callout */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-white/10 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="text-base font-bold text-white flex items-center gap-2">
            <span>💡</span> Microdrama Revenue Benchmark
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
            Standard pricing: 1 Coin = KES 2.00. Unlocking 1 episode burns 10 coins (KES 20.00 gross).
            At 65% rev-share, you earn <span className="text-emerald-400 font-bold">KES 13.00 net per unlock</span>.
            A 30-episode microdrama with 5,000 binge completions generates approx{' '}
            <span className="text-white font-bold">KES 1,950,000</span> for the creator.
          </p>
        </div>
      </div>

      {/* Payout History Section */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Recent Payout Requests</h2>
          <button
            onClick={loadData}
            className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No withdrawal history found. Earnings will show here once you request your first M-Pesa payout.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.02] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Amount</th>
                  <th className="py-3 px-5">Method</th>
                  <th className="py-3 px-5">Recipient Phone</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-5 text-slate-300">
                      {new Date(record.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-white">
                      KES {record.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 text-slate-300 capitalize">
                      {record.payoutMethod}
                    </td>
                    <td className="py-3.5 px-5 text-slate-400 font-mono text-xs">
                      {record.payoutDestination}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          record.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : record.status === 'processing'
                            ? 'bg-amber-500/10 text-amber-400'
                            : record.status === 'failed'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* M-Pesa Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowWithdrawModal(false);
                setFeedback(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                M
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Withdraw to M-Pesa</h3>
                <p className="text-xs text-slate-400">Instant B2C disbursement to your Safaricom line</p>
              </div>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Amount (KES)
                </label>
                <input
                  type="number"
                  min="500"
                  max={metrics?.availableBalanceKes || 100000}
                  step="50"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. 1000"
                  required
                />
                <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                  <span>Min: KES 500</span>
                  <span>Max Available: KES {metrics?.availableBalanceKes?.toLocaleString() ?? '0'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Safaricom Phone Number
                </label>
                <input
                  type="tel"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="0712345678 or 254712345678"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Ensure this phone number is registered for Safaricom M-Pesa.
                </p>
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    feedback.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/10 border border-red-500/30 text-red-400'
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Disbursing to M-Pesa...
                    </>
                  ) : (
                    'Confirm Payout'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
