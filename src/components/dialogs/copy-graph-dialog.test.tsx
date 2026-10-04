import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../i18n';
import type { Graph, LimitsSummary } from '../../types/api';
import { CopyGraphDialog } from './copy-graph-dialog';

const graph: Graph = {
  id: 'graph',
  title: 'Computer Science',
  description: 'A curriculum graph.',
  userId: 'owner',
  isPublic: true,
  isPrepared: true,
  nodes: Array.from({ length: 14 }, (_, index) => ({
    id: `node-${index}`,
    position: { x: index, y: index },
    data: { title: `Node ${index}` },
  })),
  edges: [],
  isOwned: false,
  permission: 'VIEWER',
  canEdit: false,
  accessCount: 2,
  sources: [],
};

const limits: LimitsSummary = {
  tier: 'REGISTERED',
  storage: {
    usedBytes: 10 * 1024 * 1024,
    limitBytes: 100 * 1024 * 1024,
    limitMb: 100,
    usedPercentage: 10,
    exceeded: false,
  },
  queueOccupation: 'low',
  canCreateGraphs: true,
  crawl: {
    allowedDepths: ['shallow', 'default', 'deep', 'unlimited'],
    maxStartingPoints: null,
    allowComparative: true,
  },
};

describe('CopyGraphDialog', () => {
  afterEach(cleanup);

  it('prefills default copy name and allows submitting copy', async () => {
    const onCopy = vi.fn().mockResolvedValue(true);
    const onOpenChange = vi.fn();
    render(
      <CopyGraphDialog
        graph={graph}
        limits={limits}
        open
        onOpenChange={onOpenChange}
        onCopy={onCopy}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('textbox')).toHaveValue(
        'Computer Science (Copy)',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy graph' }));
    await waitFor(() =>
      expect(onCopy).toHaveBeenCalledWith('Computer Science (Copy)', false),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('confirms an allowed copy with edited name and supports private visibility', async () => {
    const onCopy = vi.fn().mockResolvedValue(true);
    const onOpenChange = vi.fn();
    render(
      <CopyGraphDialog
        graph={graph}
        limits={limits}
        open
        onOpenChange={onOpenChange}
        onCopy={onCopy}
      />,
    );

    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'My copied graph' } });

    // Select public visibility radio
    const publicRadio = screen.getByRole('radio', { name: /Public/i });
    fireEvent.click(publicRadio);

    fireEvent.click(screen.getByRole('button', { name: 'Copy graph' }));
    await waitFor(() =>
      expect(onCopy).toHaveBeenCalledWith('My copied graph', true),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
