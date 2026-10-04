import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../../i18n';
import type { CrawlResponse } from '../../types/api';
import {
  CrawlResultNode,
  CrawlResultsCanvas,
  formatCrawlEdgeLabel,
  synthesizeSubtree,
} from './crawl-results-canvas';

const mockCrawlResults: CrawlResponse = {
  queryId: 'crawl-100',
  queryType: 'crawl',
  queryText: 'how does raft consensus elect leaders',
  startingNodeIds: ['node-1'],
  crawlDepth: 'default',
  direction: 'forward',
  sensitivity: 'medium',
  nodes: [
    {
      id: 'crawl-node-0',
      level: 0,
      nodeId: 'node-1',
      nodeTitle: 'Consensus Algorithms',
      score: 0.95,
      rerankScore: 0.92,
      chunk: {
        graphId: 'graph-1',
        nodeId: 'node-1',
        sourceId: 'source-1',
        sourceName: 'consensus-guide.pdf',
        content:
          '# Leader Election in Raft\nRaft relies on randomized election timers to select leaders cleanly without split votes.',
        context: 'Raft consensus section',
        startChar: 100,
        endChar: 240,
        pageNum: 4,
        score: 0.95,
      },
      stepDescription: 'Seed node match',
    },
    {
      id: 'crawl-node-1',
      level: 1,
      nodeId: 'node-2',
      nodeTitle: 'Heartbeat Protocol',
      score: 0.88,
      rerankScore: 0.84,
      chunk: {
        graphId: 'graph-1',
        nodeId: 'node-2',
        sourceId: 'source-2',
        sourceName: 'heartbeats.pdf',
        content:
          'Leaders periodically dispatch heartbeat RPCs to assert authority and prevent new elections.',
        context: 'Heartbeats section',
        startChar: 50,
        endChar: 170,
        pageNum: 7,
        score: 0.88,
      },
      parentCrawlNodeId: 'crawl-node-0',
      stepDescription: 'Followed edge: requires heartbeat',
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'crawl-node-0',
      target: 'crawl-node-1',
      level: 1,
      direction: 'forward',
    },
  ],
  maxLevelReached: 1,
  totalMatches: 2,
  matchedNodeIds: ['node-1', 'node-2'],
  remaining: 0,
  summary:
    'Exploration traced Raft leader election directly to heartbeat mechanisms ensuring steady quorum maintenance.',
};

