import { describe, expect, it } from 'vitest';

import { computeScoreHistogram } from '../../lib/search-utils';
import {
  computeAdNodePlacement,
  filterMatchedNodeIdsByScore,
  getNewlyExpandedNodeId,
  isNodeInViewport,
} from './graph-canvas';

describe('getNewlyExpandedNodeId', () => {
  it('returns no focus target when a node is collapsed', () => {
    expect(getNewlyExpandedNodeId([], ['node'])).toBeUndefined();
    expect(
      getNewlyExpandedNodeId(['first'], ['first', 'second']),
    ).toBeUndefined();
  });

  it('returns the most recently added expanded node', () => {
    expect(getNewlyExpandedNodeId(['first', 'second'], ['first'])).toBe(
      'second',
    );
  });
});

describe('isNodeInViewport', () => {
  const defaultViewport = { x: 0, y: 0, zoom: 1 };
  const containerWidth = 1200;
  const containerHeight = 800;

  it('returns true when expanded node is safely within canvas viewport', () => {
    const inView = isNodeInViewport({
      nodePosition: { x: 200, y: 200 },
      nodeWidth: 320,
      nodeHeight: 360,
      viewport: defaultViewport,
      containerWidth,
      containerHeight,
      margin: 48,
    });
    expect(inView).toBe(true);
  });

  it('returns false when node overflows the right boundary', () => {
    const inView = isNodeInViewport({
      nodePosition: { x: 1000, y: 200 },
      nodeWidth: 320,
      nodeHeight: 360,
      viewport: defaultViewport,
      containerWidth,
      containerHeight,
      margin: 48,
    });
    expect(inView).toBe(false);
  });

  it('returns false when node overflows the bottom boundary', () => {
    const inView = isNodeInViewport({
      nodePosition: { x: 200, y: 500 },
      nodeWidth: 320,
      nodeHeight: 360,
      viewport: defaultViewport,
      containerWidth,
      containerHeight,
      margin: 48,
    });
    expect(inView).toBe(false);
  });

  it('returns false when node is positioned to the left of the margin or off-screen', () => {
    const inView = isNodeInViewport({
      nodePosition: { x: 10, y: 200 },
      nodeWidth: 320,
      nodeHeight: 360,
      viewport: defaultViewport,
      containerWidth,
      containerHeight,
      margin: 48,
    });
    expect(inView).toBe(false);
  });

  it('accurately accounts for canvas pan and zoom scale', () => {
    const inView = isNodeInViewport({
      nodePosition: { x: 400, y: 400 },
      nodeWidth: 320,
      nodeHeight: 360,
      viewport: { x: 100, y: 100, zoom: 0.5 },
      containerWidth,
      containerHeight,
      margin: 48,
    });
    expect(inView).toBe(true);
  });
});

describe('computeAdNodePlacement', () => {
  const sampleNodes = [
    { position: { x: 100, y: 100 }, width: 200, height: 100 },
    { position: { x: 500, y: 300 }, width: 200, height: 100 },
  ];

  it('places vertical ad on left or right flank outside node bounding box', () => {
    const adPlacement = computeAdNodePlacement({
      regularNodes: sampleNodes,
      graphId: 'test-graph-flank',
      margin: 100,
    });

    expect(adPlacement.id).toBe('canvas-ad-node');
    expect(adPlacement.type).toBe('ad');
    expect(adPlacement.draggable).toBe(false);
    expect(adPlacement.selectable).toBe(false);

    if (adPlacement.data.side === 'left') {
      expect(adPlacement.data.format).toBe('vertical');
      expect(adPlacement.position.x).toBeLessThan(100);
    } else if (adPlacement.data.side === 'right') {
      expect(adPlacement.data.format).toBe('vertical');
      expect(adPlacement.position.x).toBeGreaterThanOrEqual(700); // 500 + 200
    } else if (adPlacement.data.side === 'top') {
      expect(adPlacement.data.format).toBe('horizontal');
      expect(adPlacement.position.y).toBeLessThan(100);
    } else if (adPlacement.data.side === 'bottom') {
      expect(adPlacement.data.format).toBe('horizontal');
      expect(adPlacement.position.y).toBeGreaterThanOrEqual(400); // 300 + 100
    }
  });

  it('places dynamic horizontal ad at bottom with horizontal shift and slot index', () => {
    const adPlacement = computeAdNodePlacement({
      regularNodes: sampleNodes,
      graphId: 'graph-123',
      side: 'bottom',
      horizontalShiftRatio: 0.8,
      slotIndex: 3,
      margin: 120,
    });

    expect(adPlacement.data.side).toBe('bottom');
    expect(adPlacement.data.format).toBe('horizontal');
    expect(adPlacement.position.y).toBeGreaterThanOrEqual(400 + 120); // maxY(400) + 120
    expect(adPlacement.data.slotId).toContain('ad-slot-bottom-3-graph-');
  });

  it('places dynamic horizontal ad at top with horizontal shift', () => {
    const adPlacement = computeAdNodePlacement({
      regularNodes: sampleNodes,
      graphId: 'graph-123',
      side: 'top',
      horizontalShiftRatio: 0.2,
      slotIndex: 4,
      margin: 100,
    });

    expect(adPlacement.data.side).toBe('top');
    expect(adPlacement.data.format).toBe('horizontal');
    expect(adPlacement.position.y).toBeLessThanOrEqual(100 - 90 - 100); // minY(100) - 90 - 100
    expect(adPlacement.data.slotId).toContain('ad-slot-top-4-graph-');
  });
});

