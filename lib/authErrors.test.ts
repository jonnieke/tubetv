import { describe, expect, it } from 'vitest';
import { otpRequestErrorMessage } from './authErrors';

describe('otpRequestErrorMessage', () => {
  it('explains missing accounts and disabled phone authentication', () => {
    expect(otpRequestErrorMessage({ code: 'user_not_found', message: 'missing' }, false))
      .toContain('Switch to Sign Up');
    expect(otpRequestErrorMessage({ code: 'phone_provider_disabled', message: 'disabled' }, false))
      .toContain('enable the Supabase Phone provider');
  });

  it('preserves a bounded provider reason for unknown 422 responses', () => {
    expect(otpRequestErrorMessage({ status: 422, message: 'Provider rejected this request' }, false))
      .toContain('Provider rejected this request');
  });
});
