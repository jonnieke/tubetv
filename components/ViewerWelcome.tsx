import React, { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { ViewState, ViewStateOrString } from '../types';

const interests = [
  ['Micro Dramas · Coming soon', ViewState.MICRO_DRAMAS, undefined],
  ['Movies', ViewState.ORIGINALS, 'Movies'], ['Series', ViewState.ORIGINALS, 'Series'],
  ['Shorts', ViewState.SHORTS, undefined],
  ['School Flix', ViewState.SCHOOL_FLIX, undefined], ['Music', ViewState.MUSIC, undefined], ['Documentary', ViewState.DOCUMENTARY, undefined], ['Education', ViewState.EDUCATION, undefined],
  ['Farmers', ViewState.FARMERS, undefined], ['Faith', ViewState.FAITH, undefined],
  ['Kids', ViewState.KIDS, undefined], ['Diaspora', ViewState.DIASPORA, undefined], ['Live', ViewState.LIVE, undefined],
] as const;

export default function ViewerWelcome({ navigate }: { navigate: (view: ViewStateOrString, category?: string) => void }) {
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem('tube_welcome_v1') === 'dismissed'; } catch { return false; } });
  const [open, setOpen] = useState(false);
  const dismiss = () => { setDismissed(true); try { localStorage.setItem('tube_welcome_v1', 'dismissed'); } catch { /* Browsing also works without storage. */ } };
  if (dismissed) return null;
  return <section className="viewer-welcome" aria-label="Welcome to TubeTV">
    <div><p>YOUR NEXT STORY STARTS HERE</p><h2>Welcome to a world of Kenyan stories.</h2><span>Browse freely. No account needed to get started.</span></div>
    <button className="cinema-secondary" aria-expanded={open} aria-controls="viewer-interests" onClick={() => setOpen(value => !value)}>Find your starting point <ArrowRight size={15} /></button>
    <button className="welcome-dismiss" aria-label="Skip introduction" onClick={dismiss}><X size={18} /></button>
    {open && <div id="viewer-interests" className="viewer-interests"><p>Where would you like to begin?</p>{interests.map(([label, view, category]) => <button key={label} onClick={() => { dismiss(); navigate(view, category); }}>{label}</button>)}<small>This is a browsing shortcut, not a sign-up or notification subscription.</small></div>}
  </section>;
}
