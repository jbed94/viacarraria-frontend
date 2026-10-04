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
  tier: 'REGISTERED' as const,
  storage: {
    usedBytes: 10 * 1024 * 1024,
    limitBytes: 100 * 1024 * 1024,
    limitMb: 100,
    usedPercentage: 10,
    exceeded: false,
  },
  queueOccupation: 'low' as const,
  canCreateGraphs: true,
  crawl: {
    allowedDepths: ['shallow', 'default', 'deep', 'unlimited'],
    maxStartingPoints: null,
    allowComparative: true,
  },
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
      />,
    );

    const titleInput = screen.getByDisplayValue('My Architecture');
    fireEvent.change(titleInput, { target: { value: 'Updated Architecture' } });

    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(onSave).toHaveBeenCalledWith({
      title: 'Updated Architecture',
      description: 'System components',
      isPublic: true,
      isExemptFromRetention: false,
    });
  });

  it('allows toggling retention exemption directly and submits setting', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <GraphSettingsDialog
        graph={mockGraph}
        limits={mockLimits}
        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );

    const checkbox = screen.getByRole('checkbox', {
      name: /Preserve graph indefinitely/i,
    });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(onSave).toHaveBeenCalledWith({
      title: 'My Architecture',
      description: 'System components',
      isPublic: true,
      isExemptFromRetention: true,
    });
  });
});
