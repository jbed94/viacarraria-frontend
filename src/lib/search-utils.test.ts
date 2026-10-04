import { describe, expect, it } from 'vitest';

import type { CrawlResponse, SearchChunk, SearchResponse } from '../types/api';
import {
  calculateSearchSpaceMultiplier,
  computeBranchEntropy,
  computeGraphEntropy,
  computeScoreHistogram,
  getSourceMatches,
  partitionHypothesisGraphs,
} from './search-utils';

describe('search-utils: getSourceMatches', () => {
  it('returns empty array when results or activeSourceId is missing', () => {
    expect(getSourceMatches(undefined, 'src-1')).toEqual([]);
    expect(getSourceMatches({ results: [] } as any, undefined)).toEqual([]);
    expect(getSourceMatches(undefined, undefined)).toEqual([]);
  });

  it('filters chunks by activeSourceId from simple SearchResponse', () => {
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
    };

    const mockResponse: SearchResponse = {
      queryId: 'q-1',
      matchedNodeIds: ['node-1'],
      remaining: 10,
      results: [
        {
          nodeId: 'node-1',
          matchCount: 2,
          chunks: [chunk1, chunkOtherSource],
        },
      ],
    };

    const matches = getSourceMatches(mockResponse, 'src-1');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.content).toBe('Important result');
  });

  it('extracts and deduplicates chunks from CrawlResponse', () => {
    const crawlChunk1: SearchChunk = {
      graphId: 'g-1',
      nodeId: 'node-1',
      sourceId: 'src-1',
      sourceName: 'paper.pdf',
      content: 'Crawl seed match',
      context: 'context',
      startChar: 0,
      endChar: 30,
      pageNum: 1,
      score: 0.92,
    };
    const crawlChunk2: SearchChunk = {
      graphId: 'g-1',
      nodeId: 'node-2',
      sourceId: 'src-1',
      sourceName: 'paper.pdf',
      content: 'Crawl hop match',
      context: 'context',
      startChar: 100,
      endChar: 150,
      pageNum: 2,
      score: 0.85,
    };
    const crawlChunkOtherSource: SearchChunk = {
      graphId: 'g-1',
      nodeId: 'node-3',
      sourceId: 'src-99',
      sourceName: 'external.pdf',
      content: 'External content',
      context: 'context',
      startChar: 0,
      endChar: 20,
      pageNum: 1,
      score: 0.6,
    };

    const mockCrawlResponse: CrawlResponse = {
      queryId: 'crawl-1',
      queryType: 'crawl',
      queryText: 'how does consensus scale',
      startingNodeIds: ['node-1'],
      crawlDepth: 'default',
      direction: 'forward',
      sensitivity: 'medium',
      nodes: [
        {
          id: 'cnode-0',
          level: 0,
          nodeId: 'node-1',
          nodeTitle: 'Consensus',
          chunk: crawlChunk1,
          score: 0.92,
        },
        {
          id: 'cnode-1',
          level: 1,
          nodeId: 'node-2',
          nodeTitle: 'Raft',
          chunk: crawlChunk2,
          score: 0.85,
          parentCrawlNodeId: 'cnode-0',
        },
        {
          id: 'cnode-2',
          level: 1,
          nodeId: 'node-3',
          nodeTitle: 'External',
          chunk: crawlChunkOtherSource,
          score: 0.6,
          parentCrawlNodeId: 'cnode-0',
        },
      ],
      edges: [
        {
          id: 'cedge-1',
          source: 'cnode-0',
          target: 'cnode-1',
          level: 1,
          direction: 'forward',
        },
      ],
      maxLevelReached: 1,
      totalMatches: 3,
      matchedNodeIds: ['node-1', 'node-2', 'node-3'],
      remaining: 0,
    };

    const matches = getSourceMatches(undefined, 'src-1', mockCrawlResponse);
    expect(matches).toHaveLength(2);
    expect(matches[0]?.content).toBe('Crawl seed match');
    expect(matches[1]?.content).toBe('Crawl hop match');
  });
});

