import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GoogleAdCard } from './google-ad-card';

describe('GoogleAdCard', () => {
  afterEach(cleanup);

  it('renders with complementary role and sponsored label adhering to AdSense policy', () => {
    render(<GoogleAdCard slotId="test-slot-1" />);

    const card = screen.getByTestId('google-ad-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('role', 'complementary');
    expect(card).toHaveAttribute('aria-label', 'Sponsored Advertisement');

    expect(screen.getByText('Ad')).toBeInTheDocument();
    expect(screen.getByText('AdChoices')).toBeInTheDocument();
  });

  it('supports vertical, horizontal, and rectangle formats', () => {
    const { rerender } = render(
      <GoogleAdCard format="horizontal" slotId="test-horizontal" />,
    );
    let card = screen.getByTestId('google-ad-card');
    expect(card).toHaveClass('format-horizontal');

    rerender(<GoogleAdCard format="vertical" slotId="test-vertical" />);
    card = screen.getByTestId('google-ad-card');
    expect(card).toHaveClass('format-vertical');

    rerender(<GoogleAdCard format="rectangle" slotId="test-rectangle" />);
    card = screen.getByTestId('google-ad-card');
    expect(card).toHaveClass('format-rectangle');
  });

  it('renders custom sponsor and headline test overrides', () => {
    render(
      <GoogleAdCard
        testSponsor="CustomSponsor"
        testHeadline="Custom Great Headline"
        testDescription="Custom Description Body"
      />,
    );

    expect(screen.getByText('CustomSponsor')).toBeInTheDocument();
    expect(screen.getByText('Custom Great Headline')).toBeInTheDocument();
    expect(screen.getByText('Custom Description Body')).toBeInTheDocument();
  });

  it('renders culled placeholder when isCulled is true to save GPU memory', () => {
    render(<GoogleAdCard isCulled={true} />);

    expect(screen.getByTestId('google-ad-card-culled')).toBeInTheDocument();
    expect(screen.getByText('Ad (Paused)')).toBeInTheDocument();
    expect(screen.queryByText('AdChoices')).not.toBeInTheDocument();
  });

  it('renders contextual topic badges when contextTags are provided', () => {
    const contextTags = [
      { id: '1', name: 'Artificial Intelligence', slug: 'ai-machine-learning' },
      { id: '2', name: 'Cloud Computing', slug: 'cloud-devops' },
    ];
    render(
      <GoogleAdCard slotId="test-slot-context" contextTags={contextTags} />,
    );

    expect(screen.getByTestId('ad-context-tags')).toBeInTheDocument();
    expect(screen.getByText('#Artificial Intelligence')).toBeInTheDocument();
    expect(screen.getByText('#Cloud Computing')).toBeInTheDocument();
  });
});
