import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { verifiedAdminId } from '../_shared/admin.ts';

const origins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
const names = ['playback_start','playback_first_frame','playback_complete','episode_next','playback_error','playback_buffer'] as const;
function headers(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    ...(origins.includes(origin) ? {'Access-Control-Allow-Origin':origin} : {}),
    'Access-Control-Allow-Headers':'authorization, apikey',
    'Access-Control-Allow-Methods':'GET, OPTIONS',
    'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
  };
}
function reply(req: Request, body: unknown, status: number) { return new Response(JSON.stringify(body),{status,headers:headers(req)}); }
serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:headers(req)});
  if (req.method !== 'GET') return reply(req,{error:'Method not allowed.'},405);
  const origin = req.headers.get('Origin');
  if (origin && !origins.includes(origin)) return reply(req,{error:'Origin not allowed.'},403);
  if (!(await verifiedAdminId(req))) return reply(req,{error:'Verified admin access required.'},403);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return reply(req,{error:'Analytics unavailable.'},503);
  const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const results = await Promise.all(names.map(async name => {
    const {count,error} = await client.from('analytics_events').select('id',{count:'exact',head:true}).eq('event_name',name).gte('occurred_at',since);
    return {name,count,error};
  }));
  if (results.some(result => result.error)) return reply(req,{error:'Analytics unavailable.'},503);
  return reply(req,{since,until:new Date().toISOString(),counts:Object.fromEntries(results.map(result => [result.name,result.count || 0]))},200);
});
