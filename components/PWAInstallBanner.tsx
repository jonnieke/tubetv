
import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Wifi, Zap } from 'lucide-react';
import { shouldShowBanner, promptInstall, dismiss, isIOS, isInstallable } from '../lib/pwa';

const PWAInstallBanner: React.FC = () => {
  const [show, setShow] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check immediately (in case already installable)
    if (shouldShowBanner()) setShow(true);

    // Also check when the browser fires installable event
    const handler = () => { if (shouldShowBanner()) setShow(true); };
    window.addEventListener('tube-pwa-installable', handler);
    window.addEventListener('tube-pwa-installed', () => setShow(false));
    return () => {
      window.removeEventListener('tube-pwa-installable', handler);
    };
  }, []);

  if (!show) return null;

  const handleInstall = async () => {
    if (isIOS() && !isInstallable()) {
      // Show iOS instructions — just dismiss and let user know
      alert('To install on iPhone: tap the Share button (□↑) in Safari, then "Add to Home Screen"');
      handleDismiss();
      return;
    }
    setInstalling(true);
    const accepted = await promptInstall();
    setInstalling(false);
    if (accepted) setShow(false);
  };

  const handleDismiss = () => {
    dismiss();
    setShow(false);
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 left-0 right-0 z-[140] px-3 animate-in slide-in-from-bottom-3 duration-400">
      <div className="max-w-sm mx-auto md:mx-0 md:ml-auto md:mr-4 bg-gradient-to-r from-zinc-900 to-zinc-800 border border-zinc-600 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-0.5 bg-gradient-to-r from-red-600 via-orange-500 to-red-600" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* App icon */}
            <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-white font-black text-lg">T</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-white font-black text-sm">Install Tube TV</p>
                <button onClick={handleDismiss} className="text-zinc-600 hover:text-zinc-400 transition-colors p-0.5 -mr-0.5 -mt-0.5">
                  <X size={14} />
                </button>
              </div>
              <p className="text-zinc-400 text-xs mt-0.5">Kenya's streaming app · Free</p>

              {/* Benefits */}
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <Wifi size={9} className="text-blue-400" /> Works offline
                </span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <Zap size={9} className="text-yellow-400" /> Loads faster
                </span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <Smartphone size={9} className="text-green-400" /> Home screen
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleInstall}
            disabled={installing}
            className="mt-3 w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Download size={15} />
            {installing ? 'Installing…' : isIOS() ? 'How to Install' : 'Add to Home Screen'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
