import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const adminSource = readFileSync(
  new URL('../components/AdminDashboard.tsx', import.meta.url),
  'utf8',
);
const bunnySource = readFileSync(
  new URL('../services/bunnyService.ts', import.meta.url),
  'utf8',
);
const constantsSource = readFileSync(
  new URL('../constants.ts', import.meta.url),
  'utf8',
);
const appSource = readFileSync(
  new URL('../App.tsx', import.meta.url),
  'utf8',
);
const visibilityFunctionSource = readFileSync(
  new URL('../supabase/functions/content-visibility/index.ts', import.meta.url),
  'utf8',
);

describe('Bunny content classification', () => {
  it('allows an admin to classify existing videos', () => {
    expect(adminSource).toContain("field('KFCB content rating', 'contentRating'");
    expect(adminSource).toContain("value=\"UNRATED\">Needs rating");
  });

  it('uses the signed-in session for Bunny mutations', () => {
    expect(bunnySource).toContain('session?.access_token || ANON_KEY');
  });

  it('lets admins hide titles from the public catalogue', () => {
    expect(adminSource).toContain('setVideoMuted');
    expect(adminSource).toContain('Hide from customer site');
    expect(bunnySource).toContain('functions/v1/content-visibility');
    expect(visibilityFunctionSource).toContain('{ property: "muted", value: "true" }');
    expect(visibilityFunctionSource).toContain('JSON.stringify({ metaTags })');
    expect(appSource).toContain('mapped.filter((video) => !video.muted)');
  });

  it('keeps unrated titles visible only behind an explicit test-phase switch', () => {
    expect(constantsSource).toContain("VITE_CONTENT_RATING_ENFORCED === 'true'");
    expect(appSource).toContain("normalizeContentRating(video.contentRating) !== '18'");
    expect(adminSource).toContain('visible during the test phase only');
  });
});
