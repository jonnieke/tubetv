# TubeTV visual and experience audit

Date: 28 September 2026. Target: https://www.tube.co.ke/.

## Verdict

The cinematic direction is promising, but the experience is not yet consistently premium. The homepage has an editorial personality; the interior pages still resemble a generic video directory. Artwork treatment, empty destinations, competing navigation, and inconsistent viewing patterns undermine the improvement more than the colour palette does.

This includes shortcomings in the latest landing-page work: forcing landscape images into portrait cards, adding titles over already-lettered artwork, restricting the design language to the homepage, and placing too much promotional content ahead of playable shelves. These should be corrected, not defended as a finished redesign.

Keep all categories, existing carousels, real content, and the micro-drama priority. This is a presentation and discovery overhaul, not a replacement platform.

## Scope and limitations

- Live browser inspection at 1440 × 1000 and 390 × 844.
- Reviewed Discover, home shelves, Series, expanded episode cards, Movies, Micro Dramas, Education, Farmers, Faith, Kids, Diaspora, Live, Watch List, public sign-in/settings entry, Shorts, mobile menu/search, welcome entry, footer, Studio entry, and privacy/terms.
- Reviewed relevant rendering code to distinguish appearance from behaviour.
- Authenticated Settings, Admin, analytics and upload interiors were not visually audited: the isolated browser was signed out. No credentials were requested or entered. Creator guidance is not a substitute for a complete creator-onboarding review.
- This is a design audit, not a complete accessibility, performance, content-rights or legal-compliance certification. No full-film playback or caption-track verification was performed. No comparison claim about competitors' current interfaces is implied.
- No application changes, deployments or data mutations were made. Browsing a public video may produce the site's normal analytics events.

## Priority findings

### P1 — Discovery produces avoidable dead ends

Education opened CBC with “No videos found,” although educational titles were visible on Discover. Farmers/Crops, Faith/Sermons, Kids/Cartoons and Diaspora/Investments likewise opened empty. This does not establish that each entire category is empty: the default subcategory can exclude available content.

Searching “Love” from Series returned no results. `handleSearch` changes the main view to HOME but retains the selected subcategory; filtering applies that subcategory before the search. A global-looking search therefore behaves like a hidden filtered search.

**Direction:** Start each category with all available content, then expose meaningful filters. Keep all categories. Empty categories need a deliberate introductory panel and real alternative titles, not a dead-end magnifying glass. Search should be global by default, with any active constraints visible and removable.

**Acceptance:** Every category has either real content or a useful designed empty state; searching a known title succeeds regardless of the previous destination.

### P1 — Artwork is not being art-directed for its placement

Series posters on Discover crop landscape thumbnails to 2:3. Embedded lettering and people are cut off. Large HTML titles are then placed over existing titles, and repeated below the image. “Learning sign language,” “Body Dump,” and the long Wandahuhu title make the overlap especially apparent. The same cards revert to landscape on the Series page.

The first desktop hero capture showed a nearly blank image area while artwork was loading; subsequent captures showed artwork. That is a loading-state observation, not proof of a permanently broken image. A movie card also appeared black in one capture; its image delivery needs separate verification.

**Direction:** Support three intentional assets: landscape hero/backdrop, portrait series poster, and landscape episode thumbnail. Use focal-point positioning. Keep existing landscape assets in landscape until proper posters exist. Show a title once; use text overlays only on clean artwork. Prefer selected, rights-cleared real key art over generic generated movie imagery.

**Acceptance:** No cropped title lettering, duplicate titles, stretched images or featureless loading panels in featured placements. Missing artwork has a branded fallback. Metadata remains readable for long titles.

### P1 — Viewer navigation exposes an administrator experience

The public account/settings path leads to a dialog headed “Admin access.” Mobile navigation gives permanent space to an unlabeled upload plus and Studio, while Shorts and Watch List are behind More. This mixes watching with managing the platform.

**Direction:** Viewer navigation should prioritize Discover, Micro Dramas, Browse/Search and My List. Preserve Education and every other category in Browse. Put creator/Studio access in a clearly labeled secondary destination; keep admin sign-in explicitly separate. Do not imply that public viewer registration exists if it does not.

**Acceptance:** No ordinary viewer action unexpectedly asks for administrator credentials. Creator-only screens retain appropriate access controls.

### P1 — Mobile viewport allocation compromises immersion

The Shorts capture retains the full two-row top navigation and fixed bottom bar. The creator row sits against the bottom bar, with the title below the visible area. `ShortsPlayer` sizes itself using viewport height while it is already inside the app shell. The expanded series card combines horizontal shelf scrolling and a narrow internal episode scrollbar; the first episode only begins near the bottom of the screen.

**Direction:** Give Shorts a dedicated, safe-area-aware viewing layout fitted to available space. Use a title-detail page or bottom sheet for synopsis/seasons/episodes rather than expanding a narrow carousel card. Keep episode thumbnails and separate main/episode synopses.

**Acceptance:** At 390 × 844 and smaller supported widths, essential controls, title and episode context remain reachable without overlapping chrome. No nested horizontal-and-vertical browsing trap.

### P1 — The visual system stops at Discover

Discover uses cream serif headings and transparent cards; Series/Movies revert to bold utility headings, grey boxed cards and green CATALOG badges. Movies and Series both open beneath “Originals.” Live uses yet another inset page width. Desktop Series shows a prominent native horizontal scrollbar. The footer is rendered only on Discover.

**Direction:** Establish shared tokens for colour, typography, gutters, spacing, borders, focus states and controls, then use them across every public page. Give each destination its own correct title. Extend the footer to browsing pages, not immersive players. Preserve keyboard/scroll access when styling carousel affordances.

