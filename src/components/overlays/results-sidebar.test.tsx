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

    fireEvent.click(
      screen.getByText('Adjacent Notes.md: One-hop extended context'),
    );
    expect(onOpenMatch).toHaveBeenCalledWith(directMatch.extendedContext[0]);
  });

  it('does not render outside visual results mode data', () => {
    const { container } = render(
      <ResultsSidebar onOpenSource={vi.fn()} onOpenMatch={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
