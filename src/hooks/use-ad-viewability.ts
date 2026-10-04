import { useEffect, useRef, useState } from 'react';

export type UseAdViewabilityOptions = {
  minViewableRatio?: number; // default 0.5 (IAB 50% in-view requirement)
  refreshIntervalMs?: number; // default 30,000ms (30s active viewability per Google AdSense policy)
  onRefresh?: () => void;
};

export type AdViewabilityState = {
  isIntersecting: boolean; // For occlusion culling: false means completely outside viewport
  isViewable: boolean; // For compliance: true when >= 50% of ad is visible
  viewableSeconds: number; // Active viewable seconds in current cycle
  refreshCount: number; // Number of compliant refreshes performed
};

export function useAdViewability<T extends HTMLElement = HTMLDivElement>(
  options: UseAdViewabilityOptions = {},
) {
  const {
    minViewableRatio = 0.5,
    refreshIntervalMs = 30000,
    onRefresh,
  } = options;

  const targetRef = useRef<T | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const [state, setState] = useState<AdViewabilityState>({
    isIntersecting: true,
    isViewable: false,
    viewableSeconds: 0,
    refreshCount: 0,
  });

  const isViewableRef = useRef(false);
  const elapsedSecondsRef = useRef(0);

  // IntersectionObserver for occlusion culling and IAB viewability ratio
  useEffect(() => {
    const el = targetRef.current;
    if (
      !el ||
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window)
    ) {
      // Fallback if IntersectionObserver is unavailable (e.g. older browser or test env)
      setState((prev) => ({ ...prev, isIntersecting: true, isViewable: true }));
      isViewableRef.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const isIntersecting = entry.isIntersecting;
        const isViewable = entry.intersectionRatio >= minViewableRatio;

        isViewableRef.current = isViewable;
        setState((prev) => ({
          ...prev,
          isIntersecting,
          isViewable,
        }));
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [minViewableRatio]);

  // Active viewability ticker: advances ONLY when ad is >= 50% in view
  useEffect(() => {
    const intervalSeconds = Math.max(5, Math.floor(refreshIntervalMs / 1000));

    const interval = setInterval(() => {
      if (!isViewableRef.current) {
        // Paused because ad is not actively viewable
        return;
      }

      elapsedSecondsRef.current += 1;
      const currentElapsed = elapsedSecondsRef.current;

      if (currentElapsed >= intervalSeconds) {
        // 30 seconds of active viewability achieved -> trigger compliant refresh
        elapsedSecondsRef.current = 0;
        setState((prev) => ({
          ...prev,
          viewableSeconds: 0,
          refreshCount: prev.refreshCount + 1,
        }));
        onRefreshRef.current?.();
      } else {
        setState((prev) => ({
          ...prev,
          viewableSeconds: currentElapsed,
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [refreshIntervalMs]);

  return {
    targetRef,
    ...state,
  };
}
