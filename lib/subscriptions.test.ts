import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PLANS } from './subscriptions';

describe('subscription payment policy', () => {
  it('offers the approved fixed-price passes', () => {
    expect(SUBSCRIPTION_PLANS.daily.amountKes).toBe(10);
    expect(SUBSCRIPTION_PLANS.weekly.amountKes).toBe(50);
    expect(SUBSCRIPTION_PLANS.monthly.amountKes).toBe(249);
  });

  it('keeps amounts server-controlled and validates callback reconciliation', () => {
    const stkSource = readFileSync(new URL('../supabase/functions/mpesa-stk-push/index.ts', import.meta.url), 'utf8');
    const callbackSource = readFileSync(new URL('../supabase/functions/mpesa-callback/index.ts', import.meta.url), 'utf8');
    expect(stkSource).toContain('amount: 10');
    expect(stkSource).not.toContain('requestBody.amount');
    expect(callbackSource).toContain('amount !== transaction.amount_kes');
    expect(callbackSource).toContain('phone !== expectedPhone');
  });
});
