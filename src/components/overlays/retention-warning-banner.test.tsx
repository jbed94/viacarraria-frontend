import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../lib/api';
import type { Graph } from '../../types/api';
import { RetentionWarningBanner } from './retention-warning-banner';

vi.mock('../../lib/api', () => ({
  api: {
    keepGraphActive: vi.fn(),
  },
}));

const mockGraph: Graph = {
  id: 'graph-1',
  title: 'Test Graph',
  description: 'A test graph',
  userId: 'user-1',
  isPublic: false,
  isPrepared: true,
  nodes: [],
  edges: [],
  isOwned: true,
  permission: 'OWNER',
  canEdit: true,
  accessCount: 10,
  viewerCount: 1,
  sources: [],
};

describe('RetentionWarningBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders nothing when graph has no scheduled deletion', () => {
    const { container } = render(
      <RetentionWarningBanner graph={mockGraph} onGraphUpdated={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders warning banner with days remaining and date when scheduledForDeletionAt is set', () => {
    const scheduledDate = new Date(
      Date.now() + 5 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const scheduledGraph: Graph = {
      ...mockGraph,
      scheduledForDeletionAt: scheduledDate,
    };

    render(
      <RetentionWarningBanner
        graph={scheduledGraph}
        onGraphUpdated={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Inactivity Warning:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Scheduled for deletion in 5 days/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Keep Graph Active/i }),
    ).toBeInTheDocument();
  });

  it('invokes api.keepGraphActive and calls onGraphUpdated when Keep Graph Active is clicked', async () => {
    const scheduledDate = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const scheduledGraph: Graph = {
      ...mockGraph,
      scheduledForDeletionAt: scheduledDate,
    };

    const updatedGraph: Graph = {
      ...scheduledGraph,
      scheduledForDeletionAt: undefined,
    };

    vi.mocked(api.keepGraphActive).mockResolvedValue(updatedGraph);
    const onGraphUpdated = vi.fn();

    render(
      <RetentionWarningBanner
        graph={scheduledGraph}
        onGraphUpdated={onGraphUpdated}
      />,
    );

    const button = screen.getByRole('button', { name: /Keep Graph Active/i });
    fireEvent.click(button);

    expect(api.keepGraphActive).toHaveBeenCalledWith('graph-1');
    await waitFor(() => {
      expect(onGraphUpdated).toHaveBeenCalledWith(updatedGraph);
    });
  });

  it('calls onOpenSettings when Preserve button is clicked', () => {
    const scheduledDate = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const scheduledGraph: Graph = {
      ...mockGraph,
      scheduledForDeletionAt: scheduledDate,
    };

    const onOpenSettings = vi.fn();

    render(
      <RetentionWarningBanner
        graph={scheduledGraph}
        onGraphUpdated={vi.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );

    const preserveBtn = screen.getByRole('button', { name: /Preserve/i });
    fireEvent.click(preserveBtn);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('displays inline error when api.keepGraphActive fails', async () => {
    const scheduledDate = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const scheduledGraph: Graph = {
      ...mockGraph,
      scheduledForDeletionAt: scheduledDate,
    };

    vi.mocked(api.keepGraphActive).mockRejectedValue(
      new Error('Network connection lost'),
    );

    render(
      <RetentionWarningBanner
        graph={scheduledGraph}
        onGraphUpdated={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: /Keep Graph Active/i });
    fireEvent.click(button);

    expect(
      await screen.findByText(/Network connection lost/i),
    ).toBeInTheDocument();
  });
});
