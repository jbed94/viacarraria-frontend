import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDynamicCanvasAd } from './use-dynamic-canvas-ad';

describe('useDynamicCanvasAd', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps ad hidden when enabled is false', () => {
    const { result } = renderHook(() =>
      useDynamicCanvasAd({
        enabled: false,
        graphId: 'graph-1',
        initialDelayMs: 2000,
      }),
    );

    expect(result.current.isVisible).toBe(false);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.isVisible).toBe(false);
  });

  it('starts hidden, appears after initialDelayMs, and cycles between visible and hidden states', () => {
    // Deterministic randomFn: first 0.2 (bottom, shift 0.2), then 0.8 (top, shift 0.8)
    const randomValues = [0.2, 0.25, 0.8, 0.75];
    let callCount = 0;
    const mockRandom = () => {
      const val = randomValues[callCount % randomValues.length]!;
      callCount += 1;
      return val;
    };

    const { result } = renderHook(() =>
      useDynamicCanvasAd({
        enabled: true,
        graphId: 'graph-1',
        initialDelayMs: 3000,
        visibleDurationMs: 8000,
        hiddenDurationMs: 4000,
        randomFn: mockRandom,
      }),
    );

    // 1. Initially hidden at the start
    expect(result.current.isVisible).toBe(false);

    // 2. Advance partway through initialDelayMs (t = 2000)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.isVisible).toBe(false);

    // 3. Complete initialDelayMs (t = 3000) -> becomes visible (bottom, shift 0.25)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isVisible).toBe(true);
    expect(result.current.side).toBe('bottom');
    expect(result.current.horizontalShiftRatio).toBe(0.25);
    expect(result.current.cycleId).toBe(1);

    // 4. Stays visible halfway through visibleDurationMs (t = 3000 + 4000 = 7000)
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.isVisible).toBe(true);

    // 5. Complete visibleDurationMs (t = 3000 + 8000 = 11000) -> disappears and stays hidden
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.isVisible).toBe(false);

    // 6. Stays hidden halfway through hiddenDurationMs (t = 11000 + 2000 = 13000)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.isVisible).toBe(false);

    // 7. Complete hiddenDurationMs (t = 11000 + 4000 = 15000) -> reappears in NEW random location (top, shift 0.75)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.isVisible).toBe(true);
    expect(result.current.side).toBe('top');
    expect(result.current.horizontalShiftRatio).toBe(0.75);
    expect(result.current.cycleId).toBe(2);
  });

  it('hides ad immediately when enabled changes from true to false', () => {
    let enabled = true;
    const { result, rerender } = renderHook(() =>
      useDynamicCanvasAd({
        enabled,
        graphId: 'graph-1',
        initialDelayMs: 1000,
        visibleDurationMs: 5000,
        hiddenDurationMs: 3000,
      }),
    );

    // Appear after initial delay
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(result.current.isVisible).toBe(true);

    // User upgrades or disables ads
    enabled = false;
    rerender();
    expect(result.current.isVisible).toBe(false);

    // Does not reappear
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('resets initial delay when graphId changes', () => {
    let graphId = 'graph-1';
    const { result, rerender } = renderHook(() =>
      useDynamicCanvasAd({
        enabled: true,
        graphId,
        initialDelayMs: 2000,
        visibleDurationMs: 5000,
        hiddenDurationMs: 2000,
      }),
    );

    // Advance 1s (still hidden)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isVisible).toBe(false);

    // Change graphId
    graphId = 'graph-2';
    rerender();
    expect(result.current.isVisible).toBe(false);

    // Advance 1.5s (2.5s total, but only 1.5s after change) -> still hidden
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.isVisible).toBe(false);

    // Advance remaining 0.5s -> appears for graph-2
    act(() => {
      vi.advanceTimersByTime(501);
    });
    expect(result.current.isVisible).toBe(true);
  });
});