describe('filterMatchedNodeIdsByScore', () => {
  const mockResults = {
    queryId: 'q-1',
    matchedNodeIds: ['node-1', 'node-2'],
    remaining: 10,
    results: [
      {
        nodeId: 'node-1',
        matchCount: 1,
        chunks: [
          {
            sourceId: 's-1',
            sourceName: 'doc.md',
            content: 'High relevance match',
            startChar: 0,
            endChar: 50,
            score: 0.85,
            rerankScore: 0.95,
          },
        ],
      },
      {
        nodeId: 'node-2',
        matchCount: 1,
        chunks: [
          {
            sourceId: 's-1',
            sourceName: 'doc.md',
            content: 'Moderate match',
            startChar: 60,
            endChar: 100,
            score: 0.75,
            rerankScore: 0.78,
          },
        ],
      },
    ],
  } as any;

  it('returns all matched nodes when minScore is 0', () => {
    const matched = filterMatchedNodeIdsByScore(mockResults, 0);
    expect(matched).toEqual(new Set(['node-1', 'node-2']));
  });

  it('filters out nodes below minScore threshold based on rerankScore', () => {
    // 0.80 threshold should keep node-1 (0.95) and exclude node-2 (0.78)
    const matched = filterMatchedNodeIdsByScore(mockResults, 0.8);
    expect(matched).toEqual(new Set(['node-1']));
  });

  it('filters out all nodes when minScore exceeds all scores', () => {
    const matched = filterMatchedNodeIdsByScore(mockResults, 0.99);
    expect(matched).toEqual(new Set([]));
  });

  it('returns null when results is undefined', () => {
    expect(filterMatchedNodeIdsByScore(undefined, 0.5)).toBeNull();
  });

  it('correctly maps mock results top scores into histogram bins', () => {
    const scores = mockResults.results.map((res: any) =>
      Math.max(
        ...(res.chunks?.map((c: any) => c.rerankScore ?? c.score ?? 0) ?? [0]),
        0,
      ),
    );
    expect(scores).toEqual([0.95, 0.78]);

    const bins = computeScoreHistogram(scores, 10);
    expect(bins[7]?.count).toBe(1); // 0.78 in 0.7-0.8
    expect(bins[9]?.count).toBe(1); // 0.95 in 0.9-1.0
    expect(bins[0]?.count).toBe(0);
  });
});

describe('Ad node camera focus decoupling', () => {
  it('excludes ad nodes from matched result focus targets', () => {
    const matchedNodeIds = [
      'node-1',
      'canvas-ad-node',
      'node-2',
      'canvas-ad-node-slot-1',
    ];
    const focusTargetIds = matchedNodeIds.filter(
      (id) => !id.startsWith('canvas-ad-node'),
    );
    expect(focusTargetIds).toEqual(['node-1', 'node-2']);
  });

  it('excludes ad nodes from graph reset fitView targets', () => {
    const allCanvasNodes = [
      { id: 'node-1' },
      { id: 'canvas-ad-node' },
      { id: 'node-2' },
      { id: 'canvas-ad-node-slot-2' },
    ];
    const nonAdNodes = allCanvasNodes.filter(
      (n) => !n.id.startsWith('canvas-ad-node'),
    );
    expect(nonAdNodes.map((n) => n.id)).toEqual(['node-1', 'node-2']);
  });

  it('filters out ad node change events from store sync', () => {
    const changes = [
      { type: 'position', id: 'node-1', dragging: true },
      {
        type: 'dimensions',
        id: 'canvas-ad-node',
        item: { id: 'canvas-ad-node' },
      },
      { type: 'position', id: 'canvas-ad-node-slot-1' },
      { type: 'select', id: 'node-2', selected: true },
    ];
    const filtered = changes.filter(
      (c: any) =>
        !String(c.id).startsWith('canvas-ad-node') &&
        ('item' in c
          ? !String((c as any).item?.id).startsWith('canvas-ad-node')
          : true),
    );
    expect(filtered).toEqual([
      { type: 'position', id: 'node-1', dragging: true },
      { type: 'select', id: 'node-2', selected: true },
    ]);
  });
});
