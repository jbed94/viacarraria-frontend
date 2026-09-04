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
  tier: 'FREE',
  graphs: { used: 2, limit: 3, exceeded: false },
  privateGraphs: { used: 0, limit: 2, exceeded: false },
  queries: { used: 4, limit: 20, exceeded: false },
  uploads: { used: 1, limit: 10, exceeded: false },
  selectedNodes: { used: 0, limit: 10, exceeded: false },
  nodesPerGraph: { used: 0, limit: 10, exceeded: false },
  sourcesPerNode: { used: 0, limit: 3, exceeded: false },
  sourceSizeBytes: { used: 0, limit: 2 * 1024 * 1024, exceeded: false },
  extendedContext: { used: 0, limit: 3, exceeded: false },
};

describe('CopyGraphDialog', () => {
  afterEach(cleanup);

  it('shows the current graph and node limits before confirming an oversized copy', async () => {
    const onCopy = vi.fn().mockResolvedValue(true);
    const onOpenPricing = vi.fn();
    render(
      <CopyGraphDialog
        graph={graph}
        limits={limits}
        open
        onOpenChange={vi.fn()}
        onCopy={onCopy}
        onOpenPricing={onOpenPricing}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('textbox')).toHaveValue(
        'Computer Science (Copy)',
      ),
    );
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(
      screen.getByText(/14 nodes, but your plan allows only 10/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade plan' }));
    expect(onOpenPricing).toHaveBeenCalledOnce();
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('confirms an allowed copy with the edited name and supports cancel', async () => {
    const allowedLimits = {
      ...limits,
      nodesPerGraph: { used: 0, limit: 10, exceeded: false },
    };
    const allowedGraph = {
      ...graph,
      nodes: graph.nodes.slice(0, 2),
    };
    const onCopy = vi.fn().mockResolvedValue(true);
    const onOpenChange = vi.fn();
    render(
      <CopyGraphDialog
        graph={allowedGraph}
        limits={allowedLimits}
        open
        onOpenChange={onOpenChange}
        onCopy={onCopy}
        onOpenPricing={vi.fn()}
      />,
    );

    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'My copied graph' } });
    fireEvent.click(screen.getByRole('button', { name: 'Copy graph' }));
    await waitFor(() =>
      expect(onCopy).toHaveBeenCalledWith('My copied graph', false),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
