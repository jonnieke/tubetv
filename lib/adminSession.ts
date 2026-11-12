import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { isAdminUser } from './authorization';

export async function verifiedActiveAdminUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !isAdminUser(user)) return null;
  return user;
}
