import React, { useEffect } from 'react';

const content = {
  privacy: {
    title: 'Privacy notice',
    intro: 'TubeTV uses account and viewing data to provide playback, saved lists and support.',
    sections: [
      ['What we collect', 'Your account profile, watch list, playback progress, and preferences. Local viewing preferences are stored on this device.'],
      ['Why we use it', 'To authenticate you, deliver purchased access, remember viewing choices, prevent abuse and improve service reliability.'],
      ['Your choices', 'You can download your account data or permanently delete your account from Settings. You may also ask us to correct inaccurate information or object to processing.'],
      ['Children', 'Profiles default to PG. Unrated and 18-rated content is blocked. A parent or guardian should manage accounts used by children.'],
      ['Contact', 'Privacy requests can be sent through the support contact published by TubeTV.'],
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: 'These terms govern access to TubeTV content and paid passes.',
    sections: [
      ['Access', 'You must use accurate account information and keep access codes private.'],
      ['Content', 'Content ratings and descriptions are guidance. Do not copy, rebroadcast or commercially exploit programmes without permission.'],
      ['Availability', 'Streams may be interrupted by connectivity, maintenance or third-party delivery services.'],
      ['Conduct', 'Do not upload unlawful content, evade access controls, attack the service or misuse another person?s account.'],
      ['Changes', 'Material changes will be reflected on this page with an updated effective date before they apply.'],
    ],
  },
} as const;

const LegalPage = ({ kind }: { kind: keyof typeof content }) => {
  const page = content[kind];
  useEffect(() => {
    document.title = `${page.title} | TubeTV`;
  }, [page.title]);

  return (
    <main className="h-screen overflow-y-auto bg-zinc-950 px-5 py-10 text-white">
      <article className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-bold text-red-400 hover:text-red-300">TubeTV home</a>
        <h1 className="mt-6 text-3xl font-black">{page.title}</h1>
        <p className="mt-3 leading-7 text-zinc-300">{page.intro}</p>
        <p className="mt-2 text-xs text-zinc-500">Effective 29 July 2026</p>
        <div className="mt-8 divide-y divide-zinc-800 border-y border-zinc-800">
          {page.sections.map(([heading, body]) => (
            <section key={heading} className="py-6">
              <h2 className="text-lg font-bold">{heading}</h2>
              <p className="mt-2 leading-7 text-zinc-300">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
};

export default LegalPage;
