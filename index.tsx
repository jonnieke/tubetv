import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LanguageProvider } from './contexts/LanguageContext';
import { isDynamicChunkLoadError, triggerChunkRecoveryReload } from './lib/chunkRecovery';

// Auto-recover from stale deployment chunk errors (404 on dynamically imported chunks)
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    triggerChunkRecoveryReload();
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isDynamicChunkLoadError(event.reason)) {
      event.preventDefault();
      triggerChunkRecoveryReload();
    }
  });
}

const AdminInviteSetup = lazy(() => import('./components/AdminInviteSetup'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        {window.location.pathname === '/admin/setup' ? (
          <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
            <AdminInviteSetup />
          </Suspense>
        ) : (
          <App />
        )}
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshingForServiceWorkerUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshingForServiceWorkerUpdate) return;
    refreshingForServiceWorkerUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        void registration.update();
      })
      .catch(() => {
        // Non-fatal in private browsing or restricted WebViews
      });
  });
}
