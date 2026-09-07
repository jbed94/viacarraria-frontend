import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../lib/api';
import { MaintenanceOverlay } from './maintenance-overlay';

describe('MaintenanceOverlay', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders maintenance overlay with title and custom message without admin button', () => {
    render(
      <MaintenanceOverlay message="Emergency database migration in progress." />,
    );

    expect(
      screen.getByText('Scheduled Maintenance in Progress'),
    ).toBeInTheDocument();
    expect(screen.getByText('System Maintenance Active')).toBeInTheDocument();
    expect(
      screen.getByText('Emergency database migration in progress.'),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('link', { name: /Admin Portal/i }),
    ).not.toBeInTheDocument();
  });

  it('checks status on click and informs user if maintenance is still active', async () => {
    vi.spyOn(api.system, 'checkStatus').mockResolvedValue({
      status: 'ok',
      maintenanceMode: true,
    });

    render(<MaintenanceOverlay />);

    const retryBtn = screen.getByRole('button', {
      name: /Check Status \/ Retry/i,
    });
    fireEvent.click(retryBtn);

    expect(screen.getByText('Checking System...')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(
          'Maintenance is still in progress. Please check back shortly.',
        ),
      ).toBeInTheDocument();
    });
    expect(api.system.checkStatus).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when status check reveals maintenance has completed', async () => {
    vi.spyOn(api.system, 'checkStatus').mockResolvedValue({
      status: 'ok',
      maintenanceMode: false,
    });
    const onDismiss = vi.fn();

    render(<MaintenanceOverlay onDismiss={onDismiss} />);

    const retryBtn = screen.getByRole('button', {
      name: /Check Status \/ Retry/i,
    });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Maintenance concluded! Restoring access...'),
      ).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(onDismiss).toHaveBeenCalledTimes(1);
      },
      { timeout: 1500 },
    );
  });
});
