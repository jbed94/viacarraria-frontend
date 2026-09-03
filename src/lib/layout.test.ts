import { describe, expect, it } from 'vitest';

import { layoutGraph } from './layout';

describe('layoutGraph', () => {
  it('places dependent nodes left to right', () => {
    const layout = layoutGraph(
      [
        { id: 'first', position: { x: 0, y: 0 }, data: { title: 'First' } },
        { id: 'second', position: { x: 0, y: 0 }, data: { title: 'Second' } },
      ],
      [{ id: 'first-second', source: 'first', target: 'second' }],
    );

    expect(layout).toHaveLength(2);
    const [first, second] = layout;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) throw new Error('Expected two laid out nodes.');
    expect(first.position.x).toBeLessThan(second.position.x);
  });

  it('reserves the expanded node footprint and horizontal gap', () => {
    const layout = layoutGraph(
      [
        { id: 'first', position: { x: 0, y: 0 }, data: { title: 'First' } },
        { id: 'second', position: { x: 0, y: 0 }, data: { title: 'Second' } },
      ],
      [{ id: 'first-second', source: 'first', target: 'second' }],
      ['first'],
    );

    const [first, second] = layout;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) throw new Error('Expected two laid out nodes.');
    expect(first.position.y).toBeLessThan(second.position.y);
    expect(second.position.x - (first.position.x + 328)).toBeGreaterThanOrEqual(
      220,
    );
  });
});
