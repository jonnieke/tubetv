import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const BUNNY_TOKEN_KEY = Deno.env.get('BUNNY_TOKEN_KEY') || Deno.env.get('BUNNY_ACCESS_KEY') || '';
const PULL_ZONE = Deno.env.get('BUNNY_PULL_ZONE') || 'vz-0fe79b1a-8ad.b-cdn.net';
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((o) => o.trim()).filter(Boolean);

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };
}

// Generates SHA-256 Bunny Token for secure playback
async function generateBunnyToken(path: string, expires: number): Promise<string> {
  const data = `${BUNNY_TOKEN_KEY}${path}${expires}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return base64;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const url = new URL(req.url);
  const videoId = url.searchParams.get('videoId') || '';
  const episodeNumber = parseInt(url.searchParams.get('episode') || '1');
  const isMicroDrama = url.searchParams.get('isMicroDrama') === 'true';

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Missing videoId' }), { status: 400, headers: corsHeaders(req) });
  }

  // Only Episode 1 is free to hook viewers; Episode 2+ requires unlock
  const isFreeEpisode = !isMicroDrama || episodeNumber <= 1;

  let isEntitled = isFreeEpisode;
  let userId: string | null = null;

  // Check user entitlement if episode is locked
  const authHeader = req.headers.get('Authorization') || '';
  if (!isEntitled && authHeader.startsWith('Bearer ')) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;

      // Check admin
      if (user.app_metadata?.role === 'admin') {
        isEntitled = true;
      }

      // Check active VIP pass
      if (!isEntitled) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .gt('end_date', new Date().toISOString())
          .maybeSingle();

        if (sub) isEntitled = true;
      }

      // Check single episode unlock
      if (!isEntitled) {
        const { data: unlock } = await supabase
          .from('episode_unlocks')
          .select('video_id')
          .eq('user_id', user.id)
          .eq('video_id', videoId)
          .maybeSingle();

        if (unlock) isEntitled = true;
      }
    }
  }

  if (!isEntitled) {
    return new Response(
      JSON.stringify({
        status: 'LOCKED',
        videoId,
        episodeNumber,
        priceCoins: 10,
        message: 'This episode is locked. Unlock with 10 coins or get a VIP pass.',
      }),
      { status: 403, headers: corsHeaders(req) }
    );
  }

  // Generate 4-hour signed playback token
  const expires = Math.floor(Date.now() / 1000) + 14400;
  const path = `/${videoId}/playlist.m3u8`;
  let signedUrl = `https://${PULL_ZONE}${path}`;

  if (BUNNY_TOKEN_KEY) {
    const token = await generateBunnyToken(path, expires);
    signedUrl += `?token=${token}&expires=${expires}`;
  }

  return new Response(
    JSON.stringify({
      status: 'UNLOCKED',
      videoId,
      streamUrl: signedUrl,
      expiresAt: new Date(expires * 1000).toISOString(),
    }),
    { status: 200, headers: corsHeaders(req) }
  );
});
