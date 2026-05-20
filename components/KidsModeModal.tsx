
import React, { useState, useRef, useEffect } from 'react';
import { Baby, Lock, ShieldCheck, X } from 'lucide-react';
import { hasKidsPin, verifyKidsPin, setKidsPin, setKidsModeActive } from '../lib/kidsMode';

interface Props {
  mode: 'activate' | 'deactivate';
  onSuccess: () => void;
  onCancel: () => void;
}

const PIN_LENGTH = 4;

const KidsModeModal: React.FC<Props> = ({ mode, onSuccess, onCancel }) => {
  const [step, setStep] = useState<'info' | 'set-pin' | 'confirm-pin' | 'enter-pin'>(() => {
    if (mode === 'deactivate') return 'enter-pin';
    if (hasKidsPin())         return 'enter-pin'; // already has a pin, just confirm to re-enable
    return 'info';
  });
  const [pin, setPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError]     = useState('');
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [step]);

  const handleDigit = (digit: string, target: 'pin' | 'confirm') => {
    const setter = target === 'pin' ? setPin : setConfirmPin;
    const current = target === 'pin' ? pin : confirmPin;
    if (current.length < PIN_LENGTH) setter(current + digit);
  };

  const handleBackspace = (target: 'pin' | 'confirm') => {
    if (target === 'pin') setPin(p => p.slice(0, -1));
    else setConfirmPin(p => p.slice(0, -1));
  };

  const handleSetPin = () => {
    if (pin.length < PIN_LENGTH) { setError('Enter a 4-digit PIN'); return; }
    setError('');
    setStep('confirm-pin');
  };

  const handleConfirmPin = () => {
    if (pin !== confirmPin) { setError('PINs do not match'); setConfirmPin(''); return; }
    setKidsPin(pin);
    setKidsModeActive(true);
    onSuccess();
  };

  const handleEnterPin = () => {
    if (mode === 'activate') {
      // re-enable: pin must match
      if (!verifyKidsPin(pin)) { setError('Incorrect PIN'); setPin(''); return; }
      setKidsModeActive(true);
    } else {
      if (!verifyKidsPin(pin)) { setError('Incorrect PIN'); setPin(''); return; }
      setKidsModeActive(false);
    }
    onSuccess();
  };

  const PinDots = ({ value }: { value: string }) => (
    <div className="flex gap-3 justify-center my-4">
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < value.length ? 'bg-violet-500 border-violet-500 scale-110' : 'border-zinc-600'}`} />
      ))}
    </div>
  );

  const Numpad = ({ target }: { target: 'pin' | 'confirm' }) => (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => (
        <button
          key={i}
          onClick={() => d === '⌫' ? handleBackspace(target) : d !== '' ? handleDigit(String(d), target) : undefined}
          className={`h-12 rounded-xl font-bold text-lg transition-all ${d === '' ? 'invisible' : 'bg-zinc-800 hover:bg-zinc-700 text-white active:scale-95'}`}
        >{d}</button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onClick={onCancel}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-xs relative shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onCancel} className="absolute top-4 right-4 text-zinc-600 hover:text-white transition-colors"><X size={16} /></button>

        {/* ── Info step ── */}
        {step === 'info' && (
          <>
            <div className="flex flex-col items-center text-center gap-3 mb-6">
              <div className="w-14 h-14 bg-violet-600/20 rounded-2xl flex items-center justify-center border border-violet-500/30">
                <Baby className="w-7 h-7 text-violet-400" />
              </div>
              <h2 className="text-white font-black text-xl">Kids Mode</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Restricts Tube to safe content only — Kids &amp; Education categories. Set a 4-digit PIN so only parents can turn it off.
              </p>
              <ul className="text-left text-xs text-zinc-500 space-y-1.5 w-full mt-1">
                <li className="flex items-center gap-2"><ShieldCheck size={12} className="text-violet-400 flex-shrink-0" /> Only Kids &amp; Education videos shown</li>
                <li className="flex items-center gap-2"><ShieldCheck size={12} className="text-violet-400 flex-shrink-0" /> Navigation restricted to safe views</li>
                <li className="flex items-center gap-2"><Lock size={12} className="text-violet-400 flex-shrink-0" /> PIN required to exit kids mode</li>
              </ul>
            </div>
            <button onClick={() => setStep('set-pin')} className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-black rounded-xl transition-colors">
              Set PIN &amp; Enable
            </button>
          </>
        )}

        {/* ── Set PIN step ── */}
        {step === 'set-pin' && (
          <>
            <div className="text-center mb-2">
              <h2 className="text-white font-black text-lg">Create a PIN</h2>
              <p className="text-zinc-500 text-sm mt-1">You'll need this to exit Kids Mode</p>
            </div>
            <PinDots value={pin} />
            {error && <p className="text-red-400 text-xs text-center mb-1">{error}</p>}
            <Numpad target="pin" />
            <button
              onClick={handleSetPin}
              disabled={pin.length < PIN_LENGTH}
              className="w-full mt-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors"
            >Next</button>
          </>
        )}

        {/* ── Confirm PIN step ── */}
        {step === 'confirm-pin' && (
          <>
            <div className="text-center mb-2">
              <h2 className="text-white font-black text-lg">Confirm PIN</h2>
              <p className="text-zinc-500 text-sm mt-1">Enter the same PIN again</p>
            </div>
            <PinDots value={confirmPin} />
            {error && <p className="text-red-400 text-xs text-center mb-1">{error}</p>}
            <Numpad target="confirm" />
            <button
              onClick={handleConfirmPin}
              disabled={confirmPin.length < PIN_LENGTH}
              className="w-full mt-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors"
            >Enable Kids Mode</button>
          </>
        )}

        {/* ── Enter PIN step (activate or deactivate) ── */}
        {step === 'enter-pin' && (
          <>
            <div className="text-center mb-2">
              <div className="w-10 h-10 bg-violet-600/20 rounded-xl flex items-center justify-center border border-violet-500/30 mx-auto mb-3">
                <Lock className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-white font-black text-lg">
                {mode === 'deactivate' ? 'Exit Kids Mode' : 'Enable Kids Mode'}
              </h2>
              <p className="text-zinc-500 text-sm mt-1">Enter your parental PIN</p>
            </div>
            <PinDots value={pin} />
            {error && <p className="text-red-400 text-xs text-center mb-1">{error}</p>}
            <Numpad target="pin" />
            <button
              onClick={handleEnterPin}
              disabled={pin.length < PIN_LENGTH}
              className="w-full mt-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors"
            >{mode === 'deactivate' ? 'Exit Kids Mode' : 'Enable'}</button>
          </>
        )}
      </div>
    </div>
  );
};

export default KidsModeModal;
