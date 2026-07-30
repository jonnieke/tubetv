# TubeTV Phase 3 deployment

Phase 3 adds KFCB-aligned classification controls, account privacy actions, stable watch pages, structured metadata and public legal routes.

## Deploy

1. Apply `supabase/migrations/20260730_phase3_compliance_discovery.sql`.
2. Deploy the authenticated privacy function:
   `supabase functions deploy account-data`
3. Confirm `ALLOWED_ORIGINS` contains the production and preview origins.
4. Set `VITE_SITE_URL=https://www.tube.co.ke` in the production frontend environment.
5. Rebuild and deploy the frontend.
6. Submit `https://www.tube.co.ke/sitemap.xml` to Google Search Console and Bing Webmaster Tools.

## Catalogue readiness

Every published title must have:

- A KFCB audience rating: GE, PG, 16 or 18.
- A truthful title and description.
- A representative thumbnail.
- A creator or publisher name.
- Captions and a transcript when available.
- A classification number when one has been issued.

The consumer player intentionally blocks UNRATED and 18 content. Do not enable 18-rated playback until TubeTV has a legally reviewed age-assurance flow. Existing Bunny titles without `contentRating` metadata will be treated as UNRATED.

## Privacy checks

Use a non-production test account to verify export and deletion after deployment. Account deletion removes the Supabase Auth user; Phase 2 account tables cascade on that user id. Retain only records that TubeTV is legally required to keep, under a separately reviewed retention policy.

The privacy notice and terms are operational drafts, not a substitute for review by Kenyan counsel or a Data Protection Officer.
