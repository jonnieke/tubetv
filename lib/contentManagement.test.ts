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

describe('Bunny content classification', () => {
  it('allows an admin to classify existing videos', () => {
    expect(adminSource).toContain("field('KFCB content rating', 'contentRating'");
    expect(adminSource).toContain("value=\"UNRATED\">Needs rating");
  });

  it('uses the signed-in session for Bunny mutations', () => {
    expect(bunnySource).toContain('session?.access_token || ANON_KEY');
  });
});
