import { beforeEach, describe, expect, it } from 'vitest';
import type { Graph } from '../types/api';
import { useGraphStore } from './graph-store';

describe('GraphStore Layout Stability', () => {
  const initialGraph: Graph = {
    id: 'test-graph',
    title: 'Stability Test Graph',
    description: null,
    userId: 'owner',
    isPublic: true,
    isPrepared: true,
    nodes: [
      {
        id: 'node-1',
        position: { x: 100, y: 150 },
        data: { title: 'Node 1', description: 'Description 1' },
      },
      {
        id: 'node-2',
        position: { x: 450, y: 150 },
        data: { title: 'Node 2', description: 'Description 2' },
      },
    ],
    edges: [
      {
        id: 'e1-2',
        source: 'node-1',
        target: 'node-2',
      },
    ],
    isOwned: true,
    permission: 'OWNER',
    canEdit: true,
    accessCount: 1,
    sources: [],
  };

  beforeEach(() => {
    useGraphStore.getState().setGraph(initialGraph);
  });

  it('preserves exact node coordinates when expanding a node', () => {
    const store = useGraphStore.getState();
    expect(store.expandedNodeIds).toEqual([]);

    // Expand node-1
    store.toggleExpanded('node-1');

    const updated = useGraphStore.getState();
    expect(updated.expandedNodeIds).toEqual(['node-1']);

    // Nodes must remain at their exact spatial coordinates (no Dagre shift)
    expect(updated.graph?.nodes[0]?.position).toEqual({ x: 100, y: 150 });
    expect(updated.graph?.nodes[1]?.position).toEqual({ x: 450, y: 150 });
  });

  it('preserves exact node coordinates when collapsing a node', () => {
    const store = useGraphStore.getState();
    store.toggleExpanded('node-1');
    expect(useGraphStore.getState().expandedNodeIds).toEqual(['node-1']);

    // Collapse node-1
    useGraphStore.getState().toggleExpanded('node-1');

    const updated = useGraphStore.getState();
    expect(updated.expandedNodeIds).toEqual([]);
    expect(updated.graph?.nodes[0]?.position).toEqual({ x: 100, y: 150 });
    expect(updated.graph?.nodes[1]?.position).toEqual({ x: 450, y: 150 });
  });

  it('preserves user custom dragged positions across multiple expansions and collapses', () => {
    // Simulate user moving node-2 to custom position
    useGraphStore.getState().applyNodes([
      {
        type: 'position',
        id: 'node-2',
        position: { x: 600, y: 320 },
      },
    ]);

    expect(useGraphStore.getState().graph?.nodes[1]?.position).toEqual({
      x: 600,
      y: 320,
    });

    // Expand node-1
    useGraphStore.getState().toggleExpanded('node-1');
    expect(useGraphStore.getState().graph?.nodes[1]?.position).toEqual({
      x: 600,
      y: 320,
    });

    // Collapse all nodes
    useGraphStore.getState().collapseAllNodes();
    expect(useGraphStore.getState().graph?.nodes[1]?.position).toEqual({
      x: 600,
      y: 320,
    });
  });

  it('does not scramble node layout when clearing results', () => {
    const store = useGraphStore.getState();
    store.applyNodes([
      {
        type: 'position',
        id: 'node-1',
        position: { x: 120, y: 220 },
      },
    ]);

    store.clearResults();

    const updated = useGraphStore.getState();
    expect(updated.graph?.nodes[0]?.position).toEqual({ x: 120, y: 220 });
    expect(updated.expandedNodeIds).toEqual([]);
  });

  it('selects all nodes by default for crawl starting nodes when graph is loaded', () => {
    useGraphStore.getState().setGraph(initialGraph);
    const store = useGraphStore.getState();
    expect(store.crawlStartingNodeIds).toEqual(['node-1', 'node-2']);
    expect(store.selectedNodeIds).toEqual(['node-1', 'node-2']);
  });

  it('caps default crawl starting nodes to 1 for anonymous users', () => {
    useGraphStore.getState().setIdentity({
      userId: 'guest',
      email: 'guest@example.com',
      username: 'guest',
      tier: 'ANONYMOUS',
      isGuest: true,
    });
    useGraphStore.getState().setGraph(initialGraph);
    const store = useGraphStore.getState();
    expect(store.crawlStartingNodeIds).toEqual(['node-1']);
  });

  it('populates crawl starting nodes when switching queryType to crawl if empty', () => {
    useGraphStore.getState().setIdentity({
      userId: 'user',
      email: 'user@example.com',
      username: 'user',
      tier: 'REGISTERED',
      isGuest: false,
    });
    useGraphStore.getState().setGraph(initialGraph);
    useGraphStore.getState().setCrawlStartingNodeIds([]);
    expect(useGraphStore.getState().crawlStartingNodeIds).toEqual([]);

    useGraphStore.getState().setQueryType('crawl');
    expect(useGraphStore.getState().crawlStartingNodeIds).toEqual([
      'node-1',
      'node-2',
    ]);
  });

  it('resets crawl starting nodes to all available nodes when clearing results', () => {
    useGraphStore.getState().setIdentity({
      userId: 'user',
      email: 'user@example.com',
      username: 'user',
      tier: 'REGISTERED',
      isGuest: false,
    });
    useGraphStore.getState().setGraph(initialGraph);
    useGraphStore.getState().setCrawlStartingNodeIds(['node-1']);

    useGraphStore.getState().clearResults();
    expect(useGraphStore.getState().crawlStartingNodeIds).toEqual([
      'node-1',
      'node-2',
    ]);
  });
});
