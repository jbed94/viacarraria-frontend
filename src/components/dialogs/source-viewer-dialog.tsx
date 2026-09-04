import {
  Check,
  ChevronLeft,
  ChevronRight,
  Code,
  Copy,
  Crosshair,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Sparkles,
  Table,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import { api } from '../../lib/api';
import { katexExtension } from '../../lib/katex-markdown';
import type { SearchChunk, Source } from '../../types/api';
import { DialogFrame } from './dialog-frame';

// Configure KaTeX extension with marked
marked.use(katexExtension());

type SourceViewerDialogProps = {
  sourceId?: string;
  matches: SearchChunk[];
  focusedMatch?: SearchChunk;
  onOpenChange: (open: boolean) => void;
};

export function isPdfSource(
  source?: { fileType?: string; name?: string },
  focusedMatch?: { sourceName?: string },
): boolean {
  return (
    source?.fileType === 'application/pdf' ||
    Boolean(source?.name?.toLowerCase().endsWith('.pdf')) ||
    Boolean(focusedMatch?.sourceName?.toLowerCase().endsWith('.pdf'))
  );
}

export function SourceViewerDialog({
  sourceId,
  onOpenChange,
  matches,
  focusedMatch,
}: SourceViewerDialogProps) {
  const [source, setSource] = useState<Source>();
  const [isLoading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'source' | 'pdf'>(
    'preview',
  );
  const [showOverlay, setShowOverlay] = useState(true);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);
  const [showTableInspector, setShowTableInspector] = useState(true);
  const [selectedColIndex, setSelectedColIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const hitRef = useRef<HTMLElement>(null);
  const content = source?.content ?? focusedMatch?.context ?? '';
  const highlightRanges = getHighlightRanges(content, matches, focusedMatch);
  const focusKey = `${content.length}:${focusedMatch?.sourceId ?? ''}:${focusedMatch?.startChar ?? ''}:${focusedMatch?.endChar ?? ''}:${viewMode}`;
  const isPdf = isPdfSource(source, focusedMatch);

  useEffect(() => {
    if (!focusedMatch || matches.length === 0) {
      setActiveMatchIndex(0);
      return;
    }
    const idx = matches.findIndex(
      (m) =>
        m.startChar === focusedMatch.startChar &&
        m.endChar === focusedMatch.endChar &&
        m.pageNum === focusedMatch.pageNum,
    );
    if (idx !== -1) {
      setActiveMatchIndex(idx);
    } else {
      setActiveMatchIndex(0);
    }
  }, [focusedMatch, matches]);

  useEffect(() => {
    setSelectedColIndex(null);
  }, [activeMatchIndex]);

  const currentMatch = matches[activeMatchIndex] ?? focusedMatch;
  const parsedTable =
    currentMatch && currentMatch.elementType === 'table'
      ? parseMarkdownTable(currentMatch.content)
      : null;

  const copyCitation = (matchToCopy?: SearchChunk) => {
    const target = matchToCopy ?? currentMatch;
    if (!target) return;
    const docName = source?.name ?? target.sourceName;
    const pageStr = target.pageNum ? `, p. ${target.pageNum}` : '';
    const text = `> "${target.content.trim()}"\n> — *${docName}${pageStr}*`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!sourceId) return;
    setLoading(true);
    void api
      .source(sourceId)
      .then((data) => {
        setSource(data);
        if (isPdfSource(data, focusedMatch)) {
          // If viewing a match on a specific page, default to PDF tab
          if (focusedMatch?.pageNum && focusedMatch.pageNum > 1) {
            setViewMode('pdf');
          }
        }
      })
      .finally(() => setLoading(false));
  }, [sourceId, focusedMatch]);

  useEffect(() => {
    if (!content || !focusedMatch || viewMode === 'pdf') return;
    const timer = setTimeout(() => {
      hitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return () => clearTimeout(timer);
  }, [content, focusKey, focusedMatch, viewMode]);

  useEffect(() => {
    if (!sourceId || viewMode !== 'pdf' || matches.length <= 1) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      if (
        event.key === '[' ||
        (event.altKey && event.key === 'ArrowLeft') ||
        event.key === 'p'
      ) {
        event.preventDefault();
        setActiveMatchIndex((prev) => Math.max(0, prev - 1));
      } else if (
        event.key === ']' ||
        (event.altKey && event.key === 'ArrowRight') ||
        event.key === 'n'
      ) {
        event.preventDefault();
        setActiveMatchIndex((prev) => Math.min(matches.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sourceId, viewMode, matches.length]);

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
        <div className="source-meta-info">
          <FileText size={16} />
          <span>{source?.status ?? 'Loading'}</span>
          {focusedMatch ? <span>Page {focusedMatch.pageNum}</span> : null}
          {matches.length > 0 ? <span>{matches.length} matches</span> : null}
        </div>
        <div className="source-viewer-actions">
          <div className="source-view-mode-toggle" role="tablist">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
              role="tab"
              aria-selected={viewMode === 'preview'}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'source' ? 'active' : ''}`}
              onClick={() => setViewMode('source')}
              role="tab"
              aria-selected={viewMode === 'source'}
            >
              <Code size={13} />
              <span>Raw</span>
            </button>
            {isPdf ? (
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'pdf' ? 'active' : ''}`}
                onClick={() => setViewMode('pdf')}
                role="tab"
                aria-selected={viewMode === 'pdf'}
              >
                <FileText size={13} />
                <span>PDF</span>
              </button>
            ) : null}
          </div>
          {sourceId ? (
            <a
              href={api.sourceDownloadUrl(sourceId)}
              target="_blank"
              rel="noreferrer noopener"
              className="view-mode-btn source-download-btn"
              title="Download or view original document"
            >
              <Download size={13} />
              <span>Original</span>
            </a>
          ) : null}
        </div>
      </div>
      {isLoading ? <LoaderCircle className="spinner" size={24} /> : null}
      {!isLoading && (content || (isPdf && sourceId)) ? (
        <article className="source-document-container">
          {viewMode === 'pdf' && sourceId ? (
            <div className="source-document pdf-viewer-wrapper">
              {currentMatch?.coordinates || currentMatch?.pageNum ? (
                <div className="pdf-target-banner">
                  <div className="pdf-target-info">
                    <Crosshair size={13} className="pdf-target-icon" />
                    <span className="pdf-target-tag is-page">
                      Page {currentMatch.pageNum ?? 1}
                    </span>
                    {currentMatch.elementType ? (
                      <span className="pdf-target-tag is-type">
                        {currentMatch.elementType}
                      </span>
                    ) : null}
                    {currentMatch.coordinates?.length === 4 ? (
                      <span className="pdf-target-coords">
                        Target Box: {Math.round(currentMatch.coordinates[0]!)},{' '}
                        {Math.round(currentMatch.coordinates[1]!)} (
                        {Math.round(currentMatch.coordinates[2]!)}×
                        {Math.round(currentMatch.coordinates[3]!)} pt)
                      </span>
                    ) : null}
                  </div>
                  {matches.length > 1 ? (
                    <div
                      className="pdf-stepper-group"
                      role="group"
                      aria-label="Match navigation stepper"
                    >
                      <button
                        type="button"
                        className="pdf-stepper-btn"
                        disabled={activeMatchIndex <= 0}
                        onClick={() =>
                          setActiveMatchIndex(activeMatchIndex - 1)
                        }
                        title="Previous search hit (Press [ or Alt+Left)"
                        aria-label="Previous match"
                      >
                        <ChevronLeft size={13} />
                        <kbd className="stepper-kbd">[</kbd>
                      </button>
                      <span className="pdf-stepper-counter">
                        {activeMatchIndex + 1} / {matches.length}
                      </span>
                      <button
                        type="button"
                        className="pdf-stepper-btn"
                        disabled={activeMatchIndex >= matches.length - 1}
                        onClick={() =>
                          setActiveMatchIndex(activeMatchIndex + 1)
                        }
                        title="Next search hit (Press ] or Alt+Right)"
                        aria-label="Next match"
                      >
                        <kbd className="stepper-kbd">]</kbd>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  ) : null}
                  <div className="pdf-target-controls">
                    <button
                      type="button"
                      className={`pdf-copy-citation-btn ${copied ? 'copied' : ''}`}
                      onClick={() => copyCitation(currentMatch)}
                      title="Copy excerpt citation as Markdown"
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copied ? 'Copied!' : 'Copy Citation'}</span>
                    </button>
                    {currentMatch.coordinates?.length === 4 ? (
                      <button
                        type="button"
                        className={`pdf-overlay-toggle-btn ${showOverlay ? 'active' : ''}`}
                        onClick={() => setShowOverlay(!showOverlay)}
                        title="Toggle visual target bounding box overlay"
                      >
                        <Crosshair size={11} />
                        <span>
                          {showOverlay
                            ? 'Target Guide: ON'
                            : 'Target Guide: OFF'}
                        </span>
                      </button>
                    ) : null}
                    {parsedTable ? (
                      <button
                        type="button"
                        className={`pdf-table-toggle-btn ${showTableInspector ? 'active' : ''}`}
                        onClick={() =>
                          setShowTableInspector(!showTableInspector)
                        }
                        title="Toggle extracted table structure and column highlighting"
                      >
                        <Table size={11} />
                        <span>
                          {showTableInspector ? 'Table: ON' : 'Table: OFF'}
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {showTableInspector && parsedTable ? (
                <div
                  className="pdf-table-inspector"
                  role="region"
                  aria-label="Extracted Table Inspector"
                >
                  <div className="pdf-table-inspector-header">
                    <div className="pdf-table-inspector-title">
                      <Table size={12} />
                      <span>
                        Table Structure ({parsedTable.headers.length} cols,{' '}
                        {parsedTable.rows.length} rows)
                      </span>
                    </div>
                    {selectedColIndex !== null ? (
                      <button
                        type="button"
                        className="pdf-table-clear-col-btn"
                        onClick={() => setSelectedColIndex(null)}
                        title="Clear column highlight"
                      >
                        Clear Column Highlight
                      </button>
                    ) : (
                      <span className="pdf-table-hint">
                        Click column header to highlight
                      </span>
                    )}
                  </div>
                  <div className="pdf-table-scroll-container">
                    <table className="pdf-table-grid">
                      <thead>
                        <tr>
                          {parsedTable.headers.map((header, idx) => (
                            <th
                              key={`th-${idx}-${header}`}
                              className={`pdf-table-th ${selectedColIndex === idx ? 'is-active-col' : ''}`}
                              onClick={() =>
                                setSelectedColIndex(
                                  selectedColIndex === idx ? null : idx,
                                )
                              }
                              title={`Click to highlight column "${header}"`}
                            >
                              <div className="pdf-th-content">
                                <span>{header}</span>
                                {selectedColIndex === idx ? (
                                  <span className="col-pin-badge">Active</span>
                                ) : null}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedTable.rows.map((row, rIdx) => (
                          <tr key={`tr-${rIdx}`}>
                            {row.map((cell, cIdx) => (
                              <td
                                key={`td-${rIdx}-${cIdx}`}
                                className={`pdf-table-td ${selectedColIndex === cIdx ? 'is-active-col' : ''}`}
                                onClick={() =>
                                  setSelectedColIndex(
                                    selectedColIndex === cIdx ? null : cIdx,
                                  )
                                }
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              <div className="pdf-viewport-container">
                <object
                  data={`${api.sourceDownloadUrl(sourceId)}#page=${currentMatch?.pageNum ?? 1}&zoom=100`}
                  type="application/pdf"
                  className="source-pdf-embed"
                  title={source?.name ?? 'PDF Document'}
                >
                  <div className="pdf-fallback-container">
                    <FileText size={32} className="pdf-fallback-icon" />
                    <p>
                      PDF inline preview is not supported directly by your
                      browser.
                    </p>
                    <a
                      href={api.sourceDownloadUrl(sourceId)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="view-mode-btn source-download-btn pdf-fallback-btn"
                    >
                      <Download size={13} />
                      <span>Download or Open PDF</span>
                    </a>
                  </div>
                </object>
                {showOverlay &&
                currentMatch?.coordinates &&
                currentMatch.coordinates.length === 4 ? (
                  <div className="pdf-overlay-layer">
                    <div
                      className="pdf-coordinate-box"
                      style={{
                        left: `${Math.max(0, Math.min(95, (currentMatch.coordinates[0]! / 595) * 100))}%`,
                        top: `${Math.max(0, Math.min(95, (currentMatch.coordinates[1]! / 842) * 100))}%`,
                        width: `${Math.max(4, Math.min(95, (currentMatch.coordinates[2]! / 595) * 100))}%`,
                        height: `${Math.max(2, Math.min(95, (currentMatch.coordinates[3]! / 842) * 100))}%`,
                      }}
                      title={`Citation Target: ${currentMatch.elementType ?? 'content'} on Page ${currentMatch.pageNum} (Click to copy citation)`}
                      onClick={() => copyCitation(currentMatch)}
                    >
                      <button
                        type="button"
                        className="pdf-coordinate-pin"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyCitation(currentMatch);
                        }}
                        title="Click to copy citation"
                      >
                        <Crosshair size={10} />
                        <span>
                          p.{currentMatch.pageNum ?? 1}{' '}
                          {currentMatch.elementType ?? 'Target'}
                        </span>
                        {copied ? (
                          <Check size={9} className="pin-copy-icon" />
                        ) : (
                          <Copy size={9} className="pin-copy-icon" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : viewMode === 'preview' ? (
            <div className="source-document markdown-preview">
              {renderMarkdownPreview(content, highlightRanges, hitRef)}
            </div>
          ) : (
            <pre className="source-document source-raw">
              {renderHighlightedContent(content, highlightRanges, hitRef)}
            </pre>
          )}
        </article>
      ) : null}
    </DialogFrame>
  );
}

export type ParsedTable = {
  headers: string[];
  rows: string[][];
};

export function parseMarkdownTable(content: string): ParsedTable | null {
  if (!content) return null;
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));

  if (lines.length < 2) return null;

  const headerLine = lines[0];
  const sepLine = lines[1];
  if (!headerLine || !sepLine || !sepLine.includes('---')) return null;

  const headers = headerLine
    .slice(1, -1)
    .split('|')
    .map((col) => col.trim());

  const rows = lines.slice(2).map((row) =>
    row
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim()),
  );

  return { headers, rows };
}

export type HighlightRange = {
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
    .map((match) => {
      const isFocused =
        Boolean(focusedMatch) &&
        match.sourceId === focusedMatch?.sourceId &&
        match.startChar === focusedMatch?.startChar &&
        match.endChar === focusedMatch?.endChar;

      return {
        start: Math.max(0, match.startChar),
        end: Math.min(content.length, match.endChar),
        focused: isFocused,
        kind: match.kind ?? 'MATCH',
      };
    })
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

export function renderMarkdownPreview(
  content: string,
  ranges: HighlightRange[],
  hitRef: RefObject<HTMLElement | null>,
): ReactNode {
  if (!content.trim()) return null;

  const tokens = marked.lexer(content);
  const elements: ReactNode[] = [];
  let currentOffset = 0;

  type MarkdownToken = ReturnType<typeof marked.lexer>[number];
  type TokenGroup = {
    tokens: MarkdownToken[];
    start: number;
    end: number;
    matchedRange?: HighlightRange;
  };

  const groups: TokenGroup[] = [];
  let currentGroup: TokenGroup | null = null;

  for (const token of tokens) {
    const rawLen = token.raw.length;
    const tokenStart = currentOffset;
    const tokenEnd = currentOffset + rawLen;
    currentOffset = tokenEnd;

    if (token.type === 'space') continue;

    const matchedRange = ranges.find(
      (range) => range.start < tokenEnd && range.end > tokenStart,
    );

    if (
      currentGroup &&
      ((!currentGroup.matchedRange && !matchedRange) ||
        (currentGroup.matchedRange &&
          matchedRange &&
          currentGroup.matchedRange.start === matchedRange.start &&
          currentGroup.matchedRange.end === matchedRange.end))
    ) {
      currentGroup.tokens.push(token);
      currentGroup.end = tokenEnd;
    } else {
      currentGroup = {
        tokens: [token],
        start: tokenStart,
        end: tokenEnd,
        matchedRange,
      };
      groups.push(currentGroup);
    }
  }

  let hasAttachedHitRef = false;

  for (const [index, group] of groups.entries()) {
    const groupHtml = marked.parser(group.tokens);
    const cleanHtml = DOMPurify.sanitize(groupHtml, {
      USE_PROFILES: { mathMl: true, html: true },
    });

    if (group.matchedRange) {
      const isFocused = group.matchedRange.focused;
      const isExtended = group.matchedRange.kind === 'EXTENDED';
      const attachRef = isFocused && !hasAttachedHitRef;
      if (attachRef) hasAttachedHitRef = true;

      elements.push(
        <div
          key={`group-${index}-${group.start}`}
          ref={attachRef ? (hitRef as RefObject<HTMLDivElement>) : undefined}
          className={`preview-hit-block ${isExtended ? 'is-context' : 'is-match'} ${isFocused ? 'is-focused' : ''}`}
          data-start-char={group.start}
          data-end-char={group.end}
        >
          <div
            className={`preview-hit-badge ${isExtended ? 'is-context' : 'is-match'}`}
          >
            {isExtended ? (
              <>
                <Sparkles size={11} aria-hidden="true" />
                <span>Context</span>
              </>
            ) : (
              <>
                <FileText size={11} aria-hidden="true" />
                <span>Match</span>
              </>
            )}
          </div>
          <div
            className="preview-hit-content"
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
        </div>,
      );
    } else {
      elements.push(
        <div
          key={`group-${index}-${group.start}`}
          className="preview-standard-block"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />,
      );
    }
  }

  return elements;
}

export function renderHighlightedContent(
  content: string,
  ranges: HighlightRange[],
  hitRef: RefObject<HTMLElement | null>,
): ReactNode {
  if (ranges.length === 0) return content;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let hasAttachedHitRef = false;

  for (const [index, range] of ranges.entries()) {
    if (range.start > cursor) {
      parts.push(content.slice(cursor, range.start));
    }
    const attachRef = range.focused && !hasAttachedHitRef;
    if (attachRef) hasAttachedHitRef = true;

    parts.push(
      <mark
        key={`${range.start}-${range.end}-${index}`}
        ref={attachRef ? hitRef : undefined}
        className={`hit-highlight ${range.kind === 'EXTENDED' ? 'is-context' : 'is-match'} ${range.focused ? 'is-focused' : ''}`}
      >
        {content.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }
  if (cursor < content.length) parts.push(content.slice(cursor));
  return parts;
}
