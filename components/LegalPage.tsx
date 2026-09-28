import React, { useEffect } from 'react';

const content = {
  privacy: {
    title: 'Privacy notice',
    intro: 'How we use account and viewing information to make TubeTV work.',
    sections: [
      ['What we collect', 'Your account profile, watch list, playback progress, and preferences. Local viewing preferences are stored on this device.'],
      ['Why we use it', 'To provide playback, remember viewing choices, protect accounts, prevent abuse and improve service reliability.'],
      ['Your choices', 'You can download your account data or permanently delete your account from Settings. You may also ask us to correct inaccurate information or object to processing.'],
      ['Children', 'Profiles default to PG. Unrated and 18-rated content is blocked. A parent or guardian should manage accounts used by children.'],
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: 'A few important conditions for enjoying TubeTV and its content.',
    sections: [
      ['Access', 'You must use accurate account information and keep access codes private.'],
      ['Content', 'Content ratings and descriptions are guidance. Do not copy, rebroadcast or commercially exploit programmes without permission.'],
      ['Availability', 'Streams may be interrupted by connectivity, maintenance or third-party delivery services.'],
      ['Conduct', 'Do not upload unlawful content, evade access controls, attack the service or misuse another person’s account.'],
      ['Changes', 'Material changes will be reflected on this page with an updated date.'],
    ],
  },
} as const;

const LegalPage = ({ kind }: { kind: keyof typeof content }) => {
  const page = content[kind];
  useEffect(() => {
    document.title = `${page.title} | TubeTV`;
  }, [page.title]);

  return (
    <main className="legal-page">
      <header className="legal-header">
        <a href="/" className="cinema-logo" aria-label="TubeTV home">Tube<span>TV</span></a>
        <a href="/" className="legal-back">← Back to stories</a>
      </header>
      <article className="legal-article">
        <p className="cinema-eyebrow">The details behind the stories</p>
        <h1>{page.title}</h1>
        <p className="legal-intro">{page.intro}</p>
        <p className="legal-date">Updated 28 September 2026</p>
        <div className="legal-sections">
          {page.sections.map(([heading, body], index) => (
            <section key={heading} className="legal-section">
              <span className="legal-section-number">{String(index + 1).padStart(2, '0')}</span>
              <div><h2>{heading}</h2><p>{body}</p></div>
            </section>
          ))}
        </div>
        <aside className="legal-contact" aria-labelledby="legal-contact-heading">
          <div><p className="cinema-eyebrow">Questions or requests</p><h2 id="legal-contact-heading">Contact TubeTV</h2></div>
          <div className="legal-contact-links"><a href="mailto:info@onfonmedia.com">info@onfonmedia.com</a><a href="tel:+254703012000">(+254) 703 012 000</a></div>
        </aside>
      </article>
      <footer className="legal-footer">
        <div><span className="cinema-logo">Tube<span>TV</span></span><p>Real stories. Bigger tomorrows.</p></div>
        <nav aria-label="Legal"><a href="/">Discover</a><a href="/privacy" aria-current={kind === 'privacy' ? 'page' : undefined}>Privacy</a><a href="/terms" aria-current={kind === 'terms' ? 'page' : undefined}>Terms</a></nav>
        <small>Kenyan stories. A brighter Africa.</small>
      </footer>
    </main>
  );
};

export default LegalPage;
