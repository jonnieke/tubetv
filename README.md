# Tube TV

Tube TV is a Kenyan-first streaming app for local video, shorts, live events, creator uploads, education, farming, faith, kids content, and diaspora programming.

## Local Setup

1. Install dependencies:
   `npm install`
2. Create `.env.local` with the required Vite keys:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_BUNNY_PULL_ZONE`
   - `VITE_VAPID_PUBLIC_KEY` for optional push notifications
3. Start the app:
   `npm run dev`
4. Build for production:
   `npm run build`

## Supabase Edge Function Secrets

The Bunny proxy expects these server-side secrets:

- `BUNNY_ACCESS_KEY`
- `BUNNY_LIBRARY_ID`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Edge Functions only)
- `GEMINI_API_KEY` for optional server-side admin artwork and metadata suggestions
- `ALLOWED_ORIGINS` with the exact website origins

Only authenticated admins can create, update, or upload Bunny Stream content through the proxy.

## Administrator access

Admin access requires a Supabase Auth user whose `app_metadata.role` is `admin`,
plus an enrolled authenticator-app factor. The shared browser PIN has been retired.
See [go-to-market hardening](docs/go-to-market-hardening.md) before deployment.
