import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export async function recordAdminMutation(adminId: string, action: string, resourceId: string | null, succeeded: boolean) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) { console.error('admin_audit_unconfigured', {action, resourceId}); return; }
  const service = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error} = await service.from('admin_audit_events').insert({admin_id:adminId,action,resource_id:resourceId,succeeded});
  if (error) console.error('admin_audit_failed',{action,resourceId,code:error.code});
}
