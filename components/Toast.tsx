import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-zinc-900 border-green-500/50 text-green-400',
  error:   'bg-zinc-900 border-red-500/50   text-red-400',
  warning: 'bg-zinc-900 border-yellow-500/50 text-yellow-400',
  info:    'bg-zinc-900 border-blue-500/50   text-blue-400',
};

let counter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = `toast-${++counter}`;
    setToasts(prev => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const value: ToastContextValue = {
    success: msg => push('success', msg),
    error:   msg => push('error', msg),
    warning: msg => push('warning', msg),
    info:    msg => push('info', msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Portal-style fixed stack */}
      <div className="fixed bottom-24 md:bottom-6 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl max-w-sm w-full
                pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-300 ${STYLES[t.type]}`}
            >
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-white text-sm flex-1">{t.message}</p>
              <button onClick={() => remove(t.id)} className="text-zinc-500 hover:text-white transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
