import { describe, expect, it } from 'vitest';
import { isValidKenyanPhone, normalizePhone, phoneToE164 } from './supabase';

describe('Kenyan phone identity', () => {
  it('normalizes supported mobile prefixes to E.164', () => {
    expect(phoneToE164('0712 345 678')).toBe('+254712345678');
    expect(phoneToE164('+254 112 345 678')).toBe('+254112345678');
    expect(normalizePhone('254712345678')).toBe('0712345678');
  });

  it('rejects incomplete and non-Kenyan numbers', () => {
    expect(isValidKenyanPhone('0712')).toBe(false);
    expect(phoneToE164('+256700000000')).toBe('');
  });
});