**Acceptance:** The same card and heading have the same visual rules across destinations. No unexplained CATALOG badges, emoji headings or conflicting page identities.

### P2 — Catalogue metadata makes the product feel like a video directory

Cards display producer, category, repeated `0.0K views`, duration badges and overflow menus. Titles include filename-like text and inconsistent capitalization. This is noisy compared with the editorial ambition of the hero. The issue is presentation and metadata quality, not the value of the content itself.

**Direction:** Make the artwork and programme title primary; keep compact useful context such as year, language, rating or episode count where known. Move producer details and secondary actions into title details. Suppress zero/unhelpful public view counts; never invent popularity. Clean display titles while preserving underlying media identifiers.

### P2 — Micro Dramas is present, but not yet a complete destination

The coming-soon treatment is honest and should stay prominent. However, the destination has an “All” filter and “Popular Videos” heading above an empty catalogue. Its main graphic resembles a generic promotional card stack more than distinctive entertainment key art. On Discover, the large promotion followed by welcome content pushes playable shelves further down.

**Direction:** Keep a compact, premium micro-drama editorial feature immediately below the hero, followed promptly by real playable carousels. The dedicated destination should explain the vertical episodic format, show clearly labeled real teaser material only when available, and offer working Movies/Series alternatives. Do not invent titles, release dates or a notification promise. When real micro dramas publish, replace promotion with first-class poster and continue-watching shelves.

### P2 — Welcome is optional, but duplicates navigation

The current welcome panel offers destination buttons rather than genuine personalization. This is acceptable as a browse shortcut, but it should not be presented as a finished onboarding system or consume a major home section indefinitely.

**Direction:** Keep first-run guidance brief, dismissible and contextual. Explain Micro Dramas alongside the rest of TubeTV. Do not require account creation to browse or watch. Ask for preferences only when the product actually uses them. Apple likewise recommends fast, optional onboarding: https://developer.apple.com/design/human-interface-guidelines/onboarding.

### P2 — Hero rotation needs user control

The hero changes every eight seconds. The implementation has title-selection dots but no pause control or focus/hover pause in that interval logic. CSS reduced-motion rules do not stop the JavaScript rotation.

**Direction:** Prefer a stable editorial feature or provide an accessible pause/resume control, pause while interacting, and respect reduced motion. W3C guidance: https://www.w3.org/WAI/tutorials/carousels/.

### P2 — Watching feels different depending on entry point

Hero and series entries use a branded modal with programme information; catalogue cards use their own video-card interactions. The inspected modal has both a back arrow and a close control, while episode discovery is spread across expanding cards and player details.

**Direction:** Define one title-details pattern and one player shell. A clear Play action, synopsis, rating, duration/episode context and My List action should behave consistently. Micro dramas can have an intentional portrait layout without becoming a separate visual brand. Preserve captions, quality controls and resume behaviour during any redesign; their functionality was not fully tested in this audit.

### P2 — Footer is a good direction; trust copy is inconsistent

The mobile footer has appealing category icons and a recognizable Kenya Creates sign-off. It needs the same alignment and typography rules as the rest of the site and should be available beyond Discover. Add only verified support/contact information.

Privacy still mentions “purchased access”; Terms still mentions “paid passes.” Terms also contains `person?s`. These conflict with the intended free/no-paywall messaging and look unfinished. Privacy references support without giving a usable contact in the page text. This is a copy-consistency finding, not legal advice; policy statements must be reviewed against actual behaviour before publication.

## Recommended creative direction

**Contemporary Kenyan cinema, not a generic streaming clone.**

- Retain near-black surfaces, warm ivory display type, restrained TubeTV red and real Kenyan imagery.
- Use expressive serif typography for programme/editorial headings, not every small card label; pair with a highly readable UI sans-serif.
- Make real programme art the visual signature. Do not compensate for weak crops with more gradients, badges or decorative effects.
- Maintain calm card surfaces and generous, consistent spacing, with more playable content visible near the top.
- Give secondary categories their own editorial introductions within the same system; a Kids destination can be warmer without becoming another product.
- Reserve red for meaningful actions and selected states. Keep focus indicators clearly visible.
- Use small, purposeful transitions. A premium feel comes from coherence and responsiveness, not constant motion.

Suggested home sequence: editorial hero → compact Micro Dramas priority feature (coming soon until real releases) → existing playable carousels → remaining categories and collections → footer. Keep welcome optional and compact. Preserve all existing catalogue capabilities.

## Implementation order

1. Fix discovery dead ends, hidden search filters and viewer/admin entry confusion.
2. Establish shared design tokens and artwork/card rules; stop destructive crops and duplicate titles.
3. Apply the system to category pages, title details, search and deliberate empty states.
4. Refine mobile navigation, Shorts viewport, player and episode browsing.
5. Polish micro-drama prelaunch/onboarding, footer and consistent public copy.
6. Re-audit representative long titles, missing art, slow image loading, empty/populated categories, keyboard focus and desktop/mobile layouts before release.

A visual pass should not silently alter authentication, catalogue records, paid-access policy or publishing permissions. Those require scoped implementation and verification.

## Evidence captures

Screenshots are local audit artifacts from the isolated browser, not design mockups.

- Home shelf/artwork: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547076169.png
- Desktop Series: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547110724.png
- Education default empty state: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547120343.png
- Public Settings/admin dialog: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547140762.png
- Micro Dramas: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547177200.png
- Movies: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547178670.png
- Desktop player presentation: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547190185.png
- Mobile footer: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547213201.png
- Mobile expanded series: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547222772.png
- Mobile search: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547234436.png
- Mobile privacy: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547235867.png
- Mobile Shorts: C:/Users/peterson/.agent-browser/tmp/screenshots/screenshot-1790547263930.png

Authenticated administration and creator interiors remain the outstanding audit scope.