describe('search-utils: calculateSearchSpaceMultiplier', () => {
  it('computes 1.0x for 1 node or less', () => {
    expect(calculateSearchSpaceMultiplier(1)).toBe(1.0);
    expect(calculateSearchSpaceMultiplier(0)).toBe(1.0);
  });

  it('computes logarithmic scaling correctly', () => {
    // log10(10)/10 + 1 = 0.1 + 1 = 1.10
    expect(calculateSearchSpaceMultiplier(10)).toBe(1.1);
    // log10(100)/10 + 1 = 0.2 + 1 = 1.20
  });
});

describe('search-utils: computeScoreHistogram', () => {
  it('creates 10 default empty bins when scores array is empty', () => {
    const bins = computeScoreHistogram([]);
    expect(bins).toHaveLength(10);
    expect(bins[0]).toEqual({ binIndex: 0, min: 0, max: 0.1, count: 0 });
    expect(bins[9]).toEqual({ binIndex: 9, min: 0.9, max: 1.0, count: 0 });
  });

  it('correctly distributes scores across bins', () => {
    const scores = [0.05, 0.08, 0.25, 0.42, 0.75, 0.78, 0.92, 1.0];
    const bins = computeScoreHistogram(scores, 10);

    expect(bins[0]?.count).toBe(2); // 0.05, 0.08 in 0.0-0.1
    expect(bins[2]?.count).toBe(1); // 0.25 in 0.2-0.3
    expect(bins[4]?.count).toBe(1); // 0.42 in 0.4-0.5
    expect(bins[7]?.count).toBe(2); // 0.75, 0.78 in 0.7-0.8
    expect(bins[9]?.count).toBe(2); // 0.92, 1.0 in 0.9-1.0
    expect(bins[1]?.count).toBe(0);
  });

  it('supports custom binCount and clamps edge values', () => {
    // 5 bins: [0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0]
    const scores = [-0.5, 0.1, 0.5, 1.5, Number.NaN];
    const bins = computeScoreHistogram(scores, 5);

    expect(bins).toHaveLength(5);
    // -0.5 clamped to 0 -> bin 0; 0.1 -> bin 0
    expect(bins[0]?.count).toBe(2);
    // 0.5 -> bin 2
    expect(bins[2]?.count).toBe(1);
    // 1.5 clamped to 1.0 -> bin 4
    expect(bins[4]?.count).toBe(1);
  });
});

describe('search-utils: computeGraphEntropy', () => {
  it('returns 0 for empty or single-node datasets', () => {
    expect(computeGraphEntropy([])).toBe(0);
    expect(
      computeGraphEntropy([
        {
          id: 'n1',
          nodeId: 'node-1',
          level: 0,
          nodeTitle: 'Title',
          score: 0.9,
          chunk: {} as any,
        },
      ]),
    ).toBe(0);
  });

  it('computes normalized entropy in [0, 1] across node scores and edge weights', () => {
    const nodes = [
      {
        id: 'n1',
        nodeId: 'node-1',
        level: 0,
        nodeTitle: 'Root',
        score: 0.9,
        rerankScore: 0.95,
        chunk: {} as any,
      },
      {
        id: 'n2',
        nodeId: 'node-2',
        level: 1,
        nodeTitle: 'Child',
        score: 0.3,
        rerankScore: 0.25,
        chunk: {} as any,
      },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        level: 1,
        direction: 'forward' as const,
        similarityScore: 0.8,
      },
    ];

    const entropy = computeGraphEntropy(nodes, edges);
    expect(entropy).toBeGreaterThan(0);
    expect(entropy).toBeLessThan(1);
  });

  it('yields lower entropy for focused/pure relevance distribution than uniform noisy distribution', () => {
    const focusedNodes = [
      {
        id: 'n1',
        nodeId: 'node-1',
        level: 0,
        nodeTitle: 'Top',
        score: 0.99,
        rerankScore: 0.99,
        chunk: {} as any,
      },
      {
        id: 'n2',
        nodeId: 'node-2',
        level: 1,
        nodeTitle: 'Low 1',
        score: 0.05,
        rerankScore: 0.05,
        chunk: {} as any,
      },
      {
        id: 'n3',
        nodeId: 'node-3',
        level: 1,
        nodeTitle: 'Low 2',
        score: 0.05,
        rerankScore: 0.05,
        chunk: {} as any,
      },
    ];
    const uniformNodes = [
      {
        id: 'n1',
        nodeId: 'node-1',
        level: 0,
        nodeTitle: 'A',
        score: 0.5,
        rerankScore: 0.5,
        chunk: {} as any,
      },
      {
        id: 'n2',
        nodeId: 'node-2',
        level: 1,
        nodeTitle: 'B',
        score: 0.5,
        rerankScore: 0.5,
        chunk: {} as any,
      },
      {
        id: 'n3',
        nodeId: 'node-3',
        level: 1,
        nodeTitle: 'C',
        score: 0.5,
        rerankScore: 0.5,
        chunk: {} as any,
      },
    ];

    const focusedEntropy = computeGraphEntropy(focusedNodes, []);
    const uniformEntropy = computeGraphEntropy(uniformNodes, []);

    expect(focusedEntropy).toBeLessThan(uniformEntropy);
  });
});

