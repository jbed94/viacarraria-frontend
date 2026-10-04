import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getOnlineStatus,
  isServiceWorkerSupported,
  registerServiceWorker,
  subscribeOnlineStatus,
  unregisterServiceWorker,
} from './pwa';

describe('PWA Service Worker Utilities', () => {
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      writable: true,
      configurable: true,
    });
  });

  it('detects service worker support correctly', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {},
      writable: true,
      configurable: true,
    });
    expect(isServiceWorkerSupported()).toBe(true);

    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(isServiceWorkerSupported()).toBe(false);
  });

  it('returns current navigator online status', () => {
    expect(getOnlineStatus()).toBe(navigator.onLine);
  });

  it('subscribes to online and offline network events and cleans up', () => {
    const handleStatusChange = vi.fn();
    const unsubscribe = subscribeOnlineStatus(handleStatusChange);

    window.dispatchEvent(new Event('offline'));
    expect(handleStatusChange).toHaveBeenCalledWith(false);

    window.dispatchEvent(new Event('online'));
    expect(handleStatusChange).toHaveBeenCalledWith(true);

    unsubscribe();
    window.dispatchEvent(new Event('offline'));
    expect(handleStatusChange).toHaveBeenCalledTimes(2);
  });

  it('does not register in non-production unless force is true', async () => {
    const mockRegister = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: mockRegister },
      writable: true,
      configurable: true,
    });

    const result = await registerServiceWorker({ force: false });
    expect(result).toBeUndefined();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers service worker when force is true', async () => {
    const mockRegistration = {
      addEventListener: vi.fn(),
      installing: null,
    };
    const mockRegister = vi.fn().mockResolvedValue(mockRegistration);

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: null,
      },
      writable: true,
      configurable: true,
    });

    const result = await registerServiceWorker({
      force: true,
      swUrl: '/sw.js',
    });

    expect(mockRegister).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(result).toBe(mockRegistration);
  });

  it('gracefully catches and logs registration errors', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const mockRegister = vi
      .fn()
      .mockRejectedValue(new Error('Network failure'));

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: mockRegister },
      writable: true,
      configurable: true,
    });

    const result = await registerServiceWorker({ force: true });
    expect(result).toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[PWA] Service Worker registration failed:',
      expect.any(Error),
    );
  });

  it('unregisters existing service worker registrations', async () => {
    const mockUnregister = vi.fn().mockResolvedValue(true);
    const mockGetRegistration = vi.fn().mockResolvedValue({
      unregister: mockUnregister,
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: mockGetRegistration },
      writable: true,
      configurable: true,
    });

    const result = await unregisterServiceWorker();
    expect(mockGetRegistration).toHaveBeenCalled();
    expect(mockUnregister).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
