import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LegalPage from './LegalPage';

describe('public legal pages', () => {
  it('keeps privacy guidance aligned with the current free viewing experience', () => {
    const html = renderToStaticMarkup(<LegalPage kind="privacy" />);
    expect(html).toContain('Privacy notice');
    expect(html).toContain('download your account data');
    expect(html).toContain('18-rated content is blocked');
    expect(html).not.toMatch(/purchased access|paid passes|M-Pesa/i);
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="mailto:info@onfonmedia.com"');
    expect(html).toContain('href="tel:+254703012000"');
  });

  it('offers a branded route back to discovery from terms', () => {
    const html = renderToStaticMarkup(<LegalPage kind="terms" />);
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('another person’s account');
    expect(html).not.toMatch(/purchased access|paid passes|M-Pesa/i);
    expect(html).toContain('href="mailto:info@onfonmedia.com"');
  });
});
