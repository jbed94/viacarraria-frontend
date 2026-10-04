import { useEffect, useState } from 'react';

export type AdConsentStatus =
  | 'granted'
  | 'essential_only'
  | 'denied'
  | 'pending';

export type AdConsentRecord = {
  status: AdConsentStatus;
  timestamp: string;
  version: string;
};

export const CURRENT_CONSENT_VERSION = '1.0';
const CONSENT_STORAGE_KEY = 'vc_ad_consent_status';
const CONSENT_RECORD_KEY = 'vc_ad_consent_record';
const CONSENT_CHANGE_EVENT = 'vc_ad_consent_changed';

type ConsentSubscriber = (status: AdConsentStatus) => void;
const subscribers = new Set<ConsentSubscriber>();

export function getAdConsentRecord(): AdConsentRecord | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CONSENT_RECORD_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AdConsentRecord;
      if (
        parsed.status === 'granted' ||
        parsed.status === 'essential_only' ||
        parsed.status === 'denied'
      ) {
        return parsed;
      }
    } catch {
      // Fallback to basic status if JSON parsing fails
    }
  }

  const basic = getAdConsent();
  if (basic !== 'pending') {
    return {
      status: basic,
      timestamp: new Date().toISOString(),
      version: CURRENT_CONSENT_VERSION,
    };
  }
  return null;
}

export function getAdConsent(): AdConsentStatus {
  if (typeof window === 'undefined') return 'pending';
  const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (saved === 'granted' || saved === 'essential_only' || saved === 'denied') {
    return saved;
  }
  return 'pending';
}

export function setAdConsent(status: AdConsentStatus): void {
  if (typeof window === 'undefined') return;
  if (status === 'pending') {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    localStorage.removeItem(CONSENT_RECORD_KEY);
  } else {
    localStorage.setItem(CONSENT_STORAGE_KEY, status);
    const record: AdConsentRecord = {
      status,
      timestamp: new Date().toISOString(),
      version: CURRENT_CONSENT_VERSION,
    };
    localStorage.setItem(CONSENT_RECORD_KEY, JSON.stringify(record));
  }

  for (const sub of subscribers) {
    try {
      sub(status);
    } catch {
      // ignore subscriber errors
    }
  }

  window.dispatchEvent(
    new CustomEvent(CONSENT_CHANGE_EVENT, { detail: { status } }),
  );
}

export function subscribeAdConsent(callback: ConsentSubscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function useAdConsent() {
  const [status, setStatus] = useState<AdConsentStatus>(getAdConsent);

  useEffect(() => {
    const unsubscribe = subscribeAdConsent((newStatus) => {
      setStatus(newStatus);
    });

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ status: AdConsentStatus }>;
      if (customEvent.detail?.status) {
        setStatus(customEvent.detail.status);
      }
    };

    window.addEventListener(CONSENT_CHANGE_EVENT, handleCustomEvent);
    return () => {
      unsubscribe();
      window.removeEventListener(CONSENT_CHANGE_EVENT, handleCustomEvent);
    };
  }, []);

  return {
    status,
    record: getAdConsentRecord(),
    setConsent: setAdConsent,
    resetConsent: () => setAdConsent('pending'),
    isPersonalized: status === 'granted',
    isAdsAllowed: status === 'granted' || status === 'essential_only',
  };
}
