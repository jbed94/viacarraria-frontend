import type { CSSProperties } from 'react';

export type CircularProgressProps = {
  /** Size in pixels (width and height). Default is 16. */
  size?: number;
  /** Stroke width of the circle arcs. Default is 2.5. */
  strokeWidth?: number;
  /** Value between 0 and 100 for determinate progress. If undefined, shows indeterminate spinner. */
  value?: number;
  /** Additional CSS class names. */
  className?: string;
  /** Optional inline styles. */
  style?: CSSProperties;
  /** Accessible label for screen readers. Defaults to 'Loading'. */
  'aria-label'?: string;
};

/**
 * A sleek, modern circular progress bar indicator.
 * Displays a background track ring and a foreground progress arc (indeterminate or determinate).
 */
export function CircularProgress({
  size = 16,
  strokeWidth = 2.5,
  value,
  className = '',
  style,
  'aria-label': ariaLabel = 'Loading',
}: CircularProgressProps) {
  const isDeterminate = typeof value === 'number';
  const clampedValue = isDeterminate
    ? Math.min(100, Math.max(0, Math.round(value)))
    : 0;

  const viewBoxSize = 24;
  const radius = (viewBoxSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = viewBoxSize / 2;

  const strokeDashoffset = isDeterminate
    ? circumference * (1 - clampedValue / 100)
    : circumference * 0.25;

  return (
    <span
      role="progressbar"
      aria-label={ariaLabel}
      aria-busy={!isDeterminate || clampedValue < 100}
      aria-valuenow={isDeterminate ? clampedValue : undefined}
      aria-valuemin={isDeterminate ? 0 : undefined}
      aria-valuemax={isDeterminate ? 100 : undefined}
      className={`circular-progress-wrapper ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        ...style,
      }}
    >
      <svg
        className={`circular-progress ${isDeterminate ? 'circular-progress-determinate' : ''}`.trim()}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        width={size}
        height={size}
        aria-hidden="true"
      >
        <circle
          className="circular-progress-track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        <circle
          className="circular-progress-indicator"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
