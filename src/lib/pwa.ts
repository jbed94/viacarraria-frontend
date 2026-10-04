export interface PwaRegistrationOptions {
  /** Force registration even in non-production environments (useful for testing) */
  force?: boolean;
  /** Service worker script URL (defaults to '/sw.js') */
  swUrl?: string;
  /** Callback invoked when a new service worker update is found */
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  /** Callback invoked when service worker successfully installed and active */
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
}

/**
 * Checks if Service Workers are supported in the current environment
 */
export function isServiceWorkerSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    Boolean(navigator.serviceWorker)
  );
}

/**
 * Returns current browser online state
 */
export function getOnlineStatus(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Subscribes to online/offline network changes
 * Returns an unsubscribe cleanup function
 */
export function subscribeOnlineStatus(
  onChange: (online: boolean) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => onChange(true);
  const handleOffline = () => onChange(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Registers the Via Carraria offline caching Service Worker
 */
export async function registerServiceWorker(
  options: PwaRegistrationOptions = {},
): Promise<ServiceWorkerRegistration | undefined> {
  if (!isServiceWorkerSupported()) {
    return undefined;
  }

  const shouldRegister =
    options.force ||
    (typeof import.meta !== 'undefined' && import.meta.env?.PROD);

  if (!shouldRegister) {
    return undefined;
  }

  const swUrl = options.swUrl || '/sw.js';

  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: '/',
    });

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            options.onUpdate?.(registration);
          } else {
            options.onSuccess?.(registration);
          }
        }
      });
    });

    return registration;
  } catch (error) {
    console.warn('[PWA] Service Worker registration failed:', error);
    return undefined;
  }
}

/**
 * Unregisters all active service workers (useful for reset/debugging)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      return await registration.unregister();
    }
    return false;
  } catch {
    return false;
  }
}
