# TubeTV reference UI implementation

Implemented locally on 25 September 2026. Not deployed.

The target is the interface inside the supplied desktop and phone screens, not the surrounding laptop, phone hardware, or presentation-board typography.

## Implemented

- Horizontal TubeTV navigation, Discover underline, Micro Dramas, Series, Movies, More, search, account access. Existing categories and admin remain accessible through More.
- Cinematic discovery hero with cream serif title, metadata, synopsis, red watch action and outlined details action.
- Five-column portrait story shelf and six-column landscape discovery shelf on desktop; horizontally scrolling shelves on mobile.
- Story details with published series synopsis and ordered episode actions.
- Phone-style player header, separate episode synopsis, next episode and expandable episode drawer. Existing player controls remain in use.
- Artwork failure fallback, lazy-loaded shelf images, keyboard dismissal and focus containment for story details.

## Verification

- TypeScript check passed; 32 tests passed across 11 files; production build passed.
- Browser checked at 1440 × 1000 and 390 × 844.
- Series destination retains selected category; story-details dialog opens and Escape closes it; watch action opens playback dialog.
- Mobile document width is 390px at a 390px viewport; no Vite error overlay detected.
- Local preview has no production backend configuration, so it uses existing demo catalogue metadata. Live admin mutation and streamed-media decoding are not validated by this UI pass.

## Remaining differences from the concept

This is not a verified pixel-identical recreation. The reference contains bespoke fictional drama artwork and titles; the application preserves published catalogue imagery and text. The existing demo image provider can fail intermittently, in which case the new neutral artwork fallback is shown. Exact poster and hero composition require suitable production artwork, rather than embedding a screenshot of the concept in the website.

Screenshots: `ui-desktop.png`, `ui-mobile.png`. The reference remains `tubetv-micro-drama-concept.png`.
