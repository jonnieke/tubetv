export interface RoleBearingUser {
  app_metadata?: Record<string, unknown>;
}

export function isAdminUser(user: RoleBearingUser | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin';
}
