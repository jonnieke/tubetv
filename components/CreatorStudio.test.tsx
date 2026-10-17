import { describe, expect, it } from 'vitest';

describe('Creator Studio Economics Logic', () => {
  it('correctly calculates 65% net creator split from coin burn', () => {
    const coinsBurned = 10;
    const kesPerCoin = 2.0;
    const revShare = 65.0; // 65%

    const grossKes = coinsBurned * kesPerCoin; // 20.00 KES
    const creatorNetKes = Math.round((grossKes * (revShare / 100)) * 100) / 100; // 13.00 KES
    const platformFeeKes = Math.round((grossKes - creatorNetKes) * 100) / 100; // 7.00 KES

    expect(grossKes).toBe(20.0);
    expect(creatorNetKes).toBe(13.0);
    expect(platformFeeKes).toBe(7.0);
  });

  it('correctly sanitizes and formats Kenyan Safaricom phone numbers', () => {
    const sanitizePhone = (raw: string) => {
      let cleaned = raw.replace(/\D/g, '');
      if (cleaned.startsWith('0')) {
        cleaned = `254${cleaned.slice(1)}`;
      } else if (cleaned.startsWith('254')) {
        // already fine
      }
      return cleaned;
    };

    expect(sanitizePhone('0712345678')).toBe('254712345678');
    expect(sanitizePhone('0112345678')).toBe('254112345678');
    expect(sanitizePhone('+254 712 345 678')).toBe('254712345678');

    const isValidMpesa = (phone: string) => /^254[71]\d{8}$/.test(phone);
    expect(isValidMpesa('254712345678')).toBe(true);
    expect(isValidMpesa('254112345678')).toBe(true);
    expect(isValidMpesa('254201234567')).toBe(false); // landline
    expect(isValidMpesa('12345')).toBe(false);
  });

  it('enforces minimum withdrawal thresholds and available balance guards', () => {
    const availableBalance = 2500;
    const minWithdrawal = 500;

    const canWithdraw = (amount: number) => {
      return !isNaN(amount) && amount >= minWithdrawal && amount <= availableBalance;
    };

    expect(canWithdraw(300)).toBe(false); // Below min
    expect(canWithdraw(500)).toBe(true); // Exact min
    expect(canWithdraw(1500)).toBe(true); // Within limits
    expect(canWithdraw(3000)).toBe(false); // Exceeds balance
  });
});
