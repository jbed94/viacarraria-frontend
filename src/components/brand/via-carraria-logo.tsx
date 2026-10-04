import React from 'react';

export interface ViaCarrariaIconProps extends React.SVGProps<SVGSVGElement> {
  /** Size in pixels (applies to width & height) */
  size?: number | string;
  /** Presentation variant: bare vector, framed squircle milestone, or badge */
  variant?: 'bare' | 'framed' | 'badge';
  /** Whether the spatial retrieval accent node (coral highlight) is active */
  showAccent?: boolean;
  /** Whether to animate on hover */
  interactive?: boolean;
  /** Whether to show active live query retrieval pulse */
  pulsing?: boolean;
  /** Accessible label */
  title?: string;
}

/**
 * Via Carraria Minimalist Vector Icon
 *
 * Geometric synthesis of:
 * 1. The initials "V" and "C" (Via Carraria monogram)
 * 2. Left-to-Right Directed Acyclic Graph (DAG) topology
 * 3. Spatial GraphRAG vector highlight node (warm terracotta/coral)
 */
export function ViaCarrariaIcon({
  size = 24,
  variant = 'bare',
  showAccent = true,
  interactive = false,
  pulsing = false,
  title = 'Via Carraria',
  className = '',
  style,
  'aria-hidden': ariaHidden,
  ...props
}: ViaCarrariaIconProps) {
  const isFramed = variant === 'framed' || variant === 'badge';
  const shouldRenderTitle = !ariaHidden && Boolean(title);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`vc-icon vc-icon-${variant} ${interactive ? 'is-interactive' : ''} ${pulsing ? 'is-pulsing' : ''} ${className}`.trim()}
      role={ariaHidden ? 'presentation' : 'img'}
      aria-hidden={ariaHidden}
      aria-label={!ariaHidden ? props['aria-label'] || title : undefined}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
      shapeRendering="geometricPrecision"
      {...props}
    >
      {shouldRenderTitle ? <title>{title}</title> : null}

      {/* Optional Framed Milestone Container */}
      {isFramed ? (
        <rect
          width="32"
          height="32"
          rx="7.5"
          className="vc-icon-container"
          fill="var(--field, #151d16)"
          stroke="var(--line, #28392a)"
          strokeWidth="1"
        />
      ) : null}

      {/* Inner ambient wash */}
      {isFramed ? (
        <circle
          cx="16.5"
          cy="16"
          r="10"
          className="vc-icon-glow"
          fill="var(--accent-wash, rgba(140, 227, 176, 0.12))"
        />
      ) : null}

      {/* Group holding the DAG lines and nodes */}
      <g className="vc-icon-mark">
        {/* V path: Left Root (7.5, 8.5) -> Pivot (13.5, 23.5) -> Nexus (19.5, 8.5) */}
        <path
          d="M 7.5 8.5 L 13.5 23.5 L 19.5 8.5"
          fill="none"
          stroke="var(--mint, #2c7950)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="vc-path-v"
        />

        {/* Directed bridge between V peak and C peak */}
        <line
          x1="19.5"
          y1="8.5"
          x2="25.5"
          y2="8.5"
          stroke="var(--mint, #2c7950)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="1 2.5"
          opacity="0.75"
          className="vc-path-bridge"
        />

        {/* C path: Classical arc sweeping from (25.5, 8.5) through (16.5, 16) to (25.5, 23.5) */}
        <path
          d="M 25.5 8.5 C 18 8.5 16.5 12 16.5 16 C 16.5 20 18 23.5 25.5 23.5"
          fill="none"
          stroke="var(--mint, #2c7950)"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="vc-path-c"
        />

        {/* Graph Vertices */}
        {/* Root Node */}
        <circle
          cx="7.5"
          cy="8.5"
          r="2"
          fill="var(--mint, #2c7950)"
          className="vc-node vc-node-root"
        />

        {/* Bottom Pivot Node */}
        <circle
          cx="13.5"
          cy="23.5"
          r="2.1"
          fill="var(--mint, #2c7950)"
          className="vc-node vc-node-pivot"
        />

        {/* Upper Nexus Node (Spatial GraphRAG Highlight) */}
        <circle
          cx="19.5"
          cy="8.5"
          r="2.3"
          fill={showAccent ? 'var(--coral, #bd503a)' : 'var(--mint, #2c7950)'}
          className="vc-node vc-node-nexus"
        />

        {/* Midpoint Junction Vertex */}
        <circle
          cx="16.5"
          cy="16"
          r="1.3"
          fill="var(--mint, #2c7950)"
          opacity="0.9"
          className="vc-node vc-node-junction"
        />

        {/* C Upper Terminal Node */}
        <circle
          cx="25.5"
          cy="8.5"
          r="1.9"
          fill="var(--mint, #2c7950)"
          className="vc-node vc-node-c1"
        />

        {/* C Lower Terminal Node */}
        <circle
          cx="25.5"
          cy="23.5"
          r="2"
          fill="var(--mint, #2c7950)"
          className="vc-node vc-node-c2"
        />
      </g>
    </svg>
  );
}

export interface ViaCarrariaLogoProps {
  /** Layout mode: full lockup, icon-only mark, or stacked lockup */
  variant?: 'full' | 'horizontal' | 'mark' | 'stacked' | 'compact';
  /** Icon size in pixels */
  size?: number;
  /** Framing style for the icon */
  iconVariant?: 'bare' | 'framed' | 'badge';
  /** Optional subtitle, e.g. 'Knowledge Platform' */
  subtitle?: string;
  /** Optional badge pill (e.g. 'ADMIN', 'BETA', 'PRO') */
  badgeText?: string;
  /** Additional wrapper CSS classes */
  className?: string;
  /** Whether the brand icon displays live query pulse */
  pulsing?: boolean;
  /** Click handler for branding */
  onClick?: () => void;
}

/**
 * Via Carraria Minimalist Brand Lockup
 */
export function ViaCarrariaLogo({
  variant = 'full',
  size = 24,
  iconVariant = 'framed',
  subtitle,
  badgeText,
  className = '',
  pulsing = false,
  onClick,
}: ViaCarrariaLogoProps) {
  if (variant === 'mark') {
    return (
      <span
        className={`vc-brand-mark-wrapper ${className}`.trim()}
        onClick={onClick}
      >
        <ViaCarrariaIcon
          size={size}
          variant={iconVariant}
          interactive
          pulsing={pulsing}
          title="Via Carraria"
        />
      </span>
    );
  }

  const isStacked = variant === 'stacked';

  return (
    <div
      className={`vc-logo vc-logo-${variant} ${onClick ? 'cursor-pointer' : ''} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <ViaCarrariaIcon
        size={size}
        variant={iconVariant}
        interactive={Boolean(onClick)}
        pulsing={pulsing}
        aria-hidden="true"
      />

      <div
        className={`vc-logo-text-group ${isStacked ? 'vc-text-stacked' : ''}`}
      >
        <div className="vc-logo-title-row">
          <span className="vc-logo-title">Via Carraria</span>
          {badgeText ? (
            <span className="vc-brand-badge">{badgeText}</span>
          ) : null}
        </div>
        {subtitle ? <span className="vc-logo-subtitle">{subtitle}</span> : null}
      </div>
    </div>
  );
}
