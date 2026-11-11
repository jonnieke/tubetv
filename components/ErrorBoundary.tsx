import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

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
    const msg = error?.message || '';
    const isDynamicChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module');

    if (isDynamicChunkError && typeof window !== 'undefined') {
      const lastReload = Number(sessionStorage.getItem('tubetv_chunk_reload_ts') || 0);
      if (Date.now() - lastReload > 8_000) {
        sessionStorage.setItem('tubetv_chunk_reload_ts', String(Date.now()));
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || '';
      const isDynamicChunkError =
        errorMsg.includes('Failed to fetch dynamically imported module') ||
        errorMsg.includes('Importing a module script failed') ||
        errorMsg.includes('error loading dynamically imported module');

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
              onClick={() => window.location.reload()}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-lg text-sm"
            >
              <RefreshCcw size={16} />
              Refresh Now
            </button>
          </div>
        );
      }

      return (
        <div className="h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-red-500/10 p-6 rounded-full mb-6">
                <AlertTriangle className="w-16 h-16 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Something went wrong.</h1>
            <p className="text-zinc-400 max-w-md mb-8">
                We're sorry, but an unexpected error occurred. Please try refreshing the page.
            </p>
            <div className="flex gap-4">
                <button 
                    onClick={() => window.location.reload()}
                    className="bg-white hover:bg-zinc-200 text-black font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-lg"
                >
                    <RefreshCcw size={18} />
                    Refresh Page
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
