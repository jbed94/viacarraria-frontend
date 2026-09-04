import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphSettingsDialog } from './graph-settings-dialog';

const mockGraph = {
  id: 'graph-1',
  title: 'My Architecture',
  description: 'System components',
  userId: 'user-1',
  isPublic: true,
  isPrepared: false,
  nodes: [],
  edges: [],
  isOwned: true,
  permission: 'OWNER' as const,
  canEdit: true,
  accessCount: 4,
  viewerCount: 4,
  sources: [],
};

const mockLimits = {
  tier: 'FREE' as const,
  graphs: { used: 1, limit: 5, exceeded: false },
  privateGraphs: { used: 1, limit: 2, exceeded: false },
  queries: { used: 0, limit: 20, exceeded: false },
  uploads: { used: 0, limit: 10, exceeded: false },
  selectedNodes: { used: 0, limit: 10, exceeded: false },
  nodesPerGraph: { used: 0, limit: 10, exceeded: false },
  sourcesPerNode: { used: 0, limit: 3, exceeded: false },
  sourceSizeBytes: { used: 0, limit: 2097152, exceeded: false },
  extendedContext: { used: 0, limit: 3, exceeded: false },
};

describe('GraphSettingsDialog', () => {
  afterEach(cleanup);

  it('renders graph title, description, and visibility radio', () => {
    render(
      <GraphSettingsDialog
        graph={mockGraph}
        limits={mockLimits}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onOpenPricing={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('My Architecture')).toBeInTheDocument();
    expect(screen.getByDisplayValue('System components')).toBeInTheDocument();
  });

  it('shows warning when changing from public to private with viewers', () => {
    render(
      <GraphSettingsDialog
        graph={mockGraph}
        limits={mockLimits}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onOpenPricing={vi.fn()}
      />,
    );

    const privateRadio = screen.getByLabelText(/Private/i);
    fireEvent.click(privateRadio);

    expect(
      screen.getByText(/immediately disconnect all 4 attached viewers/i),
    ).toBeInTheDocument();
  });

  it('submits updated settings', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <GraphSettingsDialog
        graph={mockGraph}
        limits={mockLimits}
        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onOpenPricing={vi.fn()}
      />,
    );

    const titleInput = screen.getByDisplayValue('My Architecture');
    fireEvent.change(titleInput, { target: { value: 'Updated Architecture' } });

    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(onSave).toHaveBeenCalledWith({
      title: 'Updated Architecture',
      description: 'System components',
      isPublic: true,
    });
  });
});
