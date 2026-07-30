# TubeTV Phase 4 deployment

Phase 4 reduces playback cost, adds constrained-network behavior, makes player failures recoverable, and instruments the KSh 10 conversion funnel without storing viewer identity in analytics.

## Deploy

1. Apply `supabase/migrations/20260731_phase4_performance_analytics.sql`.
2. Deploy the public event collector:
   `supabase functions deploy analytics-event`
3. Set `ALLOWED_ORIGINS` to the exact production and preview origins.
4. Set `VITE_ANALYTICS_ENDPOINT` to the deployed `analytics-event` URL.
5. Set `VITE_PAYWALL_ENABLED=true` only after the Phase 2 M-Pesa sandbox flow passes end to end.
6. Build and deploy the frontend.

The event function intentionally has JWT verification disabled so signed-out catalogue and paywall events can be measured. It compensates with an exact origin allowlist, an event-name allowlist, a 4 KB body limit, bounded scalar properties and no user, phone, session or IP-derived identifier.

## Performance result

The HLS engine changed from a statically requested 524 kB chunk to a lazy 343 kB light-build chunk. It is requested only when an HLS stream starts. MP4 playback and thumbnail browsing do not need it.

On Save-Data, slow-2g and 2g connections TubeTV now:

- Disables hover video previews.
- Uses no media preload.
- Prefers a 360p HLS rendition.
- Preserves manual Data Saver behavior on other connections.

## Funnel definitions

- `catalogue_view`: a catalogue finished loading.
- `playback_start`: a viewer deliberately started a title.
- `playback_error`: native or HLS playback failed.
- `paywall_view`: a premium gate or subscription request was opened.
- `checkout_start`: the viewer pressed an M-Pesa purchase button.
- `checkout_submitted`: Safaricom accepted the STK request.
- `subscription_activated`: the callback produced active access.
- `checkout_failed`: the request or payment failed.

## Pilot decision gates

These are TubeTV pilot targets, not market-wide benchmarks:

- Fatal playback errors below 2% of playback starts.
- At least 15% of paywall views progress to checkout start.
- At least 70% of submitted STK requests activate access.
- At least 20% of first-time daily buyers purchase another pass within seven days.
- Compare daily-pass repeat purchase and watch completion by acquisition channel before increasing paid acquisition.

Daily-pass retention should be calculated from `payment_transactions` and `subscriptions`, where authenticated purchase identity already exists for fulfilment. Do not add identity fields to `analytics_events`.
