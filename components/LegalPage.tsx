import React, { useEffect } from 'react';
import { setPageMetadata } from '../lib/seo';

const content = {
  privacy: {
    title: 'Privacy notice',
    intro:
      'How Onfon Media Ltd (operating TubeTV in Kenya) collects, safeguards, and processes viewing and M-Pesa pass information under the Kenya Data Protection Act, 2019.',
    sections: [
      [
        'Data controller & what we collect',
        'TubeTV is operated by Onfon Media Ltd, Nairobi, Kenya. We collect local viewing preferences, watchlist selections, playback progress, anonymous reliability analytics, and — when you buy or restore a pass — your phone number, email address, M-Pesa transaction receipt reference, or Paystack reference.',
      ],
      [
        'Why we process information & lawful basis',
        'We process data to stream programmes, fulfill prepaid access passes, restore active passes across your devices, protect administrator accounts, prevent fraud, and measure playback quality.',
      ],
      [
        'Service providers & cross-border safeguards',
        'TubeTV uses Safaricom PLC (M-Pesa Daraja payments), Paystack Payments Kenya Ltd (PCI-DSS Level 1 card and mobile money payment processing), Supabase (database and edge functions), Bunny.net (video encoding and CDN delivery), and Vercel (web hosting) under technical and contractual safeguards aligned with Section 48 of the Kenya Data Protection Act, 2019.',
      ],
      [
        'Your rights & statutory retention',
        'You can download your account data or permanently delete your account from Settings, or contact us to access, correct, or object to processing. Where payment transactions exist, personal profile links are detached upon deletion while statutory financial ledger records are retained for 7 years under Kenyan tax law.',
      ],
      [
        'Children & KFCB age controls',
        'General browsing defaults to rating 16 (GE, PG, and 16), the Kids section is strictly locked to GE (General Exhibition), and 18-rated content is blocked from the public catalogue. Parents or guardians can set a stricter GE or PG ceiling in Settings.',
      ],
    ],
  },
  terms: {
    title: 'Terms of use',
    intro:
      'Important conditions for streaming TubeTV programmes and purchasing prepaid access passes in accordance with the laws of Kenya.',
    sections: [
      [
        'Access & security',
        'You may watch free stories and purchase passes without registering an account. Keep your M-Pesa PIN, transaction receipts, payment references, and any account credentials confidential, and never misuse another person’s account, payment card, or mobile money line.',
      ],
      [
        'Prepaid passes & refunds',
        'TubeTV offers one-time, non-recurring prepaid passes via Safaricom M-Pesa and Paystack (Card, Apple Pay, and Mobile Money): 24-Hour All-Access Pass (KSh 10), Weekly Binge Pass (KSh 50), and Monthly VIP Pass (KSh 149), inclusive of applicable taxes. Passes never auto-renew and can be restored on another browser using your phone number or payment reference. Verified duplicate or unfulfilled debits caused by a platform fault are credited or refunded via customer support.',
      ],
      [
        'Content & KFCB classification',
        'Programmes display Kenya Film Classification Board (KFCB) ratings (GE, PG, 16) for viewer and parental guidance. All streams are licensed for personal, non-commercial viewing only; do not record, redistribute, or circumvent stream protection tokens.',
      ],
      [
        'Service availability & conduct',
        'Playback quality depends on your internet connection and device compatibility. Do not upload unlawful material, probe or evade access controls, or interfere with service delivery.',
      ],
      [
        'Governing law & updates',
        'These terms are governed by the laws of the Republic of Kenya, including the Consumer Protection Act, 2012. Material updates will appear on this page with an updated effective date.',
      ],
    ],
  },
} as const;

const LegalPage = ({ kind }: { kind: keyof typeof content }) => {
  const page = content[kind];
  useEffect(() => {
    setPageMetadata({
      title: `${page.title} | TubeTV`,
      description: page.intro,
      path: kind === 'privacy' ? '/privacy' : '/terms',
    });
  }, [kind, page.intro, page.title]);

  return (
    <main className="legal-page">
      <header className="legal-header">
        <a href="/" className="cinema-logo" aria-label="TubeTV home">
          Tube<span>TV</span>
        </a>
        <a href="/" className="legal-back">
          ← Back to stories
        </a>
      </header>
      <article className="legal-article">
        <p className="cinema-eyebrow">The details behind the stories</p>
        <h1>{page.title}</h1>
        <p className="legal-intro">{page.intro}</p>
        <p className="legal-date">Updated 3 November 2026</p>
        <div className="legal-sections">
          {page.sections.map(([heading, body], index) => (
            <section key={heading} className="legal-section">
              <span className="legal-section-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{heading}</h2>
                <p>{body}</p>
              </div>
            </section>
          ))}
        </div>
        <aside className="legal-contact" aria-labelledby="legal-contact-heading">
          <div>
            <p className="cinema-eyebrow">Questions, pass support or data requests</p>
            <h2 id="legal-contact-heading">Contact TubeTV (Onfon Media Ltd)</h2>
          </div>
          <div className="legal-contact-links">
            <a href="mailto:info@onfonmedia.com">info@onfonmedia.com</a>
            <a href="tel:+254703012000">(+254) 703 012 000</a>
          </div>
        </aside>
      </article>
      <footer className="legal-footer">
        <div>
          <span className="cinema-logo">
            Tube<span>TV</span>
          </span>
          <p>Real stories. Bigger tomorrows.</p>
        </div>
        <nav aria-label="Legal">
          <a href="/">Discover</a>
          <a href="/privacy" aria-current={kind === 'privacy' ? 'page' : undefined}>
            Privacy
          </a>
          <a href="/terms" aria-current={kind === 'terms' ? 'page' : undefined}>
            Terms
          </a>
        </nav>
        <small>© {new Date().getFullYear()} Onfon Media Ltd · TubeTV Kenya</small>
      </footer>
    </main>
  );
};

export default LegalPage;
