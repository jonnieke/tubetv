import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Globe,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  Shield,
  Smartphone,
  Ticket,
  Trash2,
  User,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { clearViewerLocalData, DEFAULT_PLAYBACK_PREFERENCES, type PlaybackPreferences } from '../lib/viewerState';
import {
  clearStoredPass,
  getRememberedPhone,
  getStoredPass,
  restorePassByPhone,
  saveRememberedPhone,
  type StoredPass,
} from '../lib/subscriptions';
import { useLanguage } from '../contexts/LanguageContext';
import { deleteAccount, exportAccountData } from '../lib/privacy';
import { trackEvent } from '../lib/analytics';

export type SettingsTabId = 'general' | 'pass' | 'account' | 'privacy';

interface SettingsSectionProps {
  currentUser?: SupabaseUser | null;
  initialTab?: SettingsTabId;
  userPhone?: string | null;
  onLogout?: () => void;
  onLocalDataCleared?: () => void;
  preferences: PlaybackPreferences;
  onPreferencesChange: (preferences: PlaybackPreferences) => void;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  currentUser,
  userPhone,
  onLogout,
  onLocalDataCleared,
  preferences,
  initialTab = 'general',
  onPreferencesChange,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // M-Pesa Pass state
  const [storedPass, setStoredPass] = useState<StoredPass | null>(() => getStoredPass());
  const [restoreReceipt, setRestoreReceipt] = useState('');
  const [restorePhone, setRestorePhone] = useState(() => getRememberedPhone() || userPhone || '');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreConflict, setRestoreConflict] = useState<{ message: string; tier?: string } | null>(null);
  const [passMessage, setPassMessage] = useState('');
  const [passError, setPassError] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const syncPass = () => setStoredPass(getStoredPass());
    window.addEventListener('tubetv:pass-updated', syncPass);
    return () => window.removeEventListener('tubetv:pass-updated', syncPass);
  }, []);

  const updatePreference = <K extends keyof PlaybackPreferences>(key: K, value: PlaybackPreferences[K]) => {
    onPreferencesChange({ ...preferences, [key]: value });
  };

  const handleSignOut = () => {
    onLogout?.();
  };

  const executePassRestore = async (forceSwitch: boolean) => {
    setPassError('');
    setPassMessage('');

    const cleanReceipt = restoreReceipt.trim().toUpperCase();
    const cleanPhone = restorePhone.replace(/[\s()-]/g, '');
    if (!/^(?:254|\+254|0)?([17]\d{8})$/.test(cleanPhone)) {
      setPassError('Enter a valid Kenyan phone number (e.g. 0712 345 678).');
      return;
    }

    try {
      setRestoreBusy(true);
      saveRememberedPhone(cleanPhone);
      const result = await restorePassByPhone({
        phone: cleanPhone,
        mpesaReceipt: cleanReceipt || undefined,
        forceSwitch,
      });

      if (result.conflict) {
        setRestoreConflict({
          message:
            result.message ||
            'Your pass is currently active on another device. Would you like to log out the other device and watch here?',
          tier: result.tier,
        });
        return;
      }

      if (!result.success || !result.pass) {
        setPassError(result.message || 'Unable to restore pass with those details.');
        return;
      }

      setRestoreConflict(null);
      setStoredPass(result.pass);
      setRestoreReceipt('');
      setPassMessage(
        result.switched
          ? 'Other device logged out. Your pass is now active on this device!'
          : 'Your active pass has been restored on this device.',
      );
      trackEvent('pass_restored', { tier: result.pass.tier, source: 'settings', switched: Boolean(result.switched) });
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Unable to restore pass with those details.');
    } finally {
      setRestoreBusy(false);
    }
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executePassRestore(false);
  };

  const handleRemoveDevicePass = () => {
    clearStoredPass();
    setStoredPass(null);
    setPassMessage('Pass removed from this device. You can restore it anytime using your phone number.');
  };

  const handleClearLocalDeviceData = () => {
    clearViewerLocalData();
    clearStoredPass();
    setStoredPass(null);
    onPreferencesChange(DEFAULT_PLAYBACK_PREFERENCES);
    onLocalDataCleared?.();
    setPrivacyMessage('Local watch history, saved titles, and device pass data have been cleared from this browser.');
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
      clearViewerLocalData();
      clearStoredPass();
      onLocalDataCleared?.();
      onLogout?.();
    } catch (error) {
      setPrivacyMessage(error instanceof Error ? error.message : 'Could not delete your account.');
      setPrivacyBusy(false);
    }
  };

  const tabs: ReadonlyArray<{ id: SettingsTabId; label: string; icon: typeof Monitor; requiresAuth?: boolean }> = [
    { id: 'general', label: t('settings.tabPlayback'), icon: Monitor },
    { id: 'pass', label: t('settings.tabPass'), icon: Ticket },
    { id: 'account', label: t('settings.tabAccount'), icon: User, requiresAuth: true },
    { id: 'privacy', label: t('settings.tabPrivacy'), icon: Shield },
  ];

  return (
    <div className="min-h-full bg-zinc-950 p-4 pb-24 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
          <p className="mt-2 text-sm text-zinc-400">{t('settings.subtitle')}</p>
        </header>

        <div className="flex flex-col gap-8 lg:flex-row">
          <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto lg:w-56 lg:flex-col">
            {tabs
              .filter((tab) => !tab.requiresAuth || Boolean(currentUser))
              .map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id ? 'bg-white text-black' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <tab.icon size={18} /> {tab.label}
                </button>
              ))}
          </nav>

          <div className="min-w-0 flex-1">
            {activeTab === 'general' && (
              <section aria-labelledby="playback-heading" className="space-y-6">
                <div>
                  <h2 id="playback-heading" className="text-xl font-bold">
                    {language === 'sw' ? 'Uchezaji na matumizi ya data' : 'Playback and data'}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {language === 'sw'
                      ? 'Mabadiliko yanahifadhiwa kwenye kifaa hiki.'
                      : 'Changes are saved for this device and applied to the player.'}
                  </p>
                </div>
                <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                  <SettingToggle
                    label={t('settings.autoplay')}
                    description={t('settings.autoplayDesc')}
                    checked={preferences.autoplay}
                    onChange={(value) => updatePreference('autoplay', value)}
                  />
                  <SettingToggle
                    label={t('settings.dataSaver')}
                    description={t('settings.dataSaverDesc')}
                    checked={preferences.dataSaver}
                    onChange={(value) => updatePreference('dataSaver', value)}
                  />
                  <SettingToggle
                    label={t('settings.captions')}
                    description={t('settings.captionsDesc')}
                    checked={preferences.captions}
                    onChange={(value) => updatePreference('captions', value)}
                  />
                  <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{t('settings.quality')}</p>
                      <p className="text-sm text-zinc-400">{t('settings.qualityDesc')}</p>
                    </div>
                    <select
                      aria-label={t('settings.quality')}
                      value={preferences.quality}
                      onChange={(event) =>
                        updatePreference('quality', event.target.value as PlaybackPreferences['quality'])
                      }
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="auto">Auto</option>
                      <option value="1080p">1080p</option>
                      <option value="720p">720p</option>
                      <option value="480p">480p</option>
                      <option value="360p">360p</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{t('settings.maxRating')}</p>
                      <p className="text-sm text-zinc-400">{t('settings.maxRatingDesc')}</p>
                    </div>
                    <select
                      aria-label="Maximum content rating"
                      value={preferences.maximumRating}
                      onChange={(event) =>
                        updatePreference('maximumRating', event.target.value as PlaybackPreferences['maximumRating'])
                      }
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="GE">GE, all ages</option>
                      <option value="PG">PG, parental guidance</option>
                      <option value="16">16 and below</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="text-zinc-500" size={20} />
                      <div>
                        <p className="font-medium">{t('common.language')}</p>
                        <p className="text-sm text-zinc-400">
                          {language === 'sw'
                            ? 'Lugha ya mfumo kwenye kifaa hiki.'
                            : 'Interface language for this device.'}
                        </p>
                      </div>
                    </div>
                    <select
                      aria-label="Language"
                      value={language}
                      onChange={(event) => setLanguage(event.target.value as 'en' | 'sw')}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="en">English</option>
                      <option value="sw">Kiswahili</option>
                    </select>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'pass' && (
              <section aria-labelledby="pass-heading" className="space-y-6">
                <div>
                  <h2 id="pass-heading" className="text-xl font-bold">
                    {t('settings.tabPass')}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {language === 'sw'
                      ? 'Angalia hali ya pasi yako ya M-Pesa au irejeshe ukitumia nambari ya risiti.'
                      : 'View your active M-Pesa pass on this device or restore it using your Safaricom SMS receipt.'}
                  </p>
                </div>

                {storedPass ? (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/25 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <CheckCircle2 size={18} />
                      <span>Active {storedPass.tier.toUpperCase()} Pass</span>
                    </div>
                    <p className="text-sm text-zinc-300">
                      Valid until{' '}
                      <strong className="text-white">{new Date(storedPass.expiresAt).toLocaleString()}</strong>
                      {storedPass.mpesaReceipt ? (
                        <>
                          {' '}
                          · Receipt <code className="font-mono text-emerald-300">{storedPass.mpesaReceipt}</code>
                        </>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      onClick={handleRemoveDevicePass}
                      className="text-xs font-semibold text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      Remove pass from this shared device
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-400">
                    No active M-Pesa pass is saved on this browser right now. Select any locked episode to purchase a
                    24-Hour (KSh 10), Weekly (KSh 50), or Monthly (KSh 149) pass, or restore an existing pass below.
                  </div>
                )}

                <form onSubmit={handleRestoreSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <KeyRound size={16} className="text-emerald-400" />
                    <h3>{t('paywall.tabRestore')}</h3>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Enter the phone number you paid with to restore your pass on this device (1 active device at a time).
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="settings-mpesa-phone" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        {t('paywall.phoneLabel')}
                      </label>
                      <input
                        id="settings-mpesa-phone"
                        type="tel"
                        required
                        placeholder="0712 345 678"
                        value={restorePhone}
                        onChange={(e) => {
                          setRestorePhone(e.target.value);
                          setRestoreConflict(null);
                        }}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-mpesa-receipt" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        {t('paywall.receiptLabel')} <span className="text-zinc-500 font-normal">(optional)</span>
                      </label>
                      <input
                        id="settings-mpesa-receipt"
                        type="text"
                        maxLength={24}
                        placeholder="Optional M-Pesa / Paystack ref"
                        value={restoreReceipt}
                        onChange={(e) => setRestoreReceipt(e.target.value.toUpperCase())}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm font-mono uppercase text-white"
                      />
                    </div>
                  </div>
                  {restoreConflict && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3.5 space-y-2.5">
                      <p className="text-xs text-amber-200 font-medium">{restoreConflict.message}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={restoreBusy}
                          onClick={() => void executePassRestore(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-50"
                        >
                          {restoreBusy && <Loader2 size={14} className="animate-spin" />}
                          Log out other device &amp; watch here
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestoreConflict(null)}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {passError && (
                    <p role="alert" className="text-xs text-red-300">
                      {passError}
                    </p>
                  )}
                  {passMessage && (
                    <p role="status" className="text-xs text-emerald-300">
                      {passMessage}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={restoreBusy}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {restoreBusy && <Loader2 size={15} className="animate-spin" />}
                    {t('paywall.restoreButton')}
                  </button>
                </form>
              </section>
            )}

            {activeTab === 'account' && currentUser && (
              <section aria-labelledby="account-heading">
                <h2 id="account-heading" className="text-xl font-bold">
                  Account access
                </h2>
                <div className="mt-6 border-y border-zinc-800 py-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                      <Smartphone size={22} />
                    </div>
                    <div>
                      <p className="font-medium">
                        {currentUser?.user_metadata?.display_name || currentUser?.email || 'TubeTV user'}
                      </p>
                      <p className="text-sm text-zinc-400">{userPhone || currentUser?.email || 'Signed in'}</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-6 flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300"
                >
                  <LogOut size={17} /> {t('nav.signOut')}
                </button>
              </section>
            )}

            {activeTab === 'privacy' && (
              <section aria-labelledby="privacy-heading" className="space-y-2">
                <h2 id="privacy-heading" className="text-xl font-bold">
                  {t('settings.tabPrivacy')}
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Manage local browser storage under the Kenya Data Protection Act (2019), export account records, or
                  permanently delete an account.
                </p>

                <div className="mt-6 border-y border-zinc-800 py-5">
                  <h3 className="font-medium">Clear local device data</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    Removes saved Watch List items, playback resume positions, and any cached pass token from this
                    browser.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearLocalDeviceData}
                    className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold hover:bg-zinc-700"
                  >
                    <Trash2 size={16} /> Clear browser history &amp; pass
                  </button>
                </div>

                {currentUser && (
                  <>
                    <div className="border-b border-zinc-800 py-5">
                      <h3 className="font-medium">Download my data</h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        Includes profile, watch list, progress, preferences, and M-Pesa transaction references.
                      </p>
                      <button
                        type="button"
                        disabled={privacyBusy}
                        onClick={handleExport}
                        className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold hover:bg-zinc-700 disabled:opacity-50"
                      >
                        {privacyBusy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}{' '}
                        Download JSON
                      </button>
                    </div>
                    <div className="border-b border-zinc-800 py-5">
                      <h3 className="font-medium text-red-400">Delete account</h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        Permanently deletes your login and personal profile. Statutory anonymised M-Pesa tax ledger
                        entries are retained per KRA regulations.
                      </p>
                      <label htmlFor="delete-confirmation" className="mt-4 block text-sm font-medium">
                        Type DELETE to confirm
                      </label>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                          id="delete-confirmation"
                          value={deleteConfirmation}
                          onChange={(event) => setDeleteConfirmation(event.target.value)}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={privacyBusy || deleteConfirmation !== 'DELETE'}
                          onClick={handleDeleteAccount}
                          className="flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold hover:bg-red-600 disabled:opacity-40"
                        >
                          <Trash2 size={16} /> Delete permanently
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {privacyMessage && (
                  <p role="status" className="mt-4 text-sm text-emerald-300">
                    {privacyMessage}
                  </p>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingToggle = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-5 py-5">
    <div>
      <p className="font-medium">{label}</p>
      <p className="text-sm text-zinc-400">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-zinc-700'}`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export default SettingsSection;
