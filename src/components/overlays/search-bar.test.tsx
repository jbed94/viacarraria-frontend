import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../i18n';
import { api } from '../../lib/api';
import { useGraphStore } from '../../store/graph-store';
import { SearchBar } from './search-bar';

vi.mock('../../lib/api', () => ({
  api: {
    getSuggestions: vi.fn().mockResolvedValue({
      querySuggestions: [],
      vocabularySuggestions: [],
      synonymSuggestions: [],
    }),
    getVocabulary: vi.fn().mockResolvedValue([]),
  },
}));

describe('SearchBar', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useGraphStore.setState({
      graph: undefined,
      queryType: 'simple',
      mode: 'IDLE',
      crawlStartingNodeIds: [],
      selectedNodeIds: [],
      results: undefined,
      crawlResults: undefined,
    });
  });

  it('fills the query text supplied by recent-query editing', async () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = render(<SearchBar onSearch={onSearch} />);
    const input = screen.getByRole('textbox');

    expect(input).toHaveValue('');

    rerender(
      <SearchBar
        onSearch={onSearch}
        queryForEdit="Where are relational databases explained?"
      />,
    );

    await waitFor(() =>
      expect(input).toHaveValue('Where are relational databases explained?'),
    );
    unmount();
  });

  it('allows customizing scope via options drawer in search mode with sensitivity option removed', async () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);
    render(<SearchBar onSearch={onSearch} tier="REGISTERED" />);

    // Open options drawer
    fireEvent.click(screen.getByRole('button', { name: 'Search options' }));

    // Sensitivity options should NOT be present
    expect(screen.queryByRole('radio', { name: 'High' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Low' })).toBeNull();

    // Scope options: Narrow, Normal, Wide
    const wideScopeBtn = screen.getByRole('radio', { name: 'Wide' });
    fireEvent.click(wideScopeBtn);
    expect(wideScopeBtn).toHaveAttribute('aria-checked', 'true');

    // Type query and submit
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'distributed consensus' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith(
      'distributed consensus',
      'medium',
      'wide',
    );
  });

  it('toggles between Search and Crawl query modes via segmented switcher', () => {
    const onSearch = vi.fn();
    const onCrawl = vi.fn();
    render(<SearchBar onSearch={onSearch} onCrawl={onCrawl} />);

    const searchModeBtn = screen.getByRole('radio', { name: 'Search' });
    const crawlModeBtn = screen.getByRole('radio', { name: 'Crawl' });
    expect(searchModeBtn).toHaveAttribute('aria-checked', 'true');
    expect(crawlModeBtn).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'Ask about selected topics',
    );

    // Switch to Crawl mode
    fireEvent.click(crawlModeBtn);
    expect(crawlModeBtn).toHaveAttribute('aria-checked', 'true');
    expect(searchModeBtn).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'Ask a question to crawl connected topics...',
    );
    expect(useGraphStore.getState().queryType).toBe('crawl');
    expect(useGraphStore.getState().mode).toBe('CRAWL_SELECTION');

    // Open options drawer in Crawl mode
    fireEvent.click(screen.getByRole('button', { name: 'Search options' }));
    expect(screen.getByText('Direction')).toBeInTheDocument();
    expect(screen.getByText('Crawl Exploration Settings')).toBeInTheDocument();
  });

  it('opens Query Modes Guide dialog when clicking info icon', () => {
    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    const guideBtn = screen.getByRole('button', { name: 'Query Modes Guide' });
    fireEvent.click(guideBtn);

    expect(screen.getByText('Direct Search Mode')).toBeInTheDocument();
    expect(screen.getByText('Graph Crawl Mode')).toBeInTheDocument();
  });

  it('preserves crawl mode when clicking cancel in crawl mode', () => {
    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    // Switch to crawl mode
    fireEvent.click(screen.getByRole('radio', { name: 'Crawl' }));
    expect(useGraphStore.getState().queryType).toBe('crawl');

    // Type query
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'investigate path' } });

    // Click cancel button
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    // Verify it stays in crawl mode and clears query
    expect(useGraphStore.getState().queryType).toBe('crawl');
    expect(useGraphStore.getState().mode).toBe('CRAWL_SELECTION');
    expect(input).toHaveValue('');
  });

  it('preserves crawl mode when pressing Escape in crawl mode input', () => {
    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    // Switch to crawl mode
    fireEvent.click(screen.getByRole('radio', { name: 'Crawl' }));
    expect(useGraphStore.getState().queryType).toBe('crawl');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'escape test' } });

    // Press Escape
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    // Verify it stays in crawl mode and clears query
    expect(useGraphStore.getState().queryType).toBe('crawl');
    expect(useGraphStore.getState().mode).toBe('CRAWL_SELECTION');
    expect(input).toHaveValue('');
  });

  it('blocks crawl submission when 0 starting nodes are selected', () => {
    const onCrawl = vi.fn();
    useGraphStore.setState({ crawlStartingNodeIds: [] });

    render(<SearchBar onSearch={vi.fn()} onCrawl={onCrawl} />);

    // Switch to Crawl mode
    fireEvent.click(screen.getByRole('radio', { name: 'Crawl' }));

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'how does consensus propagate' },
    });

    const crawlBtn = screen.getByRole('button', { name: 'Run' });
    expect(crawlBtn).toBeDisabled();
    expect(crawlBtn).toHaveAttribute(
      'title',
      'Select at least 1 starting node',
    );

    fireEvent.click(crawlBtn);
    expect(onCrawl).not.toHaveBeenCalled();
  });

  it('submits crawl query with configured direction and settings when starting nodes exist', async () => {
    const onCrawl = vi.fn().mockResolvedValue(undefined);
    useGraphStore.setState({ crawlStartingNodeIds: ['node-1', 'node-2'] });

    render(<SearchBar onSearch={vi.fn()} onCrawl={onCrawl} />);

    // Switch to Crawl mode
    fireEvent.click(screen.getByRole('radio', { name: 'Crawl' }));

    // Open options drawer
    fireEvent.click(screen.getByRole('button', { name: 'Search options' }));

    // Select direction: Both
    const bothDirBtn = screen.getByRole('radio', {
      name: /both/i,
    });
    fireEvent.click(bothDirBtn);

    // Enter query
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'multi-hop consensus' },
    });

    const crawlBtn = screen.getByRole('button', { name: 'Run' });
    expect(crawlBtn).not.toBeDisabled();
    fireEvent.click(crawlBtn);

    expect(onCrawl).toHaveBeenCalledWith(
      'multi-hop consensus',
      'both',
      'default',
      'medium',
      false,
      undefined,
      undefined,
      expect.objectContaining({
        enableDigs: true,
        enableLinks: true,
        enableJumps: true,
        maxCandidatesPerStep: 3,
      }),
    );
  });

  it('submits comparative crawl query with partitioned hypothesis seeds when comparative mode is enabled', async () => {
    const onCrawl = vi.fn().mockResolvedValue(undefined);
    useGraphStore.setState({
      crawlStartingNodeIds: ['node-1', 'node-2'],
      graph: {
        nodes: [
          {
            id: 'node-1',
            data: { title: 'Hypothesis Seed 1', description: '' },
            position: { x: 0, y: 0 },
          },
          {
            id: 'node-2',
            data: { title: 'Hypothesis Seed 2', description: '' },
            position: { x: 100, y: 100 },
          },
        ],
        edges: [],
      } as any,
    });

    render(<SearchBar onSearch={vi.fn()} onCrawl={onCrawl} />);

    // Switch to Crawl mode
    fireEvent.click(screen.getByRole('radio', { name: 'Crawl' }));

    // Open options drawer
    fireEvent.click(screen.getByRole('button', { name: 'Search options' }));

    // Comparative mode toggle is present because >=2 seeds exist
    const compToggle = screen.getByRole('button', { name: 'Disabled' });
    expect(compToggle).toBeInTheDocument();
    fireEvent.click(compToggle);

    expect(compToggle).toHaveTextContent('Enabled');

    // Query & submit
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'compare hypothesis mechanisms' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    expect(onCrawl).toHaveBeenCalledWith(
      'compare hypothesis mechanisms',
      'forward',
      'default',
      'medium',
      true,
      ['node-2'],
      expect.arrayContaining([
        expect.objectContaining({ id: 'groupA', nodeIds: ['node-1'] }),
        expect.objectContaining({ id: 'groupB', nodeIds: ['node-2'] }),
      ]),
      expect.objectContaining({
        enableDigs: true,
        enableLinks: true,
        enableJumps: true,
      }),
    );
  });

  it('supports adding a 3rd hypothesis and partitioning 3 seeds across groups A, B, and C', async () => {
    const onCrawl = vi.fn().mockResolvedValue(undefined);
    useGraphStore.setState({
      crawlStartingNodeIds: ['node-1', 'node-2', 'node-3'],
      graph: {
        nodes: [
          {
            id: 'node-1',
            data: { title: 'Alpha Hypothesis' },
            position: { x: 0, y: 0 },
          },
          {
            id: 'node-2',
            data: { title: 'Beta Hypothesis' },
            position: { x: 10, y: 10 },
          },
          {
            id: 'node-3',
            data: { title: 'Gamma Hypothesis' },
            position: { x: 20, y: 20 },
          },
        ],
        edges: [],
      } as any,
    });

    render(<SearchBar onSearch={vi.fn()} onCrawl={onCrawl} />);

    // Switch to Crawl mode
    fireEvent.click(screen.getByRole('radio', { name: 'Crawl' }));

    // Open options drawer
    fireEvent.click(screen.getByRole('button', { name: 'Search options' }));

    // Enable comparative mode
    const compToggle = screen.getByRole('button', { name: 'Disabled' });
    fireEvent.click(compToggle);

    // Click "+ Add Hypothesis" button
    const addBtn = screen.getByRole('button', { name: /Add Hypothesis/i });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);

    // Now Hypothesis C is available. Cycle node-3 to Hypothesis C
    // By default node-1 is groupA, node-2 is groupA, node-3 is groupB (the last seed)
    // Clicking node-3 pill cycles from groupB to groupC
    const node3Pill = screen.getByRole('button', {
      name: /Gamma Hypothesis/i,
    });
    fireEvent.click(node3Pill);

    // Also cycle node-2 so it is in groupB
    const node2Pill = screen.getByRole('button', {
      name: /Beta Hypothesis/i,
    });
    fireEvent.click(node2Pill);

    // Submit crawl
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'tri-hypothesis inquiry' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    expect(onCrawl).toHaveBeenCalledWith(
      'tri-hypothesis inquiry',
      'forward',
      'default',
      'medium',
      true,
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({ id: 'groupA', nodeIds: ['node-1'] }),
        expect.objectContaining({ id: 'groupB', nodeIds: ['node-2'] }),
        expect.objectContaining({ id: 'groupC', nodeIds: ['node-3'] }),
      ]),
      expect.objectContaining({
        enableDigs: true,
        enableLinks: true,
        enableJumps: true,
      }),
    );
  });

  it('displays a circular progress bar and disables button while search is pending', async () => {
    let resolveSearch: () => void = () => {};
    const pendingSearchPromise = new Promise<void>((resolve) => {
      resolveSearch = resolve;
    });
    const onSearch = vi.fn().mockReturnValue(pendingSearchPromise);

    render(<SearchBar onSearch={onSearch} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'quantum computing' },
    });

    const searchButton = screen.getByRole('button', { name: 'Search' });
    expect(searchButton).not.toBeDisabled();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    fireEvent.click(searchButton);

    // During pending search:
    expect(searchButton).toBeDisabled();
    expect(searchButton).toHaveAttribute('aria-busy', 'true');
    const progressBar = screen.getByRole('progressbar', { name: 'Search' });
    expect(progressBar).toBeInTheDocument();

    // Resolve search
    resolveSearch();
    await waitFor(() => {
      expect(searchButton).not.toBeDisabled();
      expect(searchButton).toHaveAttribute('aria-busy', 'false');
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('renders switch button on left, query panel centered, and info button on right', () => {
    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    const mainRow = document.querySelector('.search-bar-main-row');
    expect(mainRow).toBeInTheDocument();

    const children = mainRow?.children;
    expect(children).toHaveLength(4);

    // Child 0: Mode switcher column (left)
    expect(children?.[0]).toHaveClass('mode-switcher-column');
    expect(
      children?.[0]?.querySelector('.mode-select-all-checkbox-row'),
    ).toBeInTheDocument();
    expect(
      children?.[0]?.querySelector('.mode-switcher-segmented'),
    ).toBeInTheDocument();

    // Child 1: Query form directly in center spanning full available width
    expect(children?.[1]).toHaveClass('search-bar');

    // Child 2: Mode guide info button (right)
    expect(children?.[2]).toHaveClass('mode-info-icon-btn');

    // Child 3: Vocabulary cloud button (right)
    expect(children?.[3]).toHaveClass('vocab-cloud-trigger-btn');
  });

  it('renders query hints floating row above query panel in crawl mode', () => {
    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    // In simple mode, hints row is not rendered
    expect(
      document.querySelector('.search-bar-hints-row'),
    ).not.toBeInTheDocument();

    // Switch to Crawl mode
    fireEvent.click(screen.getByRole('radio', { name: 'Crawl' }));

    // Hints row appears above main row
    const hintsRow = document.querySelector('.search-bar-hints-row');
    expect(hintsRow).toBeInTheDocument();
    expect(
      screen.getByText('Select at least 1 starting node'),
    ).toBeInTheDocument();

    // Select 1 seed
    act(() => {
      useGraphStore.setState({ crawlStartingNodeIds: ['node-1'] });
    });
    expect(screen.getByText('1 seed')).toBeInTheDocument();

    // Select 2 seeds
    act(() => {
      useGraphStore.setState({ crawlStartingNodeIds: ['node-1', 'node-2'] });
    });
    expect(screen.getByText('2 seeds')).toBeInTheDocument();
  });

  it('selects all and unselects all nodes in simple search mode', () => {
    useGraphStore.setState({
      queryType: 'simple',
      graph: {
        nodes: [
          { id: 'node-1', data: { title: 'Node 1' }, position: { x: 0, y: 0 } },
          {
            id: 'node-2',
            data: { title: 'Node 2' },
            position: { x: 50, y: 50 },
          },
        ],
        edges: [],
      } as any,
    });

    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    const checkbox = screen.getByRole('checkbox', { name: 'All nodes' });
    expect(checkbox).not.toBeChecked();

    // Click checkbox to select all
    fireEvent.click(checkbox);
    expect(useGraphStore.getState().selectedNodeIds).toEqual([
      'node-1',
      'node-2',
    ]);

    // Click again to unselect all
    fireEvent.click(checkbox);
    expect(useGraphStore.getState().selectedNodeIds).toEqual([]);
  });

  it('handles indeterminate state when some nodes are selected in simple mode', () => {
    useGraphStore.setState({
      queryType: 'simple',
      selectedNodeIds: ['node-1'],
      graph: {
        nodes: [
          { id: 'node-1', data: { title: 'Node 1' }, position: { x: 0, y: 0 } },
          {
            id: 'node-2',
            data: { title: 'Node 2' },
            position: { x: 50, y: 50 },
          },
        ],
        edges: [],
      } as any,
    });

    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    const checkbox = screen.getByRole('checkbox', {
      name: 'All nodes',
    }) as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);

    // Clicking when partially selected selects all
    fireEvent.click(checkbox);
    expect(useGraphStore.getState().selectedNodeIds).toEqual([
      'node-1',
      'node-2',
    ]);
  });

  it('selects all and unselects all starting nodes in crawl mode', () => {
    useGraphStore.setState({
      queryType: 'crawl',
      crawlStartingNodeIds: [],
      graph: {
        nodes: [
          { id: 'node-1', data: { title: 'Node 1' }, position: { x: 0, y: 0 } },
          {
            id: 'node-2',
            data: { title: 'Node 2' },
            position: { x: 50, y: 50 },
          },
        ],
        edges: [],
      } as any,
    });

    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    const checkbox = screen.getByRole('checkbox', {
      name: 'All starting nodes',
    });
    expect(checkbox).not.toBeChecked();

    // Click to select all starting nodes
    fireEvent.click(checkbox);
    expect(useGraphStore.getState().crawlStartingNodeIds).toEqual([
      'node-1',
      'node-2',
    ]);

    // Click again to unselect all
    fireEvent.click(checkbox);
    expect(useGraphStore.getState().crawlStartingNodeIds).toEqual([]);
  });

  it('renders "Search" button in simple mode and "Run" in crawl mode', () => {
    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    // In simple mode, submit button is named "Search"
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();

    // Switch to Crawl mode
    fireEvent.click(screen.getByRole('radio', { name: 'Crawl' }));

    // In crawl mode, submit button is named "Run"
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
  });

  it('allows anonymous users to select crawl mode', () => {
    useGraphStore.setState({ queryType: 'simple' });
    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} tier="ANONYMOUS" />);

    const crawlBtn = screen.getByRole('radio', { name: 'Crawl' });
    fireEvent.click(crawlBtn);

    expect(useGraphStore.getState().queryType).toBe('crawl');
  });

  it('allows registered users to view crawl exploration settings and add hypothesis groups', () => {
    useGraphStore.setState({
      queryType: 'crawl',
      crawlStartingNodeIds: ['node-1', 'node-2'],
      graph: {
        nodes: [
          { id: 'node-1', data: { title: 'Node 1' }, position: { x: 0, y: 0 } },
          {
            id: 'node-2',
            data: { title: 'Node 2' },
            position: { x: 50, y: 50 },
          },
        ],
        edges: [],
      } as any,
    });

    render(
      <SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} tier="REGISTERED" />,
    );

    // Open options drawer
    const optionsToggle = screen.getByLabelText('Search options');
    fireEvent.click(optionsToggle);

    expect(screen.getByText('Crawl Exploration Settings')).toBeInTheDocument();

    // Enable comparative mode and add a 3rd hypothesis
    const compToggle = screen.getByRole('button', { name: 'Disabled' });
    fireEvent.click(compToggle);

    const addHypothesisBtn = screen.getByRole('button', {
      name: /Add Hypothesis/i,
    });
    fireEvent.click(addHypothesisBtn);
    expect(screen.getByText(/Hypothesis C/i)).toBeInTheDocument();
  });

  it('does not render query & search space scope panel even when in active query mode', () => {
    useGraphStore.setState({
      mode: 'CONTEXT_SELECTION',
      queryType: 'simple',
      selectedNodeIds: ['node-1'],
      graph: {
        nodes: [
          { id: 'node-1', data: { title: 'Node 1' }, position: { x: 0, y: 0 } },
        ],
        edges: [],
      } as any,
    });

    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    expect(
      screen.queryByRole('region', { name: 'Query & Search Space Scope' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Query & Search Space Scope'),
    ).not.toBeInTheDocument();
  });

  it('closes suggestions popover on Escape without canceling query or mode, and cancels on second Escape', async () => {
    vi.mocked(api.getSuggestions).mockResolvedValue({
      querySuggestions: ['neural networks deep learning'],
      vocabularySuggestions: [],
      synonymSuggestions: [],
    });

    useGraphStore.setState({
      mode: 'IDLE',
      graph: {
        id: 'graph-1',
        nodes: [{ id: 'n1', data: { title: 'N1' }, position: { x: 0, y: 0 } }],
        edges: [],
      } as any,
    });

    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);
    const input = screen.getByRole('textbox');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'neural' } });

    const popover = await screen.findByRole('listbox', {
      name: /Search suggestions/i,
    });
    expect(popover).toBeInTheDocument();

    expect(useGraphStore.getState().mode).toBe('CONTEXT_SELECTION');
    expect(input).toHaveValue('neural');

    // First Escape closes suggestions popover only
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(
      screen.queryByRole('listbox', { name: /Search suggestions/i }),
    ).not.toBeInTheDocument();
    expect(useGraphStore.getState().mode).toBe('CONTEXT_SELECTION');
    expect(input).toHaveValue('neural');

    // Second Escape when popover is closed cancels query
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(useGraphStore.getState().mode).toBe('IDLE');
    expect(input).toHaveValue('');
  });

  it('focuses input on ⌘K / Ctrl+K shortcut without rendering a shortcut badge icon', () => {
    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    expect(screen.queryByText('⌘K')).not.toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(document.activeElement).not.toBe(input);

    // Press Cmd+K
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('remains in expanded mode without collapse functionality', () => {
    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    expect(
      screen.queryByRole('button', { name: 'Collapse search panel' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('opens and closes mode selection dropdown menu on hover without toggle-on-click', () => {
    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    const modeSwitcherCol = document.querySelector('.mode-switcher-column')!;
    const modeTrigger = screen.getByRole('button', { name: /Search menu/i });
    expect(modeTrigger).toBeInTheDocument();
    expect(modeTrigger).toHaveAttribute('aria-expanded', 'false');

    // Hover to open
    fireEvent.mouseEnter(modeSwitcherCol);
    expect(modeTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('.mode-switcher-dropdown')).toHaveClass(
      'is-open',
    );

    // Clicking button does NOT toggle it closed
    fireEvent.click(modeTrigger);
    expect(modeTrigger).toHaveAttribute('aria-expanded', 'true');

    // Mouse leave closes
    fireEvent.mouseLeave(modeSwitcherCol);
    expect(modeTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.mode-switcher-dropdown')).not.toHaveClass(
      'is-open',
    );

    // Escape closes when open
    fireEvent.mouseEnter(modeSwitcherCol);
    expect(modeTrigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(modeTrigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('displays crawl mode label and seed count on mode menu trigger button', () => {
    useGraphStore.setState({
      queryType: 'crawl',
      crawlStartingNodeIds: ['node-1', 'node-2'],
    });

    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    const modeTrigger = screen.getByRole('button', { name: /Crawl menu/i });
    expect(modeTrigger).toBeInTheDocument();
    expect(modeTrigger).toHaveClass('is-crawl');
    expect(modeTrigger).toHaveTextContent('Crawl');
    expect(modeTrigger).toHaveTextContent('2');
  });

  it('fetches and displays suggestions dropdown when typing with graph context', async () => {
    useGraphStore.setState({
      graph: { id: 'graph-1', title: 'Knowledge Graph', nodes: [] } as any,
    });

    vi.mocked(api.getSuggestions).mockResolvedValueOnce({
      querySuggestions: ['Distributed Consensus in Raft'],
      vocabularySuggestions: [
        { term: 'Raft Consensus', nodeIds: ['node-1'], sourceType: 'node' },
        { term: 'Leader Election', nodeIds: ['node-1'], sourceType: 'heading' },
      ],
      synonymSuggestions: [
        { term: 'RPC', expansions: ['remote procedure call'] },
      ],
    });

    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'raft' } });

    const popover = await screen.findByRole('listbox', {
      name: /Search suggestions/i,
    });
    expect(popover).toBeInTheDocument();

    expect(
      screen.getByText('Distributed Consensus in Raft'),
    ).toBeInTheDocument();
    expect(screen.getByText('Raft Consensus')).toBeInTheDocument();
    expect(screen.getByText('Leader Election')).toBeInTheDocument();
    expect(screen.getByText('RPC')).toBeInTheDocument();
  });

  it('renders suggested contextual query chips for selected nodes and executes on click', async () => {
    useGraphStore.setState({
      graph: {
        id: 'graph-1',
        title: 'Knowledge Graph',
        nodes: [{ id: 'node-1', data: { title: 'Node Alpha' } }],
      } as any,
      selectedNodeIds: ['node-1'],
    });

    vi.mocked(api.getSuggestions).mockResolvedValueOnce({
      querySuggestions: ['Node Alpha architecture and components'],
      vocabularySuggestions: [],
      synonymSuggestions: [],
    });

    const onSearch = vi.fn().mockResolvedValue(undefined);
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    const chipHeader = await screen.findByText('Suggested for Selected Nodes');
    expect(chipHeader).toBeInTheDocument();

    const chip = screen.getByRole('button', {
      name: /Node Alpha architecture and components/i,
    });
    fireEvent.click(chip);

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith(
        'Node Alpha architecture and components',
        'medium',
        'normal',
      );
    });
  });

  it('renders node concept suggestion pills for selected nodes and fills query on click', async () => {
    useGraphStore.setState({
      graph: {
        id: 'graph-1',
        title: 'Knowledge Graph',
        nodes: [{ id: 'node-1', data: { title: 'Node Alpha' } }],
      } as any,
      selectedNodeIds: ['node-1'],
    });

    vi.mocked(api.getSuggestions).mockResolvedValueOnce({
      querySuggestions: [],
      vocabularySuggestions: [
        { term: 'Microservices Mesh', nodeIds: ['node-1'], sourceType: 'bold' },
      ],
      synonymSuggestions: [],
    });

    render(<SearchBar onSearch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    const conceptHeader = await screen.findByText('Node Concepts');
    expect(conceptHeader).toBeInTheDocument();

    const pill = screen.getByTitle(/Insert concept: "Microservices Mesh"/i);
    expect(pill).toHaveClass('is-vocab');

    // Hover triggers previewNodeIds
    fireEvent.mouseEnter(pill);
    expect(useGraphStore.getState().previewNodeIds).toEqual(['node-1']);

    fireEvent.mouseLeave(pill);
    expect(useGraphStore.getState().previewNodeIds).toEqual([]);

    // Click fills query input
    fireEvent.click(pill);
    expect(input).toHaveValue('Microservices Mesh');
  });

  it('navigates suggestions via keyboard (ArrowDown, ArrowUp, Enter)', async () => {
    useGraphStore.setState({
      graph: { id: 'graph-1', title: 'Knowledge Graph', nodes: [] } as any,
    });

    vi.mocked(api.getSuggestions).mockResolvedValueOnce({
      querySuggestions: ['Consensus Protocols Comparison'],
      vocabularySuggestions: [
        { term: 'Paxos Algorithm', nodeIds: ['node-1'], sourceType: 'node' },
      ],
      synonymSuggestions: [],
    });

    const onSearch = vi.fn().mockResolvedValue(undefined);
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'pax' } });

    await screen.findByRole('listbox', { name: /Search suggestions/i });

    // Arrow down to highlight first suggestion
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
    const firstOption = screen.getByRole('option', {
      name: /Consensus Protocols Comparison/i,
    });
    expect(firstOption).toHaveAttribute('aria-selected', 'true');

    // Arrow down to highlight second suggestion
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
    const secondOption = screen.getByRole('option', {
      name: /Paxos Algorithm/i,
    });
    expect(secondOption).toHaveAttribute('aria-selected', 'true');

    // Arrow up back to first suggestion
    fireEvent.keyDown(input, { key: 'ArrowUp', code: 'ArrowUp' });
    expect(firstOption).toHaveAttribute('aria-selected', 'true');

    // Press Enter to select first suggestion (it's a query phrase, so it executes search)
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith(
        'Consensus Protocols Comparison',
        'medium',
        'normal',
      );
    });
  });

  it('populates search query when clicking a vocabulary suggestion', async () => {
    useGraphStore.setState({
      graph: { id: 'graph-1', title: 'Knowledge Graph', nodes: [] } as any,
    });

    vi.mocked(api.getSuggestions).mockResolvedValueOnce({
      querySuggestions: [],
      vocabularySuggestions: [
        { term: 'Vector Embeddings', nodeIds: ['node-1'], sourceType: 'term' },
      ],
      synonymSuggestions: [],
    });

    render(<SearchBar onSearch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'vec' } });

    await screen.findByRole('listbox', { name: /Search suggestions/i });

    const vocabItem = screen.getByText('Vector Embeddings');
    fireEvent.click(vocabItem);

    expect(input).toHaveValue('Vector Embeddings');
    expect(
      screen.queryByRole('listbox', { name: /Search suggestions/i }),
    ).not.toBeInTheDocument();
  });

  it('synchronizes previewNodeIds in graph store when navigating or hovering suggestions', async () => {
    useGraphStore.setState({
      graph: { id: 'graph-1', title: 'Knowledge Graph', nodes: [] } as any,
      previewNodeIds: [],
    });

    vi.mocked(api.getSuggestions).mockResolvedValueOnce({
      querySuggestions: [],
      vocabularySuggestions: [
        {
          term: 'Paxos Algorithm',
          nodeIds: ['node-alpha', 'node-beta'],
          sourceType: 'node',
        },
      ],
      synonymSuggestions: [],
    });

    render(<SearchBar onSearch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'pax' } });

    await screen.findByRole('listbox', { name: /Search suggestions/i });

    // Arrow down to highlight Paxos Algorithm
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });

    await waitFor(() => {
      expect(useGraphStore.getState().previewNodeIds).toEqual([
        'node-alpha',
        'node-beta',
      ]);
    });

    // Mouse leave popover resets previewNodeIds
    const popover = screen.getByRole('listbox', {
      name: /Search suggestions/i,
    });
    fireEvent.mouseLeave(popover);

    await waitFor(() => {
      expect(useGraphStore.getState().previewNodeIds).toEqual([]);
    });
  });

  it('opens VocabularyCloudDialog when clicking vocabulary cloud icon button', async () => {
    useGraphStore.setState({
      graph: { id: 'graph-1', title: 'Knowledge Graph', nodes: [] } as any,
    });

    render(<SearchBar onSearch={vi.fn()} />);

    const triggerBtn = screen.getByRole('button', {
      name: /Explore Graph Concepts & Vocabulary Cloud/i,
    });
    fireEvent.click(triggerBtn);

    expect(
      await screen.findByText('Graph Concepts & Vocabulary'),
    ).toBeInTheDocument();
  });

  it('renders thematic cluster chips for selected nodes and executes query on click', async () => {
    useGraphStore.setState({
      graph: {
        id: 'graph-1',
        title: 'Knowledge Graph',
        nodes: [{ id: 'node-1', data: { title: 'Node Alpha' } }],
      } as any,
      selectedNodeIds: ['node-1'],
    });

    vi.mocked(api.getSuggestions).mockResolvedValueOnce({
      querySuggestions: [],
      vocabularySuggestions: [
        {
          term: 'Kubernetes Cluster Architecture',
          nodeIds: ['node-1'],
          sourceType: 'heading',
        },
        {
          term: 'Kubernetes Cluster Nodes',
          nodeIds: ['node-1'],
          sourceType: 'bold',
        },
      ],
      synonymSuggestions: [],
    });

    const onSearch = vi.fn().mockResolvedValue(undefined);
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    const clusterHeader = await screen.findByText('Thematic Clusters');
    expect(clusterHeader).toBeInTheDocument();

    const clusterChip = screen.getByTitle(
      /Cluster query: "Kubernetes Cluster Architecture and Kubernetes Cluster Nodes"/i,
    );
    expect(clusterChip).toHaveClass('is-cluster');

    fireEvent.click(clusterChip);

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith(
        'Kubernetes Cluster Architecture and Kubernetes Cluster Nodes',
        'medium',
        'normal',
      );
    });
  });

  it('opens VocabularyCloudDialog from suggestions footer explore button', async () => {
    useGraphStore.setState({
      graph: { id: 'graph-1', title: 'Knowledge Graph', nodes: [] } as any,
    });

    vi.mocked(api.getSuggestions).mockResolvedValueOnce({
      querySuggestions: ['Sample Query Suggestion'],
      vocabularySuggestions: [],
      synonymSuggestions: [],
    });

    render(<SearchBar onSearch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'sample' } });

    const exploreBtn = await screen.findByRole('button', {
      name: /Explore all concepts & clusters/i,
    });
    fireEvent.click(exploreBtn);

    expect(
      await screen.findByText('Graph Concepts & Vocabulary'),
    ).toBeInTheDocument();
  });

  it('populates search query ready to run when selecting vocabulary term from VocabularyCloudDialog', async () => {
    useGraphStore.setState({
      graph: {
        id: 'graph-1',
        title: 'Knowledge Graph',
        nodes: [
          {
            id: 'n1',
            label: 'Distributed Systems',
            syllabus: 'Covers consensus and replication algorithms',
            sources: [],
          },
        ],
      } as any,
    });

    vi.mocked(api.getVocabulary).mockResolvedValueOnce([
      {
        term: 'Distributed Systems',
        normalized: 'distributed systems',
        nodeIds: ['n1'],
        weight: 10,
        sourceType: 'node_title',
      },
    ]);

    vi.mocked(api.getSuggestions).mockResolvedValueOnce({
      querySuggestions: ['Distributed'],
      vocabularySuggestions: [],
      synonymSuggestions: [],
    });

    const onSearch = vi.fn().mockResolvedValue(undefined);
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'dist' } });

    const exploreBtn = await screen.findByRole('button', {
      name: /Explore all concepts & clusters/i,
    });
    fireEvent.click(exploreBtn);

    const vocabDialog = await screen.findByText('Graph Concepts & Vocabulary');
    expect(vocabDialog).toBeInTheDocument();

    const conceptBtn = screen.getByRole('button', {
      name: /Distributed Systems/i,
    });
    fireEvent.click(conceptBtn);

    expect(input).toHaveValue('Distributed Systems');
    expect(onSearch).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it('supports toggling crawl exploration settings and passing custom settings to onCrawl', async () => {
    const onCrawl = vi.fn().mockResolvedValue(undefined);
    useGraphStore.setState({
      crawlStartingNodeIds: ['node-1'],
      graph: {
        nodes: [
          {
            id: 'node-1',
            data: { title: 'Starting Topic' },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      } as any,
    });

    render(<SearchBar onSearch={vi.fn()} onCrawl={onCrawl} />);

    // Switch to Crawl mode
    fireEvent.click(screen.getByRole('radio', { name: 'Crawl' }));

    // Open options drawer
    fireEvent.click(screen.getByRole('button', { name: 'Search options' }));

    // Crawl exploration settings section should be visible
    expect(screen.getByText('Crawl Exploration Settings')).toBeInTheDocument();

    // Select "Disable" for Digs slicer
    const disableOptions = screen.getAllByRole('radio', { name: /disable/i });
    fireEvent.click(disableOptions[0]!);

    // Query & submit
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'custom crawl settings' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    expect(onCrawl).toHaveBeenCalledWith(
      'custom crawl settings',
      'forward',
      'default',
      'medium',
      false,
      undefined,
      undefined,
      expect.objectContaining({
        enableDigs: false,
        enableLinks: true,
        enableJumps: true,
        maxCandidatesPerStep: 3,
      }),
    );
  });

  it('closes options drawer on Escape while preserving crawl mode and query', () => {
    useGraphStore.setState({
      queryType: 'crawl',
      mode: 'CRAWL_SELECTION',
      crawlStartingNodeIds: ['node-1'],
    });

    render(<SearchBar onSearch={vi.fn()} onCrawl={vi.fn()} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'crawl esc test' } });

    // Open options drawer
    const optionsToggle = screen.getByLabelText('Search options');
    fireEvent.click(optionsToggle);
    expect(screen.getByText('Crawl Exploration Settings')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Drawer is closed
    expect(
      screen.queryByText('Crawl Exploration Settings'),
    ).not.toBeInTheDocument();

    // Mode and queryType are strictly preserved!
    expect(useGraphStore.getState().queryType).toBe('crawl');
    expect(useGraphStore.getState().mode).toBe('CRAWL_SELECTION');
    expect(input).toHaveValue('crawl esc test');
  });
});
