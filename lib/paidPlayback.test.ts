import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { catalogueEpisode, isFreeMicroDramaEpisode, isVerifiedPaymentIdentity } from '../supabase/functions/_shared/episodeAccess';
import { verifyPaystackWebhook } from '../supabase/functions/_shared/paystackSignature';

describe('paid episode rules', () => {
  it('allows only episodes one and two and never treats invalid metadata as free', () => {
    expect([0, 1, 2, 3, undefined].map(isFreeMicroDramaEpisode)).toEqual([false, true, true, false, false]);
    expect(catalogueEpisode('S01 E03 - Otis', '')).toBe(3);
    expect(catalogueEpisode('S01E01', '3')).toBe(3);
    expect(catalogueEpisode('S01E01', '2junk')).toBeUndefined();
  });

  it('requires an authenticated identity with verified contact details', () => {
    expect(isVerifiedPaymentIdentity({ phone: '254700000000', phone_confirmed_at: '2026-01-01' })).toBe(true);
    expect(isVerifiedPaymentIdentity({ email: 'viewer@example.com', email_confirmed_at: '2026-01-01' })).toBe(true);
    expect(isVerifiedPaymentIdentity({ email: 'viewer@example.com' })).toBe(false);
    expect(isVerifiedPaymentIdentity({ email: 'legacy@viewer.tube.co.ke', email_confirmed_at: '2026-01-01' })).toBe(false);
  });
});

describe('Paystack webhook authentication', () => {
  const payload = '{"event":"charge.success"}';
  const body = new TextEncoder().encode(payload);
  const apiSecret = 'sk_test_example';
  const signingSecret = 'whsec_example';
  const timestamp = 1750000000;
  const sign = (key: string, value: string) => createHmac('sha512', key).update(value).digest('hex');

  it('accepts a valid legacy signature and rejects altered bytes', async () => {
    const headers = new Headers({ 'x-paystack-signature': sign(apiSecret, payload) });
    expect(await verifyPaystackWebhook(headers, body, apiSecret)).toBe(true);
    expect(await verifyPaystackWebhook(headers, new TextEncoder().encode(payload + ' '), apiSecret)).toBe(false);
  });

  it('validates the timestamped signature without falling back to the legacy header', async () => {
    const signature = sign(signingSecret, timestamp + '.' + payload);
    const headers = new Headers({
      'Paystack-Signature': `t=${timestamp},v1=whk_example:${signature}`,
      'x-paystack-signature': sign(apiSecret, payload),
    });
    expect(await verifyPaystackWebhook(headers, body, apiSecret, signingSecret, timestamp)).toBe(true);
    expect(await verifyPaystackWebhook(headers, body, apiSecret, signingSecret, timestamp + 301)).toBe(false);
    headers.delete('Paystack-Signature');
    expect(await verifyPaystackWebhook(headers, body, apiSecret, signingSecret, timestamp)).toBe(false);
  });
});
