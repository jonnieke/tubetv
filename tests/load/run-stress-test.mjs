/**
 * TubeTV Zero-Dependency Node.js Stress & Anti-Farming Benchmark
 * Runs the same 4 verification scenarios as `k6-stress-test.js` without requiring k6.
 */

const SITE_URL = (process.env.SITE_URL || 'https://www.tube.co.ke').replace(/\/$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://bbwtdnsgojztxckmkhpz.supabase.co').replace(/\/$/, '');

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx]);
}

function summarize(name, latencies, okCount, totalCount, extra = '') {
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const max = sorted.length ? Math.round(sorted[sorted.length - 1]) : 0;
  const passRate = totalCount > 0 ? ((okCount / totalCount) * 100).toFixed(1) : '0.0';
  console.log(
    `[${okCount === totalCount ? 'PASS' : 'WARN'}] ${name.padEnd(30)} | ${okCount}/${totalCount} (${passRate}%) | p50=${p50}ms p95=${p95}ms p99=${p99}ms max=${max}ms${extra ? ` | ${extra}` : ''}`,
  );
  return { name, okCount, totalCount, p50, p95, p99, max };
}

async function discoverLockedVideoId() {
  if (process.env.LOCKED_VIDEO_ID) return process.env.LOCKED_VIDEO_ID;
  const res = await fetch(`${SITE_URL}/api/catalogue?page=1&itemsPerPage=100`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Catalogue discovery failed with HTTP ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  for (const item of items) {
    const tags = Array.isArray(item.metaTags) ? item.metaTags : [];
    const getTag = (k) => tags.find((t) => String(t.property || '').toLowerCase() === k)?.value || '';
    const ep = Number(getTag('episode'));
    const category = getTag('category').toLowerCase();
    if (category !== 'shorts' && Number.isFinite(ep) && ep >= 3 && item.guid) {
      return { id: item.guid, title: item.title, episode: ep };
    }
  }
  const fallback = items.find((i) => i.guid);
  return fallback ? { id: fallback.guid, title: fallback.title, episode: null } : null;
}

async function runPool(total, concurrency, worker) {
  let cursor = 0;
  const results = new Array(total);
  const runners = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (cursor < total) {
      const idx = cursor++;
      results[idx] = await worker(idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  console.log(`\n=== TubeTV Live Stress & Anti-Farming Benchmark ===`);
  console.log(`Target Site:     ${SITE_URL}`);
  console.log(`Target Supabase: ${SUPABASE_URL}\n`);

  const targetVideo = await discoverLockedVideoId();
  if (targetVideo) {
    console.log(`Discovered Locked Test Title: "${targetVideo.title}" (Ep ${targetVideo.episode ?? '?'}) [${targetVideo.id}]\n`);
  } else {
    console.log(`Warning: Could not discover a video ID from catalogue.\n`);
  }

  // 1. Catalogue CDN Burst (120 requests @ 30 concurrency)
  const catResults = await runPool(120, 30, async () => {
    const t0 = performance.now();
    try {
      const res = await fetch(`${SITE_URL}/api/catalogue?page=1&itemsPerPage=100`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      await res.text();
      return {
        ok: res.status === 200 && res.headers.get('x-catalogue-proxy') === 'vercel-cdn',
        status: res.status,
        ms: performance.now() - t0,
        cache: res.headers.get('x-vercel-cache') || res.headers.get('x-catalog-cache') || 'unknown',
      };
    } catch {
      return { ok: false, status: 0, ms: performance.now() - t0, cache: 'err' };
    }
  });
  const cacheHits = catResults.filter((r) => r.cache === 'HIT').length;
  summarize(
    '1. Catalogue CDN (30 VUs)',
    catResults.map((r) => r.ms),
    catResults.filter((r) => r.ok).length,
    catResults.length,
    `CDN HITs=${cacheHits}/${catResults.length}`,
  );

  // 2. Playback Access Burst + Spoofed ?rewardUnlock=ad Bypass Check (40 requests @ 20 concurrency)
  if (targetVideo?.id) {
    const pbResults = await runPool(40, 20, async (i) => {
      const t0 = performance.now();
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/playback-access?id=${encodeURIComponent(targetVideo.id)}&deviceId=stress_dev_${i}&rewardUnlock=ad`,
          {
            headers: { Accept: 'application/json', Origin: SITE_URL },
            signal: AbortSignal.timeout(10_000),
          },
        );
        await res.text();
        return { ok: res.status === 402, status: res.status, ms: performance.now() - t0 };
      } catch {
        return { ok: false, status: 0, ms: performance.now() - t0 };
      }
    });
    const statusCounts = pbResults.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    summarize(
      '2. Spoof Bypass Blocked (20 VUs)',
      pbResults.map((r) => r.ms),
      pbResults.filter((r) => r.ok).length,
      pbResults.length,
      `HTTP=${JSON.stringify(statusCounts)}`,
    );

    // 3. Anti-Farming Instant Ad Completion Probe (8 sequential/concurrent attempts)
    const farmResults = await runPool(8, 4, async (i) => {
      const t0 = performance.now();
      const deviceId = `farm_probe_${Date.now()}_${i}`;
      try {
        const startRes = await fetch(`${SUPABASE_URL}/functions/v1/reward-unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: SITE_URL },
          body: JSON.stringify({ action: 'start_ad', videoId: targetVideo.id, deviceId }),
          signal: AbortSignal.timeout(10_000),
        });
        if (startRes.status === 429) {
          return { ok: true, status: 429, ms: performance.now() - t0 };
        }
        const startJson = await startRes.json().catch(() => ({}));
        if (!startRes.ok || !startJson.sessionId) {
          return { ok: false, status: startRes.status, ms: performance.now() - t0 };
        }
        // Immediately attempt to complete without waiting 27s
        const compRes = await fetch(`${SUPABASE_URL}/functions/v1/reward-unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: SITE_URL },
          body: JSON.stringify({
            action: 'complete_ad',
            sessionId: startJson.sessionId,
            videoId: targetVideo.id,
            deviceId,
            grantUnlock: true,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        await compRes.text();
        return { ok: compRes.status === 400, status: compRes.status, ms: performance.now() - t0 };
      } catch {
        return { ok: false, status: 0, ms: performance.now() - t0 };
      }
    });
    const farmCounts = farmResults.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    summarize(
      '3. Instant Ad-Farm Blocked',
      farmResults.map((r) => r.ms),
      farmResults.filter((r) => r.ok).length,
      farmResults.length,
      `HTTP=${JSON.stringify(farmCounts)}`,
    );
  }

  // 4. Analytics Ingestion Spike (50 requests @ 25 concurrency)
  const anResults = await runPool(50, 25, async (i) => {
    const t0 = performance.now();
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analytics-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: SITE_URL },
        body: JSON.stringify({
          name: 'catalogue_view',
          path: '/',
          occurredAt: new Date().toISOString(),
          properties: { viewerId: `stress_viewer_${i % 10}`, source: 'stress_benchmark' },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      await res.text();
      return { ok: res.status === 204 || res.status === 429, status: res.status, ms: performance.now() - t0 };
    } catch {
      return { ok: false, status: 0, ms: performance.now() - t0 };
    }
  });
  const anCounts = anResults.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  summarize(
    '4. Analytics Spike (25 VUs)',
    anResults.map((r) => r.ms),
    anResults.filter((r) => r.ok).length,
    anResults.length,
    `HTTP=${JSON.stringify(anCounts)}`,
  );

  console.log('\n=== Benchmark Complete ===\n');
}

main().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
