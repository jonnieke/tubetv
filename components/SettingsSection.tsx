import React, { useState, useEffect } from 'react';
import { User, Bell, Shield, CreditCard, Smartphone, Globe, Monitor, LogOut, KeyRound, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { updatePin, signOut, supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useLanguage } from '../contexts/LanguageContext';
import { error as logError } from '../lib/logger';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** Convert a VAPID base64 key to the Uint8Array format pushManager.subscribe() expects */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

interface SettingsSectionProps {
  currentUser?: SupabaseUser | null;
  userPhone?: string | null;
  onLogout?: () => void;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ currentUser, userPhone, onLogout }) => {
  const { t, language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState('general');
  // Push notification state — synced with the browser permission
  const [pushEnabled, setPushEnabled]   = useState(false);
  const [pushLoading, setPushLoading]   = useState(false);
  const [pushError,   setPushError]     = useState('');
  const [notifications, setNotifications] = useState({
    recommendations: false,
    updates: true,
  });

  // Reflect current browser permission on mount
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => { if (sub) setPushEnabled(true); })
        .catch(() => {});
    }
  }, []);
  const [preferences, setPreferences] = useState({
    autoplay: true,
    captions: false,
    quality: 'Auto',
    dataSaver: false,
  });

  // Change PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePreference = (key: keyof typeof preferences) => {
    if (typeof preferences[key] === 'boolean') {
      setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const togglePush = async () => {
    setPushError('');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushError('Push notifications are not supported in this browser.');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setPushError('Push notifications are not configured yet (missing VITE_VAPID_PUBLIC_KEY).');
      return;
    }
    if (!currentUser) {
      setPushError('Sign in to enable push notifications.');
      return;
    }

    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      if (pushEnabled) {
        // ── Unsubscribe ────────────────────────────────────────────────────────
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
        }
        setPushEnabled(false);
      } else {
        // ── Subscribe ──────────────────────────────────────────────────────────
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setPushError('Permission denied. Enable notifications in your browser settings.');
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        const key  = sub.getKey('p256dh');
        const auth = sub.getKey('auth');
        await supabase.from('push_subscriptions').upsert({
          user_id:  currentUser.id,
          endpoint: sub.endpoint,
          p256dh:   key  ? btoa(String.fromCharCode(...new Uint8Array(key)))  : '',
          auth:     auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : '',
        }, { onConflict: 'endpoint' });
        setPushEnabled(true);
      }
    } catch (err) {
      logError('Push subscription error:', err);
      setPushError('Something went wrong. Please try again.');
    } finally {
      setPushLoading(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess(false);
    if (currentPin.length !== 6 || newPin.length !== 6 || confirmNewPin.length !== 6) {
      setPinError('All PIN fields must be exactly 6 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinError('New PINs do not match.');
      return;
    }
    if (newPin === currentPin) {
      setPinError('New PIN must be different from your current PIN.');
      return;
    }
    if (!userPhone) {
      setPinError('Unable to identify account. Please sign out and back in.');
      return;
    }
    setPinLoading(true);
    const { error } = await updatePin(currentPin, newPin, userPhone);
    setPinLoading(false);
    if (error) {
      setPinError(error.message);
    } else {
      setPinSuccess(true);
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onLogout?.();
  };

  const displayPhone = userPhone || '—';
  const displayName = currentUser?.user_metadata?.display_name || displayPhone;

  const tabs = [
    { id: 'general',       label: 'General',           icon: Monitor },
    { id: 'account',       label: 'Account',            icon: User },
    { id: 'notifications', label: 'Notifications',      icon: Bell },
    { id: 'billing',       label: 'Billing',            icon: CreditCard },
    { id: 'privacy',       label: 'Privacy & Security', icon: Shield },
  ];

  return (
    <div className="p-4 md:p-8 h-screen overflow-y-auto pb-24 bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('nav.settings')}</h1>
          <p className="text-zinc-400">{t('studio.subtitle')}</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm
                    ${activeTab === tab.id 
                      ? 'bg-white text-black shadow-lg' 
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            
            {/* --- GENERAL SETTINGS --- */}
            {activeTab === 'general' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Monitor className="text-blue-500" /> Playback & Performance
                  </h2>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
                      <div>
                        <p className="font-medium text-white">Autoplay next video</p>
                        <p className="text-sm text-zinc-400">Automatically play suggested videos when one finishes.</p>
                      </div>
                      <button 
                        onClick={() => togglePreference('autoplay')}
                        className={`w-12 h-6 rounded-full transition-colors relative ${preferences.autoplay ? 'bg-green-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${preferences.autoplay ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
                      <div>
                        <p className="font-medium text-white">Data Saver Mode</p>
                        <p className="text-sm text-zinc-400">Auto-selects 360p to save your bundles. Good for 4G.</p>
                      </div>
                      <button 
                        onClick={() => togglePreference('dataSaver')}
                        className={`w-12 h-6 rounded-full transition-colors relative ${preferences.dataSaver ? 'bg-green-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${preferences.dataSaver ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
                       <div>
                        <p className="font-medium text-white">Default Quality</p>
                        <p className="text-sm text-zinc-400">Adjust video quality for your network connection.</p>
                      </div>
                      <select 
                        value={preferences.quality}
                        onChange={(e) => setPreferences(prev => ({ ...prev, quality: e.target.value }))}
                        className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-2.5"
                      >
                        <option>Auto</option>
                        <option>1080p HD</option>
                        <option>720p</option>
                        <option>480p</option>
                        <option>360p (Data Saver)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">Always show captions</p>
                        <p className="text-sm text-zinc-400">Display subtitles on videos by default.</p>
                      </div>
                      <button 
                        onClick={() => togglePreference('captions')}
                        className={`w-12 h-6 rounded-full transition-colors relative ${preferences.captions ? 'bg-green-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${preferences.captions ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Globe className="text-purple-500" /> Language & Region
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block mb-2 text-sm font-medium text-zinc-400">{t('common.language')}</label>
                      <select 
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as any)}
                        className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2.5"
                      >
                        <option value="en">English</option>
                        <option value="sw">Kiswahili</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-zinc-400">Content Location</label>
                      <select className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2.5">
                        <option>Kenya 🇰🇪</option>
                        <option>Uganda 🇺🇬</option>
                        <option>Tanzania 🇹🇿</option>
                        <option>Diaspora (Global)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- ACCOUNT SETTINGS --- */}
            {activeTab === 'account' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 bg-gradient-to-tr from-red-600 to-orange-500 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
                      {displayPhone.slice(-2)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{displayName}</h2>
                      <p className="text-zinc-400 text-sm mt-1">Joined via Phone Number</p>
                      <span className="inline-block mt-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded border border-green-500/20">
                        FREE PLAN
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                     <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Smartphone className="text-zinc-500" size={20} />
                            <div>
                                <p className="text-sm text-zinc-400">Phone Number</p>
                                <p className="font-medium">{displayPhone}</p>
                            </div>
                        </div>
                        <span className="text-zinc-600 text-xs">Primary</span>
                     </div>
                  </div>
                </div>

                {/* Sign Out */}
                {currentUser && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold mb-2">Session</h3>
                    <p className="text-zinc-400 text-sm mb-4">Signed in as {displayPhone}</p>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* --- NOTIFICATIONS SETTINGS --- */}
            {activeTab === 'notifications' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Bell className="text-yellow-500" /> Notification Preferences
                    </h2>

                    <div className="space-y-6">
                        {/* ── Push notifications (real browser API) ───────────── */}
                        <div className="pb-6 border-b border-zinc-800">
                            <div className="flex items-start gap-4">
                                <div className="mt-1">
                                    {pushLoading ? (
                                        <Loader2 size={20} className="animate-spin text-zinc-400" />
                                    ) : (
                                        <button
                                            onClick={togglePush}
                                            disabled={!currentUser}
                                            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                                                pushEnabled ? 'bg-red-600' : 'bg-zinc-700'
                                            } disabled:opacity-40`}
                                            aria-label="Toggle push notifications"
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${pushEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-white">Push Notifications</p>
                                    <p className="text-sm text-zinc-400 mt-0.5">
                                        Get notified about new uploads, live streams, and replies — directly on your device.
                                    </p>
                                    {!currentUser && (
                                        <p className="text-xs text-zinc-500 mt-1">Sign in to enable push notifications.</p>
                                    )}
                                    {pushError && (
                                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                            <AlertCircle size={12} /> {pushError}
                                        </p>
                                    )}
                                    {pushEnabled && (
                                        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Active on this device
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Simple preference toggles ────────────────────────── */}
                        {(Object.entries(notifications) as [keyof typeof notifications, boolean][]).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-4 pb-6 border-b border-zinc-800 last:border-0 last:pb-0">
                                <div className="mt-1">
                                    <input
                                        type="checkbox"
                                        checked={value}
                                        onChange={() => setNotifications(prev => ({ ...prev, [key]: !prev[key] }))}
                                        className="w-5 h-5 rounded border-zinc-700 bg-zinc-800 text-red-600 focus:ring-red-500 focus:ring-offset-zinc-900"
                                    />
                                </div>
                                <div>
                                    <p className="font-medium capitalize text-white">{(key as string).replace(/([A-Z])/g, ' $1').trim()}</p>
                                    <p className="text-sm text-zinc-400">
                                        {key === 'recommendations' && 'Notify me about videos I might like based on my watch history.'}
                                        {key === 'updates' && 'Important announcements about service features and policy changes.'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- BILLING SETTINGS --- */}
            {activeTab === 'billing' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Current Plan */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center justify-between">
                        <div>
                            <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Current Plan</p>
                            <h2 className="text-2xl font-bold text-white">Free — All Access</h2>
                            <p className="text-zinc-400 text-sm mt-1">All content is free during our community-building phase.</p>
                        </div>
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30 flex-shrink-0">
                            ACTIVE
                        </span>
                    </div>

                    {/* Coming soon banner */}
                    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-red-900/30 to-zinc-900 border border-red-500/20 p-8 text-center">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <div className="p-3 bg-red-600/20 rounded-full">
                                <CreditCard className="w-7 h-7 text-red-400" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2">Subscription Plans Coming Soon</h3>
                        <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
                            We're building a seamless M-Pesa billing experience powered by header enrichment —
                            subscribe with a single tap, no card required.
                        </p>
                        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
                            {['One-tap M-Pesa', 'No card needed', 'Ksh 150 / mo', 'Cancel anytime'].map(feat => (
                                <span key={feat} className="px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-full border border-zinc-700">
                                    {feat}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- PRIVACY SETTINGS --- */}
            {activeTab === 'privacy' && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Change PIN */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                            <KeyRound className="text-red-500" /> Change PIN
                        </h2>
                        <p className="text-sm text-zinc-400 mb-6">Your PIN is used to sign into your account — keep it private like your M-Pesa PIN.</p>

                        {pinSuccess ? (
                            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400">
                                <CheckCircle2 size={20} />
                                <p className="font-medium">PIN updated successfully!</p>
                            </div>
                        ) : (
                            <form onSubmit={handleChangePin} className="space-y-4">
                                <div className="relative">
                                    <label className="block text-xs text-zinc-500 mb-1.5 ml-1">Current PIN</label>
                                    <input
                                        type={showPins ? 'text' : 'password'}
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={currentPin}
                                        onChange={(e) => { setCurrentPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                                        placeholder="6-digit PIN"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors font-mono tracking-widest text-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1.5 ml-1">New PIN</label>
                                    <input
                                        type={showPins ? 'text' : 'password'}
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={newPin}
                                        onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                                        placeholder="6-digit PIN"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors font-mono tracking-widest text-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 mb-1.5 ml-1">Confirm New PIN</label>
                                    <input
                                        type={showPins ? 'text' : 'password'}
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={confirmNewPin}
                                        onChange={(e) => { setConfirmNewPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                                        placeholder="Repeat new PIN"
                                        className={`w-full bg-zinc-950 border rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none transition-colors font-mono tracking-widest text-lg
                                            ${pinError ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-600'}`}
                                    />
                                </div>

                                {pinError && (
                                    <p className="text-red-400 text-xs flex items-center gap-1 ml-1">
                                        <AlertCircle size={12} /> {pinError}
                                    </p>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setShowPins(!showPins)}
                                    className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                                >
                                    {showPins ? <EyeOff size={12} /> : <Eye size={12} />}
                                    {showPins ? 'Hide PINs' : 'Show PINs'}
                                </button>

                                <button
                                    type="submit"
                                    disabled={pinLoading || currentPin.length < 6 || newPin.length < 6 || confirmNewPin.length < 6}
                                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {pinLoading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                                    Update PIN
                                </button>
                            </form>
                        )}
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Shield className="text-green-500" /> Privacy
                        </h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Active Sessions</p>
                                    <p className="text-sm text-zinc-400">Manage devices where you're currently logged in.</p>
                                </div>
                                <button className="text-zinc-400 hover:text-white text-sm">View all</button>
                            </div>
                        </div>
                    </div>
                 </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsSection;