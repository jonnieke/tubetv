type OtpError = {
  code?: string;
  message: string;
  status?: number;
};

export function otpRequestErrorMessage(error: OtpError, isSignUp: boolean): string {
  switch (error.code) {
    case 'user_not_found':
      return 'No account was found for this number. Switch to Sign Up.';
    case 'signup_disabled':
      return isSignUp
        ? 'Account creation is currently disabled. Contact TubeTV support.'
        : 'No account was found for this number. Switch to Sign Up.';
    case 'phone_provider_disabled':
    case 'otp_disabled':
      return 'SMS sign-in is not configured. An administrator must enable the Supabase Phone provider.';
    case 'sms_send_failed':
      return 'The SMS provider could not deliver a code. Check the number and try again.';
    case 'over_request_rate_limit':
      return 'Too many code requests. Wait a few minutes before trying again.';
  }

  const message = error.message.trim().replace(/\s+/g, ' ').slice(0, 160);
  return message
    ? `We could not send the verification code: ${message}`
    : `We could not send the verification code${error.status ? ` (HTTP ${error.status})` : ''}.`;
}
