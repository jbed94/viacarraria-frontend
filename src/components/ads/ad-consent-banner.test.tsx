import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAdConsent, setAdConsent } from '../../lib/ad-consent';
import { useGraphStore } from '../../store/graph-store';
import { AdConsentBanner } from './ad-consent-banner';

describe('AdConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    setAdConsent('pending');
    useGraphStore.setState({
      identity: {
        userId: 'user-free',
        email: 'free@example.com',
        username: 'FreeUser',
        isGuest: false,
        tier: 'REGISTERED',
      },
    });
  });

  afterEach(cleanup);

  it('renders when consent is pending for registered users', () => {
    render(<AdConsentBanner />);

    expect(
      screen.getByText('Support Via Carraria Free Research with Ads'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('consent-accept-all')).toBeInTheDocument();
    expect(screen.getByTestId('consent-essential-only')).toBeInTheDocument();
    expect(screen.getByTestId('consent-decline')).toBeInTheDocument();
  });

  it('does not render when consent is already granted', () => {
    setAdConsent('granted');
    render(<AdConsentBanner />);
    expect(screen.queryByTestId('ad-consent-banner')).not.toBeInTheDocument();
  });

  it('sets consent to granted on clicking Accept All', () => {
    render(<AdConsentBanner />);

    const acceptBtn = screen.getByTestId('consent-accept-all');
    fireEvent.click(acceptBtn);

    expect(getAdConsent()).toBe('granted');
    expect(screen.queryByTestId('ad-consent-banner')).not.toBeInTheDocument();
  });

  it('sets consent to essential_only on clicking Contextual & Essential Only', () => {
    render(<AdConsentBanner />);

    const essentialBtn = screen.getByTestId('consent-essential-only');
    fireEvent.click(essentialBtn);

    expect(getAdConsent()).toBe('essential_only');
    expect(screen.queryByTestId('ad-consent-banner')).not.toBeInTheDocument();
  });

  it('sets consent to denied on clicking Decline', () => {
    render(<AdConsentBanner />);

    const declineBtn = screen.getByTestId('consent-decline');
    fireEvent.click(declineBtn);

    expect(getAdConsent()).toBe('denied');
    expect(screen.queryByTestId('ad-consent-banner')).not.toBeInTheDocument();
  });

  it('toggles learn more details section', () => {
    render(<AdConsentBanner />);

    expect(screen.queryByTestId('ad-consent-details')).not.toBeInTheDocument();

    const learnMoreBtn = screen.getByRole('button', { name: /Learn More/i });
    fireEvent.click(learnMoreBtn);

    expect(screen.getByTestId('ad-consent-details')).toBeInTheDocument();
    expect(
      screen.getByText(/Personalized \(Recommended\):/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hide Details/i }));
    expect(screen.queryByTestId('ad-consent-details')).not.toBeInTheDocument();
  });

  it('displays strictly necessary cookies disclosure and invokes onOpenPrivacy', () => {
    const onOpenPrivacy = vi.fn();
    render(<AdConsentBanner onOpenPrivacy={onOpenPrivacy} />);

    fireEvent.click(screen.getByRole('button', { name: /Learn More/i }));

    expect(screen.getByText(/Strictly Necessary:/i)).toBeInTheDocument();
    expect(screen.getByText(/better-auth\.session_token/i)).toBeInTheDocument();

    const policyBtn = screen.getByTestId('consent-open-policy');
    expect(policyBtn).toBeInTheDocument();
    fireEvent.click(policyBtn);
    expect(onOpenPrivacy).toHaveBeenCalledTimes(1);
  });
});
