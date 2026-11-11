import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Globe, Search, Ticket, UserRound, X } from 'lucide-react';
import { NavItem, ViewState, ViewStateOrString } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { getStoredPass, type StoredPass } from '../lib/subscriptions';
import type { TranslationKey } from '../translations';

interface Props {
  view: ViewStateOrString;
  subcategory: string;
  items: NavItem[];
  authenticated: boolean;
  admin: boolean;
  search: string;
  onSearch: (event: React.ChangeEvent<HTMLInputElement>) => void;
  navigate: (view: ViewStateOrString, category?: string) => void;
  login: () => void;
  logout: () => void;
}

export default function CinemaNavigation(props: Props) {
  const { language, setLanguage, t } = useLanguage();
  const [more, setMore] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activePass, setActivePass] = useState<StoredPass | null>(() => getStoredPass());

  useEffect(() => {
    const syncPass = () => setActivePass(getStoredPass());
    window.addEventListener('tubetv:pass-updated', syncPass);
    const interval = setInterval(syncPass, 60_000);
    return () => {
      window.removeEventListener('tubetv:pass-updated', syncPass);
      clearInterval(interval);
    };
  }, []);

  const formatRemainingPassTime = (expiresAt: number): string => {
    const diffMs = Math.max(0, expiresAt - Date.now());
    const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (totalHours >= 48) {
      return `${Math.ceil(totalHours / 24)}d left`;
    }
    return `${Math.max(1, totalHours)}h left`;
  };

  const navigate = (view: ViewStateOrString, category?: string) => {
    props.navigate(view, category);
    setMore(false);
  };

  const toggleLanguage = () => setLanguage(language === 'en' ? 'sw' : 'en');

  return (
    <header
      className={`cinema-nav ${props.view === ViewState.SHORTS ? 'shorts-hidden-mobile' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setMore(false);
          setSearchOpen(false);
        }
      }}
    >
      <div className="cinema-nav-row">
        <button type="button" className="cinema-logo" aria-label="TubeTV home" onClick={() => navigate(ViewState.HOME)}>
          Tube<span>TV</span>
        </button>
        <nav className="cinema-nav-links" aria-label="Main navigation">
          <button
            type="button"
            aria-current={props.view === ViewState.HOME ? 'page' : undefined}
            onClick={() => navigate(ViewState.HOME)}
          >
            {t('nav.discover')}
          </button>
          <button
            type="button"
            aria-current={props.view === ViewState.MICRO_DRAMAS ? 'page' : undefined}
            onClick={() => navigate(ViewState.MICRO_DRAMAS)}
          >
            {t('nav.microDramas')}
          </button>
          <button
            type="button"
            aria-current={props.view === ViewState.ORIGINALS && props.subcategory === 'Series' ? 'page' : undefined}
            onClick={() => navigate(ViewState.ORIGINALS, 'Series')}
          >
            {t('nav.series')}
          </button>
          <button
            type="button"
            aria-current={props.view === ViewState.ORIGINALS && props.subcategory === 'Movies' ? 'page' : undefined}
            onClick={() => navigate(ViewState.ORIGINALS, 'Movies')}
          >
            {t('nav.movies')}
          </button>
          <button
            type="button"
            aria-current={props.view === ViewState.GENRES ? 'page' : undefined}
            onClick={() => navigate(ViewState.GENRES)}
          >
            {t('nav.genres')}
          </button>
          <button
            type="button"
            aria-current={props.view === ViewState.SETTINGS && props.subcategory === 'pass' ? 'page' : undefined}
            onClick={() => navigate(ViewState.SETTINGS, 'pass')}
            title="TubeTV Pass — From KSh 10"
            className="flex items-center gap-1.5 font-bold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Ticket size={14} className="text-amber-400" />
            <span>{language === 'sw' ? 'Pasi' : 'Pass'}</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold">
              {activePass ? 'Active' : 'KSh 10'}
            </span>
          </button>
          <button
            type="button"
            aria-expanded={more}
            aria-controls="cinema-more"
            onClick={() => setMore(!more)}
          >
            {t('nav.more')} <ChevronDown size={14} />
          </button>
        </nav>

        <div className="cinema-nav-right">
          <label className="cinema-search">
            <Search size={17} />
            <input
              aria-label="Search videos"
              placeholder={language === 'sw' ? 'Tafuta' : 'Search'}
              value={props.search}
              onChange={props.onSearch}
            />
          </label>

          {activePass ? (
            <button
              type="button"
              onClick={() => navigate(ViewState.SETTINGS, 'pass')}
              title={`Active ${activePass.tier.toUpperCase()} Pass — Click to manage`}
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-emerald-400/60 bg-gradient-to-r from-emerald-950/90 to-teal-950/90 px-3 py-1.5 text-xs font-bold text-emerald-200 shadow-md shadow-emerald-950/50 hover:border-emerald-300 hover:text-white transition-all cursor-pointer"
            >
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>Pass · {formatRemainingPassTime(activePass.expiresAt)}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(ViewState.SETTINGS, 'pass')}
              title="Get or restore your TubeTV Pass from KSh 10"
              className="relative inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs px-3.5 py-1.5 shadow-lg shadow-red-950/60 border border-amber-400/50 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            >
              <Ticket size={13} className="text-amber-200 group-hover:rotate-12 transition-transform" />
              <span className="tracking-wide uppercase text-[11px] font-extrabold">
                {language === 'sw' ? 'Pasi · KSh 10' : 'Pass · KSh 10'}
              </span>
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={language === 'en' ? 'Badili lugha kwenda Kiswahili' : 'Switch language to English'}
            title={language === 'en' ? 'Kiswahili' : 'English'}
            className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1 text-xs font-bold uppercase text-zinc-200 hover:border-zinc-500 hover:text-white transition-colors"
          >
            <Globe size={13} />
            {language === 'en' ? 'SW' : 'EN'}
          </button>

          <button
            type="button"
            className="cinema-mobile-search"
            aria-label="Toggle search"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </button>

          <button
            type="button"
            className="cinema-account shrink-0"
            aria-label={props.authenticated ? 'Account and navigation' : 'Admin sign in'}
            title={props.authenticated ? 'Account and navigation' : 'Admin sign in'}
            onClick={() => setMore(!more)}
          >
            <UserRound size={19} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <label className="cinema-search cinema-search-expanded">
          <Search size={17} />
          <input
            autoFocus
            aria-label="Search catalogue"
            placeholder={language === 'sw' ? 'Tafuta' : 'Search'}
            value={props.search}
            onChange={props.onSearch}
          />
        </label>
      )}

      {more && (
        <div id="cinema-more" className="cinema-more">
          <button
            type="button"
            className="cinema-menu-close"
            aria-label="Close navigation"
            onClick={() => setMore(false)}
          >
            <X size={18} />
          </button>

          {/* Featured TubeTV Pass Hero Card */}
          <div
            onClick={() => navigate(ViewState.SETTINGS, 'pass')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(ViewState.SETTINGS, 'pass');
              }
            }}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-red-500/50 bg-gradient-to-br from-red-950/80 via-zinc-900 to-amber-950/50 p-3.5 shadow-xl shadow-black/80 transition-all hover:border-amber-400/80 hover:shadow-red-950/60 hover:brightness-110 active:scale-[0.99] mb-1"
            style={{ gridColumn: '1 / -1' }}
          >
            {/* Ambient background glow */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br from-red-600/25 to-amber-500/25 blur-xl group-hover:from-red-600/40 group-hover:to-amber-500/40 transition-all" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-amber-600 text-white shadow-md shadow-red-950/60 group-hover:scale-105 transition-transform">
                  <Ticket size={20} className="text-amber-100" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm text-white tracking-wide uppercase">
                      {language === 'sw' ? 'Pasi ya TubeTV' : 'TubeTV Pass'}
                    </span>
                    {activePass ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                        <CheckCircle2 size={10} className="text-emerald-400" />
                        {formatRemainingPassTime(activePass.expiresAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                        {language === 'sw' ? 'Kuanzia KSh 10' : 'From KSh 10'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug truncate">
                    {activePass
                      ? (language === 'sw' ? 'Pasi inatumika · Bonyeza kudhibiti' : 'Pass active on this device · Click to manage')
                      : (language === 'sw' ? 'M-Pesa ya papo hapo · Filamu & drama zote' : 'Instant M-Pesa · All micro-dramas & movies')}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 px-3 py-1.5 text-xs font-black text-white shadow-md group-hover:from-red-500 group-hover:to-amber-500 transition-all">
                  {activePass
                    ? (language === 'sw' ? 'Dhibiti' : 'Manage')
                    : (language === 'sw' ? 'Pata Pasi' : 'Get Pass')}
                </span>
              </div>
            </div>
          </div>

          {props.items
            .filter((item) => ![ViewState.HOME, ViewState.MICRO_DRAMAS].includes(item.id as ViewState))
            .map((item) => (
              <button type="button" key={item.id} onClick={() => navigate(item.id)}>
                {item.labelKey ? t(item.labelKey as TranslationKey) : item.label}
              </button>
            ))}

          <button type="button" onClick={() => navigate(ViewState.SETTINGS)}>
            {t('nav.settings')}
          </button>

          <button
            type="button"
            onClick={() => {
              toggleLanguage();
              setMore(false);
            }}
          >
            {language === 'en' ? 'Lugha: Kiswahili' : 'Language: English'}
          </button>

          {props.admin && (
            <>
              <button type="button" onClick={() => navigate(ViewState.UPLOAD)}>
                Creator uploads
              </button>
              <button type="button" onClick={() => navigate(ViewState.ANALYTICS)}>
                Studio
              </button>
              <button type="button" onClick={() => navigate(ViewState.ADMIN)}>
                Admin dashboard
              </button>
            </>
          )}

          {!props.authenticated && (
            <button
              type="button"
              onClick={() => {
                setMore(false);
                props.login();
              }}
            >
              {t('nav.adminSignIn')}
            </button>
          )}

          {props.authenticated && (
            <button
              type="button"
              onClick={() => {
                props.logout();
                setMore(false);
              }}
            >
              {t('nav.signOut')}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
