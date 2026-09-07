import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { QueryHistory } from '../../types/api';
import { HistoryDrawer } from './history-drawer';

const mockEntries: QueryHistory[] = [
  {
    id: 'query-1',
    graphId: 'graph-1',
    queryText: 'how does replication work',
    selectedNodeIds: ['node-1'],
    results: null,
    title: null,
    isPinned: false,
    createdAt: new Date('2026-09-01T12:00:00Z').toISOString(),
  },
  {
    id: 'query-2',
    graphId: 'graph-1',
    queryText: 'what is ac id',
    title: 'ACID Properties Overview',
    selectedNodeIds: ['node-2'],
    results: null,
    isPinned: true,
    createdAt: new Date('2026-09-02T12:00:00Z').toISOString(),
  },
];

describe('HistoryDrawer', () => {
  afterEach(cleanup);

  it('renders empty state when there are no entries', () => {
    render(
      <HistoryDrawer
        entries={[]}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Your searches will collect here.'),
    ).toBeInTheDocument();
  });

  it('renders queries with custom titles and original query context', () => {
    render(
      <HistoryDrawer
        entries={mockEntries}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    // Entry 1 has no custom title
    expect(screen.getByText('how does replication work')).toBeInTheDocument();

    // Entry 2 has custom title and shows original query
    expect(screen.getByText('ACID Properties Overview')).toBeInTheDocument();
    expect(screen.getByText('what is ac id')).toBeInTheDocument();
  });

  it('separates pinned queries from unpinned queries with a separator line', () => {
    const { container } = render(
      <HistoryDrawer
        entries={mockEntries}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    const separator = container.querySelector('.history-pinned-separator');
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute('role', 'separator');

    // Pinned entry (query-2) rendered first with is-pinned class
    const entries = container.querySelectorAll('.history-entry');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveClass('is-pinned');
    expect(entries[1]).not.toHaveClass('is-pinned');
  });

  it('supports inline editing of custom search names', () => {
    const onRename = vi.fn();
    render(
      <HistoryDrawer
        entries={mockEntries}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
        onRename={onRename}
      />,
    );

    const renameButtons = screen.getAllByTitle('Rename search');
    // Entry 2 (pinned) is first, Entry 1 (unpinned) is second
    const unpinnedRenameBtn = renameButtons[1];
    expect(unpinnedRenameBtn).toBeDefined();
    if (unpinnedRenameBtn) {
      fireEvent.click(unpinnedRenameBtn);
    }

    // Input appears
    const input = screen.getByPlaceholderText('Custom search name...');
    expect(input).toHaveValue('how does replication work');

    fireEvent.change(input, { target: { value: 'Distributed Replication' } });
    fireEvent.click(screen.getByTitle('Save custom name (Enter)'));

    expect(onRename).toHaveBeenCalledWith(
      mockEntries[0],
      'Distributed Replication',
    );
  });

  it('cancels inline editing when clicking cancel or pressing escape', () => {
    render(
      <HistoryDrawer
        entries={mockEntries}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    const renameButtons = screen.getAllByTitle('Rename search');
    const unpinnedRenameBtn = renameButtons[1];
    expect(unpinnedRenameBtn).toBeDefined();
    if (unpinnedRenameBtn) {
      fireEvent.click(unpinnedRenameBtn);
    }

    expect(
      screen.getByPlaceholderText('Custom search name...'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Cancel (Esc)'));
    expect(
      screen.queryByPlaceholderText('Custom search name...'),
    ).not.toBeInTheDocument();
  });

  it('triggers onRestore, onEdit and onTogglePin callbacks', () => {
    const onRestore = vi.fn();
    const onEdit = vi.fn();
    const onTogglePin = vi.fn();

    render(
      <HistoryDrawer
        entries={mockEntries}
        onRestore={onRestore}
        onEdit={onEdit}
        onTogglePin={onTogglePin}
      />,
    );

    // Restore query
    fireEvent.click(screen.getByTitle('Restore "how does replication work"'));
    expect(onRestore).toHaveBeenCalledWith(mockEntries[0]);

    // Load into search bar (entry 1 is unpinned, index 1)
    const searchBtns = screen.getAllByTitle('Load into search bar');
    const targetSearchBtn = searchBtns[1];
    expect(targetSearchBtn).toBeDefined();
    if (targetSearchBtn) {
      fireEvent.click(targetSearchBtn);
    }
    expect(onEdit).toHaveBeenCalledWith(mockEntries[0]);

    // Toggle pin (entry 1 is unpinned, index 1)
    const pinBtns = screen.getAllByTitle(/pin query/i);
    const targetPinBtn = pinBtns[1];
    expect(targetPinBtn).toBeDefined();
    if (targetPinBtn) {
      fireEvent.click(targetPinBtn);
    }
    expect(onTogglePin).toHaveBeenCalledWith(mockEntries[0]);
  });

  it('renders top, right, and corner resize handles and toggles size on double click', () => {
    const { container } = render(
      <HistoryDrawer
        entries={mockEntries}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    const drawer = container.querySelector('.history-drawer') as HTMLElement;
    expect(drawer).toBeInTheDocument();

    const topHandle = container.querySelector(
      '.history-resize-handle-top',
    ) as HTMLElement;
    const rightHandle = container.querySelector(
      '.history-resize-handle-right',
    ) as HTMLElement;
    const cornerHandle = container.querySelector(
      '.history-resize-handle-corner',
    ) as HTMLElement;

    expect(topHandle).toBeInTheDocument();
    expect(rightHandle).toBeInTheDocument();
    expect(cornerHandle).toBeInTheDocument();

    // Double click top handle toggles between default and expanded
    fireEvent.doubleClick(topHandle);
    expect(drawer.style.width).toBe('440px');
    expect(drawer.style.height).toBe('360px');

    // Double click again returns to default
    fireEvent.doubleClick(topHandle);
    expect(drawer.style.width).toBe('280px');
    expect(drawer.style.height).toBe('215px');
  });

  it('handles pointer dragging to resize panel dimensions', () => {
    const { container } = render(
      <HistoryDrawer
        entries={mockEntries}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    const drawer = container.querySelector('.history-drawer') as HTMLElement;
    const rightHandle = container.querySelector(
      '.history-resize-handle-right',
    ) as HTMLElement;

    // Start resize rightward
    fireEvent(
      rightHandle,
      new MouseEvent('pointerdown', {
        clientX: 280,
        clientY: 200,
        bubbles: true,
      }),
    );
    fireEvent(
      rightHandle,
      new MouseEvent('pointermove', {
        clientX: 350,
        clientY: 200,
        bubbles: true,
      }),
    );
    fireEvent(
      rightHandle,
      new MouseEvent('pointerup', {
        clientX: 350,
        clientY: 200,
        bubbles: true,
      }),
    );

    expect(Number.parseInt(drawer.style.width, 10)).toBeGreaterThan(280);

    // Resize upward using top handle (dragging clientY lower increases height)
    const topHandle = container.querySelector(
      '.history-resize-handle-top',
    ) as HTMLElement;
    fireEvent(
      topHandle,
      new MouseEvent('pointerdown', {
        clientX: 200,
        clientY: 200,
        bubbles: true,
      }),
    );
    fireEvent(
      topHandle,
      new MouseEvent('pointermove', {
        clientX: 200,
        clientY: 150,
        bubbles: true,
      }),
    );
    fireEvent(
      topHandle,
      new MouseEvent('pointerup', {
        clientX: 200,
        clientY: 150,
        bubbles: true,
      }),
    );

    expect(Number.parseInt(drawer.style.height, 10)).toBeGreaterThan(215);

    // Corner handle resize (both width and height)
    const cornerHandle = container.querySelector(
      '.history-resize-handle-corner',
    ) as HTMLElement;
    fireEvent(
      cornerHandle,
      new MouseEvent('pointerdown', {
        clientX: 300,
        clientY: 200,
        bubbles: true,
      }),
    );
    fireEvent(
      cornerHandle,
      new MouseEvent('pointermove', {
        clientX: 400,
        clientY: 100,
        bubbles: true,
      }),
    );
    fireEvent(
      cornerHandle,
      new MouseEvent('pointerup', {
        clientX: 400,
        clientY: 100,
        bubbles: true,
      }),
    );

    expect(Number.parseInt(drawer.style.width, 10)).toBeGreaterThan(350);
    expect(Number.parseInt(drawer.style.height, 10)).toBeGreaterThan(260);
  });
});
