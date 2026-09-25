import React, { useEffect, useState } from 'react';
import { Check, Download, Globe, Loader2, LogOut, Monitor, Shield, Smartphone, Trash2, User } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { PlaybackPreferences } from '../lib/viewerState';
import { useLanguage } from '../contexts/LanguageContext';
import { deleteAccount, exportAccountData } from '../lib/privacy';

interface SettingsSectionProps {
  currentUser?: SupabaseUser | null;
  initialTab?: 'general' | 'account' | 'privacy';
  userPhone?: string | null;
  onLogout?: () => void;
  preferences: PlaybackPreferences;
  onPreferencesChange: (preferences: PlaybackPreferences) => void;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  currentUser,
  userPhone,
  onLogout,
  preferences,
  initialTab = 'general',
  onPreferencesChange,
}) => {
  const { language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const updatePreference = <K extends keyof PlaybackPreferences>(key: K, value: PlaybackPreferences[K]) => {
    onPreferencesChange({ ...preferences, [key]: value });
  };

  const handleSignOut = async () => {
    onLogout?.();
  };

  const handleExport = async () => {
    if (!currentUser) return setPrivacyMessage('Sign in to export your account data.');
    try {
      setPrivacyBusy(true);
      setPrivacyMessage('');
      const data = await exportAccountData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `tubetv-account-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setPrivacyMessage('Your account export has downloaded.');
    } catch (error) {
      setPrivacyMessage(error instanceof Error ? error.message : 'Could not export your data.');
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') return;
    try {
      setPrivacyBusy(true);
      await deleteAccount(deleteConfirmation);
      onLogout?.();
    } catch (error) {
      setPrivacyMessage(error instanceof Error ? error.message : 'Could not delete your account.');
      setPrivacyBusy(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'Playback', icon: Monitor },
    { id: 'account', label: 'Account', icon: User },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ];

  return (
    <div className="h-screen overflow-y-auto bg-zinc-950 p-4 pb-24 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-2 text-sm text-zinc-400">Manage playback, your local admin access and TubeTV preferences.</p>
        </header>

        <div className="flex flex-col gap-8 lg:flex-row">
          <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto lg:w-52 lg:flex-col">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-black' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}>
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1">
            {activeTab === 'general' && (
              <section aria-labelledby="playback-heading" className="space-y-6">
                <div>
                  <h2 id="playback-heading" className="text-xl font-bold">Playback and data</h2>
                  <p className="mt-1 text-sm text-zinc-400">Changes are saved to this account and applied to the player.</p>
                </div>
                <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                  <SettingToggle label="Autoplay next video" description="Continue with the next programme when one finishes." checked={preferences.autoplay} onChange={(value) => updatePreference('autoplay', value)} />
                  <SettingToggle label="Data Saver" description="Prefer 360p and avoid preloading full videos." checked={preferences.dataSaver} onChange={(value) => updatePreference('dataSaver', value)} />
                  <SettingToggle label="Captions by default" description="Show provided caption tracks automatically." checked={preferences.captions} onChange={(value) => updatePreference('captions', value)} />
                  <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Default quality</p>
                      <p className="text-sm text-zinc-400">Data Saver overrides this to 360p.</p>
                    </div>
                    <select value={preferences.quality} onChange={(event) => updatePreference('quality', event.target.value as PlaybackPreferences['quality'])} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white">
                      <option value="auto">Auto</option>
                      <option value="1080p">1080p</option>
                      <option value="720p">720p</option>
                      <option value="480p">480p</option>
                      <option value="360p">360p</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Maximum content rating</p>
                      <p className="text-sm text-zinc-400">18-rated and unrated content remains unavailable.</p>
                    </div>
                    <select aria-label="Maximum content rating" value={preferences.maximumRating} onChange={(event) => updatePreference('maximumRating', event.target.value as PlaybackPreferences['maximumRating'])} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white">
                      <option value="GE">GE, all ages</option>
                      <option value="PG">PG, parental guidance</option>
                      <option value="16">16 and below</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3"><Globe className="text-zinc-500" size={20} /><div><p className="font-medium">Language</p><p className="text-sm text-zinc-400">Interface language for this device.</p></div></div>
                    <select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'sw')} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white">
                      <option value="en">English</option>
                      <option value="sw">Kiswahili</option>
                    </select>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'account' && (
              <section aria-labelledby="account-heading">
                <h2 id="account-heading" className="text-xl font-bold">Local access</h2>
                <div className="mt-6 border-y border-zinc-800 py-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 text-green-400"><Smartphone size={22} /></div>
                    <div><p className="font-medium">{currentUser?.user_metadata?.display_name || 'TubeTV admin'}</p><p className="text-sm text-zinc-400">{userPhone || 'Not signed in'}</p></div>
                  </div>
                </div>
                <button onClick={handleSignOut} className="mt-6 flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300"><LogOut size={17} /> Sign out</button>
              </section>
            )}

            {activeTab === 'privacy' && (
              <section aria-labelledby="privacy-heading">
                <h2 id="privacy-heading" className="text-xl font-bold">Privacy</h2>
                <p className="mt-2 text-sm text-zinc-400">Access a portable copy of your account or permanently erase it.</p>
                <div className="mt-6 border-y border-zinc-800 py-5">
                  <h3 className="font-medium">Download my data</h3>
                  <p className="mt-1 text-sm text-zinc-400">Includes profile, watch list, progress and preferences.</p>
                  <button disabled={privacyBusy || !currentUser} onClick={handleExport} className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold hover:bg-zinc-700 disabled:opacity-50">
                    {privacyBusy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} Download JSON
                  </button>
                </div>
                <div className="border-b border-zinc-800 py-5">
                  <h3 className="font-medium text-red-400">Delete account</h3>
                  <p className="mt-1 text-sm text-zinc-400">This permanently deletes your login and linked TubeTV records. This cannot be undone.</p>
                  <label htmlFor="delete-confirmation" className="mt-4 block text-sm font-medium">Type DELETE to confirm</label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
                    <button disabled={privacyBusy || deleteConfirmation !== 'DELETE' || !currentUser} onClick={handleDeleteAccount} className="flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold hover:bg-red-600 disabled:opacity-40">
                      <Trash2 size={16} /> Delete permanently
                    </button>
                  </div>
                </div>
                {privacyMessage && <p role="status" className="mt-4 text-sm text-zinc-300">{privacyMessage}</p>}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingToggle = ({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) => (
  <div className="flex items-center justify-between gap-5 py-5">
    <div><p className="font-medium">{label}</p><p className="text-sm text-zinc-400">{description}</p></div>
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-zinc-700'}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

export default SettingsSection;
