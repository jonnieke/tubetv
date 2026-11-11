import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LanguageProvider } from './contexts/LanguageContext';

// Auto-recover from stale deployment chunk errors (404 on dynamically imported chunks)
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const lastReload = Number(sessionStorage.getItem('tubetv_chunk_reload_ts') || 0);
    if (Date.now() - lastReload > 8_000) {
      sessionStorage.setItem('tubetv_chunk_reload_ts', String(Date.now()));
      window.location.reload();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event.reason?.message || event.reason || '');
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module')
    ) {
      event.preventDefault();
      const lastReload = Number(sessionStorage.getItem('tubetv_chunk_reload_ts') || 0);
      if (Date.now() - lastReload > 8_000) {
        sessionStorage.setItem('tubetv_chunk_reload_ts', String(Date.now()));
        window.location.reload();
      }
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
