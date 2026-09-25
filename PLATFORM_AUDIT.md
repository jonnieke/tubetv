# TubeTV platform audit and micro-drama launch plan

Update: launch hardening code was prepared after this baseline audit. See [docs/go-to-market-hardening.md](docs/go-to-market-hardening.md) for current implementation and remaining launch gates. Findings below describe the source at audit time.

Audit date: 25 September 2026. Scope: local source review of discovery, series, players, admin publishing, authentication, Edge Functions, analytics, settings, privacy, and deployment configuration. This is not a penetration test or a measurement of production traffic. Live database policies and deployed function versions were not independently verified in this audit.

## Product decision

Lead with **Kenyan vertical stories worth coming back for**. Keep Movies, Series, Shorts, Education, Farmers, Faith, Kids, Diaspora and Live. Micro dramas need their own editorial identity: a series has a premise and an ordered story, while Shorts are standalone discovery clips. Do not move every short video into Micro Dramas just because it is vertical or brief.

Use free viewing with no account requirement for playback. Consider clearly labelled sponsored seasons, brand-funded originals and creator distribution partnerships after audience retention is demonstrated. Do not insert an ad between every tiny episode: test interruption frequency against completion and return rates.

## Findings, in priority order

| Priority | Evidence in source | Impact | Recommended action / status |
|---|---|---|---|
| Critical | `lib/localAuth.ts`, `services/bunnyService.ts`, `supabase/functions/bunny-api/index.ts`, `content-visibility/index.ts`: shared browser PIN authorizes updates | Anyone inspecting the bundle can modify catalogue metadata and visibility; no reliable admin attribution | Previously accepted test arrangement, still present. Replace before a public acquisition campaign with real server-verified admin identity, MFA, rate limits and audit events. Never treat CORS as authorization. |
| High | `services/geminiService.ts:getClient`, `vite.config.ts:define`: browser-exposed AI credential paths | A configured key can be extracted and used outside the UI | Move generation behind an authenticated, rate-limited server endpoint; rotate any key previously included in a shipped bundle. Presence of an actual deployed secret was not verified. |
| High | `services/bunnyService.ts:fetchBunnyVideos`, `App.tsx`: unfiltered upstream metadata is delivered, then hidden/rating filtering happens in the client | Hide is discoverability, not access control; direct CDN URLs and hidden records can remain accessible | Add a public catalogue endpoint returning only published/allowed records. Separate admin reads. Use signed playback where rights require it. |
| High | `components/UploadSection.tsx:uploadSingleItem` writes metadata into Supabase `videos`; catalogue reads Bunny tags | Newly uploaded category, rating and descriptions can disappear after refresh; completed state precedes encoding | Choose one catalogue source of truth. Persist metadata before publication; model uploading, encoding, ready, failed and published states. Add resumable uploads and reconciliation. PIN users also lack the real JWT required to create/upload video. |
| High | `components/AnalyticsDashboard.tsx`: `Math.random()` distributes views and invents retention/CTR; revenue is views × 0.05; traffic sources are constants | Acquisition and commissioning decisions would be based on invented data | Label/remove synthetic panels and replace them with measured playback sessions, episode completion, transition, rebuffering and cohort return data. Do not feed synthetic metrics to AI as facts. |
| High | Prior `SeriesCarousel` clicked a missing DOM card; `App.tsx` autoplay used global catalogue order and wrapped around | Broken episode starts and unrelated videos after a cliffhanger | Fixed locally: explicit `onPlay`, series-aware numeric episode ordering, final episode stops, keyed player reset. |
| High | Prior `bunnyVideoToVideo` merged `tube_content_overrides` into public metadata | Failed saves appeared published locally; old drafts masked remote changes | Fixed locally: published mapping uses server metadata only. Drafts remain in the admin editor. |
| Medium | `fetchBunnyVideos` loops over 100-item pages before showing results; admin renders every row | Startup and admin work grow with catalogue size; repeated API requests | Paginated public catalogue, cached editorial shelves, server-side search, admin table virtualization, and explicit error/retry states. Do not silently substitute demo content for a production outage. |
| Medium | `VideoCard` / `ShortsPlayer` asynchronously initialize HLS without comprehensive cancellation; each card owns a player | Fast navigation can attach stale media; simultaneous playback wastes mobile data | One active playback session; cancel pending initialization; only prepare the next eligible episode; preserve Data Saver and honor reduced motion. Use `object-contain` for story video so captions and framing are not cropped. |
| Medium | Player start analytics cover selected click paths; no first-frame or episode-completion funnel | Cannot tell whether users leave from weak stories or poor delivery | Measure first-frame time, startup failures, watch seconds, completion, next-episode acceptance, buffer duration and source attribution. Events need bounded bodies, abuse limits and deduplication. |
| Medium | `lib/seo.ts` mutates metadata after React loads; `vercel.json` rewrites all paths to the same HTML | Social crawlers may see generic previews for episode links | Server-render or pre-render series and episode landing pages with unique canonical URLs, poster, synopsis and structured data. Test actual WhatsApp sharing. |
| Medium | Saved series metadata is currently repeated in Bunny tags | Concurrent edits can overwrite shared details; group updates are not atomic | Added stable series ID and shared-synopsis propagation as a compatible bridge. Move to normalized `series`, `seasons`, `episodes` records with a unique `(series_id, season_number, episode_number)` constraint, version checks and transactional saves. |
| Medium | Public dialogs and custom player controls have incomplete focus management; caption metadata mapping was incomplete | Keyboard/screen-reader friction and inaccessible viewing | Semantic controls added to series cards; preserve native aspect ratio and map caption URLs. Still add dialog focus traps/restore, comprehensive keyboard control and English/Kiswahili caption QA. |
| Medium | Test-phase classification flag admits unrated titles, while settings copy implied otherwise | Product promise and enforcement differ | Align copy/policy and finish classification and rights review before campaign launch. The audit does not establish legal compliance. |
| Low | Several tests assert source text rather than outcomes | Refactors can pass while user flows fail | Added behavioral episode-ordering tests. Extend with authenticated API, duplicate episode, partial batch save, mobile playback and returning-viewer integration tests. |

