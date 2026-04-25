import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
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
  }

  public render() {
    if (this.state.hasError) {
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

    return this.props.children;
  }
}
