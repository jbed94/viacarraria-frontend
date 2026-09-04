import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
});
