import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../lib/api';
import type { PublicGraphItem } from '../../types/api';
import { GraphBrowserDialog } from './graph-browser-dialog';

vi.mock('../../lib/api', () => ({
  api: {
    publicGraphs: vi.fn(),
    attachGraph: vi.fn(),
    detachGraph: vi.fn(),
  },
}));

const mockPublicGraphs: PublicGraphItem[] = [
  {
    id: 'g-1',
    title: 'Computer Science',
    description: 'Algorithms and Data Structures',
    userId: 'u-1',
    ownerName: 'Ada Lovelace',
    isPublic: true,
    isPrepared: false,
    isOwned: false,
    isAttached: false,
    canQuery: false,
    viewerCount: 12,
    nodeCount: 15,
    sourceCount: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'g-2',
    title: 'Cellular Biology',
    description: 'Membrane Transport',
    userId: 'user-me',
    ownerName: 'Current User',
    isPublic: true,
    isPrepared: false,
    isOwned: true,
    isAttached: false,
    canQuery: true,
    viewerCount: 5,
    nodeCount: 8,
    sourceCount: 2,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  },
];

describe('GraphBrowserDialog', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(api.publicGraphs).mockResolvedValue(mockPublicGraphs);
  });

  it('renders public graphs list with metrics and owner', async () => {
    render(
      <GraphBrowserDialog
        open={true}
        onOpenChange={vi.fn()}
        identity={{
          userId: 'user-me',
          email: 'me@test.com',
          username: 'Current User',
          isGuest: false,
          tier: 'FREE',
        }}
        onSelectGraph={vi.fn()}
        onCopyGraph={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Computer Science')).toBeInTheDocument();
      expect(screen.getByText('Cellular Biology')).toBeInTheDocument();
    });

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Yours')).toBeInTheDocument();
  });

  it('filters graphs by query', async () => {
    render(
      <GraphBrowserDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectGraph={vi.fn()}
        onCopyGraph={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(/Filter public graphs/i);
    fireEvent.change(input, { target: { value: 'Biology' } });

    await waitFor(() => {
      expect(api.publicGraphs).toHaveBeenCalledWith('Biology');
    });
  });

  it('attaches to an unattached public graph', async () => {
    vi.mocked(api.attachGraph).mockResolvedValue({} as any);
    const onAttachChange = vi.fn();

    render(
      <GraphBrowserDialog
        open={true}
        onOpenChange={vi.fn()}
        identity={{
          userId: 'user-me',
          email: 'me@test.com',
          username: 'Current User',
          isGuest: false,
          tier: 'FREE',
        }}
        onSelectGraph={vi.fn()}
        onCopyGraph={vi.fn()}
        onAttachChange={onAttachChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Computer Science')).toBeInTheDocument();
    });

    const attachBtn = screen.getByRole('button', { name: /Attach/i });
    fireEvent.click(attachBtn);

    await waitFor(() => {
      expect(api.attachGraph).toHaveBeenCalledWith('g-1');
      expect(onAttachChange).toHaveBeenCalled();
    });
  });
});
