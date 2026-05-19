import React, { useState } from 'react';
import { X, Smartphone, CheckCircle, Loader2 } from 'lucide-react';

interface Props {
  creatorName: string;
  onClose: () => void;
}

const AMOUNTS = [50, 100, 200, 500];

const TipJarModal: React.FC<Props> = ({ creatorName, onClose }) => {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [step, setStep] = useState<'input' | 'confirming' | 'success'>('input');
  const [countdown, setCountdown] = useState(3);

  const handleSubmit = () => {
    if (!phone || !amount) return;
    setStep('confirming');
    let c = 3;
    const interval = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(interval);
        setStep('success');
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <p className="text-white font-black text-base">Tip {creatorName}</p>
            <p className="text-zinc-500 text-xs mt-0.5">Support via M-Pesa</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {step === 'input' && (
          <div className="p-5 space-y-5">
            <div>
              <p className="text-zinc-400 text-[11px] font-black tracking-wider mb-3">AMOUNT (KES)</p>
              <div className="grid grid-cols-4 gap-2">
                {AMOUNTS.map(a => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    className={`py-3 rounded-xl text-sm font-black border transition-all ${
                      amount === a
                        ? 'bg-green-600 text-white border-green-600 shadow shadow-green-900/40'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-green-500/50 hover:text-green-300'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-zinc-400 text-[11px] font-black tracking-wider mb-2">YOUR M-PESA NUMBER</p>
              <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 focus-within:border-green-500/50 transition-colors">
                <Smartphone size={14} className="text-zinc-500 flex-shrink-0" />
                <input
                  type="tel"
                  placeholder="07XX XXX XXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="bg-transparent text-white text-sm flex-1 outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!phone || !amount}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl transition-all text-sm"
            >
              {amount ? `Send KES ${amount} via M-Pesa` : 'Select an amount'}
            </button>

            <p className="text-zinc-700 text-[10px] text-center">
              100% goes directly to the creator. Powered by Safaricom M-Pesa.
            </p>
          </div>
        )}

        {step === 'confirming' && (
          <div className="p-10 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center border border-green-500/30">
              <Loader2 size={28} className="text-green-400 animate-spin" />
            </div>
            <p className="text-white font-black text-lg">Check your phone</p>
            <p className="text-zinc-400 text-sm leading-relaxed">
              M-Pesa prompt sent to<br />
              <span className="text-white font-bold">{phone}</span>.<br />
              Enter your PIN to confirm.
            </p>
            <p className="text-zinc-600 text-xs">Auto-confirming in {countdown}s…</p>
          </div>
        )}

        {step === 'success' && (
          <div className="p-10 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center border border-green-500/30">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <p className="text-white font-black text-lg">Tip Sent!</p>
            <p className="text-zinc-400 text-sm leading-relaxed">
              KES {amount} sent to <span className="text-white font-bold">{creatorName}</span>.<br />
              Thank you for supporting Kenyan creators!
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all border border-zinc-700"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TipJarModal;
