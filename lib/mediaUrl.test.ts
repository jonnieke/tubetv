import { describe, expect, it } from 'vitest';
import { publicMediaUrl } from './mediaUrl';

describe('public media URLs', () => {
  it('accepts HTTPS artwork and trailers and rejects unsafe schemes', () => {
    expect(publicMediaUrl(' https://cdn.example.com/poster.jpg ')).toBe('https://cdn.example.com/poster.jpg');
    expect(publicMediaUrl('javascript:alert(1)')).toBeUndefined();
    expect(publicMediaUrl('data:image/svg+xml,evil')).toBeUndefined();
    expect(publicMediaUrl('http://example.com/trailer')).toBeUndefined();
  });
});
