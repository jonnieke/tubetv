import { describe, expect, it } from 'vitest';
import { extractYouTubeId, getYouTubeEmbedUrl, publicMediaUrl } from './mediaUrl';

describe('public media URLs', () => {
  it('accepts HTTPS artwork and trailers and rejects unsafe schemes', () => {
    expect(publicMediaUrl(' https://cdn.example.com/poster.jpg ')).toBe('https://cdn.example.com/poster.jpg');
    expect(publicMediaUrl('javascript:alert(1)')).toBeUndefined();
    expect(publicMediaUrl('data:image/svg+xml,evil')).toBeUndefined();
    expect(publicMediaUrl('http://example.com/trailer')).toBeUndefined();
  });

  it('extracts YouTube IDs and builds privacy-enhanced embed URLs', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://cdn.example.com/trailer.mp4')).toBeNull();
    expect(getYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1&playsinline=1',
    );
  });
});