## Implemented in this change

- Dedicated Micro Dramas navigation, with migration for existing saved navigation.
- Micro Dramas as an admin category; standard Series remain available.
- Explicit `seriesId`, `seriesFormat`, main `seriesSynopsis`, and `episodeSynopsis` metadata. Legacy episode descriptions still display.
- Positive integer season/episode validation and duplicate episode checks against the loaded catalogue.
- Main synopsis shared across existing sibling episodes; each episode retains its own synopsis. Failed multi-video saves keep the draft for retry. This is not an atomic database transaction and does not prevent concurrent administrators racing.
- Portrait series posters/player frame; series synopsis and season-based episode list; direct playback and next-episode control.
- Micro-drama opening episodes lead the homepage hero when available; a dedicated shelf complements the existing catalogue.
- Payment gates, badges, billing screen, payment client module, payment translations, donation/paybill UI, payment analytics events and payment function sources/configuration removed from the current application.
- Historical migrations, financial records and Git history retained. Removing source/configuration does **not** uninstall previously deployed functions. Production retirement must explicitly remove the two retired payment functions and revoke their unused credentials after checking for pending settlements.

## Content model and editorial workflow

**Series:** stable ID, title, main synopsis, format, portrait poster, landscape key art, genres, languages, creator, rating, publication status, release schedule and rights window.

**Episode:** stable ID, parent series ID, season, episode number, title, short spoiler-light synopsis, Bunny GUID, measured runtime, encoding state, captions per language, poster, publication state and release time.

