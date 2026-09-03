import { describe, expect, it } from 'vitest';

import { getNewlyExpandedNodeId } from './graph-canvas';

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
