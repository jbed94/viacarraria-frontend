import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViaCarrariaIcon, ViaCarrariaLogo } from './via-carraria-logo';

describe('ViaCarrariaIcon & ViaCarrariaLogo', () => {
  afterEach(cleanup);

  it('renders ViaCarrariaIcon with role="img" and accessible title', () => {
    render(<ViaCarrariaIcon title="Via Carraria Brand" />);
    const icon = screen.getByRole('img', { name: 'Via Carraria Brand' });
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('viewBox', '0 0 32 32');
  });

  it('applies custom dimensions to the icon', () => {
    render(<ViaCarrariaIcon size={48} aria-label="Large Icon" />);
    const icon = screen.getByRole('img', { name: 'Large Icon' });
    expect(icon).toHaveAttribute('width', '48');
    expect(icon).toHaveAttribute('height', '48');
  });

  it('renders squircle frame when variant="framed"', () => {
    const { container } = render(<ViaCarrariaIcon variant="framed" />);
    const frameRect = container.querySelector('.vc-icon-container');
    expect(frameRect).toBeInTheDocument();
    expect(frameRect).toHaveAttribute('rx', '7.5');
  });

  it('does not render squircle frame when variant="bare"', () => {
    const { container } = render(<ViaCarrariaIcon variant="bare" />);
    const frameRect = container.querySelector('.vc-icon-container');
    expect(frameRect).not.toBeInTheDocument();
  });

  it('toggles accent node fill depending on showAccent prop', () => {
    const { container: c1 } = render(<ViaCarrariaIcon showAccent={true} />);
    const nexusAccent = c1.querySelector('.vc-node-nexus');
    expect(nexusAccent).toHaveAttribute('fill', 'var(--coral, #bd503a)');

    const { container: c2 } = render(<ViaCarrariaIcon showAccent={false} />);
    const nexusPlain = c2.querySelector('.vc-node-nexus');
    expect(nexusPlain).toHaveAttribute('fill', 'var(--mint, #2c7950)');
  });

  it('renders ViaCarrariaLogo full lockup with title and subtitle', () => {
    const { container } = render(
      <ViaCarrariaLogo
        variant="full"
        subtitle="Knowledge Platform"
        badgeText="PRO"
      />,
    );

    expect(screen.getByText('Via Carraria')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Platform')).toBeInTheDocument();
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('fires onClick callback when logo is clicked', () => {
    const handleClick = vi.fn();
    render(<ViaCarrariaLogo onClick={handleClick} />);

    const logo = screen.getByRole('button');
    fireEvent.click(logo);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders mark variant with only the brand mark icon', () => {
    const { container } = render(<ViaCarrariaLogo variant="mark" size={32} />);
    expect(container.querySelector('.vc-logo-title')).not.toBeInTheDocument();
    expect(
      container.querySelector('.vc-brand-mark-wrapper'),
    ).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('applies is-pulsing class when pulsing={true}', () => {
    const { container } = render(<ViaCarrariaIcon pulsing={true} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('is-pulsing');
  });

  it('renders mark variant with pulsing motion when pulsing is true', () => {
    const { container } = render(
      <ViaCarrariaLogo variant="mark" pulsing={true} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('is-pulsing');
  });
});
