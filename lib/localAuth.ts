/** Retained only to identify and clear sessions created by the retired test PIN. */
const LEGACY_STORAGE_KEY = 'tube_local_auth_session_v1';

export function isLocalAuthUserId(userId?: string | null): boolean {
  return Boolean(userId?.startsWith('local-'));
}

export function clearLocalAuthSession() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(LEGACY_STORAGE_KEY);
}
