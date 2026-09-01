import type { User as SupabaseUser } from '@supabase/supabase-js';
import { phoneToE164 } from './supabase';

export const LOCAL_AUTH_SOURCE = 'local_pin';
export const LOCAL_ADMIN_PIN = '2468';
const LOCAL_AUTH_STORAGE_KEY = 'tube_local_auth_session_v1';

type StoredLocalSession = {
  phone: string;
  displayName: string;
  createdAt: string;
};

function buildLocalUser(phoneE164: string, displayName: string, createdAt: string): SupabaseUser {
  const phoneDigits = phoneE164.replace(/\D/g, '');
  return {
    id: `local-${phoneDigits}`,
    aud: 'authenticated',
    role: 'authenticated',
    email: '',
    email_confirmed_at: null,
    phone: phoneE164,
    confirmed_at: createdAt,
    phone_confirmed_at: createdAt,
    last_sign_in_at: createdAt,
    app_metadata: {
      role: 'admin',
      auth_source: LOCAL_AUTH_SOURCE,
    },
    user_metadata: {
      display_name: displayName,
      auth_source: LOCAL_AUTH_SOURCE,
    },
    identities: [],
    created_at: createdAt,
    updated_at: createdAt,
    is_anonymous: false,
  } as SupabaseUser;
}

export function verifyLocalAdminLogin(phone: string, pin: string, displayName?: string) {
  const phoneE164 = phoneToE164(phone);
  if (!phoneE164) {
    return { error: new Error('Enter a valid Kenyan phone number, for example 0712 345 678.') };
  }

  if (pin.trim() !== LOCAL_ADMIN_PIN) {
    return { error: new Error('That PIN is incorrect.') };
  }

  const createdAt = new Date().toISOString();
  const user = buildLocalUser(phoneE164, displayName?.trim() || 'TubeTV Admin', createdAt);
  return { user };
}

export function saveLocalAuthSession(user: SupabaseUser) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify({
    phone: user.phone || '',
    displayName: String(user.user_metadata?.display_name || 'TubeTV Admin'),
    createdAt: user.created_at || new Date().toISOString(),
  } satisfies StoredLocalSession));
}

export function loadLocalAuthSession(): SupabaseUser | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLocalSession>;
    if (!parsed.phone || !parsed.createdAt) return null;
    const phoneE164 = phoneToE164(parsed.phone);
    if (!phoneE164) return null;
    return buildLocalUser(phoneE164, parsed.displayName || 'TubeTV Admin', parsed.createdAt);
  } catch {
    return null;
  }
}

export function clearLocalAuthSession() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
}
