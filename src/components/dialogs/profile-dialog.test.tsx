import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../lib/api';
import type { Identity } from '../../types/api';
import { ProfileDialog } from './profile-dialog';

describe('ProfileDialog', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const identity: Identity = {
    userId: 'user-1',
    username: 'Alice',
    email: 'alice@example.com',
    tier: 'PRO',
    isGuest: false,
    role: 'admin',
  };

  it('renders profile dialog and does not display an Administration Portal button', async () => {
    vi.spyOn(api, 'profile').mockResolvedValue({
      ...identity,
      preferredLanguage: 'en',
    });
    vi.spyOn(api, 'sessions').mockResolvedValue([]);

    const onOpenRetention = vi.fn();
    const onLogout = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ProfileDialog
        identity={identity}
        open={true}
        onOpenChange={onOpenChange}
        onIdentityChange={vi.fn()}
        onLogout={onLogout}
        onOpenRetention={onOpenRetention}
      />,
    );

    expect(screen.getByText('Your account')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('PRO')).toBeInTheDocument();

    // Verify Retention & Archives is present
    expect(
      screen.getByRole('button', { name: /Retention & Archives/i }),
    ).toBeInTheDocument();

    // Verify Administration Portal button is NOT present
    expect(
      screen.queryByRole('button', { name: /Administration Portal/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin/i)).not.toBeInTheDocument();
  });
});
