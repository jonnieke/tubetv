import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export async function verifiedAdminId(req: Request): Promise<string | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('Authorization') || '';
  if (!url || !anonKey || !authorization.startsWith('Bearer ')) return null;
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: anonKey },
    });
    if (!response.ok) return null;
    const user = await response.json();
    if (user?.app_metadata?.role !== 'admin' || typeof user.id !== 'string') return null;
    const token = authorization.slice('Bearer '.length);
    const client = createClient(url, anonKey, {auth:{persistSession:false,autoRefreshToken:false}});
    const { data: assurance, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(token);
    return !error && assurance.currentLevel === 'aal2' ? user.id : null;
  } catch { return null; }
}
