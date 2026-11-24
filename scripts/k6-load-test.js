import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * TubeTV Viral Load Test (Read + Catalogue + Playback Token + HLS Playlist)
 * Safely avoids live M-Pesa/Paystack payment endpoints.
 */
export const options = {
  stages: [
    { duration: '30s', target: 200 },   // Warmup: 200 concurrent viewers
    { duration: '45s', target: 1000 },  // Growth: 1,000 concurrent viewers
    { duration: '45s', target: 2500 },  // Viral spike: 2,500 concurrent viewers
    { duration: '30s', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],     // < 2% errors
    http_req_duration: ['p(95)<1500'],  // 95% of requests under 1.5s
  },
};

const SITE = 'https://www.tube.co.ke';
const SUPABASE = 'https://bbwtdnsgojztxckmkhpz.supabase.co';

export function setup() {
  const res = http.get(`${SITE}/api/catalogue?page=1&itemsPerPage=100&orderBy=date`);
  let sampleVideoId = '';
  try {
    const data = res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    // Pick a free Micro Drama Ep 1 or Short so playback-access returns a real signed Bunny URL
    const freeItem = items.find((item) => {
      const tags = item.metaTags || [];
      const get = (k) => (tags.find((t) => (t.property || '').toLowerCase() === k)?.value || '').toLowerCase();
      return (get('category') === 'micro dramas' && get('episode') === '1') || get('category') === 'shorts';
    });
    sampleVideoId = freeItem?.guid || items[0]?.guid || '';
  } catch {
    sampleVideoId = '';
  }
  return { sampleVideoId };
}

export default function (data) {
  // 1. Landing page (alternates Micro Dramas `/` and Cinema `/movies`)
  const landingUrl = __VU % 2 === 0 ? `${SITE}/` : `${SITE}/movies`;
  const rHome = http.get(landingUrl, { tags: { name: 'landing_page' } });
  check(rHome, { 'landing 200': (r) => r.status === 200 });

  // 2. Global Edge CDN Catalogue
  const rCat = http.get(`${SITE}/api/catalogue?page=1&itemsPerPage=100&orderBy=date`, {
    headers: { Accept: 'application/json' },
    tags: { name: 'catalogue_api' },
  });
  check(rCat, { 'catalogue 200': (r) => r.status === 200 });

  // 3. Playback authorization + Bunny HLS manifest (25% of VUs press Play each cycle)
  if (data.sampleVideoId && __ITER % 4 === 0) {
    const deviceId = `k6-vu-${__VU}`;
    const rAuth = http.get(
      `${SUPABASE}/functions/v1/playback-access?id=${data.sampleVideoId}&deviceId=${deviceId}`,
      {
        headers: { Origin: SITE, Accept: 'application/json' },
        tags: { name: 'playback_access' },
      },
    );
    check(rAuth, { 'playback-access 200/402': (r) => r.status === 200 || r.status === 402 });

    if (rAuth.status === 200) {
      try {
        const body = rAuth.json();
        if (body?.playbackUrl) {
          const rHls = http.get(body.playbackUrl, { tags: { name: 'bunny_hls_manifest' } });
          check(rHls, { 'bunny HLS 200': (r) => r.status === 200 });
        }
      } catch {
        // Ignore parse error
      }
    }
  }

  sleep(1 + Math.random() * 2);
}