describe('search-utils: partitionHypothesisGraphs', () => {
  it('returns empty array when crawlResults has no nodes', () => {
    expect(partitionHypothesisGraphs({} as any)).toEqual([]);
    expect(partitionHypothesisGraphs({ nodes: [] } as any)).toEqual([]);
  });

  it('returns single exploratory trajectory when not comparative', () => {
    const singleResult: CrawlResponse = {
      queryId: 'q-1',
      queryType: 'crawl',
      queryText: 'single crawl',
      startingNodeIds: ['node-1'],
      crawlDepth: 'default',
      direction: 'forward',
      sensitivity: 'medium',
      nodes: [
        {
          id: 'n1',
          nodeId: 'node-1',
          level: 0,
          nodeTitle: 'Root',
          score: 0.9,
          chunk: {} as any,
        },
        {
          id: 'n2',
          nodeId: 'node-2',
          level: 1,
          nodeTitle: 'Step',
          score: 0.8,
          chunk: {} as any,
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          level: 1,
          direction: 'forward',
          similarityScore: 0.85,
        },
      ],
      maxLevelReached: 1,
      totalMatches: 2,
      matchedNodeIds: ['node-1', 'node-2'],
      remaining: 10,
    };

    const partitions = partitionHypothesisGraphs(singleResult);
    expect(partitions).toHaveLength(1);
    expect(partitions[0]?.id).toBe('primary');
    expect(partitions[0]?.name).toBe('Exploratory Trajectory');
    expect(partitions[0]?.nodes).toHaveLength(2);
    expect(partitions[0]?.entropy).toBeDefined();
  });

  it('partitions comparative hypotheses and sorts by ascending graph entropy', () => {
    const comparativeResult: CrawlResponse = {
      queryId: 'q-comp',
      queryType: 'crawl',
      queryText: 'comparative query',
      startingNodeIds: ['node-a', 'node-b'],
      crawlDepth: 'default',
      direction: 'forward',
      sensitivity: 'medium',
      comparative: {
        isComparative: true,
        groupACount: 3,
        groupBCount: 3,
        intersectionCount: 1,
        intersectionNodeTitles: ['Bridge'],
        groups: [
          { id: 'groupA', name: 'Hypothesis A', count: 3, color: '#38bdf8' },
          { id: 'groupB', name: 'Hypothesis B', count: 3, color: '#a855f7' },
        ],
      },
      nodes: [
        // Group A: high variance / pure (one dominant high score -> low entropy)
        {
          id: 'na1',
          nodeId: 'node-a',
          level: 0,
          nodeTitle: 'A Seed',
          score: 0.99,
          rerankScore: 0.99,
          groupOrigin: 'groupA',
          chunk: {} as any,
        },
        {
          id: 'na2',
          nodeId: 'node-a2',
          level: 1,
          nodeTitle: 'A Step',
          score: 0.05,
          rerankScore: 0.05,
          groupOrigin: 'groupA',
          chunk: {} as any,
        },
        // Group B: uniform scores (diffuse -> higher entropy)
        {
          id: 'nb1',
          nodeId: 'node-b',
          level: 0,
          nodeTitle: 'B Seed',
          score: 0.5,
          rerankScore: 0.5,
          groupOrigin: 'groupB',
          chunk: {} as any,
        },
        {
          id: 'nb2',
          nodeId: 'node-b2',
          level: 1,
          nodeTitle: 'B Step',
          score: 0.5,
          rerankScore: 0.5,
          groupOrigin: 'groupB',
          chunk: {} as any,
        },
        // Intersection node reached by both
        {
          id: 'ni1',
          nodeId: 'node-bridge',
          level: 2,
          nodeTitle: 'Bridge',
          score: 0.85,
          groupOrigin: 'intersection',
          reachedGroupIds: ['groupA', 'groupB'],
          chunk: {} as any,
        },
      ],
      edges: [
        {
          id: 'ea1',
          source: 'na1',
          target: 'na2',
          level: 1,
          direction: 'forward',
          similarityScore: 0.9,
        },
        {
          id: 'ea2',
          source: 'na2',
          target: 'ni1',
          level: 2,
          direction: 'forward',
          similarityScore: 0.85,
        },
        {
          id: 'eb1',
          source: 'nb1',
          target: 'nb2',
          level: 1,
          direction: 'forward',
          similarityScore: 0.5,
        },
        {
          id: 'eb2',
          source: 'nb2',
          target: 'ni1',
          level: 2,
          direction: 'forward',
          similarityScore: 0.5,
        },
      ],
      maxLevelReached: 2,
      totalMatches: 5,
      matchedNodeIds: ['node-a', 'node-a2', 'node-b', 'node-b2', 'node-bridge'],
      remaining: 10,
    };

    const partitions = partitionHypothesisGraphs(comparativeResult);
    expect(partitions).toHaveLength(2);

    // Group A has lower entropy than Group B, so it is sorted first!
    expect(partitions[0]?.id).toBe('groupA');
    expect(partitions[1]?.id).toBe('groupB');
    expect(partitions[0]!.entropy).toBeLessThan(partitions[1]!.entropy);
    expect(partitions[0]!.entropyDelta).toBe(0);
    expect(partitions[1]!.entropyDelta).toBeGreaterThan(0);

    // Group A includes its base nodes plus the bridge node
    expect(partitions[0]?.nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining(['na1', 'na2', 'ni1']),
    );
  });
});

