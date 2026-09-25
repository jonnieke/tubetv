# Go-to-market hardening status

Local code prepared on 25 September 2026. **Production rollout in progress:** the migration, frontend, and `public-catalogue`, `admin-ai`, `analytics-summary`, `analytics-event`, `bunny-api`, and `content-visibility` Edge Functions are deployed. The local preview has no Supabase environment values, so it still shows labelled demo content. Newly invited admins must complete password setup and TOTP enrollment before a positive admin mutation can be verified.

## Implemented in this checkout

- Removed the shared browser PIN. Admin sign-in uses Supabase email/password and TOTP. The browser and mutation functions require an `app_metadata.role = admin` identity with an `aal2` session. Invited admins can set their own password at `/admin/setup` before enrolling TOTP.
- Public catalogue has its own Edge Function. It omits unfinished, muted, draft, adult-rated and future-dated records and strips non-public metadata. Existing unrated records remain visible until `ENFORCE_CONTENT_RATINGS=true` is enabled after classification review.
- Bunny list and mutation proxy now require verified admin access. Content and visibility mutations attempt an admin audit row and log failures; Bunny mutations and database audit writes are not atomic. Public catalogue failures show a retry state instead of silently presenting demo titles in production.
- AI suggestions run through an admin-only Edge Function with the API key in server secrets and an atomic limit of 20 requests per admin per day. The browser no longer imports the AI SDK or exposes its key. Captions are not fabricated from a title.
- Uploads save metadata in Bunny before transfer, wait for encoding to complete before announcing availability, and preserve selected artwork by uploading it to Bunny. Supabase `videos` is no longer written as a competing catalogue. The upload queue reports encoding and failure states.
- Studio totals use Bunny lifetime views. Synthetic revenue, subscribers, weekly views, retention and traffic shares have been removed. A protected summary reports actual playback event counts for the past seven days when the collector and migration are deployed.
- Live uses published catalogue entries. Simulated channels, viewers, chat and polls have been removed.
- Public catalogue pages fetch in batches of four. Visibility changes bypass stale browser caches.

## Release sequence

1. In Supabase, enable email/password sign-in and TOTP enrollment. Invite each owner to an inbox they control, with the invite redirect set to `/admin/setup` on an allowed website origin. Assign `role: admin` in each account's **app metadata** using trusted admin controls, then have each owner choose their own password and verify authenticator sign-in. Never put a service-role key in Vite variables or the browser.
2. Apply `supabase/migrations/20260925145915_market_launch_events.sql`. Confirm the quota RPC is executable only by `service_role`; keep RLS enabled for the usage table.
3. Configure Edge Function secrets: `BUNNY_ACCESS_KEY`, `BUNNY_LIBRARY_ID`, `ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `GEMINI_API_KEY` is optional. Rotate any Gemini key previously shipped in a browser bundle.
4. Deploy `public-catalogue`, `admin-ai`, and `analytics-summary` with the JWT settings in `supabase/config.toml`; then deploy the website with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BUNNY_PULL_ZONE`, and `VITE_ANALYTICS_ENDPOINT` configured. Finally deploy the secured `bunny-api`, `content-visibility`, and `analytics-event` versions. Keep the gap between frontend and secured mutations short. Remove the unused `ADMIN_PIN` secret.
5. Verify as an anonymous viewer and a fresh MFA admin: catalogue list, hidden title exclusion, an admin edit, hide/show, thumbnail upload, one encoded new title, live content, playback, and analytics counts. Verify the previous PIN and an AAL1 session both receive 403 from content mutations.
6. Review every title's rating, rights window, poster and captions. After the catalogue passes review, set `ENFORCE_CONTENT_RATINGS=true` and test the visible count. A missing rating will then hide a title.
7. Confirm the retired payment endpoints have no pending transaction callbacks, then remove deployed functions and revoke their credentials. Source removal alone does not uninstall them.

## Still required before a public campaign

- Production CLI access is restored. The requested `pkariuki@onfonmedia.com` and `gsemo@onfonmedia.com` users were invited on 25 September 2026 and assigned `app_metadata.role = admin`. Supabase Auth's Site URL is `https://www.tube.co.ke`, the exact `/admin/setup` redirect is allowed, and custom SMTP is enabled with Resend. The production frontend and MFA-protected mutation functions are live. Verify invite delivery, password setup, TOTP enrollment and a positive admin edit; these recipient-controlled steps remain pending. The existing legacy phone-style admin has no verified TOTP factor.
- The production Vercel environment still contains retired browser variables `VITE_BUNNY_ACCESS_KEY` and `VITE_API_KEY`. Remove them after the new frontend is live, then rotate the underlying credentials that were previously shipped to browsers.
- Bunny CDN playback URLs are currently public. Rights-restricted media needs Bunny token authentication enabled and server-issued playback links before claiming access control over the video itself. The new catalogue endpoint controls listing only.
- Resumable uploads, encoding webhooks and reconciliation are still needed for reliable long-running creator uploads. The current queue uses browser polling and loses its visible progress if the tab closes; the Bunny record remains and can be checked in Admin.
- The series editor still saves shared details to multiple Bunny records sequentially; it is not transactional. A normalized series database and versioned writes remain future work.
- Episode share pages still depend on client-side metadata; WhatsApp/social preview tags need server rendering or pre-rendering.
- The analytics event endpoint has body and origin limits but does not yet have a platform-level per-IP abuse limit. Configure a gateway/WAF rate limit before driving large anonymous traffic. Event counts are not unique viewers or cohort retention.
- Backups, production error alerts, rights, rating and caption review require project and editorial access. None was verified from this local checkout.

## Local verification

`npm run typecheck`, `npm test`, and `npm run build` run without production secrets. Public catalogue projection has tests for hidden, draft, incomplete, adult and scheduled records. End-to-end admin and Edge Function checks require the configured Supabase project and a live MFA account.
