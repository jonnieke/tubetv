import { describe, expect, it } from 'vitest';
import { normalizeContentRating, ratingDescription } from '../lib/contentRating';

describe('Moderation & Ingestion Business Logic', () => {
  it('correctly normalizes KFCB content ratings', () => {
    expect(normalizeContentRating('ge')).toBe('GE');
    expect(normalizeContentRating('PG')).toBe('PG');
    expect(normalizeContentRating('16+')).toBe('16');
    expect(normalizeContentRating('18+')).toBe('18');
    expect(normalizeContentRating('unknown')).toBe('UNRATED');
  });

  it('provides official KFCB viewer guidance descriptions', () => {
    expect(ratingDescription('GE')).toContain('General Exhibition');
    expect(ratingDescription('PG')).toContain('Parental Guidance');
    expect(ratingDescription('16')).toContain('16');
    expect(ratingDescription('18')).toContain('Adults only');
    expect(ratingDescription('UNRATED')).toContain('Awaiting classification');
  });

  it('generates consistent URL slugs for Kenyan microdrama series titles', () => {
    const generateSlug = (title: string) => {
      return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    };

    expect(generateSlug('Nairobi Secrets')).toBe('nairobi-secrets');
    expect(generateSlug('Mkali wa Mtaa: Season 2!')).toBe('mkali-wa-mtaa-season-2');
    expect(generateSlug('Love in Westlands & Karen')).toBe('love-in-westlands-karen');
  });
});
