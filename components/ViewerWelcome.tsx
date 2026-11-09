import React, { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { ViewState, ViewStateOrString } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

export default function ViewerWelcome({
  navigate,
  hasMicroDramas = false,
}: {
  navigate: (view: ViewStateOrString, category?: string) => void;
  hasMicroDramas?: boolean;
}) {
  const { language, t } = useLanguage();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('tube_welcome_v1') === 'dismissed';
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('tube_welcome_v1', 'dismissed');
    } catch {
      /* Browsing also works without storage. */
    }
  };

  if (dismissed) return null;

  const interests: Array<[string, ViewStateOrString, string | undefined]> = [
    [
      hasMicroDramas
        ? t('nav.microDramas')
        : language === 'sw'
          ? 'Tamthilia Fupi · Zinakuja'
          : 'Micro Dramas · Coming soon',
      ViewState.MICRO_DRAMAS,
      undefined,
    ],
    [t('nav.movies'), ViewState.ORIGINALS, 'Movies'],
    [t('nav.series'), ViewState.ORIGINALS, 'Series'],
    [t('nav.genres'), ViewState.GENRES, undefined],
    [t('nav.shorts'), ViewState.SHORTS, undefined],
    [t('nav.education'), ViewState.EDUCATION, undefined],
    [t('nav.farmers'), ViewState.FARMERS, undefined],
    [t('nav.faith'), ViewState.FAITH, undefined],
    [t('nav.kids'), ViewState.KIDS, undefined],
    [t('nav.diaspora'), ViewState.DIASPORA, undefined],
    [t('nav.live'), ViewState.LIVE, undefined],
  ];

  return (
    <section className="viewer-welcome" aria-label="Welcome to TubeTV">
      <div>
        <p>{t('welcome.eyebrow')}</p>
        <h2>{language === 'sw' ? 'Karibu kwenye ulimwengu wa hadithi za Kenya.' : 'Welcome to a world of Kenyan stories.'}</h2>
        <span>
          {language === 'sw'
            ? 'Tazama kwa uhuru. Huhitaji akaunti kuanza kutazama.'
            : 'Browse freely. No account needed to get started.'}
        </span>
      </div>
      <button
        type="button"
        className="cinema-secondary"
        aria-expanded={open}
        aria-controls="viewer-interests"
        onClick={() => setOpen((value) => !value)}
      >
        {t('welcome.title')} <ArrowRight size={15} />
      </button>
      <button type="button" className="welcome-dismiss" aria-label={t('welcome.skip')} onClick={dismiss}>
        <X size={18} />
      </button>
      {open && (
        <div id="viewer-interests" className="viewer-interests">
          <p>{language === 'sw' ? ' ungependa kuanzia wapi?' : 'Where would you like to begin?'}</p>
          {interests.map(([label, view, category]) => (
            <button
              type="button"
              key={label}
              onClick={() => {
                dismiss();
                navigate(view, category);
              }}
            >
              {label}
            </button>
          ))}
          <small>
            {language === 'sw'
              ? 'Hii ni njia ya mkato ya kuvinjari, si usajili wa akaunti.'
              : 'This is a browsing shortcut, not a sign-up or notification subscription.'}
          </small>
        </div>
      )}
    </section>
  );
}
