
import React, { useState } from 'react';
import { CheckCircle, ChevronRight, Sparkles } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Interest {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

const INTERESTS: Interest[] = [
  { id: 'kilimo',    label: 'Kilimo',    emoji: '🌿', color: 'bg-green-500/20 border-green-500/50 text-green-300' },
  { id: 'faith',     label: 'Imani',     emoji: '✝️',  color: 'bg-amber-500/20 border-amber-500/50 text-amber-300' },
  { id: 'education', label: 'Elimu',     emoji: '📚', color: 'bg-blue-500/20 border-blue-500/50 text-blue-300' },
  { id: 'comedy',    label: 'Vichekesho',emoji: '😂', color: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300' },
  { id: 'drama',     label: 'Drama',     emoji: '🎭', color: 'bg-red-500/20 border-red-500/50 text-red-300' },
  { id: 'sports',    label: 'Michezo',   emoji: '⚽', color: 'bg-orange-500/20 border-orange-500/50 text-orange-300' },
  { id: 'music',     label: 'Muziki',    emoji: '🎵', color: 'bg-pink-500/20 border-pink-500/50 text-pink-300' },
  { id: 'kids',      label: 'Watoto',    emoji: '🧒', color: 'bg-violet-500/20 border-violet-500/50 text-violet-300' },
  { id: 'wildlife',  label: 'Wanyama',   emoji: '🦁', color: 'bg-teal-500/20 border-teal-500/50 text-teal-300' },
  { id: 'fashion',   label: 'Mitindo',   emoji: '👗', color: 'bg-rose-500/20 border-rose-500/50 text-rose-300' },
  { id: 'business',  label: 'Biashara',  emoji: '💼', color: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' },
  { id: 'news',      label: 'Habari',    emoji: '📰', color: 'bg-zinc-500/20 border-zinc-500/50 text-zinc-300' },
];

const LANGUAGES = [
  { id: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
  { id: 'en', label: 'English',   flag: '🌍' },
  { id: 'both', label: 'Both / Zote', flag: '🤝' },
] as const;

type LangId = typeof LANGUAGES[number]['id'];

interface Props {
  onDone: (interests: string[], language: LangId) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const OnboardingQuiz: React.FC<Props> = ({ onDone }) => {
  const [step, setStep] = useState<'interests' | 'language' | 'done'>('interests');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lang, setLang] = useState<LangId>('both');

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDone = () => {
    const interests = Array.from(selected);
    try {
      localStorage.setItem('tube_interests', JSON.stringify(interests));
      localStorage.setItem('tube_language_pref', lang);
      localStorage.setItem('tube_onboarded', '1');
    } catch {}
    onDone(interests, lang);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-zinc-950 flex flex-col overflow-y-auto">
      {/* ── Logo strip ── */}
      <div className="flex items-center gap-2 px-6 py-5 flex-shrink-0">
        <span className="font-black text-xl tracking-tight text-white">Tube</span>
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-sm bg-red-600 text-white uppercase tracking-wider">TV</span>
        <span className="ml-2 text-2xl">🇰🇪</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-6 pb-12 max-w-lg mx-auto w-full">

        {step === 'interests' && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="mb-8">
              <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center mb-4">
                <Sparkles size={20} className="text-red-400" />
              </div>
              <h1 className="text-2xl font-black text-white mb-2">Unachopenda kutazama?</h1>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Chagua mada unazopenda — tutakupendekeza maudhui yanayokufaa.
              </p>
              <p className="text-zinc-600 text-xs mt-1">Select at least 2 interests</p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-8">
              {INTERESTS.map(interest => {
                const isOn = selected.has(interest.id);
                return (
                  <button
                    key={interest.id}
                    onClick={() => toggle(interest.id)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-95 ${
                      isOn
                        ? interest.color + ' border-current scale-[1.03] shadow-lg'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <span className="text-2xl leading-none">{interest.emoji}</span>
                    <span className="text-[11px] font-bold">{interest.label}</span>
                    {isOn && (
                      <CheckCircle size={12} className="text-current opacity-70" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep('language')}
              disabled={selected.size < 2}
              className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-red-900/30"
            >
              Endelea <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 'language' && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="mb-8">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center mb-4">
                <span className="text-xl">🌐</span>
              </div>
              <h1 className="text-2xl font-black text-white mb-2">Lugha unayopenda?</h1>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Which language do you prefer for content?
              </p>
            </div>

            <div className="flex flex-col gap-3 mb-10">
              {LANGUAGES.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all active:scale-[0.99] ${
                    lang === l.id
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-2xl">{l.flag}</span>
                  <span className="font-bold text-base">{l.label}</span>
                  {lang === l.id && (
                    <CheckCircle size={18} className="ml-auto text-blue-400" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={handleDone}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-black rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-red-900/30"
            >
              <CheckCircle size={18} /> Anza Kutazama!
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingQuiz;
