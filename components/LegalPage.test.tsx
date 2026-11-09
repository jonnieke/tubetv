import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LegalPage from './LegalPage';

describe('public legal pages', () => {
  it('discloses KDPA 2019 controller details, sub-processors, retention, and KFCB safeguards', () => {
    const html = renderToStaticMarkup(<LegalPage kind="privacy" />);
    expect(html).toContain('Privacy notice');
    expect(html).toContain('Kenya Data Protection Act, 2019');
    expect(html).toContain('Paystack Payments Kenya Ltd');
    expect(html).toContain('Onfon Media Ltd');
    expect(html).toContain('download your account data');
    expect(html).toContain('7 years');
    expect(html).toContain('18-rated content is blocked');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="mailto:info@onfonmedia.com"');
    expect(html).toContain('href="tel:+254703012000"');
  });

  it('discloses non-recurring M-Pesa pass pricing, receipt restoration, and Kenyan consumer terms', () => {
    const html = renderToStaticMarkup(<LegalPage kind="terms" />);
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('another person’s account');
    expect(html).toContain('KSh 10');
    expect(html).toContain('KSh 50');
    expect(html).toContain('KSh 249');
    expect(html).toContain('never auto-renew');
    expect(html).toContain('Consumer Protection Act, 2012');
    expect(html).toContain('href="mailto:info@onfonmedia.com"');
  });
});