Main synopsis: approximately 40–80 words about the premise, protagonist and stakes. Episode synopsis: approximately 15–35 words explaining the immediate conflict without revealing the cliffhanger. These are editorial targets, not API limits. Keep subtitles and artwork free of critical text under player controls.

Current admin workflow: select **Micro Dramas** (or **Series**), choose/reuse a series name, enter season/episode, main synopsis and episode synopsis, then save. Reusing an existing series name carries its shared synopsis and ID into the form. A main-synopsis change propagates to the loaded episodes of that series. Import videos into the Bunny library first; the existing new-video upload pipeline still needs the repair described above.

## Go-to-market experiment

Treat these as proposed experiments, not market forecasts:

1. Launch a small slate of two or three distinctive Kenyan stories with enough completed episodes to support a consistent release cadence. Pilot 60–180-second episodes and compare pacing before locking a format.
2. Make episode one available immediately. Use captioned teaser clips on creator channels and social platforms, linking to the exact series opener. The catalogue should never demand payment or an account to start a story.
3. Keep Continue Watching, a clear episode list, optional next episode, and opt-in release reminders close to playback. Separate editorial recommendations from chronological story order.
4. Measure qualified starts → episode-one completion → episode-two start → series continuation → day-1/day-7 return. Segment by device, connection and acquisition source. Establish a real baseline before setting growth claims or buying reach.
5. Commission the next slate from completion and return evidence, qualitative viewer interviews and creator economics—not raw aggregate views alone.

## Delivery sequence

**Before campaign:** replace test admin access; protect API credentials; unify publication metadata; remove deployed payment endpoints; make measured analytics trustworthy; establish error reporting and backups; verify rights/classification.

**Next release:** normalized series editor with transactional saves; reliable resumable upload; encoding webhooks; scheduled episodes; portrait artwork tools; caption editor; Continue Watching; server-rendered share pages.

**Then optimize:** low-bandwidth Android/iOS testing, one active player, measured prefetch policy, accessible episode drawer, editorial merchandising, opt-in reminders, cohort dashboards and creator reporting. Native apps can follow demonstrated web retention.

Suggested engineering acceptance targets, to validate rather than claim: no payment UI in built assets; episode ordering survives refresh; no cross-series autoplay; no simultaneous media audio; first-frame p75 under 2.5 seconds on a representative 4G test profile; successful resume after network loss; keyboard and 390px-wide portrait QA; no hidden items from the public catalogue API.

## Verification and limits

- TypeScript checks pass after the changes.
- Existing and new regression tests: 29 passed across 10 files, including numeric episode ordering, cross-season continuation, last-episode stopping, legacy synopsis fallback and isolation of published metadata from drafts.
- `npm audit --omit=dev --json`: zero reported production dependency vulnerabilities at audit time. This is not proof of application security.
- Browser verification uses the local development build. Navigation, both synopsis levels, episode selection, next-episode transitions and final-episode stopping pass with labelled fixtures. No page overflow at 390px. The browser rejects the remote sample media with `NotSupportedError`; decoded media playback and real Bunny persistence have not been verified for this change. Production content and financial records were not modified to test the new schema.
- No claim is made that the entire concept image has been implemented. It is a visual direction with fictional titles.

## References

- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth): validate caller identity and distinguish authorization from public API access.
- [web.dev video loading](https://web.dev/articles/lazy-loading-video): defer media loading until needed.
- [Bunny video specification](https://docs.bunny.net/docs/stream-best-practices): encoding and supported video/caption formats.

## Visual concept

Generated with the built-in image-generation tool. Prompt: a high-fidelity desktop and mobile TubeTV concept, Kenyan vertical micro dramas first, cinematic charcoal/ivory/scarlet palette, portrait drama posters, main story synopsis, episode player/synopsis and next episode, with Movies, Series, Shorts, Education and Live retained; no payment elements; fictional titles labelled as a concept. Original generated artifact is linked in the task. Proposed design is not a production screenshot.
