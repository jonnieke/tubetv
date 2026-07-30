import React, { useEffect, useState } from 'react';
import { Check, CreditCard, Download, Globe, Loader2, LogOut, Monitor, Shield, Smartphone, Trash2, User } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { signOut } from '../lib/supabase';
import type { ActiveSubscription, SubscriptionPlanCode } from '../lib/subscriptions';
import { fetchPaymentStatus, startMpesaPayment, SUBSCRIPTION_PLANS } from '../lib/subscriptions';
import type { PlaybackPreferences } from '../lib/viewerState';
import { useLanguage } from '../contexts/LanguageContext';
import { deleteAccount, exportAccountData } from '../lib/privacy';
import { trackEvent } from '../lib/analytics';

interface SettingsSectionProps {
  currentUser?: SupabaseUser | null;
  initialTab?: 'general' | 'billing';
  userPhone?: string | null;
  onLogout?: () => void;
  preferences: PlaybackPreferences;
  onPreferencesChange: (preferences: PlaybackPreferences) => void;
  activeSubscription: ActiveSubscription | null;
  onSubscriptionRefresh: () => Promise<void>;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  currentUser,
  userPhone,
  onLogout,
  preferences,
  initialTab = 'general',
  onPreferencesChange,
  activeSubscription,
  onSubscriptionRefresh,
}) => {
  const { language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [paymentState, setPaymentState] = useState<'idle' | 'requesting' | 'waiting' | 'succeeded' | 'failed'>('idle');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const updatePreference = <K extends keyof PlaybackPreferences>(key: K, value: PlaybackPreferences[K]) => {
    onPreferencesChange({ ...preferences, [key]: value });
  };

  const handlePurchase = async (planCode: SubscriptionPlanCode) => {
    if (!currentUser) {
      setPaymentState('failed');
      setPaymentMessage('Sign in with your verified phone number before subscribing.');
      return;
    }

    const amountKes = SUBSCRIPTION_PLANS[planCode].amountKes;
    trackEvent('checkout_start', { plan: planCode, amountKes });
    try {
      setPaymentState('requesting');
      setPaymentMessage('');
      const transaction = await startMpesaPayment(planCode);
      setPaymentState('waiting');
      setPaymentMessage(transaction.message || 'Check your phone and enter your M-Pesa PIN.');
      trackEvent('checkout_submitted', { plan: planCode, amountKes });

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        const status = await fetchPaymentStatus(transaction.id);
        if (status.status === 'succeeded') {
          setPaymentState('succeeded');
          setPaymentMessage('Payment received. Premium access is active.');
          trackEvent('subscription_activated', { plan: planCode, amountKes });
          await onSubscriptionRefresh();
          return;
        }
        if (status.status === 'failed' || status.status === 'cancelled') {
          setPaymentState('failed');
          setPaymentMessage(status.result_description || 'Payment was not completed.');
          trackEvent('checkout_failed', { plan: planCode, reason: status.status });
          return;
        }
      }

      setPaymentState('waiting');
      setPaymentMessage('Payment is still processing. Your access will activate automatically when M-Pesa confirms it.');
    } catch (error) {
      setPaymentState('failed');
      setPaymentMessage(error instanceof Error ? error.message : 'Unable to start the M-Pesa request.');
      trackEvent('checkout_failed', { plan: planCode, reason: 'request_error' });
    }
  };

  const handleSignOut = async () => {
    await signOut();
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
      await signOut();
      onLogout?.();
    } catch (error) {
      setPrivacyMessage(error instanceof Error ? error.message : 'Could not delete your account.');
      setPrivacyBusy(false);
    }
  };
  const tabs = [
    { id: 'general', label: 'Playback', icon: Monitor },
    { id: 'account', label: 'Account', icon: User },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ];

  const subscriptionEnd = activeSubscription?.end_date
    ? new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activeSubscription.end_date))
    : null;

  return (
    <div className="h-screen overflow-y-auto bg-zinc-950 p-4 pb-24 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-2 text-sm text-zinc-400">Manage playback, your verified account and TubeTV access.</p>
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
                <h2 id="account-heading" className="text-xl font-bold">Verified account</h2>
                <div className="mt-6 border-y border-zinc-800 py-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 text-green-400"><Smartphone size={22} /></div>
                    <div><p className="font-medium">{currentUser?.user_metadata?.display_name || 'TubeTV viewer'}</p><p className="text-sm text-zinc-400">{userPhone || 'Not signed in'}</p></div>
                    {currentUser?.phone_confirmed_at && <span className="ml-auto flex items-center gap-1 text-xs font-bold text-green-400"><Check size={14} /> Verified</span>}
                  </div>
                </div>
                <button onClick={handleSignOut} className="mt-6 flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300"><LogOut size={17} /> Sign out</button>
              </section>
            )}

            {activeTab === 'billing' && (
              <section aria-labelledby="billing-heading">
                <h2 id="billing-heading" className="text-xl font-bold">Premium access</h2>
                {activeSubscription ? (
                  <div className="mt-5 border-l-2 border-green-500 pl-4">
                    <p className="font-bold text-green-400">Premium is active</p>
                    <p className="mt-1 text-sm text-zinc-400">{activeSubscription.tier} pass, valid until {subscriptionEnd}.</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">Choose a pass. Payment is confirmed securely through M-Pesa.</p>
                )}
                <div className="mt-7 grid gap-4 md:grid-cols-3">
                  {Object.values(SUBSCRIPTION_PLANS).map((plan) => (
                    <div key={plan.code} className={`rounded-lg border bg-zinc-900 p-5 ${plan.code === 'daily' ? 'border-green-500' : 'border-zinc-800'}`}>
                      {plan.code === 'daily' && <p className="mb-3 text-xs font-bold uppercase text-green-400">Start here</p>}
                      <p className="font-bold">{plan.label}</p>
                      <p className="mt-2 text-2xl font-black">KSh {plan.amountKes}</p>
                      <p className="mt-2 min-h-10 text-sm text-zinc-400">{plan.description}</p>
                      <button disabled={paymentState === 'requesting' || paymentState === 'waiting'} onClick={() => handlePurchase(plan.code)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2.5 text-sm font-bold hover:bg-green-500 disabled:opacity-50">
                        {paymentState === 'requesting' ? <Loader2 className="animate-spin" size={16} /> : <Smartphone size={16} />} Pay with M-Pesa
                      </button>
                    </div>
                  ))}
                </div>
                {paymentMessage && <p role="status" className={`mt-5 text-sm ${paymentState === 'failed' ? 'text-red-400' : paymentState === 'succeeded' ? 'text-green-400' : 'text-zinc-300'}`}>{paymentMessage}</p>}
              </section>
            )}

            {activeTab === 'privacy' && (
              <section aria-labelledby="privacy-heading">
                <h2 id="privacy-heading" className="text-xl font-bold">Privacy</h2>
                <p className="mt-2 text-sm text-zinc-400">Access a portable copy of your account or permanently erase it.</p>
                <div className="mt-6 border-y border-zinc-800 py-5">
                  <h3 className="font-medium">Download my data</h3>
                  <p className="mt-1 text-sm text-zinc-400">Includes profile, billing records, watch list, progress and preferences.</p>
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
