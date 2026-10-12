import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGraphStore } from '../../store/graph-store';
import { NodeDetailModal } from './node-detail-modal';

describe('NodeDetailModal', () => {
  const sampleGraph = {
    id: 'graph-1',
    title: 'Distributed Systems',
    nodes: [
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        data: {
          title: 'Consensus Protocols',
          description:
            'Paxos, Raft, and Byzantine Fault Tolerance fundamentals.',
        },
      },
      {
        id: 'node-2',
        position: { x: 100, y: 100 },
        data: {
          title: 'Vector Clocks',
          description: 'Causality tracking in distributed state.',
        },
      },
    ],
    edges: [],
    sources: [
      {
        id: 'source-1',
        nodeId: 'node-1',
        name: 'raft-paper.pdf',
        fileType: 'application/pdf',
        status: 'READY',
      },
      {
        id: 'source-2',
        nodeId: 'node-1',
        name: 'notes.md',
        fileType: 'text/markdown',
        status: 'READY',
      },
    ],
  };

  beforeEach(() => {
    useGraphStore.getState().setGraph(sampleGraph as any);
    useGraphStore.getState().setMaximizedNodeId(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when maximizedNodeId is not set', () => {
    const { container } = render(<NodeDetailModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders topic details, description, sources, and action button when maximized', () => {
    useGraphStore.getState().setMaximizedNodeId('node-1');
    render(<NodeDetailModal />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Consensus Protocols')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Paxos, Raft, and Byzantine Fault Tolerance fundamentals.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('raft-paper.pdf')).toBeInTheDocument();
    expect(screen.getByText('notes.md')).toBeInTheDocument();
    expect(screen.getByText('Included in Search')).toBeInTheDocument();
  });

  it('allows toggling topic selection in search mode', () => {
    useGraphStore.getState().setMaximizedNodeId('node-1');
    useGraphStore.getState().setSelectedNodeIds([]);
    render(<NodeDetailModal />);

    const includeBtn = screen.getByRole('button', {
      name: 'Include in Search',
    });
    fireEvent.click(includeBtn);

    expect(useGraphStore.getState().selectedNodeIds).toContain('node-1');
  });

  it('allows toggling seed node in crawl mode', () => {
    useGraphStore.getState().setQueryType('crawl');
    useGraphStore.getState().setMaximizedNodeId('node-1');
    useGraphStore.getState().setCrawlStartingNodeIds([]);
    render(<NodeDetailModal />);

    const seedBtn = screen.getByRole('button', { name: 'Set as Seed' });
    fireEvent.click(seedBtn);

    expect(useGraphStore.getState().crawlStartingNodeIds).toContain('node-1');
  });

  it('closes dialog when close button is clicked', () => {
    useGraphStore.getState().setMaximizedNodeId('node-1');
    render(<NodeDetailModal />);

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    fireEvent.click(closeBtn);

    expect(useGraphStore.getState().maximizedNodeId).toBeUndefined();
  });
});
