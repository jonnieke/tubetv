import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import UploadSection from './UploadSection';

describe('upload ingest choices', () => {
  it('keeps film/general, landscape series and portrait micro dramas distinct', () => {
    const html = renderToStaticMarkup(<UploadSection />);
    expect(html).toContain('Choose an ingest path');
    expect(html).toContain('Series · landscape');
    expect(html).toContain('Micro Dramas · portrait');
    expect(html).toContain('Film &amp; other');
  });
});
