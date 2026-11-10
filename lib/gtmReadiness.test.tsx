import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PaywallModal from '../components/PaywallModal';
import VideoCard from '../components/VideoCard';
import { PlaybackProvider } from '../contexts/PlaybackContext';
import { filterVideosByRating, isKidsVideo } from './discovery';
import { isVideoLocked } from './monetization';
import { DEFAULT_PLAYBACK_PREFERENCES } from './viewerState';
import { translations } from '../translations';
import type { Video } from '../types';

const sampleVideo = (overrides: Partial<Video> = {}): Video => ({
  id: '11111111-2222-3333-4444-555555555555',
  title: 'Nairobi After Dark',
  description: 'A thriller set in CBD.',
  thumbnail: 'https://example.com/thumb.jpg',
  url: 'https://example.com/playlist.m3u8',
  duration: '12:00',
  views: 100,
  author: 'TubeTV Originals',
  category: 'Movies',
  contentRating: '16',
  isPremium: true,
  accessTier: 'premium',
  ...overrides,
});

describe('GTM readiness guardrails', () => {
  it('renders all M-Pesa pass tiers and cross-device restore tab without fake demo bypasses', () => {
    const html = renderToStaticMarkup(
      <PaywallModal video={sampleVideo()} onSuccess={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain('KSh 10');
    expect(html).toContain('KSh 50');
    expect(html).toContain('KSh 149');
    expect(html).toContain('Restore Pass');
    expect(html).toContain('Paystack');
    expect(html).toContain('Card, Apple Pay, M-Pesa');

    const paywallSource = readFileSync(new URL('../components/PaywallModal.tsx', import.meta.url), 'utf8');
    const subSource = readFileSync(new URL('./subscriptions.ts', import.meta.url), 'utf8');
    expect(paywallSource).not.toContain('activateDemoPass');
    expect(subSource).not.toContain('activateDemoPass');
    expect(subSource).toContain("LEGACY_GUEST_PASS_KEY = 'tube_guest_pass'");
    expect(subSource).toContain('localStorage.removeItem(LEGACY_GUEST_PASS_KEY)');
    expect(subSource).toContain('verifyStoredPass');
    expect(subSource).toContain('startPaystackPayment');
    expect(subSource).toContain('fetchPaystackStatus');
    expect(subSource).toContain('restorePaystackPass');
    expect(paywallSource).toContain('startPaystackPayment');
    expect(paywallSource).toContain('fetchPaystackStatus');
    expect(paywallSource).toContain('restorePaystackPass');
  });

  it('gates locked premium titles in VideoCard without mounting an unauthorized video stream', () => {
    const lockedVideo = sampleVideo();
    expect(isVideoLocked(lockedVideo, false)).toBe(true);
    expect(isVideoLocked(lockedVideo, true)).toBe(false);

    const lockedHtml = renderToStaticMarkup(
      <PlaybackProvider
        value={{
          preferences: DEFAULT_PLAYBACK_PREFERENCES,
          getProgress: () => undefined,
          onEnded: () => {},
          onProgress: () => {},
          isLocked: () => true,
          onRequireUnlock: () => {},
        }}
      >
        <VideoCard video={lockedVideo} autoPlay playerOnly />
      </PlaybackProvider>,
    );

    expect(lockedHtml).toContain('Unlock with M-Pesa');
    expect(lockedHtml).not.toContain('<video');

    const unlockedPausedHtml = renderToStaticMarkup(
      <PlaybackProvider
        value={{
          preferences: DEFAULT_PLAYBACK_PREFERENCES,
          getProgress: () => undefined,
          onEnded: () => {},
          onProgress: () => {},
          isLocked: () => false,
          onRequireUnlock: () => {},
        }}
      >
        <VideoCard video={sampleVideo({ isPremium: false, accessTier: 'free' })} autoPlay={false} playerOnly />
      </PlaybackProvider>,
    );
    expect(unlockedPausedHtml).toContain('<video');
    expect(unlockedPausedHtml).toContain('Resume Nairobi After Dark');
  });

  it('enforces word-boundary and KFCB GE rating rules for Kids discovery', () => {
    expect(
      isKidsVideo(
        sampleVideo({
          title: 'Kidnapped in Mombasa',
          description: 'Crime thriller',
          category: 'Movies',
          contentRating: '16',
        }),
      ),
    ).toBe(false);

    expect(
      isKidsVideo(
        sampleVideo({
          title: 'Adult Animation Feature',
          genre: 'Animation',
          category: 'Movies',
          contentRating: '16',
        }),
      ),
    ).toBe(false);

    expect(
      isKidsVideo(
        sampleVideo({
          title: 'Toto Tales',
          category: 'Kids',
          contentRating: 'GE',
        }),
      ),
    ).toBe(true);

    const ratedList = [
      sampleVideo({ id: 'ge-1', contentRating: 'GE' }),
      sampleVideo({ id: 'pg-1', contentRating: 'PG' }),
      sampleVideo({ id: '16-1', contentRating: '16' }),
      sampleVideo({ id: '18-1', contentRating: '18' }),
    ];
    expect(filterVideosByRating(ratedList, 'GE').map((v) => v.id)).toEqual(['ge-1']);
    expect(filterVideosByRating(ratedList, 'PG').map((v) => v.id)).toEqual(['ge-1', 'pg-1']);
    expect(filterVideosByRating(ratedList, '16').map((v) => v.id)).toEqual(['ge-1', 'pg-1', '16-1']);
  });

  it('keeps client AnalyticsEventName and Edge Function allowlists synchronized', () => {
    const clientSource = readFileSync(new URL('./analytics.ts', import.meta.url), 'utf8');
    const collectorSource = readFileSync(
      new URL('../supabase/functions/analytics-event/index.ts', import.meta.url),
      'utf8',
    );
    const summarySource = readFileSync(
      new URL('../supabase/functions/analytics-summary/index.ts', import.meta.url),
      'utf8',
    );
    const migrationSource = readFileSync(
      new URL('../supabase/migrations/20261103164500_gtm_launch_hardening.sql', import.meta.url),
      'utf8',
    );

    const clientEvents = Array.from(clientSource.matchAll(/\|\s*'([a-z_]+)'/g)).map((m) => m[1]);
    expect(clientEvents.length).toBeGreaterThanOrEqual(16);

    for (const evt of clientEvents) {
      expect(collectorSource).toContain(`"${evt}"`);
      expect(summarySource).toContain(`"${evt}"`);
      expect(migrationSource).toContain(`'${evt}'`);
    }
  });

  it('maintains 100% key and placeholder parity between English and Kiswahili dictionaries', () => {
    const enKeys = Object.keys(translations.en).sort();
    const swKeys = Object.keys(translations.sw).sort();
    expect(swKeys).toEqual(enKeys);

    for (const key of enKeys) {
      const enVal = translations.en[key as keyof typeof translations.en];
      const swVal = translations.sw[key as keyof typeof translations.sw];
      expect(swVal.trim().length, `Empty sw translation for ${key}`).toBeGreaterThan(0);

      const enParams = Array.from(enVal.matchAll(/\{(\w+)\}/g))
        .map((m) => m[1])
        .sort();
      const swParams = Array.from(swVal.matchAll(/\{(\w+)\}/g))
        .map((m) => m[1])
        .sort();
      expect(swParams, `Mismatched placeholders in sw translation for ${key}`).toEqual(enParams);
    }
  });

  it('validates Paystack webhook HMAC-SHA512 verification, checkout edge functions, and SQL migration', () => {
    const webhookSource = readFileSync(
      new URL('../supabase/functions/paystack-webhook/index.ts', import.meta.url),
      'utf8',
    );
    const checkoutSource = readFileSync(
      new URL('../supabase/functions/paystack-checkout/index.ts', import.meta.url),
      'utf8',
    );
    const migrationSource = readFileSync(
      new URL('../supabase/migrations/20261105140000_paystack_integration.sql', import.meta.url),
      'utf8',
    );

    // Webhook security guardrails
    expect(webhookSource).toContain('x-paystack-signature');
    expect(webhookSource).toContain('name: "HMAC"');
    expect(webhookSource).toContain('hash: "SHA-512"');
    expect(webhookSource).toContain('fulfill_paystack_payment');

    // Checkout edge function guardrails
    expect(checkoutSource).toContain('https://api.paystack.co/transaction/initialize');
    expect(checkoutSource).toContain('https://api.paystack.co/transaction/verify');
    expect(checkoutSource).toContain('currency: "KES"');
    expect(checkoutSource).toContain('fulfill_paystack_payment');

    // SQL migration guardrails
    expect(migrationSource).toContain('fulfill_paystack_payment');
    expect(migrationSource).toContain('paystack_reference');
    expect(migrationSource).toContain('paystack_access_code');
  });

  it('serves Apple Pay merchant domain association file with correct headers and Permissions-Policy', () => {
    const associationContent = readFileSync(
      new URL('../public/.well-known/apple-developer-merchantid-domain-association', import.meta.url),
      'utf8',
    ).trim();
    expect(associationContent.length).toBeGreaterThan(50);
    // Paystack PSP association hex contains {"version":1,"pspId":...}
    expect(associationContent.startsWith('7b22')).toBe(true);

    const vercelConfig = JSON.parse(
      readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
    ) as {
      headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };

    const globalHeaders = vercelConfig.headers?.find((h) => h.source === '/(.*)')?.headers;
    const permissionsPolicy = globalHeaders?.find((h) => h.key === 'Permissions-Policy')?.value;
    expect(permissionsPolicy).toContain('payment=');
    expect(permissionsPolicy).toContain('https://js.paystack.co');

    const wellKnownHeaders = vercelConfig.headers?.find((h) => h.source === '/.well-known/(.*)')?.headers;
    const contentType = wellKnownHeaders?.find((h) => h.key === 'Content-Type')?.value;
    expect(contentType).toContain('text/plain');
  });
});
