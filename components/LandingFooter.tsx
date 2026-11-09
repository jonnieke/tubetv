import React from 'react';
import { BookOpen, Clapperboard, Monitor, Radio, Smartphone, SquarePlay } from 'lucide-react';
import { ViewState, ViewStateOrString } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const destinations = [
  { label: 'Movies', swLabel: 'Filamu', caption: 'Bigger worlds.', swCaption: 'Ulimwengu mpana.', icon: Clapperboard, view: ViewState.ORIGINALS, category: 'Movies' },
  { label: 'Series', swLabel: 'Tamthilia', caption: 'Deeper journeys.', swCaption: 'Safari ndefu.', icon: Monitor, view: ViewState.ORIGINALS, category: 'Series' },
  { label: 'Micro Dramas', swLabel: 'Tamthilia Fupi', caption: 'Shorter. Bolder. Closer.', swCaption: 'Fupi. Kali. Karibu.', icon: Smartphone, view: ViewState.MICRO_DRAMAS },
  { label: 'Shorts', swLabel: 'Shorts', caption: 'Real life. Right now.', swCaption: 'Maisha halisi sasa.', icon: SquarePlay, view: ViewState.SHORTS },
  { label: 'Education', swLabel: 'Elimu', caption: 'Knowledge for tomorrow.', swCaption: 'Maarifa ya kesho.', icon: BookOpen, view: ViewState.EDUCATION },
  { label: 'Live', swLabel: 'Moja kwa Moja', caption: 'In the moment.', swCaption: 'Mubashara sasa.', icon: Radio, view: ViewState.LIVE },
];

export default function LandingFooter({
  navigate,
}: {
  navigate: (view: ViewStateOrString, category?: string) => void;
}) {
  const { language } = useLanguage();
  return (
    <footer className="landing-footer">
      <nav aria-label="Explore TubeTV" className="landing-footer-categories">
        {destinations.map(({ label, swLabel, caption, swCaption, icon: Icon, view, category }) => (
          <button
            type="button"
            key={label}
            onClick={() => navigate(view, category)}
            className={view === ViewState.MICRO_DRAMAS ? 'landing-footer-priority' : ''}
          >
            <Icon size={30} strokeWidth={1.35} />
            <span>
              <strong>{language === 'sw' ? swLabel : label}</strong>
              <small>{language === 'sw' ? swCaption : caption}</small>
            </span>
          </button>
        ))}
      </nav>
      <div className="landing-footer-bottom">
        <div>
          <span className="cinema-logo">
            Tube<span>TV</span>
          </span>
          <p>{language === 'sw' ? 'Hadithi za kweli. Kesho iliyo bora.' : 'Real stories. Bigger tomorrows.'}</p>
          <small>{language === 'sw' ? 'Hadithi za Kenya. Afrika yenye mwanga.' : 'Kenyan stories. A brighter Africa.'}</small>
        </div>
        <div className="landing-footer-contact">
          <nav aria-label="Legal">
            <a href="/privacy">{language === 'sw' ? 'Faragha' : 'Privacy'}</a>
            <a href="/terms">{language === 'sw' ? 'Masharti' : 'Terms'}</a>
          </nav>
          <a href="mailto:info@onfonmedia.com">info@onfonmedia.com</a>
          <a href="tel:+254703012000">(+254) 703 012 000</a>
        </div>
        <div className="landing-signature">
          <span>
            Kenya
            <br />
            Creates
          </span>
          <p>
            A more human tomorrow.
            <br />
            On TubeTV.
          </p>
        </div>
      </div>
    </footer>
  );
}
