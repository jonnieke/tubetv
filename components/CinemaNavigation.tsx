import React, { useState } from 'react';
import { ChevronDown, Search, UserRound, X } from 'lucide-react';
import { NavItem, ViewState, ViewStateOrString } from '../types';

interface Props {
  view: ViewStateOrString; subcategory: string; items: NavItem[]; authenticated: boolean; admin: boolean;
  search: string; onSearch: (event: React.ChangeEvent<HTMLInputElement>) => void;
  navigate: (view: ViewStateOrString, category?: string) => void; login: () => void; logout: () => void;
}
export default function CinemaNavigation(props: Props) {
  const [more, setMore] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = (view: ViewStateOrString, category?: string) => { props.navigate(view, category); setMore(false); };
  return <header className="cinema-nav" onKeyDown={event => { if (event.key === 'Escape') { setMore(false); setSearchOpen(false); } }}>
    <div className="cinema-nav-row">
      <button className="cinema-logo" aria-label="TubeTV home" onClick={() => navigate(ViewState.HOME)}>Tube<span>TV</span></button>
      <nav className="cinema-nav-links" aria-label="Main navigation">
        <button aria-current={props.view === ViewState.HOME ? 'page' : undefined} onClick={() => navigate(ViewState.HOME)}>Discover</button>
        <button aria-current={props.view === ViewState.MICRO_DRAMAS ? 'page' : undefined} onClick={() => navigate(ViewState.MICRO_DRAMAS)}>Micro Dramas</button>
        <button aria-current={props.view === ViewState.ORIGINALS && props.subcategory === 'Series' ? 'page' : undefined} onClick={() => navigate(ViewState.ORIGINALS, 'Series')}>Series</button>
        <button aria-current={props.view === ViewState.ORIGINALS && props.subcategory === 'Movies' ? 'page' : undefined} onClick={() => navigate(ViewState.ORIGINALS, 'Movies')}>Movies</button>
        <button aria-expanded={more} aria-controls="cinema-more" onClick={() => setMore(!more)}>More <ChevronDown size={14} /></button>
      </nav>
      <label className="cinema-search"><Search size={17} /><input aria-label="Search videos" placeholder="Search" value={props.search} onChange={props.onSearch} /></label>
      <button className="cinema-mobile-search" aria-label="Toggle search" onClick={() => setSearchOpen(!searchOpen)}>{searchOpen ? <X size={20} /> : <Search size={20} />}</button>
      <button className="cinema-account" aria-label={props.authenticated ? 'Account and navigation' : 'Sign in'} onClick={() => props.authenticated ? setMore(!more) : props.login()}><UserRound size={19} /></button>
    </div>
    {searchOpen && <label className="cinema-search cinema-search-expanded"><Search size={17} /><input autoFocus aria-label="Search catalogue" placeholder="Search" value={props.search} onChange={props.onSearch} /></label>}
    {more && <div id="cinema-more" className="cinema-more"><button className="cinema-menu-close" aria-label="Close navigation" onClick={() => setMore(false)}><X size={18} /></button>{props.items.filter(item => ![ViewState.HOME, ViewState.MICRO_DRAMAS].includes(item.id as ViewState)).map(item => <button key={item.id} onClick={() => navigate(item.id)}>{item.label}</button>)}{props.admin && <button onClick={() => navigate(ViewState.ADMIN)}>Admin dashboard</button>}<button onClick={() => navigate(ViewState.SETTINGS)}>Settings</button>{props.authenticated && <button onClick={() => { props.logout(); setMore(false); }}>Sign out</button>}</div>}
  </header>;
}
