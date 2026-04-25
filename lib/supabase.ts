import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Normalizes a Kenyan phone number to a consistent format.
 * Accepts: 07XX, 01XX, +2547XX, 2547XX
 * Returns: 07XXXXXXXX (local format) for display, and a deterministic email for Supabase auth.
 */
export const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  // +254 or 254 prefix → replace with 0
  if (digits.startsWith('254') && digits.length === 12) {
    return '0' + digits.slice(3);
  }
  // Already starts with 0
  if (digits.startsWith('0') && digits.length === 10) {
    return digits;
  }
  return digits;
};

/**
 * Converts a local phone number to a deterministic Supabase-compatible email.
 * e.g. 0712345678 → 0712345678@tube.ke
 */
export const phoneToEmail = (phone: string): string => {
  return `${normalizePhone(phone)}@tubekenya.com`;
};

/**
 * Validates a Kenyan phone number.
 * Supports Safaricom (07X, 01X) and international prefix.
 */
export const isValidKenyanPhone = (phone: string): boolean => {
  const normalized = normalizePhone(phone);
  return /^0[71][0-9]{8}$/.test(normalized);
};

/**
 * Sign up a new user with phone number + 6-digit PIN.
 * Stores extra profile data in the `profiles` table.
 */
export const signUpWithPhone = async (phone: string, pin: string, displayName?: string) => {
  const email = phoneToEmail(phone);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pin,
    options: {
      data: {
        phone,
        display_name: displayName || phone,
      },
    },
  });
  return { data, error };
};

/**
 * Sign in an existing user with phone number + 6-digit PIN.
 */
export const signInWithPhone = async (phone: string, pin: string) => {
  const email = phoneToEmail(phone);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pin,
  });
  return { data, error };
};

/**
 * Update PIN for an authenticated user.
 */
export const updatePin = async (currentPin: string, newPin: string, phone: string) => {
  // Re-authenticate first
  const { error: authError } = await signInWithPhone(phone, currentPin);
  if (authError) return { error: { message: 'Current PIN is incorrect.' } };

  const { error } = await supabase.auth.updateUser({ password: newPin });
  return { error };
};

/**
 * Sign out the current session.
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};
