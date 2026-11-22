import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * TubeTV Industrial Stress & Anti-Farming Verification Suite (k6)
 *
 * Usage:
 *   k6 run \
 *     -e SITE_URL=https://www.tube.co.ke \
 *     -e SUPABASE_URL=https://<project>.supabase.co \
 *     -e SUPABASE_ANON_KEY=<anon_key> \
 *     -e LOCKED_VIDEO_ID=<episode-3-uuid> \
 *     -e PASS_TOKEN=<optional-valid-pass-token> \
 *     tests/load/k6-stress-test.js
 */

const SITE_URL = (__ENV.SITE_URL || 'https://www.tube.co.ke').replace(/\/$/, '');
const SUPABASE_URL = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const LOCKED_VIDEO_ID = __ENV.LOCKED_VIDEO_ID || '';
const PASS_TOKEN = __ENV.PASS_TOKEN || '';

const catalogueLatency = new Trend('tubetv_catalogue_duration', true);
const playbackLatency = new Trend('tubetv_playback_access_duration', true);
const analyticsLatency = new Trend('tubetv_analytics_duration', true);
const antiFarmingBlocked = new Rate('tubetv_antifarming_blocked');

export const options = {
  scenarios: {
    // 1. High-concurrency catalogue browsing (verifies Vercel Edge CDN + SWR cache)
    catalogue_browse: {
      executor: 'ramping-vus',
      exec: 'browseCatalogue',
      startVUs: 10,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 300 },
        { duration: '30s', target: 0 },
      ],
    },
    // 2. Viral Episode 3 paywall burst + spoofed query-param rejection check
    playback_access_burst: {
      executor: 'ramping-vus',
      exec: 'testPlaybackAccess',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 150 },
        { duration: '30s', target: 0 },
      ],
    },
    // 3. Anti-farming security probe: instant ad-completion script must be 100% blocked
    antifarming_probe: {
      executor: 'per-vu-iterations',
      exec: 'probeAntiFarming',
      vus: 5,
      iterations: 3,
      startTime: '10s',
    },
    // 4. Analytics event ingestion spike (verifies 204 throughput + NAT-safe rate limits)
    analytics_spike: {
      executor: 'constant-arrival-rate',
      exec: 'ingestAnalytics',
      rate: 60,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 20,
      maxVUs: 80,
      startTime: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    tubetv_catalogue_duration: ['p(95)<500', 'p(99)<1200'],
    tubetv_playback_access_duration: ['p(95)<1500'],
    tubetv_analytics_duration: ['p(95)<600'],
    tubetv_antifarming_blocked: ['rate==1.0'], // 100% of instant ad-farm attempts MUST fail
  },
};

export function browseCatalogue() {
  const res = http.get(`${SITE_URL}/api/catalogue?page=1&itemsPerPage=100`, {
    headers: { Accept: 'application/json' },
    tags: { endpoint: 'catalogue' },
  });
  catalogueLatency.add(res.timings.duration);
  check(res, {
    'catalogue returns 200': (r) => r.status === 200,
    'catalogue served via Vercel CDN proxy': (r) => r.headers['X-Catalogue-Proxy'] === 'vercel-cdn',
    'catalogue body has items': (r) => r.body && r.body.includes('"items"'),
  });
  sleep(1);
}

export function testPlaybackAccess() {
  if (!SUPABASE_URL || !ANON_KEY || !LOCKED_VIDEO_ID) {
    sleep(1);
    return;
  }

  const deviceId = `k6_dev_${__VU}_${__ITER}`;
  const baseHeaders = {
    Accept: 'application/json',
    Origin: SITE_URL,
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  };

  // A. Legacy spoofed ?rewardUnlock=ad bypass MUST be rejected with 402
  const spoofRes = http.get(
    `${SUPABASE_URL}/functions/v1/playback-access?id=${LOCKED_VIDEO_ID}&deviceId=${deviceId}&rewardUnlock=ad`,
    {
      headers: baseHeaders,
      tags: { endpoint: 'playback_spoof' },
      responseCallback: http.expectedStatuses(402),
    },
  );
  playbackLatency.add(spoofRes.timings.duration);
  const blockedSpoof = check(spoofRes, {
    'spoofed rewardUnlock query param blocked with 402': (r) => r.status === 402,
  });
  antiFarmingBlocked.add(blockedSpoof);

  // B. Optional: if a valid PASS_TOKEN is provided, verify 200 + signed Bunny URL
  if (PASS_TOKEN) {
    const passRes = http.get(
      `${SUPABASE_URL}/functions/v1/playback-access?id=${LOCKED_VIDEO_ID}&deviceId=${deviceId}`,
      {
        headers: { ...baseHeaders, 'X-Pass-Token': PASS_TOKEN },
        tags: { endpoint: 'playback_pass' },
      },
    );
    playbackLatency.add(passRes.timings.duration);
    check(passRes, {
      'valid pass returns 200 or device_switched 402': (r) => r.status === 200 || r.status === 402,
    });
  }

  sleep(1);
}

export function probeAntiFarming() {
  if (!SUPABASE_URL || !ANON_KEY || !LOCKED_VIDEO_ID) {
    sleep(1);
    return;
  }

  const deviceId = `k6_farm_${__VU}_${__ITER}_${Date.now()}`;
  const headers = {
    'Content-Type': 'application/json',
    Origin: SITE_URL,
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  };

  // 1. Start a real ad session
  const startRes = http.post(
    `${SUPABASE_URL}/functions/v1/reward-unlock`,
    JSON.stringify({ action: 'start_ad', videoId: LOCKED_VIDEO_ID, deviceId }),
    { headers, tags: { endpoint: 'reward_start' } },
  );

  if (startRes.status === 200) {
    const parsed = startRes.json();
    const sessionId = parsed && parsed.sessionId;
    if (sessionId) {
      // 2. Immediately attempt to complete the ad without waiting 27s (farming attack!)
      const instantComplete = http.post(
        `${SUPABASE_URL}/functions/v1/reward-unlock`,
        JSON.stringify({
          action: 'complete_ad',
          sessionId,
          videoId: LOCKED_VIDEO_ID,
          deviceId,
          grantUnlock: true,
        }),
        {
          headers,
          tags: { endpoint: 'reward_complete_instant' },
          responseCallback: http.expectedStatuses(400),
        },
      );
      const blocked = check(instantComplete, {
        'instant ad completion rejected with 400': (r) => r.status === 400,
      });
      antiFarmingBlocked.add(blocked);
    }
  } else if (startRes.status === 429) {
    antiFarmingBlocked.add(true);
  }

  sleep(0.5);
}

export function ingestAnalytics() {
  if (!SUPABASE_URL || !ANON_KEY) {
    sleep(1);
    return;
  }

  const res = http.post(
    `${SUPABASE_URL}/functions/v1/analytics-event`,
    JSON.stringify({
      name: 'catalogue_view',
      path: '/',
      occurredAt: new Date().toISOString(),
      properties: { viewerId: `k6_viewer_${__VU}`, source: 'k6_load_test' },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Origin: SITE_URL,
        apikey: ANON_KEY,
      },
      tags: { endpoint: 'analytics' },
      responseCallback: http.expectedStatuses(204, 429),
    },
  );
  analyticsLatency.add(res.timings.duration);
  check(res, {
    'analytics accepted (204) or rate-limited (429)': (r) => r.status === 204 || r.status === 429,
  });
}
