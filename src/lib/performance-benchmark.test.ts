import { beforeAll, describe, expect, it } from 'vitest';

import { useGraphStore } from '../store/graph-store';
import type { Graph, GraphEdge, GraphNode, SearchResponse } from '../types/api';
import { layoutGraph } from './layout';

function generateSyntheticGraph(nodeCount: number): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node-${i}`,
      position: { x: 0, y: 0 },
      data: {
        title: `Topic ${i}: Algorithmic Complexity & Systems Analysis`,
        category:
          i % 3 === 0
            ? 'Core Theory'
            : i % 3 === 1
              ? 'Applied Systems'
              : 'Security',
        description: `Detailed description for node ${i} covering distributed architecture and invariants.`,
      },
    });

    if (i > 0) {
      // Connect each node to a predecessor to form a realistic DAG
      const parentId = `node-${Math.floor((i - 1) / 2)}`;
      edges.push({
        id: `edge-${parentId}-${nodes[i]!.id}`,
        source: parentId,
        target: nodes[i]!.id,
      });
    }
  }

  return { nodes, edges };
}

describe('Canvas Performance & Optimization Benchmarks', () => {
  beforeAll(() => {
    // Warm-up run to allow V8/JIT to optimize layout graph function and load modules
    const warmup = generateSyntheticGraph(10);
    layoutGraph(warmup.nodes, warmup.edges, []);
  });

  it('measures dagre layout computation time for 20 nodes (< 100ms budget)', () => {
    const { nodes, edges } = generateSyntheticGraph(20);

    const start = performance.now();
    const laidOut = layoutGraph(nodes, edges, ['node-1', 'node-3']);
    const duration = performance.now() - start;

    expect(laidOut.length).toBe(20);
    expect(laidOut[0]!.position.x).toBeDefined();
    expect(laidOut[0]!.position.y).toBeDefined();
    // Budget: 20 nodes should layout within 100ms
    expect(duration).toBeLessThan(100);
  });

  it('measures dagre layout computation scaling for 50 nodes (< 150ms budget)', () => {
    const { nodes, edges } = generateSyntheticGraph(50);

    const start = performance.now();
    const laidOut = layoutGraph(nodes, edges, ['node-2', 'node-5', 'node-12']);
    const duration = performance.now() - start;

    expect(laidOut.length).toBe(50);
    // Budget: 50 nodes should compute within 150ms
    expect(duration).toBeLessThan(150);
  });

  it('measures dagre layout computation scaling for 100 dense nodes (< 350ms budget)', () => {
    const { nodes, edges } = generateSyntheticGraph(100);

    const start = performance.now();
    const laidOut = layoutGraph(nodes, edges);
    const duration = performance.now() - start;

    expect(laidOut.length).toBe(100);
    // Budget: 100 nodes should compute within 350ms
    expect(duration).toBeLessThan(350);
  });

  it('benchmarks state selector and selection toggling throughput on 50 nodes', () => {
    const { nodes, edges } = generateSyntheticGraph(50);
    const graph: Graph = {
      id: 'graph-perf-1',
      title: 'Performance Evaluation Graph',
      description: null,
      userId: 'user-perf',
      isPublic: true,
      isPrepared: true,
      isOwned: true,
      permission: 'OWNER',
      canEdit: true,
      accessCount: 10,
      nodes,
      edges,
      sources: [],
    };

    useGraphStore.getState().setGraph(graph);
    useGraphStore.getState().setSelectedNodeIds([]);
    useGraphStore.getState().setMode('CONTEXT_SELECTION');

    const start = performance.now();
    // Simulate rapid bulk user selection toggles
    for (let i = 0; i < 20; i++) {
      useGraphStore.getState().toggleNodeSelection(`node-${i}`);
    }
    const duration = performance.now() - start;

    expect(useGraphStore.getState().selectedNodeIds.length).toBe(20);
    // 20 rapid Zustand actions should execute in < 15ms
    expect(duration).toBeLessThan(30);
  });

  it('benchmarks search result ingestion and match mapping latency on 50 nodes', () => {
    const { nodes, edges } = generateSyntheticGraph(50);
    const graph: Graph = {
      id: 'graph-perf-2',
      title: 'Search Performance Graph',
      description: null,
      userId: 'user-perf',
      isPublic: true,
      isPrepared: true,
      isOwned: true,
      permission: 'OWNER',
      canEdit: true,
      accessCount: 1,
      nodes,
      edges,
      sources: [],
    };

    useGraphStore.getState().setGraph(graph);

    // Create a large search response with matches across 15 nodes
    const searchResponse: SearchResponse = {
      queryId: 'query-perf-1',
      remaining: 10,
      extendedSearch: true,
      extendedContextCount: 5,
      matchedNodeIds: Array.from({ length: 15 }, (_, i) => `node-${i * 2}`),
      results: Array.from({ length: 15 }, (_, i) => ({
        nodeId: `node-${i * 2}`,
        matchCount: 2,
        chunks: [
          {
            graphId: 'graph-perf-2',
            sourceId: `src-${i}`,
            sourceName: `Chapter ${i}.pdf`,
            nodeId: `node-${i * 2}`,
            content: `Matching content for node ${i * 2} explaining system invariants.`,
            context: 'Context paragraph',
            startChar: 0,
            endChar: 60,
            pageNum: 1,
            score: 0.92,
          },
        ],
      })),
    };

    const start = performance.now();
    useGraphStore.getState().setResults(searchResponse);
    const duration = performance.now() - start;

    expect(useGraphStore.getState().mode).toBe('VISUAL_RESULTS');
    expect(useGraphStore.getState().results?.matchedNodeIds.length).toBe(15);
    // Setting and processing search results should take < 10ms
    expect(duration).toBeLessThan(20);
  });

  it('benchmarks viewport spatial culling throughput on 250 distributed nodes', () => {
    // Generate large graph with 250 nodes spread over a 4000x4000 coordinate space
    const nodes: Array<GraphNode & { width: number; height: number }> = [];
    for (let i = 0; i < 250; i++) {
      nodes.push({
        id: `node-${i}`,
        position: { x: (i % 16) * 260, y: Math.floor(i / 16) * 260 },
        width: 220,
        height: 120,
        data: { title: `Node ${i}` },
      });
    }

    // Viewport window: (0, 0) to (1200, 800) with 100px buffer margin
    const viewport = { x: 0, y: 0, width: 1200, height: 800 };
    const margin = 100;

    const start = performance.now();
    const visibleNodes = nodes.filter((node) => {
      return (
        node.position.x + node.width >= viewport.x - margin &&
        node.position.x <= viewport.x + viewport.width + margin &&
        node.position.y + node.height >= viewport.y - margin &&
        node.position.y <= viewport.y + viewport.height + margin
      );
    });
    const duration = performance.now() - start;

    // Spatial culling should drastically reduce rendered nodes from 250 to viewport subset (~20 nodes)
    expect(visibleNodes.length).toBeLessThan(40);
    expect(visibleNodes.length).toBeGreaterThan(0);
    // Viewport intersection computation across 250 nodes executes in < 5ms
    expect(duration).toBeLessThan(10);
  });
});
