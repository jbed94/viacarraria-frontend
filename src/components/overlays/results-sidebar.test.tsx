import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../i18n';
import { ResultsSidebar } from './results-sidebar';

const directMatch = {
  graphId: 'graph',
  sourceId: 'source-match',
  sourceName: 'Direct Notes.md',
  nodeId: 'node-match',
  content: 'Direct query match',
  context: 'Direct query match context',
  startChar: 0,
  endChar: 18,
  pageNum: 1,
  score: 0.9,
  kind: 'MATCH' as const,
  extendedContext: [
    {
      graphId: 'graph',
      sourceId: 'source-context',
      sourceName: 'Adjacent Notes.md',
      nodeId: 'node-adjacent',
      content: 'One-hop extended context',
      context: 'One-hop extended context source',
      startChar: 0,
      endChar: 24,
      pageNum: 1,
      score: 0.8,
      kind: 'EXTENDED' as const,
    },
  ],
};

describe('ResultsSidebar', () => {
  afterEach(cleanup);

  it('groups direct matches by source and opens each context level correctly', () => {
    const onOpenSource = vi.fn();
    const onOpenMatch = vi.fn();
    render(
      <ResultsSidebar
        results={{
          queryId: 'query',
          results: [
            {
              nodeId: directMatch.nodeId,
              matchCount: 1,
              chunks: [directMatch],
            },
          ],
          matchedNodeIds: [directMatch.nodeId],
          remaining: 2,
          extendedSearch: true,
          extendedContextCount: 1,
        }}
        onOpenSource={onOpenSource}
        onOpenMatch={onOpenMatch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Direct Notes.md' }));
    expect(onOpenSource).toHaveBeenCalledWith('source-match');

    fireEvent.click(screen.getByText('Direct query match'));
    expect(onOpenMatch).toHaveBeenCalledWith(directMatch);

    // Verify page badges are displayed for both chunks
    expect(screen.getAllByText('p.1')).toHaveLength(2);

    fireEvent.click(screen.getByText('One-hop extended context'));
    expect(onOpenMatch).toHaveBeenCalledWith(directMatch.extendedContext[0]);
  });

  it('does not render outside visual results mode data', () => {
    const { container } = render(
      <ResultsSidebar onOpenSource={vi.fn()} onOpenMatch={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders Table badge for search chunks with elementType table', () => {
    const tableMatch = {
      ...directMatch,
      elementType: 'table',
      extendedContext: [
        {
          ...directMatch.extendedContext[0]!,
          elementType: 'table',
        },
      ],
    };

    render(
      <ResultsSidebar
        results={{
          queryId: 'query-table',
          results: [
            {
              nodeId: tableMatch.nodeId,
              matchCount: 1,
              chunks: [tableMatch],
            },
          ],
          matchedNodeIds: [tableMatch.nodeId],
          remaining: 5,
          extendedSearch: true,
          extendedContextCount: 1,
        }}
        onOpenSource={vi.fn()}
        onOpenMatch={vi.fn()}
      />,
    );

    // Verify Table badges are rendered for both direct match and extended context
    const tableBadges = screen.getAllByText('Table');
    expect(tableBadges).toHaveLength(2);
  });

  it('filters extended context items by scope pills (All, This Document, Adjacent Nodes)', () => {
    const multiContextMatch = {
      ...directMatch,
      extendedContext: [
        {
          graphId: 'graph',
          sourceId: directMatch.sourceId, // same source!
          sourceName: directMatch.sourceName,
          nodeId: directMatch.nodeId,
          content: 'Same document earlier paragraph',
          context: 'Same document context',
          startChar: 50,
          endChar: 80,
          pageNum: 1,
          score: 0.82,
          kind: 'EXTENDED' as const,
        },
        {
          graphId: 'graph',
          sourceId: 'source-adjacent', // adjacent node source!
          sourceName: 'Adjacent Architecture.md',
          nodeId: 'node-adjacent',
          content: 'Adjacent node related concept',
          context: 'Adjacent node context',
          startChar: 10,
          endChar: 40,
          pageNum: 2,
          score: 0.79,
          kind: 'EXTENDED' as const,
        },
      ],
    };

    render(
      <ResultsSidebar
        results={{
          queryId: 'query-filter',
          results: [
            {
              nodeId: multiContextMatch.nodeId,
              matchCount: 1,
              chunks: [multiContextMatch],
            },
          ],
          matchedNodeIds: [multiContextMatch.nodeId],
          remaining: 0,
          extendedSearch: true,
          extendedContextCount: 2,
        }}
        onOpenSource={vi.fn()}
        onOpenMatch={vi.fn()}
      />,
    );

    // Initial state: 'All' active, both extended context chunks visible
    expect(
      screen.getByText('Same document earlier paragraph'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Adjacent node related concept'),
    ).toBeInTheDocument();

    // Click 'This Document' filter
    fireEvent.click(screen.getByRole('button', { name: 'This Document' }));
    expect(
      screen.getByText('Same document earlier paragraph'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Adjacent node related concept'),
    ).not.toBeInTheDocument();

    // Click 'Adjacent Nodes' filter
    fireEvent.click(screen.getByRole('button', { name: 'Adjacent Nodes' }));
    expect(
      screen.queryByText('Same document earlier paragraph'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Adjacent node related concept'),
    ).toBeInTheDocument();

    // Click 'All' filter
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(
      screen.getByText('Same document earlier paragraph'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Adjacent node related concept'),
    ).toBeInTheDocument();
  });

  it('renders Lead Direct Answer hero card with answer type, score, and graph concept navigation', () => {
    const onOpenMatch = vi.fn();
    const onSelectNode = vi.fn();

    const leadChunk = {
      graphId: 'graph-1',
      sourceId: 'src-algo',
      sourceName: 'Algorithms-Guide.pdf',
      nodeId: 'node-dijkstra',
      content:
        '# Shortest Path Algorithm\nStep 1: Initialize min-heap dist array.\nStep 2: While queue is not empty, extract min.',
      context: 'Algorithm full context',
      startChar: 0,
      endChar: 110,
      pageNum: 4,
      score: 0.95,
      rerankScore: 0.95,
      kind: 'MATCH' as const,
    };

    render(
      <ResultsSidebar
        results={{
          queryId: 'query-qa',
          leadAnswer: {
            chunk: leadChunk,
            score: 0.95,
            answerType: 'procedural',
            prerequisiteNodes: [
              { id: 'node-heap', title: 'Min-Heap Priority Queue' },
            ],
            extensionNodes: [
              { id: 'node-astar', title: 'A* Search Heuristic' },
            ],
          },
          results: [
            {
              nodeId: 'node-dijkstra',
              matchCount: 1,
              chunks: [leadChunk],
            },
          ],
          matchedNodeIds: ['node-dijkstra'],
          remaining: 10,
          extendedSearch: false,
          extendedContextCount: 0,
        }}
        onOpenSource={vi.fn()}
        onOpenMatch={onOpenMatch}
        onSelectNode={onSelectNode}
      />,
    );

    // Verify Direct Answer hero badges
    expect(screen.getByText('QA Mode')).toBeInTheDocument();
    const hero = screen.getByLabelText('Direct Answer');
    const withinHero = within(hero);

    expect(withinHero.getByText('Direct Answer')).toBeInTheDocument();
    expect(withinHero.getByText('Procedure')).toBeInTheDocument();
    expect(withinHero.getByText('95% Salience')).toBeInTheDocument();

    // Verify lead answer source and page info
    expect(withinHero.getByText('Algorithms-Guide.pdf')).toBeInTheDocument();
    expect(withinHero.getByText('p.4')).toBeInTheDocument();

    // Verify prerequisite and next-step navigation chips
    expect(withinHero.getByText('Min-Heap Priority Queue')).toBeInTheDocument();
    expect(withinHero.getByText('A* Search Heuristic')).toBeInTheDocument();

    // Clicking prerequisite chip focuses node on canvas
    fireEvent.click(
      withinHero.getByRole('button', { name: 'Min-Heap Priority Queue' }),
    );
    expect(onSelectNode).toHaveBeenCalledWith('node-heap');

    // Clicking extension chip focuses node on canvas
    fireEvent.click(
      withinHero.getByRole('button', { name: 'A* Search Heuristic' }),
    );
    expect(onSelectNode).toHaveBeenCalledWith('node-astar');

    // Clicking lead answer card body opens the match in PDF dialog
    fireEvent.click(
      withinHero.getByText(
        'Shortest Path Algorithm Step 1: Initialize min-heap dist array. Step 2: While queue is not empty, extract min.',
      ),
    );
    expect(onOpenMatch).toHaveBeenCalledWith(leadChunk);
  });

  it('calls onClose when exit button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ResultsSidebar
        results={{
          queryId: 'query',
          results: [
            {
              nodeId: directMatch.nodeId,
              matchCount: 1,
              chunks: [directMatch],
            },
          ],
          matchedNodeIds: [directMatch.nodeId],
          remaining: 2,
          extendedSearch: false,
          extendedContextCount: 0,
        }}
        onOpenSource={vi.fn()}
        onOpenMatch={vi.fn()}
        onClose={onClose}
      />,
    );

    const exitBtn = screen.getByRole('button', { name: /close/i });
    expect(exitBtn).toBeInTheDocument();
    fireEvent.click(exitBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <ResultsSidebar
        results={{
          queryId: 'query',
          results: [
            {
              nodeId: directMatch.nodeId,
              matchCount: 1,
              chunks: [directMatch],
            },
          ],
          matchedNodeIds: [directMatch.nodeId],
          remaining: 2,
          extendedSearch: false,
          extendedContextCount: 0,
        }}
        onOpenSource={vi.fn()}
        onOpenMatch={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates exit button and ignores Escape when activeSourceId is present', () => {
    const onClose = vi.fn();
    render(
      <ResultsSidebar
        results={{
          queryId: 'query',
          results: [
            {
              nodeId: directMatch.nodeId,
              matchCount: 1,
              chunks: [directMatch],
            },
          ],
          matchedNodeIds: [directMatch.nodeId],
          remaining: 2,
          extendedSearch: false,
          extendedContextCount: 0,
        }}
        activeSourceId="source-1"
        onOpenSource={vi.fn()}
        onOpenMatch={vi.fn()}
        onClose={onClose}
      />,
    );

    const exitBtn = screen.getByRole('button', { name: 'Close source dialog' });
    expect(exitBtn).toBeInTheDocument();
    expect(exitBtn).toHaveAttribute('title', 'Close source dialog');

    // Pressing Escape does not close results when activeSourceId is open
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    // Clicking exit button calls onClose
    fireEvent.click(exitBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders horizontal resize handle with characteristic lines and toggles width on double click', () => {
    render(
      <ResultsSidebar
        results={{
          queryId: 'query',
          results: [
            {
              nodeId: directMatch.nodeId,
              matchCount: 1,
              chunks: [directMatch],
            },
          ],
          matchedNodeIds: [directMatch.nodeId],
          remaining: 0,
          extendedSearch: false,
          extendedContextCount: 0,
        }}
        onOpenSource={vi.fn()}
        onOpenMatch={vi.fn()}
      />,
    );

    const resizeHandle = screen.getByRole('separator', {
      name: /resize results panel/i,
    });
    expect(resizeHandle).toBeInTheDocument();
    expect(resizeHandle).toHaveAttribute('aria-orientation', 'vertical');

    const sidebar = screen.getByRole('complementary', { name: /results/i });
    expect(sidebar).toHaveStyle({ width: '380px' });

    // Double click toggles to expanded width
    fireEvent.doubleClick(resizeHandle);
    expect(sidebar).toHaveStyle({ width: '600px' });

    // Double click again returns to default width
    fireEvent.doubleClick(resizeHandle);
    expect(sidebar).toHaveStyle({ width: '380px' });
  });

  it('opens Search & Query Answering Guide dialog when info button is clicked', async () => {
    render(
      <ResultsSidebar
        results={{
          queryId: 'query',
          results: [
            {
              nodeId: directMatch.nodeId,
              matchCount: 1,
              chunks: [directMatch],
            },
          ],
          matchedNodeIds: [directMatch.nodeId],
          remaining: 0,
          extendedSearch: false,
          extendedContextCount: 0,
        }}
        onOpenSource={vi.fn()}
        onOpenMatch={vi.fn()}
      />,
    );

    const infoBtn = screen.getByRole('button', {
      name: /search guide & legend/i,
    });
    expect(infoBtn).toBeInTheDocument();

    // Dialog is initially closed
    expect(
      screen.queryByText('Search & Query Answering Guide'),
    ).not.toBeInTheDocument();

    // Click opens guide dialog
    fireEvent.click(infoBtn);
    expect(
      await screen.findByText('Search & Query Answering Guide'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Indicators & Legend')).toBeInTheDocument();
  });
});
