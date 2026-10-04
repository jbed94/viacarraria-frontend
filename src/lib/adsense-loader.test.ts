import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isAdSenseLoaded, loadGoogleAdSense } from './adsense-loader';

describe('adsense-loader', () => {
  beforeEach(() => {
    document
      .querySelectorAll('script[src*="adsbygoogle.js"]')
      .forEach((s) => s.remove());
    delete (window as any).adsbygoogle;
  });

  afterEach(() => {
    document
      .querySelectorAll('script[src*="adsbygoogle.js"]')
      .forEach((s) => s.remove());
  });

  it('returns false when no client ID is provided', async () => {
    const result = await loadGoogleAdSense({ clientId: '' });
    expect(result).toBe(false);
    expect(isAdSenseLoaded()).toBe(false);
  });

  it('injects script tag and configures NPA when requested', async () => {
    const loadPromise = loadGoogleAdSense({
      clientId: 'ca-pub-1234567890',
      npa: true,
    });

    const script = document.querySelector(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
    ) as HTMLScriptElement | null;

    expect(script).not.toBeNull();
    expect(script?.src).toContain('ca-pub-1234567890');
    expect(script?.async).toBe(true);
    expect(script?.crossOrigin).toBe('anonymous');

    expect((window as any).adsbygoogle?.requestNonPersonalizedAds).toBe(1);

    // Simulate script load
    script?.dispatchEvent(new Event('load'));
    const result = await loadPromise;
    expect(result).toBe(true);
    expect(isAdSenseLoaded()).toBe(true);
  });
});
