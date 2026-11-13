import { describe, expect, it } from 'vitest';
import { isDynamicChunkLoadError } from './chunkRecovery';

describe('isDynamicChunkLoadError', () => {
  it('detects Vite, Safari, and HTML fallback chunk load errors', () => {
    expect(isDynamicChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/VideoCard.js'))).toBe(true);
    expect(isDynamicChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isDynamicChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    const chunkErr = new Error('Loading chunk 12 failed');
    chunkErr.name = 'ChunkLoadError';
    expect(isDynamicChunkLoadError(chunkErr)).toBe(true);
    expect(isDynamicChunkLoadError(new SyntaxError("Unexpected token '<'"))).toBe(true);
  });

  it('does not treat unrelated application errors as chunk load errors', () => {
    expect(isDynamicChunkLoadError(new ReferenceError('foo is not defined'))).toBe(false);
    expect(isDynamicChunkLoadError(new Error('Network request timed out'))).toBe(false);
  });
});
