import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CircularProgress } from './circular-progress';

describe('CircularProgress', () => {
  afterEach(cleanup);

  it('renders with progressbar role and default aria-label', () => {
    render(<CircularProgress />);

    const progressbar = screen.getByRole('progressbar', { name: 'Loading' });
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-busy', 'true');
  });

  it('renders custom size, aria-label, and class name', () => {
    const { container } = render(
      <CircularProgress
        size={24}
        strokeWidth={3}
        className="custom-spinner"
        aria-label="Searching database"
      />,
    );

    const progressbar = screen.getByRole('progressbar', {
      name: 'Searching database',
    });
    expect(progressbar).toHaveClass('custom-spinner');
    expect(progressbar).toHaveStyle({ width: '24px', height: '24px' });

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');

    const track = container.querySelector('.circular-progress-track');
    const indicator = container.querySelector('.circular-progress-indicator');
    expect(track).toBeInTheDocument();
    expect(indicator).toBeInTheDocument();
  });

  it('renders determinate progress with accurate aria attributes and strokeDashoffset', () => {
    const { container, rerender } = render(
      <CircularProgress value={50} aria-label="Upload progress" />,
    );

    const progressbar = screen.getByRole('progressbar', {
      name: 'Upload progress',
    });
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    expect(progressbar).toHaveAttribute('aria-busy', 'true');

    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('circular-progress-determinate');

    const indicator = container.querySelector('.circular-progress-indicator');
    const offset50 = Number(indicator?.getAttribute('stroke-dashoffset'));
    expect(offset50).toBeGreaterThan(0);

    rerender(<CircularProgress value={100} aria-label="Upload progress" />);
    const completedBar = screen.getByRole('progressbar', {
      name: 'Upload progress',
    });
    expect(completedBar).toHaveAttribute('aria-busy', 'false');
    expect(completedBar).toHaveAttribute('aria-valuenow', '100');

    const indicator100 = container.querySelector(
      '.circular-progress-indicator',
    );
    const offset100 = Number(indicator100?.getAttribute('stroke-dashoffset'));
    expect(offset100).toBe(0);
  });
});
