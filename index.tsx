import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LanguageProvider } from './contexts/LanguageContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  let refreshingForServiceWorkerUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingForServiceWorkerUpdate) return;
    refreshingForServiceWorkerUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      console.log('SW registered: ', registration);
      void registration.update();
    }).catch((registrationError) => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
