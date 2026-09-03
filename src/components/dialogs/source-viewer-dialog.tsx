import { FileText, LoaderCircle } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import { api } from '../../lib/api';
import type { SearchChunk, Source } from '../../types/api';
import { DialogFrame } from './dialog-frame';

type SourceViewerDialogProps = {
  sourceId?: string;
  matches: SearchChunk[];
  focusedMatch?: SearchChunk;
  onOpenChange: (open: boolean) => void;
};

export function SourceViewerDialog({
  sourceId,
  onOpenChange,
  matches,
  focusedMatch,
}: SourceViewerDialogProps) {
  const [source, setSource] = useState<Source>();
  const [isLoading, setLoading] = useState(false);
  const hitRef = useRef<HTMLElement>(null);
  const content = source?.content ?? focusedMatch?.context ?? '';
  const highlightRanges = getHighlightRanges(content, matches, focusedMatch);
  const focusKey = `${content.length}:${focusedMatch?.sourceId ?? ''}:${focusedMatch?.startChar ?? ''}:${focusedMatch?.endChar ?? ''}`;

  useEffect(() => {
    if (!sourceId) return;
    setLoading(true);
    void api
      .source(sourceId)
      .then(setSource)
      .finally(() => setLoading(false));
  }, [sourceId]);

  useEffect(() => {
    if (!content || !focusKey || !focusedMatch) return;
    hitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [content, focusKey, focusedMatch]);

  return (
    <DialogFrame
      open={Boolean(sourceId)}
      onOpenChange={onOpenChange}
      title={
        source?.name ??
        focusedMatch?.sourceName ??
        matches[0]?.sourceName ??
        'Source viewer'
      }
      className="source-dialog"
    >
      <div className="source-viewer-meta">
        <FileText size={17} />
        <span>{source?.status ?? 'Loading'}</span>
        {focusedMatch ? <span>Page {focusedMatch.pageNum}</span> : null}
        {matches.length > 0 ? <span>{matches.length} matches</span> : null}
      </div>
      {isLoading ? <LoaderCircle className="spinner" size={24} /> : null}
      {!isLoading && content ? (
        <article className="source-document">
          {renderHighlightedContent(content, highlightRanges, hitRef)}
        </article>
      ) : null}
    </DialogFrame>
  );
}

type HighlightRange = {
  start: number;
  end: number;
  focused: boolean;
  kind: 'MATCH' | 'EXTENDED';
};

export function getHighlightRanges(
  content: string,
  matches: SearchChunk[],
  focusedMatch?: SearchChunk,
): HighlightRange[] {
  const ranges = matches
    .map((match) => ({
      start: Math.max(0, match.startChar),
      end: Math.min(content.length, match.endChar),
      focused:
        match.sourceId === focusedMatch?.sourceId &&
        match.startChar === focusedMatch.startChar &&
        match.endChar === focusedMatch.endChar,
      kind: match.kind ?? 'MATCH',
    }))
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start);

  return ranges.reduce<HighlightRange[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) {
      merged.push(range);
    } else {
      previous.end = Math.max(previous.end, range.end);
      previous.focused ||= range.focused;
      if (range.kind === 'MATCH') previous.kind = 'MATCH';
    }
    return merged;
  }, []);
}

function renderHighlightedContent(
  content: string,
  ranges: HighlightRange[],
  hitRef: RefObject<HTMLElement | null>,
): ReactNode {
  if (ranges.length === 0) return content;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [index, range] of ranges.entries()) {
    if (range.start > cursor) {
      parts.push(content.slice(cursor, range.start));
    }
    parts.push(
      <mark
        key={`${range.start}-${range.end}-${index}`}
        ref={range.focused ? hitRef : undefined}
        className={`hit-highlight ${range.kind === 'EXTENDED' ? 'is-extended' : ''} ${range.focused ? 'is-focused' : ''}`}
      >
        {content.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }
  if (cursor < content.length) parts.push(content.slice(cursor));
  return parts;
}
