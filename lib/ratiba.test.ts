import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
  isSupabaseConfigured: true,
}));

import { SUBSCRIPTION_PLANS, startMpesaPayment, getRatibaMandateStatus, cancelRatibaMandate } from './subscriptions';
import { translations } from '../translations';
import { supabase } from './supabase';

describe('M-Pesa Ratiba (Standing Orders) Monthly Pass', () => {
  it('confirms the monthly pass is KSh 149 for 30 days', () => {
    expect(SUBSCRIPTION_PLANS.monthly.amountKes).toBe(149);
    expect(SUBSCRIPTION_PLANS.monthly.code).toBe('monthly');
  });

  it('provides exact user-requested translations for auto-renew toggle', () => {
    expect(translations.en['paywall.autoRenewLabel']).toBe('Auto-renew with M-Pesa');
    expect(translations.sw['paywall.autoRenewLabel']).toBe('Jirudishe yenyewe kwa M-Pesa');
    expect(translations.en['paywall.autoRenewHint']).toContain('Renews automatically every 30 days');
    expect(translations.en['paywall.autoRenewHint']).toContain('*334#');
    expect(translations.en['paywall.payButtonAutoRenew']).toBe('Authorize KSh {amount} / mo via M-Pesa');
  });

  it('routes to mpesa-ratiba when autoRenew is enabled for monthly pass', async () => {
    const invokeSpy = vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        transaction: {
          id: 'tx-ratiba-123',
          status: 'submitted',
          checkoutToken: 'tok-secret-abc',
          mandateId: 'mandate-xyz',
          message: 'Auto-renew prompt sent to your Safaricom phone.',
          isRatiba: true,
        },
      },
      error: null,
    });

    const result = await startMpesaPayment('monthly', '0712345678', { autoRenew: true });

    expect(invokeSpy).toHaveBeenCalledWith(
      'mpesa-ratiba',
      expect.objectContaining({
        body: { action: 'initiate', planCode: 'monthly', phone: '0712345678' },
      }),
    );
    expect(result.id).toBe('tx-ratiba-123');
    expect(result.isRatiba).toBe(true);

    invokeSpy.mockReset();
  });

  it('queries mandate status and can cancel standing order', async () => {
    const statusSpy = vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        mandate: {
          id: 'mandate-1',
          standing_order_name: 'TubeTV Monthly Pass',
          amount_kes: 149,
          frequency: 'monthly',
          status: 'active',
          next_billing_date: '2026-12-11T00:00:00Z',
        },
      },
      error: null,
    });

    const status = await getRatibaMandateStatus('0712345678');
    expect(status?.status).toBe('active');
    expect(status?.amount_kes).toBe(149);
    statusSpy.mockReset();

    const cancelSpy = vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { ok: true, cancelled: true },
      error: null,
    });

    const cancelled = await cancelRatibaMandate('0712345678');
    expect(cancelled).toBe(true);
    cancelSpy.mockReset();
  });
});
