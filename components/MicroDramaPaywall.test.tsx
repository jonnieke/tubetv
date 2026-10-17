import { describe, expect, it } from 'vitest';
import { COIN_PACKAGES, VIP_PASSES } from '../services/paymentService';

describe('MicroDrama Monetization Engine', () => {
  it('validates coin packages and pricing for Kenya & Diaspora', () => {
    expect(COIN_PACKAGES.length).toBeGreaterThanOrEqual(3);

    // Starter pack: 100 KES or $0.99
    const starter = COIN_PACKAGES.find(p => p.id === 'coins-100');
    expect(starter).toBeDefined();
    expect(starter?.priceKes).toBe(100);
    expect(starter?.priceUsd).toBe(0.99);
    expect(starter?.coins).toBe(100);

    // Binge pack with bonus
    const binge = COIN_PACKAGES.find(p => p.id === 'coins-300');
    expect(binge).toBeDefined();
    expect(binge?.bonus).toBe(50);
  });

  it('validates VIP pass definitions', () => {
    const dailyPass = VIP_PASSES.find(p => p.id === 'pass-daily');
    expect(dailyPass).toBeDefined();
    expect(dailyPass?.priceKes).toBe(50);
  });
});