describe('CrawlResultsCanvas', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(cleanup);

  it('renders top toolbar with query text, info details popover, and close button', () => {
    const onClose = vi.fn();
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByText('how does raft consensus elect leaders'),
    ).toBeInTheDocument();

    // Open info panel to view traversal query metadata
    const infoBtn = screen.getByRole('button', { name: /Query details/i });
    expect(infoBtn).toBeInTheDocument();
    fireEvent.click(infoBtn);

    expect(screen.getByText('Direction:')).toBeInTheDocument();
    expect(screen.getByText('forward')).toBeInTheDocument();
    expect(screen.getByText('Depth:')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('Levels:')).toBeInTheDocument();

    // Close button (X icon) triggers onClose
    const exitBtn = screen.getByRole('button', { name: /Exit crawl view/i });
    expect(exitBtn).toBeInTheDocument();
    fireEvent.click(exitBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles query details info popover and displays exploration summary', () => {
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('dialog', { name: /Query Details/i }),
    ).not.toBeInTheDocument();

    // Toggle open
    const infoBtn = screen.getByRole('button', { name: /Query details/i });
    fireEvent.click(infoBtn);

    expect(
      screen.getByRole('dialog', { name: /Query Details/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Exploration traced Raft leader election directly to heartbeat mechanisms ensuring steady quorum maintenance.',
      ),
    ).toBeInTheDocument();

    // Toggle close via dialog close button
    const closeInfoBtn = screen.getByRole('button', { name: /Close info/i });
    fireEvent.click(closeInfoBtn);
    expect(
      screen.queryByRole('dialog', { name: /Query Details/i }),
    ).not.toBeInTheDocument();
  });

  it('renders crawl result nodes with level badges, scores, titles, and snippets', () => {
    const onOpenSource = vi.fn();
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={onOpenSource}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Level 0 · Seed')).toBeInTheDocument();
    expect(screen.getByText('Consensus Algorithms')).toBeInTheDocument();
    expect(screen.getByText('92% match')).toBeInTheDocument();
    expect(screen.getByText('consensus-guide.pdf')).toBeInTheDocument();

    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat Protocol')).toBeInTheDocument();
    expect(screen.getByText('84% match')).toBeInTheDocument();
    expect(screen.getByText('heartbeats.pdf')).toBeInTheDocument();
  });

  it('invokes onOpenSource with chunk details when clicking the match excerpt text', () => {
    const onOpenSource = vi.fn();
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={onOpenSource}
        onClose={vi.fn()}
      />,
    );

    const matchExcerpts = document.querySelectorAll('.crawl-match-excerpt');
    expect(matchExcerpts.length).toBeGreaterThan(0);
    fireEvent.click(matchExcerpts[0]!);

    expect(onOpenSource).toHaveBeenCalledWith(
      'source-1',
      mockCrawlResults.nodes[0]!.chunk,
    );
  });

  it('opens source directly when clicking the source document banner', () => {
    const onOpenSource = vi.fn();
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={onOpenSource}
        onClose={vi.fn()}
      />,
    );

    const sourceBanner = screen
      .getByText('consensus-guide.pdf')
      .closest('.crawl-source-banner')!;
    expect(sourceBanner).toBeInTheDocument();
    fireEvent.click(sourceBanner);

    expect(onOpenSource).toHaveBeenCalledWith(
      'source-1',
      mockCrawlResults.nodes[0]!.chunk,
    );
  });

  it('isolates and spotlights active path on node click, dimming unassociated nodes', () => {
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const seedArticle = screen
      .getByText('Consensus Algorithms')
      .closest('article')!;
    const hopArticle = screen
      .getByText('Heartbeat Protocol')
      .closest('article')!;

    expect(seedArticle).not.toHaveClass('is-path-highlighted');
    expect(hopArticle).not.toHaveClass('is-path-highlighted');
    expect(screen.queryByText(/Trail:/i)).not.toBeInTheDocument();

    // Click hop node to spotlight its path
    fireEvent.click(hopArticle);

    // Both hop node (target) and seed node (ancestor) should be highlighted
    expect(hopArticle).toHaveClass('is-trail-target');
    expect(seedArticle).toHaveClass('is-path-highlighted');

    // Sequence step badges should be rendered on active trail nodes
    expect(screen.getByText('Target · Step 1')).toBeInTheDocument();
    expect(screen.getByText('Seed · Root')).toBeInTheDocument();

    // Trail breadcrumb chip should be visible
    expect(screen.getByText(/Trail:/i)).toBeInTheDocument();
    expect(screen.getAllByText('Heartbeat Protocol')).toHaveLength(2);

    // Clear trail focus
    const clearBtn = screen.getByRole('button', {
      name: /Clear trail focus/i,
    });
    fireEvent.click(clearBtn);

    expect(hopArticle).not.toHaveClass('is-trail-target');
    expect(screen.queryByText(/Trail:/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Target · Step 1')).not.toBeInTheDocument();
  });

  it('filters frontier depth using depth expansion buttons in filter traversal panel', () => {
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Both nodes visible initially
    expect(screen.getByText('Consensus Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat Protocol')).toBeInTheDocument();

    // Open filter drawer
    fireEvent.click(screen.getByRole('button', { name: /Filter Traversal/i }));

    // Quick depth buttons should be rendered inside filter drawer
    const allHopsBtn = screen.getByRole('button', { name: /All Hops/i });
    const seedsBtn = screen.getByRole('button', { name: /Seeds/i });
    const hop1Btn = screen.getByRole('button', { name: /Hop 1/i });

    expect(allHopsBtn).toBeInTheDocument();
    expect(seedsBtn).toBeInTheDocument();
    expect(hop1Btn).toBeInTheDocument();
    expect(allHopsBtn).toHaveClass('active');

    // Click 'Seeds' (level 0 only)
    fireEvent.click(seedsBtn);
    expect(seedsBtn).toHaveClass('active');
    expect(allHopsBtn).not.toHaveClass('active');

    // Consensus Algorithms (seed) should survive, Heartbeat Protocol (hop 1) filtered out
    expect(screen.getByText('Consensus Algorithms')).toBeInTheDocument();
    expect(screen.queryByText('Heartbeat Protocol')).not.toBeInTheDocument();

    // Click 'All Hops' to restore
    fireEvent.click(allHopsBtn);
    expect(allHopsBtn).toHaveClass('active');
    expect(screen.getByText('Consensus Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat Protocol')).toBeInTheDocument();
  });

  it('displays comparative badges for Hypothesis origins and convergence points', () => {
    const comparativeCrawlResults: CrawlResponse = {
      ...mockCrawlResults,
      comparative: {
        isComparative: true,
        groupACount: 1,
        groupBCount: 1,
        intersectionCount: 1,
        intersectionNodeTitles: ['Shared Convergence Topic'],
      },
      nodes: [
        {
          ...mockCrawlResults.nodes[0]!,
          groupOrigin: 'groupA',
        },
        {
          ...mockCrawlResults.nodes[1]!,
          groupOrigin: 'intersection',
        },
      ],
    };

    render(
      <CrawlResultsCanvas
        crawlResults={comparativeCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Badges on nodes and nav capsule
    expect(screen.getAllByText('Hypothesis A').length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText('Hypothesis A').length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText('Hypothesis A').length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText('Convergence Point')).toBeInTheDocument();

    // Info panel includes comparative summary
    fireEvent.click(screen.getByRole('button', { name: /Query details/i }));
    expect(screen.getByText(/1 convergence points/i)).toBeInTheDocument();
  });

  it('confirms view source matches and jump to PDF buttons are removed in favor of clean node match text', () => {
    const onOpenSource = vi.fn();
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={onOpenSource}
        onClose={vi.fn()}
      />,
    );

    // Verify removed buttons do not exist
    expect(screen.queryByText(/Jump to PDF/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/View source matches/i)).not.toBeInTheDocument();

    // Clicking the clickable match excerpt opens source at chunk
    const excerpt = screen.getByText(
      /Raft relies on randomized election timers/i,
    );
    fireEvent.click(excerpt.closest('.crawl-match-excerpt')!);
    expect(onOpenSource).toHaveBeenCalledWith(
      'source-1',
      mockCrawlResults.nodes[0]!.chunk,
    );
  });

  it('renders live streaming frontier update pill when isStreaming is true', () => {
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        isStreaming={true}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Streaming Hop 1\.\.\./i)).toBeInTheDocument();
  });

  it('switches between unified flow and split comparative diff view with lane guide badges', () => {
    const comparativeCrawlResults: CrawlResponse = {
      ...mockCrawlResults,
      comparative: {
        isComparative: true,
        groupACount: 1,
        groupBCount: 1,
        intersectionCount: 1,
        intersectionNodeTitles: ['Shared Convergence Topic'],
      },
      nodes: [
        {
          ...mockCrawlResults.nodes[0]!,
          groupOrigin: 'groupA',
        },
        {
          ...mockCrawlResults.nodes[1]!,
          groupOrigin: 'groupB',
        },
        {
          id: 'crawl-node-2',
          level: 2,
          nodeId: 'node-3',
          nodeTitle: 'Convergence Node',
          score: 0.9,
          groupOrigin: 'intersection',
          chunk: {
            ...mockCrawlResults.nodes[0]!.chunk,
            nodeId: 'node-3',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'crawl-node-0',
          target: 'crawl-node-1',
          level: 1,
          direction: 'forward',
        },
        {
          id: 'e2',
          source: 'crawl-node-1',
          target: 'crawl-node-2',
          level: 2,
          direction: 'forward',
        },
      ],
      totalMatches: 3,
    };

    render(
      <CrawlResultsCanvas
        crawlResults={comparativeCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Diff switcher should be visible in comparative mode
    // Diff switcher should be visible in comparative mode with Single Focus active by default
    const singleBtn = screen.getByRole('button', { name: /Single Focus/i });
    const unifiedBtn = screen.getByRole('button', { name: /Unified Flow/i });
    const splitBtn = screen.getByRole('button', {
      name: /Split Diff \(A vs B\)/i,
    });
    expect(singleBtn).toBeInTheDocument();
    expect(unifiedBtn).toBeInTheDocument();
    expect(splitBtn).toBeInTheDocument();
    expect(singleBtn).toHaveClass('active');
    expect(unifiedBtn).not.toHaveClass('active');
    expect(splitBtn).not.toHaveClass('active');

    // Switch to Unified Flow mode
    fireEvent.click(unifiedBtn);
    expect(unifiedBtn).toHaveClass('active');
    expect(singleBtn).not.toHaveClass('active');

    // In unified mode, lane headers are not present
    expect(document.querySelector('.diff-lane-badge')).not.toBeInTheDocument();

    // Switch to Split Diff mode
    fireEvent.click(splitBtn);
    expect(splitBtn).toHaveClass('active');
    expect(unifiedBtn).not.toHaveClass('active');

    // In split mode, lane header badges should be displayed
    expect(document.querySelectorAll('.diff-lane-badge').length).toBe(3);
    const hypothesisABadges = screen.getAllByText('Hypothesis A');
    expect(hypothesisABadges.length).toBeGreaterThanOrEqual(1);

    const convergenceBadges = screen.getAllByText('Convergence Points');
    expect(convergenceBadges.length).toBeGreaterThanOrEqual(1);

    const hypothesisBBadges = screen.getAllByText('Hypothesis B');
    expect(hypothesisBBadges.length).toBeGreaterThanOrEqual(1);

    // Switch back to Unified Flow mode
    fireEvent.click(unifiedBtn);
    expect(unifiedBtn).toHaveClass('active');
    expect(splitBtn).not.toHaveClass('active');
  });

  it('filters nodes by relevance score and updates live counts', () => {
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Initial state: both nodes visible
    expect(screen.getByText('Consensus Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat Protocol')).toBeInTheDocument();

    // Open filter drawer
    const filterToggleBtn = screen.getByRole('button', {
      name: /Filter Traversal/i,
    });
    fireEvent.click(filterToggleBtn);

    expect(
      screen.getByText('Interactive Traversal Filtering'),
    ).toBeInTheDocument();

    // Change min score slider to 0.90 (Heartbeat Protocol has score 0.84, so it should be filtered out)
    const scoreSlider = screen.getByLabelText(/Min Relevance Score/i);
    fireEvent.change(scoreSlider, { target: { value: '0.9' } });

    // Node-0 (92%) survives, Node-1 (84%) is filtered out
    expect(screen.getByText('Consensus Algorithms')).toBeInTheDocument();
    expect(screen.queryByText('Heartbeat Protocol')).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 2 nodes/i)).toBeInTheDocument();

    // Reset filters
    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);

    // Both nodes restored
    expect(screen.getByText('Consensus Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat Protocol')).toBeInTheDocument();
  });

  it('prunes orphan descendant nodes when upstream parent seed is filtered out', () => {
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Open filter drawer
    fireEvent.click(screen.getByRole('button', { name: /Filter Traversal/i }));

    // Set score threshold to 0.94.
    // Level 0 Seed node has score 0.92, so it will be filtered out.
    // Even though Hop 1 has score 0.84, since seed is removed, hop 1 is pruned as an orphan!
    const scoreSlider = screen.getByLabelText(/Min Relevance Score/i);
    fireEvent.change(scoreSlider, { target: { value: '0.94' } });

    expect(screen.queryByText('Consensus Algorithms')).not.toBeInTheDocument();
    expect(screen.queryByText('Heartbeat Protocol')).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 0 of 2 nodes/i)).toBeInTheDocument();
  });

  it('filters nodes dynamically using match classification filter pills', () => {
    const classificationCrawlResults: CrawlResponse = {
      ...mockCrawlResults,
      nodes: [
        {
          ...mockCrawlResults.nodes[0]!,
          id: 'c-seed',
          nodeTitle: 'Machine Learning Seed',
          matchType: 'seed',
          level: 0,
        },
        {
          ...mockCrawlResults.nodes[1]!,
          id: 'c-dig',
          nodeTitle: 'Deep Learning Dig',
          matchType: 'dig',
          level: 1,
          parentCrawlNodeId: 'c-seed',
        },
        {
          ...mockCrawlResults.nodes[1]!,
          id: 'c-link',
          nodeTitle: 'Robotics Link',
          matchType: 'link',
          level: 1,
          parentCrawlNodeId: 'c-seed',
        },
        {
          ...mockCrawlResults.nodes[1]!,
          id: 'c-jump',
          nodeTitle: 'Computer Vision Jump',
          matchType: 'jump',
          level: 1,
          parentCrawlNodeId: 'c-seed',
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'c-seed',
          target: 'c-dig',
          level: 1,
          direction: 'forward',
          matchType: 'dig',
        },
        {
          id: 'e2',
          source: 'c-seed',
          target: 'c-link',
          level: 1,
          direction: 'forward',
          matchType: 'link',
        },
        {
          id: 'e3',
          source: 'c-seed',
          target: 'c-jump',
          level: 1,
          direction: 'forward',
          matchType: 'jump',
        },
      ],
      totalMatches: 4,
    };

    render(
      <CrawlResultsCanvas
        crawlResults={classificationCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Initial state: all 4 nodes visible
    expect(screen.getByText('Machine Learning Seed')).toBeInTheDocument();
    expect(screen.getByText('Deep Learning Dig')).toBeInTheDocument();
    expect(screen.getByText('Robotics Link')).toBeInTheDocument();
    expect(screen.getByText('Computer Vision Jump')).toBeInTheDocument();

    // Open filter drawer
    fireEvent.click(screen.getByRole('button', { name: /Filter Traversal/i }));

    expect(
      screen.getByText('Interactive Traversal Filtering'),
    ).toBeInTheDocument();
    expect(screen.getByText('Match Classification')).toBeInTheDocument();

    // Toggle off Digs
    const digPill = screen.getByRole('button', { name: /Toggle Digs \(1\)/i });
    fireEvent.click(digPill);

    // Dig node is filtered out; Seed, Link, Jump remain visible
    expect(screen.getByText('Machine Learning Seed')).toBeInTheDocument();
    expect(screen.queryByText('Deep Learning Dig')).not.toBeInTheDocument();
    expect(screen.getByText('Robotics Link')).toBeInTheDocument();
    expect(screen.getByText('Computer Vision Jump')).toBeInTheDocument();
    expect(screen.getByText(/Showing 3 of 4 nodes/i)).toBeInTheDocument();

    // Toggle off Links
    const linkPill = screen.getByRole('button', {
      name: /Toggle Links \(1\)/i,
    });
    fireEvent.click(linkPill);

    expect(screen.getByText('Machine Learning Seed')).toBeInTheDocument();
    expect(screen.queryByText('Deep Learning Dig')).not.toBeInTheDocument();
    expect(screen.queryByText('Robotics Link')).not.toBeInTheDocument();
    expect(screen.getByText('Computer Vision Jump')).toBeInTheDocument();
    expect(screen.getByText(/Showing 2 of 4 nodes/i)).toBeInTheDocument();

    // Reset filters
    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);

    // All 4 nodes restored
    expect(screen.getByText('Machine Learning Seed')).toBeInTheDocument();
    expect(screen.getByText('Deep Learning Dig')).toBeInTheDocument();
    expect(screen.getByText('Robotics Link')).toBeInTheDocument();
    expect(screen.getByText('Computer Vision Jump')).toBeInTheDocument();
  });

  it('renders multi-lane split diff view with N=3 hypothesis groups and convergence lane', () => {
    const n3CrawlResults: CrawlResponse = {
      ...mockCrawlResults,
      comparative: {
        isComparative: true,
        groupACount: 1,
        groupBCount: 1,
        intersectionCount: 1,
        intersectionNodeTitles: ['Tri-Bridge Hub'],
        groups: [
          { id: 'alpha', name: 'Alpha Model', count: 1, color: '#38bdf8' },
          { id: 'beta', name: 'Beta Model', count: 1, color: '#a855f7' },
          { id: 'gamma', name: 'Gamma Model', count: 1, color: '#f59e0b' },
        ],
      },
      nodes: [
        {
          ...mockCrawlResults.nodes[0]!,
          id: 'n-alpha',
          nodeTitle: 'Alpha Seed',
          groupOrigin: 'alpha',
        },
        {
          ...mockCrawlResults.nodes[1]!,
          id: 'n-beta',
          nodeTitle: 'Beta Seed',
          groupOrigin: 'beta',
        },
        {
          id: 'n-gamma',
          level: 0,
          nodeId: 'node-3',
          nodeTitle: 'Gamma Seed',
          score: 0.91,
          groupOrigin: 'gamma',
          chunk: {
            ...mockCrawlResults.nodes[0]!.chunk,
            nodeId: 'node-3',
          },
        },
        {
          id: 'n-hub',
          level: 1,
          nodeId: 'node-4',
          nodeTitle: 'Tri-Bridge Hub',
          score: 0.93,
          groupOrigin: 'intersection',
          reachedGroupIds: ['alpha', 'beta', 'gamma'],
          chunk: {
            ...mockCrawlResults.nodes[0]!.chunk,
            nodeId: 'node-4',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n-alpha',
          target: 'n-hub',
          level: 1,
          direction: 'forward',
        },
        {
          id: 'e2',
          source: 'n-beta',
          target: 'n-hub',
          level: 1,
          direction: 'forward',
        },
        {
          id: 'e3',
          source: 'n-gamma',
          target: 'n-hub',
          level: 1,
          direction: 'forward',
        },
      ],
      totalMatches: 4,
    };

    render(
      <CrawlResultsCanvas
        crawlResults={n3CrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Switch to Split Diff View
    const splitBtn = screen.getByRole('button', {
      name: /Split Diff/i,
    });
    fireEvent.click(splitBtn);

    // Verify all 3 hypothesis lane headers + Convergence Points header are rendered
    expect(screen.getAllByText('Alpha Model').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Beta Model').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Gamma Model').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText('Convergence Points').length,
    ).toBeGreaterThanOrEqual(1);

    // Verify Convergence badge on hub node
    expect(screen.getByText('Convergence (3 Groups)')).toBeInTheDocument();

    // Open filter drawer and toggle off Gamma Model
    fireEvent.click(screen.getByRole('button', { name: /Filter Traversal/i }));
    const gammaPill = screen.getByRole('button', {
      name: /Toggle Gamma Model/i,
    });
    fireEvent.click(gammaPill);

    // Gamma Seed should now be filtered out
    expect(screen.queryByText('Gamma Seed')).not.toBeInTheDocument();
    expect(screen.getByText('Alpha Seed')).toBeInTheDocument();
  });

  it('collapses and expands downstream subtrees when clicking subtree toggle button on branch nodes', () => {
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Initial state: both Seed and Hop 1 are visible
    expect(screen.getByText('Consensus Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat Protocol')).toBeInTheDocument();

    // Collapse toggle button is rendered on Seed node because it has 1 downstream branch
    const collapseBtn = screen.getByTitle(
      /Collapse downstream subtree \(1 branch\)/i,
    );
    expect(collapseBtn).toBeInTheDocument();

    // Collapse the subtree
    fireEvent.click(collapseBtn);

    // Downstream child 'Heartbeat Protocol' is pruned from view
    expect(screen.queryByText('Heartbeat Protocol')).not.toBeInTheDocument();
    // Seed node remains visible
    expect(screen.getByText('Consensus Algorithms')).toBeInTheDocument();

    // Verify info details popover records collapsed branch count
    fireEvent.click(screen.getByRole('button', { name: /Query details/i }));
    expect(screen.getByText('1 branch')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Close info/i }));

    // The button now says Expand
    const expandBtn = screen.getByTitle(
      /Expand downstream subtree \(1 branch\)/i,
    );
    expect(expandBtn).toBeInTheDocument();

    // Expand the subtree again
    fireEvent.click(expandBtn);

    // Downstream child is restored
    expect(screen.getByText('Heartbeat Protocol')).toBeInTheDocument();
  });

  it('formats vector similarity percentage and shared keywords on crawl edges', () => {
    const edgeWithSimAndKeywords = {
      id: 'edge-sim-1',
      source: 'crawl-node-0',
      target: 'crawl-node-1',
      level: 1,
      direction: 'forward' as const,
      similarityScore: 0.884,
      sharedKeywords: ['consensus', 'heartbeat'],
    };

    // Standard hop edge
    expect(formatCrawlEdgeLabel(edgeWithSimAndKeywords)).toBe(
      'Hop 1 · 88% Sim · [consensus, heartbeat]',
    );

    // Isolated trail edge with step sequence
    expect(
      formatCrawlEdgeLabel(edgeWithSimAndKeywords, {
        isEdgeInPath: true,
        stepNumber: 2,
      }),
    ).toBe('Step 2 · Hop 1 · 88% Sim · [consensus, heartbeat]');

    // Legacy edge without similarity or keywords
    const legacyEdge = {
      id: 'edge-legacy',
      source: 'crawl-node-0',
      target: 'crawl-node-1',
      level: 2,
      direction: 'forward' as const,
    };
    expect(formatCrawlEdgeLabel(legacyEdge)).toBe('Hop 2');
  });

  it('computes subtree narrative synthesis with trajectory, similarity, and themes', () => {
    const rootNode = mockCrawlResults.nodes[0]!;
    const descendantNode = mockCrawlResults.nodes[1]!;
    const edges = [
      {
        id: 'e1',
        source: rootNode.id,
        target: descendantNode.id,
        level: 1,
        direction: 'forward' as const,
        similarityScore: 0.88,
        sharedKeywords: ['consensus', 'heartbeat'],
      },
    ];

    const synthesis = synthesizeSubtree(rootNode, [descendantNode], edges);
    expect(synthesis.rootTitle).toBe('Consensus Algorithms');
    expect(synthesis.totalNodes).toBe(2);
    expect(synthesis.totalHops).toBe(1);
    expect(synthesis.averageSimilarity).toBe(0.88);
    expect(synthesis.topicTrajectory).toEqual([
      'Consensus Algorithms',
      'Heartbeat Protocol',
    ]);
    expect(synthesis.sharedThemes).toEqual(['consensus', 'heartbeat']);
    expect(synthesis.keyTakeaways).toHaveLength(2);
    expect(synthesis.narrative).toContain('Consensus Algorithms');
    expect(synthesis.narrative).toContain('Heartbeat Protocol');
    expect(synthesis.narrative).toContain('consensus, heartbeat');
  });

  it('filters crawl branches interactively with multiselect edge keywords computing union', () => {
    const multiBranchResults: CrawlResponse = {
      ...mockCrawlResults,
      nodes: [
        {
          id: 'seed-0',
          level: 0,
          nodeId: 'node-seed',
          nodeTitle: 'Base Algorithms',
          score: 0.95,
          chunk: {
            ...mockCrawlResults.nodes[0]!.chunk,
            nodeId: 'node-seed',
          },
        },
        {
          id: 'raft-1',
          level: 1,
          nodeId: 'node-raft',
          nodeTitle: 'Raft Branch',
          score: 0.9,
          chunk: {
            ...mockCrawlResults.nodes[0]!.chunk,
            nodeId: 'node-raft',
          },
        },
        {
          id: 'paxos-1',
          level: 1,
          nodeId: 'node-paxos',
          nodeTitle: 'Paxos Branch',
          score: 0.86,
          chunk: {
            ...mockCrawlResults.nodes[0]!.chunk,
            nodeId: 'node-paxos',
          },
        },
        {
          id: 'heartbeat-2',
          level: 2,
          nodeId: 'node-heartbeat',
          nodeTitle: 'Heartbeat Leaf',
          score: 0.84,
          chunk: {
            ...mockCrawlResults.nodes[0]!.chunk,
            nodeId: 'node-heartbeat',
          },
        },
      ],
      edges: [
        {
          id: 'e-raft',
          source: 'seed-0',
          target: 'raft-1',
          level: 1,
          direction: 'forward',
          sharedKeywords: ['consensus', 'election'],
          similarityScore: 0.92,
        },
        {
          id: 'e-paxos',
          source: 'seed-0',
          target: 'paxos-1',
          level: 1,
          direction: 'forward',
          sharedKeywords: ['consensus', 'synod'],
          similarityScore: 0.86,
        },
        {
          id: 'e-hb',
          source: 'raft-1',
          target: 'heartbeat-2',
          level: 2,
          direction: 'forward',
          sharedKeywords: ['heartbeat', 'election'],
          similarityScore: 0.89,
        },
      ],
      maxLevelReached: 2,
      totalMatches: 4,
    };

    render(
      <CrawlResultsCanvas
        crawlResults={multiBranchResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Initial state: all 4 nodes visible
    expect(screen.getByText('Base Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Raft Branch')).toBeInTheDocument();
    expect(screen.getByText('Paxos Branch')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat Leaf')).toBeInTheDocument();

    // Open filter drawer
    fireEvent.click(screen.getByRole('button', { name: /Filter Traversal/i }));

    // Edge keyword pills should be rendered with frequencies
    expect(screen.getByText('Edge Keywords & Concepts')).toBeInTheDocument();
    const synodPill = screen.getByTitle(/Filter branches by keyword "synod"/i);
    expect(synodPill).toBeInTheDocument();

    // Filter by "synod": only Base Algorithms and Paxos Branch should survive
    fireEvent.click(synodPill);

    expect(screen.getByText('Base Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Paxos Branch')).toBeInTheDocument();
    expect(screen.queryByText('Raft Branch')).not.toBeInTheDocument();
    expect(screen.queryByText('Heartbeat Leaf')).not.toBeInTheDocument();

    // Active keyword chip displayed in toolbar
    const keywordChip = document.querySelector('.crawl-active-keyword-chip');
    expect(keywordChip).not.toBeNull();
    expect(keywordChip).toHaveTextContent('synod');

    // Multiselect another concept: "election"
    const electionPill = screen.getByTitle(
      /Filter branches by keyword "election"/i,
    );
    fireEvent.click(electionPill);

    // Both "synod" and "election" are selected. Since it computes a UNION, all 4 nodes survive!
    expect(screen.getByText('Base Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Paxos Branch')).toBeInTheDocument();
    expect(screen.getByText('Raft Branch')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat Leaf')).toBeInTheDocument();
    expect(keywordChip).toHaveTextContent('Keywords (2)');

    // Clear filters via clear button on toolbar chip
    const clearKeywordBtn = screen.getByRole('button', {
      name: /Clear keyword filters/i,
    });
    fireEvent.click(clearKeywordBtn);

    // Full graph restored and chip disappears
    expect(document.querySelector('.crawl-active-keyword-chip')).toBeNull();
    expect(screen.getByText('Raft Branch')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat Leaf')).toBeInTheDocument();
  });

  it('opens and closes on-demand subtree narrative synthesis card for branch nodes', () => {
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Consensus Algorithms has 1 child, so Synthesize button should be rendered
    const synthBtn = screen.getByTitle(
      /Synthesize downstream branch narrative/i,
    );
    expect(synthBtn).toBeInTheDocument();

    // Dialog not open initially
    expect(
      screen.queryByRole('dialog', {
        name: /Subtree Synthesis for Consensus Algorithms/i,
      }),
    ).not.toBeInTheDocument();

    // Click Synthesize
    fireEvent.click(synthBtn);

    // Dialog opens
    const dialog = screen.getByRole('dialog', {
      name: /Subtree Synthesis for Consensus Algorithms/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText('Subtree Synthesis: Consensus Algorithms'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
    expect(screen.getByText('1 hop')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Investigation branch rooted at "Consensus Algorithms"/i,
      ),
    ).toBeInTheDocument();

    // Close dialog
    const closeBtn = screen.getByRole('button', { name: /Close synthesis/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exports investigation trail dossier containing applied filters and subtree syntheses', () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(
      (tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          el.click = vi.fn();
        }
        return el;
      },
    );
    let capturedDownloadBlobContent = '';

    const originalBlob = globalThis.Blob;
    globalThis.Blob = class MockBlob extends originalBlob {
      constructor(sources?: BlobPart[], options?: BlobPropertyBag) {
        super(sources, options);
        if (sources && typeof sources[0] === 'string') {
          capturedDownloadBlobContent = sources[0];
        }
      }
    };

    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const exportBtn = screen.getByRole('button', { name: /Export Trail/i });
    fireEvent.click(exportBtn);

    const mdMenuItem = screen.getByRole('menuitem', {
      name: /Markdown Report/i,
    });
    fireEvent.click(mdMenuItem);

    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(capturedDownloadBlobContent).toContain('# Investigation Trail');
    expect(capturedDownloadBlobContent).toContain(
      '## Exploration & Match Classification',
    );
    expect(capturedDownloadBlobContent).toContain(
      '## Subtree Narrative Syntheses',
    );
    expect(capturedDownloadBlobContent).toContain(
      '### Branch: Consensus Algorithms',
    );
    expect(capturedDownloadBlobContent).toContain(
      'Investigation branch rooted at "Consensus Algorithms"',
    );
    expect(capturedDownloadBlobContent).toContain('[Seed]');
    expect(capturedDownloadBlobContent).toContain('[Dig]');

    globalThis.Blob = originalBlob;
  });

  it('exports investigation canvas as Obsidian Canvas JSON (.canvas) with spatial node coordinates and colors', () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');
    const origCreateElement = document.createElement.bind(document);
    let capturedDownloadFilename = '';
    vi.spyOn(document, 'createElement').mockImplementation(
      (tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          el.click = vi.fn();
          Object.defineProperty(el, 'download', {
            set: (val: string) => {
              capturedDownloadFilename = val;
            },
            get: () => capturedDownloadFilename,
          });
        }
        return el;
      },
    );
    let capturedDownloadBlobContent = '';

    const originalBlob = globalThis.Blob;
    globalThis.Blob = class MockBlob extends originalBlob {
      constructor(sources?: BlobPart[], options?: BlobPropertyBag) {
        super(sources, options);
        if (sources && typeof sources[0] === 'string') {
          capturedDownloadBlobContent = sources[0];
        }
      }
    };

    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Open export dropdown and select Obsidian Canvas
    const exportBtn = screen.getByRole('button', { name: /Export Trail/i });
    fireEvent.click(exportBtn);

    const canvasMenuItem = screen.getByRole('menuitem', {
      name: /Obsidian Canvas/i,
    });
    fireEvent.click(canvasMenuItem);

    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(capturedDownloadFilename).toMatch(/\.canvas$/);

    const parsedCanvas = JSON.parse(capturedDownloadBlobContent);
    expect(parsedCanvas).toHaveProperty('nodes');
    expect(parsedCanvas).toHaveProperty('edges');
    expect(parsedCanvas.nodes.length).toBe(2);
    expect(parsedCanvas.edges.length).toBe(1);

    // Node 0 is Seed (color: #3b82f6)
    const seedNode = parsedCanvas.nodes[0];
    expect(seedNode.id).toBe('crawl-node-0');
    expect(seedNode.type).toBe('text');
    expect(seedNode.color).toBe('#3b82f6');
    expect(seedNode.text).toContain('[SEED] Consensus Algorithms');
    expect(seedNode.text).toContain('Leader Election in Raft');

    // Edge 0 connects node-0 to node-1 with arrow
    const edge0 = parsedCanvas.edges[0];
    expect(edge0.fromNode).toBe('crawl-node-0');
    expect(edge0.toNode).toBe('crawl-node-1');
    expect(edge0.toEnd).toBe('arrow');
    expect(edge0.color).toBe('#10b981'); // emerald for dig

    globalThis.Blob = originalBlob;
  });

  it('handles Escape key workflow: unselects active node trail or prompts return confirmation', () => {
    const onClose = vi.fn();
    render(
      <CrawlResultsCanvas
        crawlResults={mockCrawlResults}
        onOpenSource={vi.fn()}
        onClose={onClose}
      />,
    );

    const hopArticle = screen
      .getByText('Heartbeat Protocol')
      .closest('article')!;

    // 1. Click node to select trail
    fireEvent.click(hopArticle);
    expect(hopArticle).toHaveClass('is-trail-target');

    // Pressing Escape unselects trail
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(hopArticle).not.toHaveClass('is-trail-target');
    expect(
      screen.queryByRole('dialog', { name: /Return to Canvas\?/i }),
    ).not.toBeInTheDocument();

    // 2. Pressing Escape when nothing is selected opens return confirmation modal
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.getByRole('dialog', { name: /Return to Canvas\?/i }),
    ).toBeInTheDocument();

    // Pressing Cancel closes modal without calling onClose
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(
      screen.queryByRole('dialog', { name: /Return to Canvas\?/i }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // Pressing Escape again and confirming calls onClose
    fireEvent.keyDown(window, { key: 'Escape' });
    const confirmBtn = screen.getByRole('button', {
      name: /Return to Canvas/i,
    });
    fireEvent.click(confirmBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders crawl summary breakdown pills row with seed topic, digs, links, and jumps', () => {
    const summaryCrawlResults: CrawlResponse = {
      ...mockCrawlResults,
      stats: {
        seedTitle: 'Raft Consensus Protocol',
        digsCount: 3,
        linksCount: 2,
        jumpsCount: 1,
      },
      nodes: [
        {
          id: 'seed-node',
          level: 0,
          nodeId: 'node-seed',
          nodeTitle: 'Raft Consensus Protocol',
          score: 0.95,
          matchType: 'seed',
          chunk: mockCrawlResults.nodes[0]!.chunk,
        },
        {
          id: 'dig-node',
          level: 1,
          nodeId: 'node-dig',
          nodeTitle: 'Heartbeat RPC Details',
          score: 0.88,
          matchType: 'dig',
          chunk: mockCrawlResults.nodes[0]!.chunk,
        },
        {
          id: 'link-node',
          level: 1,
          nodeId: 'node-link',
          nodeTitle: 'Paxos Comparison',
          score: 0.85,
          matchType: 'link',
          chunk: mockCrawlResults.nodes[0]!.chunk,
        },
        {
          id: 'jump-node',
          level: 2,
          nodeId: 'node-jump',
          nodeTitle: 'Distributed Systems Storage',
          score: 0.82,
          matchType: 'jump',
          chunk: mockCrawlResults.nodes[0]!.chunk,
        },
      ],
      totalMatches: 4,
    };

    render(
      <CrawlResultsCanvas
        crawlResults={summaryCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Summary pills row
    const summaryRow = screen.getByRole('region', { name: /Crawl summary/i });
    expect(summaryRow).toBeInTheDocument();

    // Verify seed pill
    expect(
      within(summaryRow).getByText('Raft Consensus Protocol'),
    ).toBeInTheDocument();

    // Verify Digs, Links, Jumps pills
    expect(screen.getByText('Digs:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('Links:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    expect(screen.getByText('Jumps:')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    expect(screen.getByText(/4 matches/i)).toBeInTheDocument();
  });

  it('displays Crawl Exploration details (Digs, Links, Jumps, Seed) in the Query & Crawl Details popover', () => {
    const detailCrawlResults: CrawlResponse = {
      ...mockCrawlResults,
      stats: {
        seedTitle: 'Consensus Algorithms',
        digsCount: 2,
        linksCount: 1,
        jumpsCount: 0,
      },
    };

    render(
      <CrawlResultsCanvas
        crawlResults={detailCrawlResults}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Open info popover
    const infoBtn = screen.getByRole('button', { name: /Query details/i });
    fireEvent.click(infoBtn);

    // Popover contains details and crawl classification counts
    const popover = screen.getByRole('dialog', { name: /Query Details/i });
    expect(popover).toBeInTheDocument();
    expect(
      within(popover).getByText('Query & Crawl Details'),
    ).toBeInTheDocument();
    expect(within(popover).getByText('Seed Topic:')).toBeInTheDocument();
    expect(
      within(popover).getByText('Consensus Algorithms'),
    ).toBeInTheDocument();
    expect(within(popover).getByText('Digs:')).toBeInTheDocument();
    expect(within(popover).getByText(/2 detail matches/i)).toBeInTheDocument();
    expect(within(popover).getByText('Links:')).toBeInTheDocument();
    expect(
      within(popover).getByText(/1 perspective connections/i),
    ).toBeInTheDocument();
    expect(within(popover).getByText('Jumps:')).toBeInTheDocument();
    expect(
      within(popover).getByText(/0 topic transitions/i),
    ).toBeInTheDocument();
  });

  it('formats edge labels and visual attributes based on candidate match types (dig, link, jump)', () => {
    const digEdge = {
      id: 'e-dig',
      source: 'seed-node',
      target: 'dig-node',
      level: 1,
      direction: 'forward' as const,
      matchType: 'dig' as const,
      similarityScore: 0.9,
    };
    const linkEdge = {
      id: 'e-link',
      source: 'seed-node',
      target: 'link-node',
      level: 1,
      direction: 'forward' as const,
      matchType: 'link' as const,
    };
    const jumpEdge = {
      id: 'e-jump',
      source: 'link-node',
      target: 'jump-node',
      level: 2,
      direction: 'forward' as const,
      matchType: 'jump' as const,
      similarityScore: 0.85,
    };

    expect(formatCrawlEdgeLabel(digEdge)).toBe('Dig · Hop 1 · 90% Sim');
    expect(formatCrawlEdgeLabel(linkEdge)).toBe('Link · Hop 1');
    expect(formatCrawlEdgeLabel(jumpEdge)).toBe('Jump · Hop 2 · 85% Sim');
    expect(
      formatCrawlEdgeLabel(digEdge, { isEdgeInPath: true, stepNumber: 1 }),
    ).toBe('Dig · Step 1 · Hop 1 · 90% Sim');
  });

  it('renders distinct match type badges (Seed, Dig, Link, Jump) on crawl nodes', () => {
    const multiTypeCrawl: CrawlResponse = {
      ...mockCrawlResults,
      maxLevelReached: 2,
      nodes: [
        {
          id: 'crawl-seed',
          level: 0,
          nodeId: 'node-1',
          nodeTitle: 'Raft Consensus Core',
          score: 0.95,
          matchType: 'seed',
          chunk: mockCrawlResults.nodes[0]!.chunk,
        },
        {
          id: 'crawl-dig',
          level: 1,
          nodeId: 'node-2',
          nodeTitle: 'Heartbeat Protocol Detail',
          score: 0.88,
          matchType: 'dig',
          parentCrawlNodeId: 'crawl-seed',
          chunk: mockCrawlResults.nodes[1]!.chunk,
        },
        {
          id: 'crawl-link',
          level: 1,
          nodeId: 'node-3',
          nodeTitle: 'Paxos Comparison Bridge',
          score: 0.82,
          matchType: 'link',
          parentCrawlNodeId: 'crawl-seed',
          chunk: mockCrawlResults.nodes[0]!.chunk,
        },
        {
          id: 'crawl-jump',
          level: 2,
          nodeId: 'node-4',
          nodeTitle: 'Byzantine Fault Tolerance',
          score: 0.79,
          matchType: 'jump',
          parentCrawlNodeId: 'crawl-link',
          chunk: mockCrawlResults.nodes[0]!.chunk,
        },
      ],
      edges: [
        {
          id: 'e-1',
          source: 'crawl-seed',
          target: 'crawl-dig',
          level: 1,
          direction: 'forward',
          matchType: 'dig',
        },
        {
          id: 'e-2',
          source: 'crawl-seed',
          target: 'crawl-link',
          level: 1,
          direction: 'forward',
          matchType: 'link',
        },
        {
          id: 'e-3',
          source: 'crawl-link',
          target: 'crawl-jump',
          level: 2,
          direction: 'forward',
          matchType: 'jump',
        },
      ],
      totalMatches: 4,
    };

    render(
      <CrawlResultsCanvas
        crawlResults={multiTypeCrawl}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Verify match type tags in the document
    expect(screen.getByText('Seed')).toBeInTheDocument();
    expect(screen.getByText('Dig')).toBeInTheDocument();
    expect(screen.getByText('Link')).toBeInTheDocument();
    expect(screen.getByText('Jump')).toBeInTheDocument();

    // Verify node titles
    expect(screen.getByText('Raft Consensus Core')).toBeInTheDocument();
    expect(screen.getByText('Heartbeat Protocol Detail')).toBeInTheDocument();
    expect(screen.getByText('Paxos Comparison Bridge')).toBeInTheDocument();
    expect(screen.getByText('Byzantine Fault Tolerance')).toBeInTheDocument();

    // Verify obsolete entropy badges and pruned tag do NOT exist
    expect(
      document.querySelector('.crawl-node-entropy-tag'),
    ).not.toBeInTheDocument();
    expect(document.querySelector('.crawl-pruned-tag')).not.toBeInTheDocument();
  });

  it('renders live streaming progress pill during streaming crawl', () => {
    const streamingCrawl: CrawlResponse = {
      queryId: 'streaming',
      queryType: 'crawl',
      queryText: 'streaming live crawl test',
      startingNodeIds: ['seed-1'],
      crawlDepth: 'default',
      direction: 'forward',
      sensitivity: 'medium',
      maxLevelReached: 2,
      totalMatches: 2,
      matchedNodeIds: ['seed-1', 'hop-1'],
      remaining: 0,
      nodes: [
        {
          id: 'seed-1',
          level: 0,
          nodeId: 'seed-1',
          nodeTitle: 'Streaming Seed',
          score: 0.95,
          matchType: 'seed',
          chunk: mockCrawlResults.nodes[0]!.chunk,
        },
        {
          id: 'hop-1',
          level: 1,
          nodeId: 'hop-1',
          nodeTitle: 'Streaming Frontier Hop',
          score: 0.85,
          matchType: 'dig',
          parentCrawlNodeId: 'seed-1',
          chunk: mockCrawlResults.nodes[1]!.chunk,
        },
      ],
      edges: [
        {
          id: 'e-1',
          source: 'seed-1',
          target: 'hop-1',
          level: 1,
          direction: 'forward',
          matchType: 'dig',
        },
      ],
    };

    render(
      <CrawlResultsCanvas
        crawlResults={streamingCrawl}
        isStreaming={true}
        crawlStepProgress={{
          graphId: 'g1',
          level: 2,
          status: 'hop_evaluated',
          message: 'Hop 2 evaluated',
          matchesCount: 2,
        }}
        onOpenSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const streamPill = document.querySelector('.crawl-streaming-pill');
    expect(streamPill).toBeInTheDocument();
    expect(screen.getByText(/Streaming Hop 2/i)).toBeInTheDocument();
    expect(screen.getByText(/· 2 matches/i)).toBeInTheDocument();

    // Verify absence of old entropy pill
    expect(
      document.querySelector('.crawl-stream-entropy-pill'),
    ).not.toBeInTheDocument();
  });

  it('renders image thumbnail preview and figure badge in crawl nodes when imageAssetUrl is present', () => {
    const onOpenSource = vi.fn();
    const nodeData = {
      crawlNode: {
        ...mockCrawlResults.nodes[0]!,
        chunk: {
          ...mockCrawlResults.nodes[0]!.chunk,
          imageAssetUrl: '/api/sources/source-1/assets/diagram.png',
        },
      },
      onOpenSource,
      isSeed: true,
    };

    render(
      <ReactFlowProvider>
        <CrawlResultNode
          {...({
            id: 'test-node-1',
            data: nodeData,
            type: 'crawlResult',
            selected: false,
            zIndex: 0,
            isConnectable: false,
            dragging: false,
          } as any)}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('Figure')).toBeInTheDocument();
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe(
      '/api/sources/source-1/assets/diagram.png',
    );

    // Clicking image opens source at that chunk
    fireEvent.click(img.parentElement!);
    expect(onOpenSource).toHaveBeenCalledWith(
      'source-1',
      expect.objectContaining({
        imageAssetUrl: '/api/sources/source-1/assets/diagram.png',
      }),
    );
  });
});
