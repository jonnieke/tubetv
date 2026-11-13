import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react';
import {
  hardResetAppCachesAndReload,
  isDynamicChunkLoadError,
  triggerChunkRecoveryReload,
} from '../lib/chunkRecovery';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
  }

  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    if (isDynamicChunkLoadError(error)) {
      triggerChunkRecoveryReload();
    }
  }

  public render() {
    if (this.state.hasError) {
      const isDynamicChunkError = isDynamicChunkLoadError(this.state.error);

      if (isDynamicChunkError) {
        return (
          <div className="h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
            <div className="bg-emerald-500/10 p-5 rounded-full mb-5">
              <RefreshCcw className="w-12 h-12 text-emerald-400 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Updating TubeTV...</h1>
            <p className="text-zinc-400 max-w-md mb-6 text-sm">
              A fresh update has just been deployed. Updating your session to load the latest features...
            </p>
            <button
              onClick={() => void hardResetAppCachesAndReload()}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-lg text-sm"
            >
              <RefreshCcw size={16} />
              Refresh Now
            </button>
          </div>
        );
      }

      return (
        <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-red-500/10 p-6 rounded-full mb-6">
                <AlertTriangle className="w-16 h-16 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Something went wrong.</h1>
            <p className="text-zinc-400 max-w-md mb-8">
                We're sorry, but an unexpected error occurred. Please try refreshing the page.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
                <button 
                    onClick={() => void hardResetAppCachesAndReload()}
                    className="bg-white hover:bg-zinc-200 text-black font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-lg"
                >
                    <RefreshCcw size={18} />
                    Refresh Page
                </button>
                <button
                    onClick={() => void hardResetAppCachesAndReload('/')}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-semibold px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Home size={18} />
                    Go Home
                </button>
            </div>
            {this.state.error && (
                <div className="mt-12 bg-black/50 border border-zinc-800 rounded p-4 text-left max-w-2xl overflow-auto text-xs text-red-400 font-mono">
                    {this.state.error.toString()}
                </div>
            )}
        </div>
      );
    }

    return (this as unknown as { props: Props }).props.children;
  }
}

interface SectionProps {
  children?: ReactNode;
  label?: string;
  onReset?: () => void;
}

interface SectionState {
  hasError: boolean;
}

export class SectionErrorBoundary extends React.Component<SectionProps, SectionState> {
  public state: SectionState = { hasError: false };

  public static getDerivedStateFromError(): SectionState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Section error:', error, errorInfo);
    if (isDynamicChunkLoadError(error)) {
      triggerChunkRecoveryReload();
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/95 p-6 text-center text-white">
          <p className="text-sm font-semibold mb-2">
            {this.props.label ? `Unable to load ${this.props.label}.` : 'Unable to load this section.'}
          </p>
          <p className="text-xs text-zinc-400 mb-4">
            Try reloading this view or refreshing the page.
          </p>
          <div className="flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onReset?.();
              }}
              className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-black hover:bg-zinc-200 transition-colors"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => void hardResetAppCachesAndReload()}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Refresh App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
