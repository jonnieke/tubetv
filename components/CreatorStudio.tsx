
import React, { useState, useMemo } from 'react';
import {
  TrendingUp, Eye, DollarSign, Film, Phone, CheckCircle,
  Loader2, AlertCircle, ChevronDown, ChevronUp, Smartphone,
} from 'lucide-react';
import { Video } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Estimated revenue per 1 000 views in KES (conservative Kenyan rate) */
const KES_PER_1K_VIEWS = 80;
/** Minimum payout threshold in KES */
const PAYOUT_MIN = 500;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtKes = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

const estimateRevenue = (views: number) => (views / 1000) * KES_PER_1K_VIEWS;

// ─── Payout modal ─────────────────────────────────────────────────────────────

type PayoutStep = 'form' | 'processing' | 'success';

const PayoutModal: React.FC<{
  balance: number;
  userPhone?: string | null;
  onClose: () => void;
}> = ({ balance, userPhone, onClose }) => {
  const [step, setStep]         = useState<PayoutStep>('form');
  const [phone, setPhone]       = useState(userPhone?.replace(/^\+?254/, '') || '');
  const [amount, setAmount]     = useState(Math.min(balance, 5000).toFixed(2));
  const [phoneErr, setPhoneErr] = useState('');
  const [amountErr, setAmountErr] = useState('');

  const canPayout = balance >= PAYOUT_MIN;

  const handleSubmit = () => {
    let ok = true;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) { setPhoneErr('Enter a valid Kenyan phone number'); ok = false; }
    else setPhoneErr('');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < PAYOUT_MIN) { setAmountErr(`Minimum payout is KES ${PAYOUT_MIN}`); ok = false; }
    else if (amt > balance) { setAmountErr('Amount exceeds your available balance'); ok = false; }
    else setAmountErr('');
    if (!ok) return;
    setStep('processing');
    setTimeout(() => setStep('success'), 3000);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-green-950 to-zinc-900 px-6 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-2xl flex items-center justify-center">
              <Smartphone size={20} className="text-green-400" />
            </div>
            <div>
              <p className="text-white font-black">M-Pesa Payout</p>
              <p className="text-green-400/70 text-xs">Withdraw your creator earnings</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* ── Form ── */}
          {step === 'form' && (
            <>
              <div className="bg-zinc-800/60 rounded-2xl p-4 mb-5">
                <p className="text-zinc-500 text-xs mb-1">Available balance</p>
                <p className="text-white font-black text-2xl">{fmtKes(balance)}</p>
                {!canPayout && (
                  <div className="flex items-center gap-1.5 mt-2 text-amber-400 text-[11px]">
                    <AlertCircle size={11} /> Minimum payout is {fmtKes(PAYOUT_MIN)}
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-5">
                {/* Amount */}
                <div>
                  <label className="text-zinc-400 text-xs font-bold mb-1.5 block">Amount (KES)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setAmountErr(''); }}
                    min={PAYOUT_MIN}
                    max={balance}
                    disabled={!canPayout}
                    className={`w-full bg-zinc-800 border rounded-xl px-3 py-3 text-white text-sm outline-none transition-colors disabled:opacity-50 ${amountErr ? 'border-red-500' : 'border-zinc-700 focus:border-green-500'}`}
                  />
                  {amountErr && <p className="text-red-400 text-[11px] mt-1">{amountErr}</p>}
                </div>
                {/* Phone */}
                <div>
                  <label className="text-zinc-400 text-xs font-bold mb-1.5 block">M-Pesa Number</label>
                  <div className={`flex items-center bg-zinc-800 border rounded-xl px-3 py-3 transition-colors ${phoneErr ? 'border-red-500' : 'border-zinc-700 focus-within:border-green-500'}`}>
                    <span className="text-zinc-500 text-sm mr-2">+254</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setPhoneErr(''); }}
                      placeholder="712 345 678"
                      maxLength={9}
                      inputMode="numeric"
                      className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
                    />
                  </div>
                  {phoneErr && <p className="text-red-400 text-[11px] mt-1">{phoneErr}</p>}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-[0_0_auto] w-20 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm rounded-2xl transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canPayout}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-black text-sm rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  <Smartphone size={14} /> Request Payout
                </button>
              </div>
            </>
          )}

          {/* ── Processing ── */}
          {step === 'processing' && (
            <div className="py-8 text-center">
              <Loader2 size={40} className="text-green-400 animate-spin mx-auto mb-4" />
              <p className="text-white font-black text-base mb-1">Processing…</p>
              <p className="text-zinc-400 text-sm">Sending {fmtKes(parseFloat(amount))} to +254{phone}</p>
            </div>
          )}

          {/* ── Success ── */}
          {step === 'success' && (
            <div className="py-6 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in-50 duration-500">
                <CheckCircle size={30} className="text-green-400" />
              </div>
              <p className="text-white font-black text-xl mb-1">Payout Requested! 🎉</p>
              <p className="text-zinc-300 text-sm mb-1">
                <span className="text-green-400 font-bold">{fmtKes(parseFloat(amount))}</span> will be sent to +254{phone}
              </p>
              <p className="text-zinc-500 text-xs mb-5">Typically arrives within 1–2 business days.</p>
              <button onClick={onClose} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-black text-sm rounded-2xl transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  videos: Video[];
  creatorName: string;
}

const CreatorStudio: React.FC<Props> = ({ videos, creatorName }) => {
  const [showPayout, setShowPayout] = useState(false);
  const [sortBy, setSortBy]         = useState<'views' | 'revenue' | 'date'>('views');
  const [sortDir, setSortDir]       = useState<'desc' | 'asc'>('desc');

  // Filter to this creator's videos
  const myVideos = useMemo(
    () => videos.filter(v => v.author === creatorName),
    [videos, creatorName]
  );

  const totalViews   = useMemo(() => myVideos.reduce((s, v) => s + v.views, 0), [myVideos]);
  const totalRevenue = useMemo(() => estimateRevenue(totalViews), [totalViews]);

  const sortedVideos = useMemo(() => {
    const arr = [...myVideos];
    arr.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'views')   diff = b.views - a.views;
      if (sortBy === 'revenue') diff = b.views - a.views; // revenue is proportional to views
      if (sortBy === 'date')    diff = (new Date(b.dateUploaded || 0).getTime()) - (new Date(a.dateUploaded || 0).getTime());
      return sortDir === 'desc' ? diff : -diff;
    });
    return arr;
  }, [myVideos, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    sortBy === col
      ? sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />
      : <ChevronDown size={11} className="opacity-30" />
  );

  // Summary stat card
  const Stat = ({ icon, label, value, sub, accent }: {
    icon: React.ReactNode; label: string; value: string; sub?: string; accent: string;
  }) => (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-xl ${accent} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{label}</p>
        <p className="text-white font-black text-lg leading-tight">{value}</p>
        {sub && <p className="text-zinc-600 text-[10px] mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  return (
    <div className="px-4 md:px-8 py-6 pb-24 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Creator Studio</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Your content performance & earnings</p>
        </div>
        <button
          onClick={() => setShowPayout(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-green-900/30 active:scale-95"
        >
          <Smartphone size={15} /> Request Payout
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat
          icon={<Film size={17} className="text-violet-400" />}
          label="Total Videos"
          value={myVideos.length.toString()}
          sub="on Tube TV"
          accent="bg-violet-500/15"
        />
        <Stat
          icon={<Eye size={17} className="text-blue-400" />}
          label="Total Views"
          value={fmtViews(totalViews)}
          sub="lifetime"
          accent="bg-blue-500/15"
        />
        <Stat
          icon={<TrendingUp size={17} className="text-amber-400" />}
          label="Avg / Video"
          value={fmtViews(myVideos.length > 0 ? Math.round(totalViews / myVideos.length) : 0)}
          sub="views per upload"
          accent="bg-amber-500/15"
        />
        <Stat
          icon={<DollarSign size={17} className="text-green-400" />}
          label="Est. Earnings"
          value={fmtKes(totalRevenue)}
          sub={`@ KES ${KES_PER_1K_VIEWS}/1K views`}
          accent="bg-green-500/15"
        />
      </div>

      {/* Rate info banner */}
      <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-800/30 rounded-2xl px-4 py-3 mb-6">
        <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-300/80 text-xs leading-relaxed">
          Earnings are estimated at <strong className="text-amber-300">KES {KES_PER_1K_VIEWS} per 1,000 views</strong>.
          Actual payouts depend on ad revenue share, content category, and Tube TV's monthly settlement.
          Minimum withdrawal is <strong className="text-amber-300">KES {PAYOUT_MIN}</strong>.
        </p>
      </div>

      {/* Video table */}
      {myVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4">
            <Film className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="text-white font-bold text-lg mb-1">No videos yet</p>
          <p className="text-zinc-500 text-sm max-w-xs">Upload your first video to start earning. Your videos will appear here once they're live.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-zinc-400 text-sm font-bold">{myVideos.length} video{myVideos.length !== 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              Sort by:
              {(['views', 'revenue', 'date'] as const).map(col => (
                <button
                  key={col}
                  onClick={() => toggleSort(col)}
                  className={`flex items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${sortBy === col ? 'text-white bg-zinc-800' : 'hover:text-zinc-300'}`}
                >
                  {col.charAt(0).toUpperCase() + col.slice(1)} <SortIcon col={col} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {sortedVideos.map((video, i) => {
              const rev = estimateRevenue(video.views);
              const isTop = i === 0 && sortBy === 'views';
              return (
                <div
                  key={video.id}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${isTop ? 'border-amber-700/40 bg-amber-950/20' : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/60'}`}
                >
                  {/* Rank */}
                  <span className={`text-xs font-black w-5 flex-shrink-0 ${isTop ? 'text-amber-400' : 'text-zinc-700'}`}>
                    {i + 1}
                  </span>

                  {/* Thumbnail */}
                  <div className="w-16 h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                    <img src={video.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold line-clamp-1">{video.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-zinc-500 text-[10px]">{video.category}</span>
                      {video.duration && <span className="text-zinc-700 text-[10px]">· {video.duration}</span>}
                    </div>
                  </div>

                  {/* Views */}
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <Eye size={10} className="text-blue-400" />
                      <span className="text-white text-xs font-bold">{fmtViews(video.views)}</span>
                    </div>
                    <p className="text-zinc-500 text-[10px]">views</p>
                  </div>

                  {/* Revenue */}
                  <div className="text-right flex-shrink-0 min-w-[72px]">
                    <p className="text-green-400 text-xs font-black">{fmtKes(rev)}</p>
                    <p className="text-zinc-600 text-[10px]">estimated</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total row */}
          <div className="mt-3 flex items-center justify-end gap-4 px-3 py-3 border-t border-zinc-800">
            <div className="flex items-center gap-1.5">
              <Eye size={12} className="text-blue-400" />
              <span className="text-white text-sm font-black">{fmtViews(totalViews)}</span>
              <span className="text-zinc-500 text-xs">total views</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign size={12} className="text-green-400" />
              <span className="text-green-400 text-sm font-black">{fmtKes(totalRevenue)}</span>
              <span className="text-zinc-500 text-xs">est. earnings</span>
            </div>
          </div>
        </>
      )}

      {/* Payout modal */}
      {showPayout && (
        <PayoutModal
          balance={totalRevenue}
          userPhone={null}
          onClose={() => setShowPayout(false)}
        />
      )}
    </div>
  );
};

export default CreatorStudio;
