import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAdConsent,
  getAdConsentRecord,
  setAdConsent,
  subscribeAdConsent,
} from './ad-consent';

describe('ad-consent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to pending when nothing is stored', () => {
    expect(getAdConsent()).toBe('pending');
  });

  it('persists granted, essential_only, and denied in localStorage', () => {
    setAdConsent('granted');
    expect(getAdConsent()).toBe('granted');
    expect(localStorage.getItem('vc_ad_consent_status')).toBe('granted');

    setAdConsent('essential_only');
    expect(getAdConsent()).toBe('essential_only');

    setAdConsent('denied');
    expect(getAdConsent()).toBe('denied');

    setAdConsent('pending');
    expect(getAdConsent()).toBe('pending');
    expect(localStorage.getItem('vc_ad_consent_status')).toBeNull();
  });

  it('notifies subscribers upon consent changes', () => {
    const subscriber = vi.fn();
    const unsubscribe = subscribeAdConsent(subscriber);

    setAdConsent('granted');
    expect(subscriber).toHaveBeenCalledWith('granted');

    setAdConsent('essential_only');
    expect(subscriber).toHaveBeenCalledWith('essential_only');

    unsubscribe();
    setAdConsent('denied');
    expect(subscriber).not.toHaveBeenCalledWith('denied');
  });

  it('persists and retrieves consent record with timestamp and version', () => {
    setAdConsent('granted');
    const record = getAdConsentRecord();
    expect(record).not.toBeNull();
    expect(record?.status).toBe('granted');
    expect(record?.version).toBe('1.0');
    expect(new Date(record!.timestamp).getTime()).not.toBeNaN();

    setAdConsent('pending');
    expect(getAdConsentRecord()).toBeNull();
  });
});
