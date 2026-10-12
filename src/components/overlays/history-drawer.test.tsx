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

  it('renders Crawl badge for crawl queries and Search badge for search queries', () => {
    const crawlEntry: QueryHistory = {
      id: 'query-crawl-1',
      graphId: 'graph-1',
      queryText: 'crawl traversal across systems',
      selectedNodeIds: ['node-1'],
      results: {
        queryId: 'query-crawl-1',
        queryType: 'crawl',
        queryText: 'crawl traversal across systems',
        startingNodeIds: ['node-1'],
        crawlDepth: 'default',
        direction: 'forward',
        sensitivity: 'medium',
        nodes: [],
        edges: [],
        maxLevelReached: 0,
        totalMatches: 0,
        matchedNodeIds: ['node-1'],
        remaining: 0,
      },
      title: null,
      isPinned: false,
      createdAt: new Date('2026-09-03T12:00:00Z').toISOString(),
    };

    render(
      <HistoryDrawer
        entries={[crawlEntry, mockEntries[0]!]}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    expect(screen.getByText('Crawl')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('renders re-run button and calls onRerun', () => {
    const onRerun = vi.fn();
    const entry: QueryHistory = {
      ...mockEntries[0]!,
    };

    render(
      <HistoryDrawer
        entries={[entry]}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
        onRerun={onRerun}
      />,
    );

    const rerunBtn = screen.getByRole('button', { name: /re-run query/i });
    expect(rerunBtn).toBeInTheDocument();
    fireEvent.click(rerunBtn);

    expect(onRerun).toHaveBeenCalledWith(entry);
  });

  it('filters history by quick filter chips (All, Pinned, Searches, Crawls)', () => {
    const crawlEntry: QueryHistory = {
      id: 'query-crawl-1',
      graphId: 'graph-1',
      queryText: 'crawl traversal across systems',
      selectedNodeIds: ['node-1'],
      results: {
        queryId: 'query-crawl-1',
        queryType: 'crawl',
        queryText: 'crawl traversal across systems',
        startingNodeIds: ['node-1'],
        crawlDepth: 'default',
        direction: 'forward',
        sensitivity: 'medium',
        nodes: [],
        edges: [],
        maxLevelReached: 0,
        totalMatches: 0,
        matchedNodeIds: ['node-1'],
        remaining: 0,
      },
      title: null,
      isPinned: false,
      createdAt: new Date('2026-09-03T12:00:00Z').toISOString(),
    };

    render(
      <HistoryDrawer
        entries={[mockEntries[0]!, mockEntries[1]!, crawlEntry]}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    // Initial state (All): all 3 visible
    expect(screen.getByText('how does replication work')).toBeInTheDocument();
    expect(screen.getByText('ACID Properties Overview')).toBeInTheDocument();
    expect(
      screen.getByText('crawl traversal across systems'),
    ).toBeInTheDocument();

    // Filter by Pinned
    fireEvent.click(screen.getByRole('tab', { name: /pinned/i }));
    expect(
      screen.queryByText('how does replication work'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('ACID Properties Overview')).toBeInTheDocument();
    expect(
      screen.queryByText('crawl traversal across systems'),
    ).not.toBeInTheDocument();

    // Filter by Crawls
    fireEvent.click(screen.getByRole('tab', { name: /crawls/i }));
    expect(
      screen.queryByText('how does replication work'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('ACID Properties Overview'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('crawl traversal across systems'),
    ).toBeInTheDocument();

    // Filter by Searches
    fireEvent.click(screen.getByRole('tab', { name: /searches/i }));
    expect(screen.getByText('how does replication work')).toBeInTheDocument();
    expect(screen.getByText('ACID Properties Overview')).toBeInTheDocument();
    expect(
      screen.queryByText('crawl traversal across systems'),
    ).not.toBeInTheDocument();

    // Filter back to All
    fireEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(screen.getByText('how does replication work')).toBeInTheDocument();
    expect(screen.getByText('ACID Properties Overview')).toBeInTheDocument();
    expect(
      screen.getByText('crawl traversal across systems'),
    ).toBeInTheDocument();
  });

  it('filters history via in-drawer search input and shows empty filter message', () => {
    render(
      <HistoryDrawer
        entries={[
          mockEntries[0]!,
          mockEntries[1]!,
          {
            id: 'query-3',
            graphId: 'graph-1',
            queryText: 'btree index performance',
            selectedNodeIds: ['node-3'],
            results: null,
            title: null,
            isPinned: false,
            createdAt: new Date('2026-09-04T12:00:00Z').toISOString(),
          },
        ]}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    const searchInput = screen.getByLabelText('Filter history');
    expect(searchInput).toBeInTheDocument();

    // Filter for replication
    fireEvent.change(searchInput, { target: { value: 'replication' } });
    expect(screen.getByText('how does replication work')).toBeInTheDocument();
    expect(
      screen.queryByText('ACID Properties Overview'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('btree index performance'),
    ).not.toBeInTheDocument();

    // Filter for non-matching
    fireEvent.change(searchInput, { target: { value: 'nonexistent xyz' } });
    expect(
      screen.getByText('No queries match this filter.'),
    ).toBeInTheDocument();

    // Clear filter
    fireEvent.click(screen.getByLabelText('Clear filter'));
    expect(screen.getByText('how does replication work')).toBeInTheDocument();
    expect(screen.getByText('ACID Properties Overview')).toBeInTheDocument();
    expect(screen.getByText('btree index performance')).toBeInTheDocument();
  });

  it('renders ongoing crawl jobs with progress bar, level details, and cancel action', () => {
    const handleCancel = vi.fn();
    const activeJobs = [
      {
        jobId: 'job-crawl-42',
        graphId: 'graph-1',
        queryText: 'deep graph exploration query',
        status: 'PROCESSING' as const,
        progress: 45,
        level: 2,
        matchesCount: 6,
        message: 'Exploring frontier level 2',
        createdAt: new Date().toISOString(),
      },
    ];

    render(
      <HistoryDrawer
        entries={[]}
        activeCrawlJobs={activeJobs}
        onCancelCrawlJob={handleCancel}
        onRestore={vi.fn()}
        onEdit={vi.fn()}
        onTogglePin={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Pending & Ongoing Crawls (1)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('deep graph exploration query'),
    ).toBeInTheDocument();
    expect(screen.getByText('Crawling...')).toBeInTheDocument();
    expect(screen.getByText('Exploring frontier level 2')).toBeInTheDocument();

    const cancelBtn = screen.getByLabelText('Cancel crawl');
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledWith('job-crawl-42');
  });
});
