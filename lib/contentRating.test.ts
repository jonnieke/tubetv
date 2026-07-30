import { describe, expect, it } from 'vitest';
import { canWatchContent, normalizeContentRating } from './contentRating';

describe('content ratings', () => {
  it('normalizes known ratings and rejects unknown values', () => {
    expect(normalizeContentRating('16+')).toBe('16');
    expect(normalizeContentRating('adult')).toBe('UNRATED');
  });

  it('fails closed for unrated and adult content', () => {
    expect(canWatchContent('UNRATED', '16')).toBe(false);
    expect(canWatchContent('18', '16')).toBe(false);
  });

  it('honours a profile maximum', () => {
    expect(canWatchContent('GE', 'PG')).toBe(true);
    expect(canWatchContent('16', 'PG')).toBe(false);
  });
});
