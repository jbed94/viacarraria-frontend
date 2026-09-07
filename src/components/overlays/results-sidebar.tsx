import {
  BookOpen,
  ExternalLink,
  FileText,
  Info,
  ListOrdered,
  ListTree,
  Sparkles,
  Table,
  Target,
  X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SearchChunk, SearchResponse } from '../../types/api';

const ResultsGuideDialog = lazy(() =>
  import('../dialogs/results-guide-dialog').then((m) => ({
    default: m.ResultsGuideDialog,
  })),
);

type ResultsSidebarProps = {
  results?: SearchResponse;
  activeSourceId?: string;
  onOpenSource: (sourceId: string) => void;
  onOpenMatch: (chunk: SearchChunk) => void;
  onSelectNode?: (nodeId: string) => void;
  onClose?: () => void;
};

type SourceMatchGroup = {
  sourceId: string;
  sourceName: string;
  chunks: SearchChunk[];
};

export type ContextFilterMode = 'all' | 'same-source' | 'adjacent';

const DEFAULT_RESULTS_WIDTH = 380;
const EXPANDED_RESULTS_WIDTH = 600;
const MIN_RESULTS_WIDTH = 320;

export function formatInlineSnippet(text: string): string {
  if (!text) return '';
  return text
    .replace(/^#+\s+/gm, '') // Remove markdown heading hashes
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list bullet dashes
    .replace(/\s+/g, ' ') // Collapse multiple whitespace and newlines
    .trim();
}

export function getAnswerTypeIcon(type?: string) {
  switch (type) {
    case 'procedural':
      return <ListOrdered size={11} aria-hidden="true" />;
    case 'tabular':
      return <Table size={11} aria-hidden="true" />;
    case 'definitional':
      return <BookOpen size={11} aria-hidden="true" />;
    case 'direct':
    default:
      return <Target size={11} aria-hidden="true" />;
  }
}

export function getAnswerTypeLabel(type?: string): string {
  switch (type) {
    case 'procedural':
      return 'Procedure';
    case 'tabular':
      return 'Table Matrix';
    case 'definitional':
      return 'Definition';
    case 'direct':
    default:
      return 'Direct Match';
  }
}

export function ResultsSidebar({
  results,
  activeSourceId,
  onOpenSource,
  onOpenMatch,
  onSelectNode,
  onClose,
}: ResultsSidebarProps) {
  const { t } = useTranslation();
  const [contextFilter, setContextFilter] = useState<ContextFilterMode>('all');
  const [guideOpen, setGuideOpen] = useState(false);
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_RESULTS_WIDTH;
    const saved = localStorage.getItem('vc_results_sidebar_width');
    if (saved) {
      const parsed = Number.parseInt(saved, 10);
      if (!Number.isNaN(parsed) && parsed >= MIN_RESULTS_WIDTH) {
        return Math.min(parsed, window.innerWidth - 48);
      }
    }
    return DEFAULT_RESULTS_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const handleWindowResize = () => {
      setWidth((prev) => {
        const maxWidth = Math.max(MIN_RESULTS_WIDTH, window.innerWidth - 48);
        return Math.min(prev, maxWidth);
      });
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // Handle Escape key to exit results mode
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;

      // If the guide dialog is open, let the dialog handle Escape
      if (guideOpen) return;

      // If typing in an active input or textarea, don't exit results
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      // If an open modal dialog or active source is present, do not close results sidebar
      if (document.querySelector('[role="dialog"]') || activeSourceId) return;

      event.preventDefault();
      onClose?.();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guideOpen, onClose, activeSourceId]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: width };
    setIsResizing(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    const deltaX = resizeRef.current.startX - e.clientX; // dragging left increases width
    const maxWidth = Math.min(920, window.innerWidth - 48);
    const newWidth = Math.max(
      MIN_RESULTS_WIDTH,
      Math.min(maxWidth, resizeRef.current.startWidth + deltaX),
    );
    setWidth(newWidth);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizeRef.current) {
      localStorage.setItem('vc_results_sidebar_width', width.toString());
      resizeRef.current = null;
      setIsResizing(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleToggleWidth = () => {
    const nextWidth =
      width >= 520 ? DEFAULT_RESULTS_WIDTH : EXPANDED_RESULTS_WIDTH;
    const maxWidth = Math.min(920, window.innerWidth - 48);
    const clamped = Math.max(MIN_RESULTS_WIDTH, Math.min(maxWidth, nextWidth));
    setWidth(clamped);
    localStorage.setItem('vc_results_sidebar_width', clamped.toString());
  };

  const sources = useMemo(
    () => (results ? groupMatchesBySource(results.results) : []),
    [results?.results],
  );
  const totalMatches = useMemo(
    () => results?.results.reduce((sum, r) => sum + r.chunks.length, 0) ?? 0,
    [results?.results],
  );
  const hasExtendedContext = useMemo(
    () =>
      results?.results.some((r) =>
        r.chunks.some((c) => (c.extendedContext?.length ?? 0) > 0),
      ) ?? false,
    [results?.results],
  );

  if (!results) return null;

  return (
    <>
      <aside
        className={`results-sidebar overlay-interactive ${isResizing ? 'is-resizing' : ''}`}
        style={{ width: `${width}px` }}
        aria-label={t('searchResults')}
      >
        <div
          className="results-resize-handle"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleToggleWidth}
          title="Drag to resize results panel (double-click to toggle width)"
          aria-label="Resize results panel"
          role="separator"
          aria-orientation="vertical"
        >
          <span className="results-resize-pill">
            <span className="results-resize-line" aria-hidden="true" />
            <span className="results-resize-line" aria-hidden="true" />
            <span className="results-resize-line" aria-hidden="true" />
          </span>
        </div>

        <div className="results-sidebar-heading">
          <div className="results-heading-left">
            <ListTree size={16} aria-hidden="true" />
            <span>{t('searchResults')}</span>
            <span className="results-count-pill">{totalMatches}</span>
          </div>
          <div className="results-heading-actions">
            {results.leadAnswer ? (
              <span className="results-qa-mode-tag">QA Mode</span>
            ) : null}
            <button
              type="button"
              className="results-info-button"
              onClick={() => setGuideOpen(true)}
              aria-label={t('searchGuide', 'Search guide & legend')}
              title={t(
                'searchGuide',
                'Search guide & legend (how to read results)',
              )}
            >
              <Info size={14} aria-hidden="true" />
            </button>
            {onClose ? (
              <button
                type="button"
                className="results-exit-button"
                onClick={onClose}
                aria-label={
                  activeSourceId
                    ? t('closeSource', 'Close source dialog')
                    : t('closeResults', 'Close results')
                }
                title={
                  activeSourceId
                    ? t('closeSource', 'Close source dialog')
                    : t('closeResultsTitle', 'Exit results view')
                }
              >
                <X size={15} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="results-sidebar-scrollable">
          {/* Lead Direct Answer Card */}
          {results.leadAnswer ? (
            <section className="lead-answer-hero" aria-label="Direct Answer">
              <div className="lead-answer-topline">
                <div className="lead-answer-identity">
                  <span className="lead-identity-tag">
                    <Target size={11} aria-hidden="true" />
                    <span>{t('directAnswer', 'Direct Answer')}</span>
                  </span>
                  <span className="lead-type-chip">
                    {getAnswerTypeIcon(results.leadAnswer.answerType)}
                    <span>
                      {getAnswerTypeLabel(results.leadAnswer.answerType)}
                    </span>
                  </span>
                </div>
                {results.leadAnswer.score > 0 ? (
                  <span
                    className="lead-score-badge"
                    title="Relevance Confidence"
                  >
                    {Math.round(
                      results.leadAnswer.score <= 1
                        ? results.leadAnswer.score * 100
                        : results.leadAnswer.score,
                    )}
                    % Salience
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                className="lead-source-chip"
                onClick={() => onOpenMatch(results.leadAnswer!.chunk)}
                title={`View citation in ${results.leadAnswer.chunk.sourceName}`}
              >
                <FileText size={12} aria-hidden="true" />
                <span className="lead-source-title">
                  {results.leadAnswer.chunk.sourceName}
                </span>
                {results.leadAnswer.chunk.pageNum ? (
                  <span className="lead-page-tag">
                    p.{results.leadAnswer.chunk.pageNum}
                  </span>
                ) : null}
                {results.leadAnswer.chunk.elementType === 'table' ? (
                  <span className="lead-page-tag is-table">Table</span>
                ) : null}
                <ExternalLink
                  size={11}
                  className="lead-link-icon"
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                className="lead-answer-body"
                onClick={() => onOpenMatch(results.leadAnswer!.chunk)}
                title="Click to focus match in document"
              >
                <p className="lead-answer-text">
                  {formatInlineSnippet(results.leadAnswer.chunk.content)}
                </p>
              </button>

              {/* Graph Topological Prerequisites & Next Steps */}
              {results.leadAnswer.prerequisiteNodes?.length ||
              results.leadAnswer.extensionNodes?.length ? (
                <div className="lead-graph-relations">
                  {results.leadAnswer.prerequisiteNodes &&
                  results.leadAnswer.prerequisiteNodes.length > 0 ? (
                    <div className="lead-relation-row is-prerequisite">
                      <span className="relation-label">
                        <span>{t('prerequisites', 'Prerequisites')}:</span>
                      </span>
                      <div className="relation-chips">
                        {results.leadAnswer.prerequisiteNodes.map((node) => (
                          <button
                            key={node.id}
                            type="button"
                            className="relation-chip is-prereq"
                            onClick={() => onSelectNode?.(node.id)}
                            title={`Focus prerequisite node: ${node.title}`}
                          >
                            {node.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {results.leadAnswer.extensionNodes &&
                  results.leadAnswer.extensionNodes.length > 0 ? (
                    <div className="lead-relation-row is-extension">
                      <span className="relation-label">
                        <span>{t('nextSteps', 'Next Steps')}:</span>
                      </span>
                      <div className="relation-chips">
                        {results.leadAnswer.extensionNodes.map((node) => (
                          <button
                            key={node.id}
                            type="button"
                            className="relation-chip is-ext"
                            onClick={() => onSelectNode?.(node.id)}
                            title={`Focus next-step node: ${node.title}`}
                          >
                            {node.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {hasExtendedContext ? (
            <div
              className="results-context-filter-pills"
              aria-label="Filter context scope"
            >
              <button
                type="button"
                className={`filter-pill ${contextFilter === 'all' ? 'active' : ''}`}
                onClick={() => setContextFilter('all')}
                aria-pressed={contextFilter === 'all'}
              >
                All
              </button>
              <button
                type="button"
                className={`filter-pill ${contextFilter === 'same-source' ? 'active' : ''}`}
                onClick={() => setContextFilter('same-source')}
                aria-pressed={contextFilter === 'same-source'}
              >
                This Document
              </button>
              <button
                type="button"
                className={`filter-pill ${contextFilter === 'adjacent' ? 'active' : ''}`}
                onClick={() => setContextFilter('adjacent')}
                aria-pressed={contextFilter === 'adjacent'}
              >
                Adjacent Nodes
              </button>
            </div>
          ) : null}

          <div className="results-sidebar-list">
            {sources.length === 0 ? (
              <p className="empty-state">{t('noSearchResults')}</p>
            ) : null}
            {sources.map((source) => (
              <section key={source.sourceId} className="result-source-group">
                <button
                  type="button"
                  className="result-source-button"
                  onClick={() => onOpenSource(source.sourceId)}
                >
                  <FileText size={13} aria-hidden="true" />
                  <span className="result-source-label">
                    {source.sourceName}
                  </span>
                  <span className="result-source-count" aria-hidden="true">
                    {source.chunks.length}
                  </span>
                </button>
                <ul className="result-match-list">
                  {source.chunks.map((chunk) => {
                    const filteredExtended = (
                      chunk.extendedContext ?? []
                    ).filter((extendedChunk) => {
                      if (contextFilter === 'same-source') {
                        return extendedChunk.sourceId === chunk.sourceId;
                      }
                      if (contextFilter === 'adjacent') {
                        return extendedChunk.sourceId !== chunk.sourceId;
                      }
                      return true;
                    });

                    return (
                      <li
                        key={`${chunk.sourceId}-${chunk.startChar}-${chunk.endChar}`}
                        className="result-item"
                      >
                        <button
                          type="button"
                          className="result-match-button"
                          onClick={() => onOpenMatch(chunk)}
                          title={chunk.content}
                        >
                          <div className="result-match-badges">
                            <span className="result-kind-badge is-match">
                              Match
                            </span>
                            {chunk.pageNum ? (
                              <span className="result-kind-badge is-pdf-page">
                                p.{chunk.pageNum}
                              </span>
                            ) : null}
                            {chunk.elementType === 'table' ? (
                              <span className="result-kind-badge is-table">
                                <Table size={10} aria-hidden="true" />
                                Table
                              </span>
                            ) : null}
                            {chunk.rerankScore ? (
                              <span className="result-kind-badge is-salience">
                                {Math.round(
                                  chunk.rerankScore <= 1
                                    ? chunk.rerankScore * 100
                                    : chunk.rerankScore,
                                )}
                                %
                              </span>
                            ) : null}
                          </div>
                          <span className="result-text">
                            {formatInlineSnippet(chunk.content)}
                          </span>
                        </button>
                        {filteredExtended.length > 0 ? (
                          <ul className="result-extended-list">
                            {filteredExtended.map((extendedChunk) => {
                              const isSameSource =
                                extendedChunk.sourceId === chunk.sourceId;
                              return (
                                <li
                                  key={`${extendedChunk.sourceId}-${extendedChunk.startChar}-${extendedChunk.endChar}`}
                                  className="result-extended-item"
                                >
                                  <button
                                    type="button"
                                    className="result-extended-button"
                                    onClick={() => onOpenMatch(extendedChunk)}
                                    title={extendedChunk.content}
                                  >
                                    <div className="result-extended-badges">
                                      <span className="result-kind-badge is-context">
                                        <Sparkles size={9} aria-hidden="true" />
                                        Context
                                      </span>
                                      <span
                                        className={`result-kind-badge ${isSameSource ? 'is-same-source' : 'is-adjacent-node'}`}
                                      >
                                        {isSameSource
                                          ? 'This Document'
                                          : 'Adjacent Node'}
                                      </span>
                                      {extendedChunk.pageNum ? (
                                        <span className="result-kind-badge is-pdf-page">
                                          p.{extendedChunk.pageNum}
                                        </span>
                                      ) : null}
                                      {extendedChunk.elementType === 'table' ? (
                                        <span className="result-kind-badge is-table">
                                          <Table size={9} aria-hidden="true" />
                                          Table
                                        </span>
                                      ) : null}
                                    </div>
                                    <span className="result-text">
                                      <strong className="result-source-name">
                                        {extendedChunk.sourceName}:
                                      </strong>{' '}
                                      {formatInlineSnippet(
                                        extendedChunk.content,
                                      )}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </aside>
      <Suspense fallback={null}>
        <ResultsGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
      </Suspense>
    </>
  );
}

export function groupMatchesBySource(
  results: SearchResponse['results'],
): SourceMatchGroup[] {
  const grouped = new Map<string, SourceMatchGroup>();
  for (const result of results) {
    for (const chunk of result.chunks) {
      const source = grouped.get(chunk.sourceId) ?? {
        sourceId: chunk.sourceId,
        sourceName: chunk.sourceName,
        chunks: [],
      };
      source.chunks.push(chunk);
      grouped.set(chunk.sourceId, source);
    }
  }
  return [...grouped.values()];
}
