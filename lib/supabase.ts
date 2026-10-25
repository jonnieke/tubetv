import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase environment variables are missing. Running in local demo mode.');
}

export const supabase = createClient(
  supabaseUrl || 'https://demo.supabase.co',
  supabaseAnonKey || 'demo-anon-key'
);

export const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.startsWith('0') && digits.length === 10) return digits;
  return digits;
};

export const phoneToE164 = (raw: string): string => {
  const local = normalizePhone(raw);
  return /^0[17]\d{8}$/.test(local) ? `+254${local.slice(1)}` : '';
};

export const isValidKenyanPhone = (phone: string): boolean => Boolean(phoneToE164(phone));

export async function requestPhoneOtp(
  phone: string,
  shouldCreateUser: boolean,
  displayName?: string,
  channel: 'whatsapp' | 'sms' = 'whatsapp'
) {
  const phoneE164 = phoneToE164(phone);
  if (!phoneE164) return { error: new Error('Enter a valid Kenyan phone number.') };

  const { error } = await supabase.auth.signInWithOtp({
    phone: phoneE164,
    options: {
      channel,
      shouldCreateUser,
      data: shouldCreateUser ? { display_name: displayName?.trim() || phoneE164 } : undefined,
    },
  });
  return { phoneE164, error };
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const phoneE164 = phoneToE164(phone);
  if (!phoneE164) return { data: null, error: new Error('Invalid phone number.') };
  return supabase.auth.verifyOtp({ phone: phoneE164, token, type: 'sms' });
}

export async function signOut() {
  return supabase.auth.signOut();
}
