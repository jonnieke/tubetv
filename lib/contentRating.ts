export type ContentRating = 'GE' | 'PG' | '16' | '18' | 'UNRATED';

const RATING_LEVEL: Record<ContentRating, number> = {
  GE: 0,
  PG: 1,
  '16': 2,
  '18': 3,
  UNRATED: 4,
};

export const PUBLIC_CONTENT_RATINGS: ContentRating[] = ['GE', 'PG', '16'];

export function normalizeContentRating(value?: string): ContentRating {
  const normalized = String(value || '').toUpperCase().replace('+', '').trim();
  return normalized === 'GE' || normalized === 'PG' || normalized === '16' || normalized === '18'
    ? normalized
    : 'UNRATED';
}

export function canWatchContent(contentRating: ContentRating | undefined, maximumRating: 'GE' | 'PG' | '16'): boolean {
  const normalized = normalizeContentRating(contentRating);
  if (normalized === '18' || normalized === 'UNRATED') return false;
  return RATING_LEVEL[normalized] <= RATING_LEVEL[maximumRating];
}

export function ratingDescription(rating: ContentRating): string {
  if (rating === 'GE') return 'General Exhibition';
  if (rating === 'PG') return 'Parental Guidance';
  if (rating === '16') return 'Not suitable for viewers under 16';
  if (rating === '18') return 'Adults only';
  return 'Awaiting classification';
}
