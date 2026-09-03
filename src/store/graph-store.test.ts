import { describe, expect, it } from 'vitest';

import { useGraphStore } from './graph-store';

describe('graph store', () => {
  it('limits the default guest context to two nodes', () => {
    useGraphStore.getState().setIdentity({
      userId: 'guest',
      email: null,
      username: null,
      isGuest: true,
      tier: 'ANONYMOUS',
    });
    useGraphStore.getState().setGraph({
      id: 'graph',
      title: 'Graph',
      description: null,
      userId: 'owner',
      isPublic: true,
      isPrepared: true,
      isOwned: false,
      nodes: [
        { id: 'one', position: { x: 0, y: 0 }, data: { title: 'One' } },
        { id: 'two', position: { x: 0, y: 0 }, data: { title: 'Two' } },
        { id: 'three', position: { x: 0, y: 0 }, data: { title: 'Three' } },
      ],
      edges: [],
      sources: [],
      permission: 'VIEWER',
      canEdit: false,
      accessCount: 1,
    });

    expect(useGraphStore.getState().selectedNodeIds).toEqual(['one', 'two']);
  });

  it('clears source focus when visual results are dismissed', () => {
    useGraphStore.getState().setActiveSourceId('source-1');
    useGraphStore.getState().setResults({
      queryId: 'query-1',
      results: [],
      matchedNodeIds: [],
      remaining: 2,
      extendedSearch: false,
      extendedContextCount: 0,
    });
    useGraphStore.getState().setResults(undefined);

    expect(useGraphStore.getState().mode).toBe('IDLE');
    expect(useGraphStore.getState().activeSourceId).toBeUndefined();
    expect(useGraphStore.getState().activeMatch).toBeUndefined();
  });
});
