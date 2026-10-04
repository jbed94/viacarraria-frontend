export type AdSenseLoadOptions = {
  clientId?: string;
  npa?: boolean;
};

let scriptLoadingPromise: Promise<boolean> | null = null;

export function isAdSenseLoaded(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
    ),
  );
}

export function loadGoogleAdSense(
  options: AdSenseLoadOptions = {},
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  const clientId =
    options.clientId ||
    (typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT
      : undefined);

  if (!clientId || clientId.trim() === '') {
    return Promise.resolve(false);
  }

  // Configure non-personalized ads if opted out of profiling
  const win = window as any;
  win.adsbygoogle = win.adsbygoogle || [];
  if (options.npa) {
    win.adsbygoogle.requestNonPersonalizedAds = 1;
  }

  if (isAdSenseLoaded()) {
    return Promise.resolve(true);
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<boolean>((resolve) => {
    try {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
      script.crossOrigin = 'anonymous';

      script.onload = () => {
        resolve(true);
      };

      script.onerror = () => {
        scriptLoadingPromise = null;
        resolve(false);
      };

      document.head.appendChild(script);
    } catch {
      scriptLoadingPromise = null;
      resolve(false);
    }
  });

  return scriptLoadingPromise;
}
