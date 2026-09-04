import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LineSlicer } from './line-slicer';

describe('LineSlicer', () => {
  afterEach(cleanup);

  const options = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  it('renders all options and tracks radiogroup role', () => {
    render(
      <LineSlicer
        label="Sensitivity"
        value="medium"
        options={options}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('radiogroup', { name: 'Sensitivity' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Low' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'High' })).toBeInTheDocument();
  });

  it('sets aria-checked on active option and computes correct track fill percentage', () => {
    const { container, rerender } = render(
      <LineSlicer
        label="Sensitivity"
        value="low"
        options={options}
        onChange={vi.fn()}
      />,
    );

    const lowRadio = screen.getByRole('radio', { name: 'Low' });
    const medRadio = screen.getByRole('radio', { name: 'Medium' });
    const highRadio = screen.getByRole('radio', { name: 'High' });

    expect(lowRadio).toHaveAttribute('aria-checked', 'true');
    expect(medRadio).toHaveAttribute('aria-checked', 'false');

    const fill = container.querySelector(
      '.line-slicer-track-fill',
    ) as HTMLElement;
    expect(fill.style.width).toBe('0%');

    // Re-render with medium
    rerender(
      <LineSlicer
        label="Sensitivity"
        value="medium"
        options={options}
        onChange={vi.fn()}
      />,
    );
    expect(medRadio).toHaveAttribute('aria-checked', 'true');
    expect(fill.style.width).toBe('50%');

    // Re-render with high
    rerender(
      <LineSlicer
        label="Sensitivity"
        value="high"
        options={options}
        onChange={vi.fn()}
      />,
    );
    expect(highRadio).toHaveAttribute('aria-checked', 'true');
    expect(fill.style.width).toBe('100%');
  });

  it('calls onChange with selected value on click', () => {
    const onChange = vi.fn();
    render(
      <LineSlicer
        label="Sensitivity"
        value="low"
        options={options}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'High' }));
    expect(onChange).toHaveBeenCalledWith('high');

    fireEvent.click(screen.getByRole('radio', { name: 'Medium' }));
    expect(onChange).toHaveBeenCalledWith('medium');
  });
});
