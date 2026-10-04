import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAdViewability } from './use-ad-viewability';

describe('useAdViewability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes and advances viewable seconds when fallback viewability is true', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      useAdViewability({
        refreshIntervalMs: 5000,
        onRefresh,
      }),
    );

    expect(result.current.isIntersecting).toBe(true);
    expect(result.current.isViewable).toBe(true);
    expect(result.current.viewableSeconds).toBe(0);

    // Advance 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.viewableSeconds).toBe(3);
    expect(onRefresh).not.toHaveBeenCalled();

    // Advance 2 more seconds -> completes 5 seconds -> triggers refresh
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.viewableSeconds).toBe(0);
    expect(result.current.refreshCount).toBe(1);
  });
});
