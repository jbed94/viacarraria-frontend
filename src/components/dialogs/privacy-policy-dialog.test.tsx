import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getAdConsent,
  getAdConsentRecord,
  setAdConsent,
} from '../../lib/ad-consent';
import { PrivacyPolicyDialog } from './privacy-policy-dialog';

describe('PrivacyPolicyDialog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders privacy dialog with tabs and overview content', () => {
    render(<PrivacyPolicyDialog open={true} onOpenChange={() => {}} />);

    expect(
      screen.getByRole('heading', { name: 'Privacy & Cookie Policy' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('privacy-tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('privacy-tab-cookies')).toBeInTheDocument();
    expect(screen.getByTestId('privacy-tab-preferences')).toBeInTheDocument();

    expect(
      screen.getByText(/Your Privacy & Data Ownership/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Download Your Data:/i)).toBeInTheDocument();
    expect(screen.getByText(/Delete Anything Anytime:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Safe Contextual Ad Matching & Taxonomy/i),
    ).toBeInTheDocument();
  });

  it('switches to cookies guide tab and displays session cookie breakdown', () => {
    render(<PrivacyPolicyDialog open={true} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByTestId('privacy-tab-cookies'));

    expect(screen.getByText('Strictly Necessary')).toBeInTheDocument();
    expect(screen.getByText('better-auth.session_token')).toBeInTheDocument();
    expect(screen.getByText('Sign-In Token')).toBeInTheDocument();
    expect(screen.getByText('Privacy Memory')).toBeInTheDocument();
    expect(screen.getByText('Advertising & Measurement')).toBeInTheDocument();
    expect(screen.getByText(/Google AdSense/i)).toBeInTheDocument();
  });

  it('switches to preferences tab and allows updating consent to contextual only', () => {
    render(<PrivacyPolicyDialog open={true} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByTestId('privacy-tab-preferences'));

    expect(screen.getByTestId('current-consent-status')).toHaveTextContent(
      /Pending/i,
    );

    fireEvent.click(screen.getByTestId('pref-opt-essential'));

    expect(getAdConsent()).toBe('essential_only');
    expect(getAdConsentRecord()?.status).toBe('essential_only');
    expect(screen.getByTestId('current-consent-status')).toHaveTextContent(
      /Contextual & Essential Only/i,
    );
    expect(
      screen.getByText(
        /Preferences updated: Contextual & Essential Only Selected/i,
      ),
    ).toBeInTheDocument();
  });

  it('allows updating consent to granted (personalized) and denied (decline)', () => {
    render(<PrivacyPolicyDialog open={true} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByTestId('privacy-tab-preferences'));

    fireEvent.click(screen.getByTestId('pref-opt-granted'));
    expect(getAdConsent()).toBe('granted');
    expect(screen.getByTestId('current-consent-status')).toHaveTextContent(
      /Personalized/i,
    );

    fireEvent.click(screen.getByTestId('pref-opt-denied'));
    expect(getAdConsent()).toBe('denied');
    expect(screen.getByTestId('current-consent-status')).toHaveTextContent(
      /Declined/i,
    );
  });

  it('allows resetting consent choices to pending', () => {
    setAdConsent('granted');

    render(<PrivacyPolicyDialog open={true} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByTestId('privacy-tab-preferences'));
    expect(screen.getByTestId('current-consent-status')).toHaveTextContent(
      /Personalized/i,
    );

    fireEvent.click(screen.getByTestId('pref-opt-reset'));

    expect(getAdConsent()).toBe('pending');
    expect(getAdConsentRecord()).toBeNull();
    expect(screen.getByTestId('current-consent-status')).toHaveTextContent(
      /Pending/i,
    );
  });
});
