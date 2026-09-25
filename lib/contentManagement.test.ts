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
const entrySource = readFileSync(
  new URL('../index.tsx', import.meta.url),
  'utf8',
);
const serviceWorkerSource = readFileSync(
  new URL('../public/sw.js', import.meta.url),
  'utf8',
);
const visibilityFunctionSource = readFileSync(
  new URL('../supabase/functions/content-visibility/index.ts', import.meta.url),
  'utf8',
);
const bunnyFunctionSource = readFileSync(
  new URL('../supabase/functions/bunny-api/index.ts', import.meta.url),
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

  it('remembers edit details locally until the server save succeeds', () => {
    expect(adminSource).toContain("const EDIT_DRAFTS_STORAGE_KEY = 'tube_content_overrides'");
    expect(adminSource).toContain('persistEditDraft(editingItem.guid, editForm)');
    expect(adminSource).toContain('clearEditDraft(editingItem.guid)');
    expect(adminSource).toContain('Draft saved automatically on this device');
    expect(adminSource).toContain('Your draft is saved on this device so you can retry.');
  });

  it('replaces stale app-shell service workers after a deployment', () => {
    expect(entrySource).toContain("updateViaCache: 'none'");
    expect(entrySource).toContain("addEventListener('controllerchange'");
    expect(entrySource).toContain('registration.update()');
    expect(serviceWorkerSource).toContain('self.skipWaiting()');
    expect(serviceWorkerSource).toContain("cacheName.startsWith('tube-tv-shell-')");
    expect(serviceWorkerSource).toContain('client.navigate(client.url)');
  });

  it('requires a verified admin session for Bunny mutations', () => {
    expect(bunnySource).not.toContain('x-admin-pin');
    expect(bunnyFunctionSource).toContain('verifiedAdminId(req)');
    expect(bunnyFunctionSource).not.toContain('ADMIN_PIN');
    expect(bunnyFunctionSource).toContain('(?:\\/thumbnail)?');
  });

  it('streams raw thumbnail files and retries transient gateway failures', () => {
    expect(bunnySource).toContain("'Content-Type': 'application/octet-stream'");
    expect(bunnySource).toContain('body: file');
    expect(bunnySource).toContain('[500, 502, 503, 504]');
    expect(bunnyFunctionSource).toContain(': req.body');
    expect(bunnyFunctionSource).not.toContain('await req.arrayBuffer()');
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
