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
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:border-emerald-400 hover:text-white transition-colors"
            >
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span>Pass · {formatRemainingPassTime(activePass.expiresAt)}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(ViewState.SETTINGS, 'pass')}
              title="Restore or view your TubeTV Pass"
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
            >
              <Ticket size={12} className="text-emerald-400" />
              <span>{language === 'sw' ? 'Pasi' : 'Pass'}</span>
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

          {props.items
            .filter((item) => ![ViewState.HOME, ViewState.MICRO_DRAMAS].includes(item.id as ViewState))
            .map((item) => (
              <button type="button" key={item.id} onClick={() => navigate(item.id)}>
                {item.labelKey ? t(item.labelKey as TranslationKey) : item.label}
              </button>
            ))}

          <button type="button" onClick={() => navigate(ViewState.SETTINGS, 'pass')}>
            {t('settings.tabPass')}
          </button>

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
