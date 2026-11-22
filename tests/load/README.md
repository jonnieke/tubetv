# TubeTV k6 Load, Stress & Anti-Farming Test Suite

This suite benchmarks TubeTV's public catalogue CDN, playback entitlement gate, analytics ingestion throughput, and verifies that anti-farming protections hold under concurrent load.

## Prerequisites

Install [k6](https://k6.io/docs/get-started/installation/):

```powershell
winget install k6 --source winget
```

## Running the Stress Test

```powershell
k6 run `
  -e SITE_URL=https://www.tube.co.ke `
  -e SUPABASE_URL=https://<your-project>.supabase.co `
  -e SUPABASE_ANON_KEY=<your-anon-key> `
  -e LOCKED_VIDEO_ID=<uuid-of-episode-3> `
  tests/load/k6-stress-test.js
```

## Pass / Fail Gates (Built-in Thresholds)

| Metric | Target | What It Validates |
|---|---|---|
| `tubetv_catalogue_duration` | `p(95) < 500ms`, `p(99) < 1200ms` | Vercel Edge CDN + SWR cache handles 300 concurrent browsers without hitting Bunny rate limits |
| `tubetv_playback_access_duration` | `p(95) < 1500ms` | Entitlement checks stay responsive under viral Episode 3 bursts |
| `tubetv_analytics_duration` | `p(95) < 600ms` | Telemetry ingestion handles 60 events/sec smoothly |
| `tubetv_antifarming_blocked` | `100% (rate == 1.0)` | Spoofed `?rewardUnlock=ad` queries return `402` and instant ad-completion scripts return `400` |
| `http_req_failed` | `< 2%` | Overall error budget under peak stress |