describe('search-utils: computeBranchEntropy', () => {
  it('returns 0 for empty or single node path', () => {
    expect(computeBranchEntropy([])).toBe(0);
    expect(
      computeBranchEntropy([
        {
          id: 'c1',
          level: 0,
          nodeId: 'n1',
          nodeTitle: 'Root',
          score: 0.95,
          chunk: {} as any,
        },
      ]),
    ).toBe(0);
  });

  it('computes low entropy for cohesive transitions and high entropy for drifting branches', () => {
    const seed: any = { id: 's1', score: 0.95, rerankScore: 0.95 };
    const goodHop: any = { id: 's2', score: 0.92, rerankScore: 0.92 };
    const badHop: any = { id: 's3', score: 0.2, rerankScore: 0.2 };

    const goodEdge: any = { id: 'e1', similarityScore: 0.9 };
    const badEdge: any = { id: 'e2', similarityScore: 0.25 };

    const cohesive = computeBranchEntropy([seed, goodHop], [goodEdge]);
    const drifted = computeBranchEntropy([seed, badHop], [badEdge]);

    expect(cohesive).toBeLessThan(0.35);
    expect(drifted).toBeGreaterThan(0.7);
    expect(cohesive).toBeLessThan(drifted);
  });

  it('clamps output to range [0, 1]', () => {
    const extremeSeed: any = { id: 's1', score: 0.01 };
    const extremeDrift: any = { id: 's2', score: 0.01 };
    const edge: any = { id: 'e1', similarityScore: 0.0 };

    const entropy = computeBranchEntropy([extremeSeed, extremeDrift], [edge]);
    expect(entropy).toBeLessThanOrEqual(1.0);
    expect(entropy).toBeGreaterThanOrEqual(0.0);
  });
});
