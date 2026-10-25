import React from 'react';
import { BookOpen, Clapperboard, Monitor, Radio, Smartphone, SquarePlay, Music } from 'lucide-react';
import { ViewState, ViewStateOrString } from '../types';

const destinations = [
  { label: 'Movies', caption: 'Bigger worlds.', icon: Clapperboard, view: ViewState.ORIGINALS, category: 'Movies' },
  { label: 'Series', caption: 'Deeper journeys.', icon: Monitor, view: ViewState.ORIGINALS, category: 'Series' },
  { label: 'Micro Dramas', caption: 'Shorter. Bolder. Closer.', icon: Smartphone, view: ViewState.MICRO_DRAMAS },
  { label: 'Shorts', caption: 'Real life. Right now.', icon: SquarePlay, view: ViewState.SHORTS },
  { label: 'School Flix', caption: 'Next gen talent.', icon: BookOpen, view: ViewState.SCHOOL_FLIX },
  { label: 'Music', caption: 'Rhythms of Africa.', icon: Music, view: ViewState.MUSIC },
  { label: 'Documentary', caption: 'Real truth. Deeper stories.', icon: Clapperboard, view: ViewState.DOCUMENTARY },
  { label: 'Education', caption: 'Knowledge for tomorrow.', icon: BookOpen, view: ViewState.EDUCATION },
  { label: 'Live', caption: 'In the moment.', icon: Radio, view: ViewState.LIVE },
];

export default function LandingFooter({ navigate }: { navigate: (view: ViewStateOrString, category?: string) => void }) {
  return <footer className="landing-footer">
    <nav aria-label="Explore TubeTV" className="landing-footer-categories">
      {destinations.map(({ label, caption, icon: Icon, view, category }) => <button key={label} onClick={() => navigate(view, category)} className={view === ViewState.MICRO_DRAMAS ? 'landing-footer-priority' : ''}>
        <Icon size={30} strokeWidth={1.35} /><span><strong>{label}</strong><small>{caption}</small></span>
      </button>)}
    </nav>
    <div className="landing-footer-bottom">
      <div><span className="cinema-logo">Tube<span>TV</span></span><p>Real stories. Bigger tomorrows.</p><small>Kenyan stories. A brighter Africa.</small></div>
      <div className="landing-footer-contact"><nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav><a href="mailto:info@onfonmedia.com">info@onfonmedia.com</a><a href="tel:+254703012000">(+254) 703 012 000</a></div>
      <div className="landing-signature"><span>Kenya<br />Creates</span><p>A more human tomorrow.<br />On TubeTV.</p></div>
    </div>
  </footer>;
}
