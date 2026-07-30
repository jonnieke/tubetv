import { describe, expect, it } from 'vitest';
import { isAdminUser } from './authorization';

describe('isAdminUser', () => {
  it('accepts only the trusted admin role claim', () => {
    expect(isAdminUser({ app_metadata: { role: 'admin' } })).toBe(true);
    expect(isAdminUser({ app_metadata: { role: 'creator' } })).toBe(false);
  });

  it('does not infer access from user-controlled metadata', () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser({ app_metadata: {} })).toBe(false);
  });
});
