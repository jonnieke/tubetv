import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Film,
  Globe,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  Shield,
  Smartphone,
  Sparkles,
  Ticket,
  Trash2,
  User,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Video } from '../types';
import { supabase } from '../lib/supabase';
import {
  computeShareOfPlayRoyalties,
  exportCreatorSelfStatementCsv,
  generateDefaultPortalCode,
  MINIMUM_PAYOUT_THRESHOLD_KES,
  DEFAULT_CREATOR_POOL_PERCENT,
  PAYMENT_GATEWAY_FEE_PERCENT,
} from '../lib/royalties';
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
import {
  isPushSupported,
  getPushPermissionState,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  type PushPermissionState,
} from '../lib/pushNotifications';
import { triggerPwaPrompt } from './PWAInstallBanner';

export type SettingsTabId = 'general' | 'pass' | 'creator' | 'account' | 'privacy';

interface SettingsSectionProps {
  currentUser?: SupabaseUser | null;
  initialTab?: SettingsTabId;
  initialCreatorCode?: string;
  videos?: Video[];
  userPhone?: string | null;
  onLogout?: () => void;
  onLocalDataCleared?: () => void;
  preferences: PlaybackPreferences;
  onPreferencesChange: (preferences: PlaybackPreferences) => void;
  onOpenBuyPass?: () => void;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  currentUser,
  userPhone,
  onLogout,
  onLocalDataCleared,
  preferences,
  initialTab = 'general',
  initialCreatorCode = '',
  videos = [],
  onPreferencesChange,
  onOpenBuyPass,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    initialCreatorCode ? 'creator' : initialTab
  );
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Creator Self-Service Portal state
  const [creatorCodeInput, setCreatorCodeInput] = useState<string>(() => {
    if (initialCreatorCode) return initialCreatorCode.toUpperCase();
    try {
      return window.localStorage.getItem('tubetv_saved_creator_code_v1') || '';
    } catch {
      return '';
    }
  });
  const [unlockedCreatorName, setUnlockedCreatorName] = useState<string | null>(null);
  const [unlockedProfileMeta, setUnlockedProfileMeta] = useState<{
    payoutRail?: string;
    maskedAccount?: string;
    whtPercent?: number;
    code?: string;
  } | null>(null);
  const [creatorPortalError, setCreatorPortalError] = useState<string>('');
  const [creatorPortalBusy, setCreatorPortalBusy] = useState<boolean>(false);

  // M-Pesa Pass state
  const [storedPass, setStoredPass] = useState<StoredPass | null>(() => getStoredPass());
  const [restoreReceipt, setRestoreReceipt] = useState('');
  const [restorePhone, setRestorePhone] = useState(() => getRememberedPhone() || userPhone || '');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreConflict, setRestoreConflict] = useState<{ message: string; tier?: string } | null>(null);
  const [restoreExpired, setRestoreExpired] = useState<{ phone: string; tier?: string } | null>(null);
  const [passMessage, setPassMessage] = useState('');
  const [passError, setPassError] = useState('');
  const [pushState, setPushState] = useState<PushPermissionState>('unsupported');
  const [pushLoading, setPushLoading] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsStandaloneApp(
        window.matchMedia('(display-mode: standalone)').matches ||
          Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
      );
      setPushState(getPushPermissionState());
      const onPushUpdate = () => setPushState(getPushPermissionState());
      window.addEventListener('tubetv:push-updated', onPushUpdate);
      return () => window.removeEventListener('tubetv:push-updated', onPushUpdate);
    }
  }, []);

  const handleTogglePush = async () => {
    if (pushState === 'granted') {
      setPushLoading(true);
      await unsubscribeFromPushNotifications();
      setPushState(getPushPermissionState());
      setPushLoading(false);
    } else {
      setPushLoading(true);
      await subscribeToPushNotifications();
      setPushState(getPushPermissionState());
      setPushLoading(false);
    }
  };

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
    const phoneDigits = cleanPhone.replace(/\D/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 15) {
      setPassError('Enter a valid phone number (e.g. 0712 345 678 or +1 / +44 / +234...).');
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

      if (result.expired) {
        setRestoreExpired({
          phone: result.phone || cleanPhone,
          tier: result.tier,
        });
        setPassError('');
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

  const royaltySnapshot = useMemo(() => {
    return computeShareOfPlayRoyalties(videos, {
      periodLabel: 'Current Monthly Cycle',
      grossSubscriptionRevenueKes: 35000,
      creatorPoolPercent: DEFAULT_CREATOR_POOL_PERCENT,
      gatewayFeePercent: PAYMENT_GATEWAY_FEE_PERCENT,
      payoutThresholdKes: MINIMUM_PAYOUT_THRESHOLD_KES,
    });
  }, [videos]);

  const verifyCreatorCode = async (rawCode: string) => {
    const clean = rawCode.trim().toUpperCase();
    if (!clean) {
      setCreatorPortalError('Enter your Creator Portal Access Code (e.g. TUBE-RM84).');
      return;
    }
    setCreatorPortalError('');
    setCreatorPortalBusy(true);
    try {
      // 1. Check Supabase RPC first
      const { data: rpcRows } = await supabase.rpc('get_creator_profile_by_code', {
        p_access_code: clean,
      });
      if (Array.isArray(rpcRows) && rpcRows.length > 0 && rpcRows[0]?.creator_name) {
        const row = rpcRows[0];
        setUnlockedCreatorName(row.creator_name);
        setUnlockedProfileMeta({
          payoutRail: row.payout_rail,
          maskedAccount: row.masked_payout_account,
          whtPercent: Number(row.withholding_tax_percent) || 0,
          code: row.portal_access_code,
        });
        try {
          window.localStorage.setItem('tubetv_saved_creator_code_v1', clean);
        } catch {}
        return;
      }

      // 2. Check locally saved creator profiles or default deterministic code from catalogue
      let localProfiles: Record<string, any> = {};
      try {
        const raw = window.localStorage.getItem('tubetv_creator_payout_profiles_v1');
        if (raw) localProfiles = JSON.parse(raw);
      } catch {}

      for (const c of royaltySnapshot.creators) {
        const saved = localProfiles[c.creator];
        const code = (saved?.portal_access_code || generateDefaultPortalCode(c.creator)).toUpperCase();
        if (code === clean || c.creator.toUpperCase() === clean) {
          const acc = saved?.payout_account || '';
          const masked =
            acc.length > 4 ? `${'*'.repeat(Math.max(2, acc.length - 4))}${acc.slice(-4)}` : acc;
          setUnlockedCreatorName(c.creator);
          setUnlockedProfileMeta({
            payoutRail: saved?.payout_rail || 'M-Pesa B2C (Kenya)',
            maskedAccount: masked || 'Not configured yet',
            whtPercent: Number(saved?.withholding_tax_percent) || 0,
            code,
          });
          try {
            window.localStorage.setItem('tubetv_saved_creator_code_v1', code);
          } catch {}
          return;
        }
      }

      setCreatorPortalError(
        'Invalid Creator Access Code. Ask the TubeTV Studio team for your studio code from the Royalties tab.'
      );
    } finally {
      setCreatorPortalBusy(false);
    }
  };

  useEffect(() => {
    if (initialCreatorCode) {
      setActiveTab('creator');
      void verifyCreatorCode(initialCreatorCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCreatorCode]);

  const tabs: ReadonlyArray<{ id: SettingsTabId; label: string; icon: typeof Monitor; requiresAuth?: boolean }> = [
    { id: 'general', label: t('settings.tabPlayback'), icon: Monitor },
    { id: 'pass', label: t('settings.tabPass'), icon: Ticket },
    { id: 'creator', label: 'Creator Portal', icon: Coins },
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
                  className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? tab.id === 'pass'
                        ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold shadow-md shadow-red-950/50'
                        : 'bg-white text-black'
                      : tab.id === 'pass'
                        ? 'text-amber-300 bg-amber-950/25 border border-amber-500/30 hover:bg-amber-900/40 hover:text-white'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <tab.icon size={18} className={tab.id === 'pass' && activeTab !== 'pass' ? 'text-amber-400' : undefined} />
                    {tab.label}
                  </span>
                  {tab.id === 'pass' && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        activeTab === 'pass'
                          ? 'bg-black/30 text-white'
                          : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                      }`}
                    >
                      {storedPass ? 'Active' : 'KSh 10'}
                    </span>
                  )}
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

                  {/* Push Notifications */}
                  <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="text-zinc-500" size={20} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {language === 'sw' ? 'Taarifa za vipindi vipya' : 'New episode alerts'}
                          </p>
                          {pushState === 'granted' && (
                            <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.2 text-[10px] font-bold text-emerald-300 uppercase">
                              {language === 'sw' ? 'Zimewashwa' : 'Active'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400">
                          {language === 'sw'
                            ? 'Pokea arifa za simu papo hapo vipindi vipya na drama zinapozinduliwa.'
                            : 'Get push notifications when new micro-dramas and episodes drop.'}
                        </p>
                      </div>
                    </div>
                    {pushState === 'unsupported' ? (
                      <span className="text-xs text-zinc-500 italic">
                        {language === 'sw' ? 'Haipatikani kwenye kivinjari hiki' : 'Not supported in this browser'}
                      </span>
                    ) : pushState === 'denied' ? (
                      <span className="text-xs text-rose-400">
                        {language === 'sw' ? 'Imezuiwa na kivinjari' : 'Blocked in browser settings'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleTogglePush}
                        disabled={pushLoading}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                          pushState === 'granted'
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                            : 'bg-gradient-to-r from-red-600 to-amber-600 text-white hover:from-red-500 hover:to-amber-500 shadow-md'
                        } disabled:opacity-50`}
                      >
                        {pushLoading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : pushState === 'granted' ? (
                          <BellRing size={13} className="text-emerald-400" />
                        ) : (
                          <Bell size={13} />
                        )}
                        <span>
                          {pushLoading
                            ? (language === 'sw' ? 'Inapakia...' : 'Updating...')
                            : pushState === 'granted'
                            ? (language === 'sw' ? 'Zima arifa' : 'Disable alerts')
                            : (language === 'sw' ? 'Washa arifa' : 'Enable alerts')}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* TubeTV Standalone App / PWA */}
                  <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Smartphone className="text-zinc-500" size={20} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {language === 'sw' ? 'App ya TubeTV (0 MB)' : 'TubeTV App (0 MB)'}
                          </p>
                          {isStandaloneApp ? (
                            <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.2 text-[10px] font-bold text-emerald-300 uppercase">
                              {language === 'sw' ? 'Imesakinishwa' : 'Installed'}
                            </span>
                          ) : (
                            <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 text-[10px] font-bold text-amber-300 uppercase">
                              {language === 'sw' ? 'Bure' : 'Free'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400">
                          {language === 'sw'
                            ? 'Sakinisha TubeTV kwenye skrini ya simu yako bila kutumia Play Store.'
                            : 'Install TubeTV directly to your home screen for instant full-screen playback.'}
                        </p>
                      </div>
                    </div>
                    {isStandaloneApp ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <CheckCircle2 size={14} />
                        {language === 'sw' ? 'Inafanya kazi kama App' : 'Running as Installed App'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await triggerPwaPrompt();
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 hover:text-white transition-all active:scale-95 cursor-pointer"
                      >
                        <Download size={13} />
                        <span>{language === 'sw' ? 'Sakinisha (0 MB)' : 'Install to Home Screen'}</span>
                      </button>
                    )}
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
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold">
                        <CheckCircle2 size={18} />
                        <span>Active {storedPass.tier.toUpperCase()} Pass</span>
                      </div>
                      {onOpenBuyPass && (
                        <button
                          type="button"
                          onClick={onOpenBuyPass}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25 transition-colors cursor-pointer"
                        >
                          <Ticket size={13} />
                          <span>{language === 'sw' ? 'Ongeza Muda' : 'Extend / Top Up'}</span>
                        </button>
                      )}
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
                  <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-950 p-5 space-y-3.5 shadow-lg shadow-black/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-400 font-bold">
                        <Ticket size={20} />
                        <span>{language === 'sw' ? 'Nunua Pasi ya TubeTV' : 'Get a TubeTV Pass'}</span>
                      </div>
                      <span className="text-xs font-black text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        From KSh 10
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {language === 'sw'
                        ? 'Tazama filamu, tamthilia fupi, na vipindi vyote bila kikomo. Chagua pasi ya Masaa 24 (KSh 10), Wiki (KSh 50), au Mwezi (KSh 149). Lipa papo hapo kwa Safaricom M-Pesa STK Push au Kadi ya Benki.'
                        : 'Unlock all premium Kenyan movies, series, and cliffhangers. Choose 24-Hour (KSh 10), Weekly (KSh 50), or Monthly (KSh 149). Pay instantly via Safaricom M-Pesa STK Push or Debit / Credit Card.'}
                    </p>
                    {onOpenBuyPass && (
                      <button
                        type="button"
                        onClick={onOpenBuyPass}
                        className="cinema-primary w-full sm:w-auto px-6 py-2.5 font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/50"
                      >
                        <Ticket size={16} />
                        <span>{language === 'sw' ? 'Nunua Pasi Sasa (KSh 10)' : 'Buy Pass Now (From KSh 10)'}</span>
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleRestoreSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <KeyRound size={16} className="text-emerald-400" />
                    <h3>{t('paywall.tabRestore')}</h3>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {language === 'sw'
                      ? 'Ulipia tayari kwenye simu au kifaa kingine? Weka nambari ya simu uliyolipia ili kurejesha pasi yako hapa.'
                      : 'Already paid on another phone or device? Enter the phone number you paid with to restore your pass on this device (1 active device at a time).'}
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
                  {restoreExpired && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                        <Clock size={15} />
                        <span>Pass Expired</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Your TubeTV pass for <strong className="text-white">{restoreExpired.phone}</strong> has expired. Renew your pass to extend watching across TubeTV.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (videos.length > 0) {
                              onRequireUnlock?.(videos[0]);
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow cursor-pointer"
                        >
                          <Sparkles size={14} />
                          <span>Extend Watching · Get New Pass</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestoreExpired(null)}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
                        >
                          Dismiss
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

            {activeTab === 'creator' && (
              <section aria-labelledby="creator-portal-heading" className="space-y-6">
                <div>
                  <h2 id="creator-portal-heading" className="text-xl font-bold flex items-center gap-2">
                    <Coins size={20} className="text-amber-400" />
                    <span>Creator Self-Service Royalties Portal</span>
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Read-only portal for filmmakers and studios to track 30-second Qualified Views (QVs), 60/40 Share-of-Play royalties, and monthly KSh 1,000 payout eligibility.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void verifyCreatorCode(creatorCodeInput);
                  }}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1">
                      <label htmlFor="creator-access-code" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Studio / Creator Access Code
                      </label>
                      <input
                        id="creator-access-code"
                        type="text"
                        placeholder="e.g. TUBE-RM84"
                        value={creatorCodeInput}
                        onChange={(e) => setCreatorCodeInput(e.target.value.toUpperCase())}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono uppercase text-amber-300"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={creatorPortalBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-black text-black hover:bg-amber-400 disabled:opacity-50"
                    >
                      {creatorPortalBusy && <Loader2 size={15} className="animate-spin" />}
                      View My Royalties
                    </button>
                  </div>

                  {creatorPortalError && (
                    <p role="alert" className="text-xs text-red-300">
                      {creatorPortalError}
                    </p>
                  )}
                </form>

                {unlockedCreatorName && (() => {
                  const summary = royaltySnapshot.creators.find(
                    (c) => c.creator.toLowerCase() === unlockedCreatorName.toLowerCase()
                  );
                  const episodes = royaltySnapshot.content.filter(
                    (ep) => ep.creator.toLowerCase() === unlockedCreatorName.toLowerCase()
                  );

                  if (!summary) {
                    return (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
                        Verified Studio: <strong className="text-white">{unlockedCreatorName}</strong>. No published catalogue episodes found in the current cycle yet.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-zinc-900/80 p-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                              Verified Studio
                            </span>
                            <span className="font-mono text-xs text-zinc-400">{unlockedProfileMeta?.code}</span>
                          </div>
                          <h3 className="text-lg font-black text-white mt-1">{summary.creator}</h3>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Payout Rail: <strong className="text-zinc-200">{unlockedProfileMeta?.payoutRail}</strong> ·
                            Account: <strong className="text-emerald-400 font-mono">{unlockedProfileMeta?.maskedAccount}</strong>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            exportCreatorSelfStatementCsv(summary, episodes, royaltySnapshot.periodLabel)
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow"
                        >
                          <Download size={15} />
                          Download My Statement (CSV)
                        </button>
                      </div>

                      {/* Creator KPI Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                          <p className="text-[11px] font-bold uppercase text-zinc-400">30s+ Qualified Views</p>
                          <p className="text-2xl font-black text-white mt-1">
                            {summary.qualifiedViews.toLocaleString()}
                          </p>
                          <p className="text-xs text-zinc-400 mt-1">{summary.totalWatchHours} Watch Hours</p>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                          <p className="text-[11px] font-bold uppercase text-zinc-400">Share of Play</p>
                          <p className="text-2xl font-black text-amber-400 mt-1">
                            {summary.shareOfPlayPercent.toFixed(2)}%
                          </p>
                          <p className="text-xs text-zinc-400 mt-1">Across {summary.titlesCount} catalogue titles</p>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                          <p className="text-[11px] font-bold uppercase text-emerald-400">Your 60% Net Royalties</p>
                          <p className="text-2xl font-black text-emerald-400 mt-1">
                            KES {summary.netEarningsKes.toLocaleString()}
                          </p>
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className={summary.isEligibleForPayout ? 'text-emerald-300 font-bold' : 'text-amber-300'}>
                                {summary.isEligibleForPayout ? '✓ Eligible for Payout' : 'Carried Forward (< KSh 1,000)'}
                              </span>
                              <span className="text-zinc-400">{summary.thresholdProgressPercent}% of KSh 1,000</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  summary.isEligibleForPayout ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${summary.thresholdProgressPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Creator Episodes Table */}
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2 text-xs font-bold text-white">
                          <Film size={15} className="text-red-500" />
                          <span>My Titles &amp; Episodes ({episodes.length})</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-950/70 text-zinc-400 border-b border-zinc-800">
                              <tr>
                                <th className="py-2.5 px-4">Title</th>
                                <th className="py-2.5 px-4">Series</th>
                                <th className="py-2.5 px-4 text-right">30s+ QVs</th>
                                <th className="py-2.5 px-4 text-right">Watch Time</th>
                                <th className="py-2.5 px-4 text-right">60% Net Royalty</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                              {episodes.map((ep) => (
                                <tr key={ep.videoId}>
                                  <td className="py-2.5 px-4 font-bold text-white">{ep.title}</td>
                                  <td className="py-2.5 px-4 text-zinc-400">
                                    {ep.seriesTitle} {ep.episode ? `· Ep ${ep.episode}` : ''}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-bold text-white">
                                    {ep.qualifiedViews.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-zinc-400">{ep.totalWatchHours} hrs</td>
                                  <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">
                                    KES {ep.attributedRevenueKes.toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
