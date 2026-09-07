import { describe, expect, it } from 'vitest';

import type { SearchChunk, SearchResponse } from '../types/api';
import { getSourceMatches } from './search-utils';

describe('search-utils: getSourceMatches', () => {
  it('returns empty array when results or activeSourceId is missing', () => {
    expect(getSourceMatches(undefined, 'src-1')).toEqual([]);
    expect(getSourceMatches({ results: [] } as any, undefined)).toEqual([]);
    expect(getSourceMatches(undefined, undefined)).toEqual([]);
  });

  it('filters chunks by activeSourceId and deduplicates overlapping chunks favoring MATCH', () => {
    const chunk1: SearchChunk = {
      graphId: 'g-1',
      nodeId: 'node-1',
      sourceId: 'src-1',
      sourceName: 'paper.pdf',
      content: 'Important result',
      context: 'context',
      startChar: 10,
      endChar: 50,
      pageNum: 1,
      score: 0.9,
      kind: 'MATCH',
    };
    const contextChunk: SearchChunk = {
      graphId: 'g-1',
      nodeId: 'node-1',
      sourceId: 'src-1',
      sourceName: 'paper.pdf',
      content: 'Important result (context version)',
      context: 'context',
      startChar: 10,
      endChar: 50,
      pageNum: 1,
      score: 0.8,
      kind: 'EXTENDED',
    };
    const chunkOtherSource: SearchChunk = {
      graphId: 'g-1',
      nodeId: 'node-1',
      sourceId: 'src-2',
      sourceName: 'other.pdf',
      content: 'Other source content',
      context: 'context',
      startChar: 0,
      endChar: 40,
      pageNum: 1,
      score: 0.7,
      kind: 'MATCH',
    };

    const mockResponse: SearchResponse = {
      queryId: 'q-1',
      matchedNodeIds: ['node-1'],
      remaining: 10,
      extendedSearch: false,
      extendedContextCount: 1,
      results: [
        {
          nodeId: 'node-1',
          matchCount: 2,
          chunks: [
            {
              ...contextChunk,
              extendedContext: [chunk1],
            },
            chunkOtherSource,
          ],
        },
      ],
    };

    const matches = getSourceMatches(mockResponse, 'src-1');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.kind).toBe('MATCH');
    expect(matches[0]?.content).toBe('Important result');
  });
});
