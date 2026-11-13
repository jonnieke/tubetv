const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bbwtdnsgojztxckmkhpz.supabase.co';
const ORIGIN = process.env.VITE_SITE_URL || 'https://www.tube.co.ke';
const FUNCTIONS = [
  'public-catalogue',
  'playback-access',
  'analytics-event',
  'paystack-checkout',
  'mpesa-stk-push',
  'mpesa-ratiba',
];

let failed = false;

for (const fn of FUNCTIONS) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${fn}`;
  try {
    const res = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': fn === 'public-catalogue' || fn === 'playback-access' ? 'GET' : 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type, apikey, x-pass-token',
      },
      signal: AbortSignal.timeout(8000),
    });
    const allowOrigin = res.headers.get('access-control-allow-origin');
    const allowCreds = res.headers.get('access-control-allow-credentials');
    const ok = res.status >= 200 && res.status < 300 && Boolean(allowOrigin);
    console.log(`${ok ? 'OK  ' : 'FAIL'} OPTIONS ${fn} -> ${res.status} (ACAO=${allowOrigin || 'missing'}, ACAC=${allowCreds || 'none'})`);
    if (!ok) failed = true;
  } catch (err) {
    console.error(`FAIL OPTIONS ${fn} ->`, err instanceof Error ? err.message : err);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
