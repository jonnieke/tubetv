import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sanitizeEventProperties } from './analytics';
import { isConstrainedConnection } from './network';

describe('phase 4 performance policy', () => {
  it('detects Save-Data and constrained mobile connections', () => {
    expect(isConstrainedConnection({ saveData: true })).toBe(true);
    expect(isConstrainedConnection({ effectiveType: '2g' })).toBe(true);
    expect(isConstrainedConnection({ effectiveType: '4g' })).toBe(false);
  });

  it('bounds analytics payloads and drops object values', () => {
    const result = sanitizeEventProperties({
      title: 'x'.repeat(200),
      count: 2,
      nested: { unsafe: true } as unknown as string,
    });
    expect(String(result.title)).toHaveLength(120);
    expect(result.count).toBe(2);
    expect(result.nested).toBeUndefined();
  });

  it('keeps the analytics collector anonymous and allowlisted', () => {
    const source = readFileSync(new URL('../supabase/functions/analytics-event/index.ts', import.meta.url), 'utf8');
    expect(source).toContain('const EVENTS = new Set');
    expect(source).toContain('ALLOWED_ORIGINS');
    expect(source).not.toContain('user_id');
    expect(source).toContain('Access-Control-Allow-Credentials');
    expect(source).not.toContain('phone');
  });

});
