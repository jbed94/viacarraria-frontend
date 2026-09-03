import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LimitsSummary } from '../../types/api';
import '../../i18n';
import { Header } from './header';

const graph = {
  id: 'graph',
  title: 'Public graph',
  description: null,
  userId: 'owner',
  isPublic: true,
  isPrepared: true,
  nodes: [],
  edges: [],
  isOwned: false,
  permission: 'VIEWER' as const,
  canEdit: false,
  accessCount: 5,
  sources: [],
};

const props = {
  graphs: [graph],
  isEditing: false,
  onGraphChange: vi.fn(),
  onCopy: vi.fn(),
  onCreate: vi.fn(),
  onToggleEditing: vi.fn(),
  onOpenAuth: vi.fn(),
  onOpenProfile: vi.fn(),
  onOpenPricing: vi.fn(),
  theme: 'light' as const,
  onThemeChange: vi.fn(),
  limits: {
    tier: 'FREE' as const,
    graphs: { used: 3, limit: 3, exceeded: true },
    queries: { used: 20, limit: 20, exceeded: true },
    uploads: { used: 2, limit: 10, exceeded: false },
    selectedNodes: { used: 0, limit: 10, exceeded: false },
    nodesPerGraph: { used: 14, limit: 10, exceeded: true },
    sourcesPerNode: { used: 3, limit: 3, exceeded: true },
    sourceSizeBytes: { used: 0, limit: 2 * 1024 * 1024, exceeded: false },
    extendedContext: { used: 0, limit: 3, exceeded: false },
  } satisfies LimitsSummary,
};

describe('Header graph access controls', () => {
  afterEach(cleanup);

  it('shows view permission and access count without exposing names', () => {
    render(<Header {...props} graph={graph} />);

    expect(screen.getByLabelText('5 users with access')).toBeInTheDocument();
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy graph' }),
    ).toBeInTheDocument();
    expect(screen.queryByTitle('Edit graph')).not.toBeInTheDocument();
  });

  it('formats large access counts into tier badges', () => {
    const tieredGraph = {
      ...graph,
      accessCount: 140,
    };
    render(<Header {...props} graph={tieredGraph} />);

    expect(screen.getByLabelText('+100 users with access')).toBeInTheDocument();
    expect(screen.getByText('+100')).toBeInTheDocument();
  });

  it('shows the edit control only when the server grants edit permission', () => {
    const ownedGraph = {
      ...graph,
      isPublic: false,
      isOwned: true,
      permission: 'OWNER' as const,
      canEdit: true,
      accessCount: 1,
    };
    render(<Header {...props} graph={ownedGraph} />);

    expect(screen.getByTitle('Edit graph')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('opens the current quota context menu with separate Quotas and Plan limits sections', () => {
    render(<Header {...props} graph={graph} />);

    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));

    expect(screen.getByRole('menu', { name: 'Limits' })).toBeInTheDocument();
    expect(screen.getByText('Quotas')).toBeInTheDocument();
    expect(screen.getByText('Plan limits')).toBeInTheDocument();

    // Quotas section
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByText('20 / 20')).toBeInTheDocument();
    expect(screen.getByText('2 / 10')).toBeInTheDocument();
    expect(screen.getAllByText('At limit').length).toBeGreaterThanOrEqual(2);

    // Plan limits section
    expect(screen.getByText('Nodes per graph')).toBeInTheDocument();
    expect(screen.getByText('Sources per node')).toBeInTheDocument();
    expect(screen.getByText('Max file size')).toBeInTheDocument();
    expect(screen.getByText('2 MB')).toBeInTheDocument();
    expect(screen.getByText('Nodes per search')).toBeInTheDocument();
    expect(screen.getByText('Extended search chunks')).toBeInTheDocument();
  });

  it('displays clean anonymous quota and plan limit values without per-node usage ratios', () => {
    const anonymousProps = {
      ...props,
      limits: {
        tier: 'ANONYMOUS' as const,
        graphs: { used: 0, limit: 0, exceeded: true },
        queries: { used: 1, limit: 3, exceeded: false },
        uploads: { used: 0, limit: 0, exceeded: true },
        selectedNodes: { used: 0, limit: 2, exceeded: false },
        nodesPerGraph: { used: 0, limit: 0, exceeded: true },
        sourcesPerNode: { used: 0, limit: 0, exceeded: true },
        sourceSizeBytes: { used: 0, limit: 0, exceeded: false },
        extendedContext: { used: 0, limit: 0, exceeded: false },
      } satisfies LimitsSummary,
    };
    render(<Header {...anonymousProps} graph={graph} />);

    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // selected nodes limit
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText('0 / 0')).not.toBeInTheDocument();
  });
});
