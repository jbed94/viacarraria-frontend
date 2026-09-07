import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, api } from '../../lib/api';
import type { Identity } from '../../types/api';
import { AuthDialog } from './auth-dialog';

vi.mock('../../lib/api', () => ({
  ApiError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
  api: {
    login: vi.fn(),
    register: vi.fn(),
    googleSignIn: vi.fn(),
  },
}));

const mockIdentity: Identity = {
  userId: 'user-123',
  email: 'test@example.com',
  username: 'Marie Curie',
  isGuest: false,
  tier: 'FREE',
};

describe('AuthDialog', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders signup form by default with all inputs and tabs', () => {
    render(
      <AuthDialog
        open={true}
        onOpenChange={vi.fn()}
        onAuthenticated={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /get started free/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it('switches between register and login modes', () => {
    render(
      <AuthDialog
        open={true}
        onOpenChange={vi.fn()}
        onAuthenticated={vi.fn()}
      />,
    );

    // Default is Sign up
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();

    // Click Log in tab
    fireEvent.click(screen.getByRole('tab', { name: /log in/i }));

    // Name field should be hidden in login mode
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /log in to workspace/i }),
    ).toBeInTheDocument();

    // Click back to Sign up tab
    fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    render(
      <AuthDialog
        open={true}
        onOpenChange={vi.fn()}
        onAuthenticated={vi.fn()}
      />,
    );

    const passwordInput = screen.getByLabelText(
      /^password$/i,
    ) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleBtn = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(passwordInput.type).toBe('password');
  });

  it('submits login successfully and calls callbacks', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({
      identity: mockIdentity,
      token: 'fake-token',
    });
    const onAuthenticated = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <AuthDialog
        open={true}
        onOpenChange={onOpenChange}
        onAuthenticated={onAuthenticated}
      />,
    );

    // Switch to login
    fireEvent.click(screen.getByRole('tab', { name: /log in/i }));

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'marie@curie.org' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'secretpass123' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /log in to workspace/i }),
    );

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith(
        'marie@curie.org',
        'secretpass123',
      );
      expect(onAuthenticated).toHaveBeenCalledWith(mockIdentity);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('submits registration successfully', async () => {
    vi.mocked(api.register).mockResolvedValueOnce({
      identity: mockIdentity,
      token: 'fake-token',
    });
    const onAuthenticated = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <AuthDialog
        open={true}
        onOpenChange={onOpenChange}
        onAuthenticated={onAuthenticated}
      />,
    );

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Marie Curie' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'marie@curie.org' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'secretpass123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /get started free/i }));

    await waitFor(() => {
      expect(api.register).toHaveBeenCalledWith(
        'marie@curie.org',
        'secretpass123',
        'Marie Curie',
      );
      expect(onAuthenticated).toHaveBeenCalledWith(mockIdentity);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('displays error banner when authentication fails', async () => {
    vi.mocked(api.login).mockRejectedValueOnce(
      new ApiError('Invalid email or password.', 401),
    );

    render(
      <AuthDialog
        open={true}
        onOpenChange={vi.fn()}
        onAuthenticated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /log in/i }));

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'wrong@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'wrongpass123' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /log in to workspace/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Invalid email or password.'),
      ).toBeInTheDocument();
    });
  });

  it('triggers Google sign in when clicked', async () => {
    vi.mocked(api.googleSignIn).mockResolvedValueOnce(undefined);

    render(
      <AuthDialog
        open={true}
        onOpenChange={vi.fn()}
        onAuthenticated={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(api.googleSignIn).toHaveBeenCalled();
    });
  });
});
