import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { catalogueEpisode, isFreeMicroDramaEpisode, isVerifiedPaymentIdentity } from '../_shared/episodeAccess.ts';
import { publicItem } from '../_shared/publicCatalog.ts';

const signingKey = Deno.env.get('BUNNY_TOKEN_KEY');
const libraryId = Deno.env.get('BUNNY_LIBRARY_ID');
const libraryKey = Deno.env.get('BUNNY_ACCESS_KEY');
const host = Deno.env.get('BUNNY_PULL_ZONE') || 'vz-0fe79b1a-8ad.b-cdn.net';
const origins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(origin => origin.trim());
const encoder = new TextEncoder();

async function signedPlaylist(videoId: string, expires: number, keyText: string) {
  const path = '/' + videoId + '/';
  const key = await crypto.subtle.importKey('raw', encoder.encode(keyText),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key,
    encoder.encode(path + expires + 'token_path=' + path)));
  const token = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return 'https://' + host + '/bcdn_token=HS256-' + token + '&expires=' + expires +
    '&token_path=' + encodeURIComponent(path) + path + 'playlist.m3u8';
}

serve(async req => {
  const origin = req.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store',
    Vary: 'Origin',
  });
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.includes(origin)) return reply(403, { error: 'Origin not allowed.' });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'GET') return reply(405, { error: 'Method not allowed.' });

  const videoId = new URL(req.url).searchParams.get('videoId')?.toLowerCase();
  if (!videoId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(videoId)) {
    return reply(400, { error: 'Invalid video ID.' });
  }
  if (!libraryId || !libraryKey || !/^[a-z0-9.-]+$/i.test(host)) {
    return reply(503, { error: 'Playback is unavailable.' });
  }

  try {
    const upstream = await fetch('https://video.bunnycdn.com/library/' + libraryId + '/videos/' + videoId, {
      headers: { AccessKey: libraryKey },
      signal: AbortSignal.timeout(5000),
    });
    if (upstream.status === 404) return reply(404, { error: 'Episode not found.' });
    if (!upstream.ok) throw new Error('Bunny metadata lookup failed.');
    const raw = await upstream.json();
    const item = publicItem(raw, Deno.env.get('ENFORCE_CONTENT_RATINGS') === 'true');
    if (!item || item.guid !== videoId) return reply(404, { error: 'Episode not found.' });
    const tag = (name: string) => item.metaTags.find(t => t.property?.toLowerCase() === name)?.value?.trim() || '';
    if (!['micro dramas', 'micro-drama'].includes(tag('category').toLowerCase()) &&
        tag('seriesformat').toLowerCase() !== 'micro-drama') {
      return reply(404, { error: 'Episode not found.' });
    }
    const episode = catalogueEpisode(String(item.title || ''), tag('episode'));
    if (!episode) return reply(404, { error: 'Episode details are unavailable.' });

    if (!isFreeMicroDramaEpisode(episode)) {
      const locked = () => reply(403, { status: 'LOCKED' });
      const authorization = req.headers.get('Authorization');
      if (!authorization?.startsWith('Bearer ')) return locked();
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user } } = await db.auth.getUser(authorization.slice(7));
      if (!user || !isVerifiedPaymentIdentity(user)) return locked();

      if (user.app_metadata?.role !== 'admin') {
        const [pass, unlock] = await Promise.all([
          db.from('subscriptions').select('id').eq('user_id', user.id).eq('is_active', true)
            .neq('tier', 'free').or('end_date.is.null,end_date.gt.' + new Date().toISOString()).limit(1).maybeSingle(),
          db.from('episode_unlocks').select('unlock_method, coins_spent').eq('user_id', user.id)
            .eq('video_id', videoId).maybeSingle(),
        ]);
        if (pass.error || unlock.error) throw new Error('Entitlement lookup failed.');
        const permanent = unlock.data?.unlock_method === 'admin' ||
          (unlock.data?.unlock_method === 'coins' && unlock.data.coins_spent >= 1);
        if (!pass.data && !permanent) return locked();
      }
      if (!signingKey) return reply(503, { error: 'Protected playback is unavailable.' });
    }

    const expires = Math.floor(Date.now() / 1000) + 3600;
    const streamUrl = signingKey ? await signedPlaylist(videoId, expires, signingKey)
      : 'https://' + host + '/' + videoId + '/playlist.m3u8';
    return reply(200, { status: 'UNLOCKED', streamUrl });
  } catch (error) {
    console.error('Playback authorization failed', error);
    return reply(503, { error: 'Playback is unavailable.' });
  }
});
