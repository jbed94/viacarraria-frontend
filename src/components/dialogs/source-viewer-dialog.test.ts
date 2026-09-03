import { describe, expect, it } from 'vitest';

import { getHighlightRanges } from './source-viewer-dialog';

const match = (startChar: number, endChar: number) => ({
  graphId: 'graph',
  sourceId: 'source',
  sourceName: 'Notes.md',
  nodeId: 'node',
  content: 'match',
  context: 'A source context.',
  startChar,
  endChar,
  pageNum: 1,
  score: 0.9,
});

describe('getHighlightRanges', () => {
  it('keeps all source matches and marks the selected match as focused', () => {
    const ranges = getHighlightRanges(
      '01234567890123456789',
      [match(1, 4), match(10, 14), match(12, 17)],
      match(10, 14),
    );

    expect(ranges).toEqual([
      { start: 1, end: 4, focused: false, kind: 'MATCH' },
      { start: 10, end: 17, focused: true, kind: 'MATCH' },
    ]);
  });

  it('clips matches to the available source content', () => {
    expect(getHighlightRanges('short', [match(-3, 20)])).toEqual([
      { start: 0, end: 5, focused: false, kind: 'MATCH' },
    ]);
  });

  it('preserves the blue extended-context type when no direct match overlaps it', () => {
    expect(
      getHighlightRanges('extended context', [
        { ...match(0, 8), kind: 'EXTENDED' },
      ]),
    ).toEqual([{ start: 0, end: 8, focused: false, kind: 'EXTENDED' }]);
  });
});
