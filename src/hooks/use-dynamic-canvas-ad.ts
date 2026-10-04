import { useEffect, useRef, useState } from 'react';

export type DynamicCanvasAdOptions = {
  enabled: boolean;
  graphId?: string;
  initialDelayMs?: number;
  visibleDurationMs?: number;
  hiddenDurationMs?: number;
  randomFn?: () => number;
};

export type DynamicCanvasAdState = {
  isVisible: boolean;
  side: 'bottom' | 'top';
  horizontalShiftRatio: number;
  cycleId: number;
};

const DEFAULT_INITIAL_DELAY_MS = 6000;
const DEFAULT_VISIBLE_DURATION_MS = 24000;
const DEFAULT_HIDDEN_DURATION_MS = 16000;

/**
 * Hook to manage intermittent lifecycle and randomized placement of canvas ads.
 * Ads start hidden, appear after an initial delay, stay visible for a duration,
 * disappear to remain hidden, and then reappear in a new randomized location (bottom/top with horizontal shift).
 */
export function useDynamicCanvasAd({
  enabled,
  graphId,
  initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
  visibleDurationMs = DEFAULT_VISIBLE_DURATION_MS,
  hiddenDurationMs = DEFAULT_HIDDEN_DURATION_MS,
  randomFn = Math.random,
}: DynamicCanvasAdOptions): DynamicCanvasAdState {
  const [state, setState] = useState<DynamicCanvasAdState>(() => ({
    isVisible: false,
    side: 'bottom',
    horizontalShiftRatio: 0.5,
    cycleId: 0,
  }));

  const cycleIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any active cycle timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!enabled) {
      setState((prev) => ({
        ...prev,
        isVisible: false,
      }));
      return;
    }

    // Reset visibility at start of graph or when enabled
    setState({
      isVisible: false,
      side: 'bottom',
      horizontalShiftRatio: 0.5,
      cycleId: cycleIdRef.current,
    });

    function scheduleShow() {
      timerRef.current = setTimeout(() => {
        cycleIdRef.current += 1;
        const nextSide: 'bottom' | 'top' = randomFn() < 0.5 ? 'bottom' : 'top';
        const nextShift = Math.max(0, Math.min(1, randomFn()));

        setState({
          isVisible: true,
          side: nextSide,
          horizontalShiftRatio: nextShift,
          cycleId: cycleIdRef.current,
        });

        scheduleHide();
      }, hiddenDurationMs);
    }

    function scheduleHide() {
      timerRef.current = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          isVisible: false,
        }));

        scheduleShow();
      }, visibleDurationMs);
    }

    // Start initial delay before first ad appearance
    timerRef.current = setTimeout(() => {
      cycleIdRef.current += 1;
      const initialSide: 'bottom' | 'top' = randomFn() < 0.5 ? 'bottom' : 'top';
      const initialShift = Math.max(0, Math.min(1, randomFn()));

      setState({
        isVisible: true,
        side: initialSide,
        horizontalShiftRatio: initialShift,
        cycleId: cycleIdRef.current,
      });

      scheduleHide();
    }, initialDelayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    enabled,
    graphId,
    initialDelayMs,
    visibleDurationMs,
    hiddenDurationMs,
    randomFn,
  ]);

  return state;
}
