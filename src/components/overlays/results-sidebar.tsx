import { useState } from 'react';
import { FileText, ListTree, Sparkles, Table } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { SearchChunk, SearchResponse } from '../../types/api';

type ResultsSidebarProps = {
  results?: SearchResponse;
  onOpenSource: (sourceId: string) => void;
  onOpenMatch: (chunk: SearchChunk) => void;
};

type SourceMatchGroup = {
  sourceId: string;
  sourceName: string;
  chunks: SearchChunk[];
};

export type ContextFilterMode = 'all' | 'same-source' | 'adjacent';

export function formatInlineSnippet(text: string): string {
  if (!text) return '';
  return text
    .replace(/^#+\s+/gm, '') // Remove markdown heading hashes
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list bullet dashes
    .replace(/\s+/g, ' ') // Collapse multiple whitespace and newlines
    .trim();
}

export function ResultsSidebar({
  results,
  onOpenSource,
  onOpenMatch,
}: ResultsSidebarProps) {
  const { t } = useTranslation();
  const [contextFilter, setContextFilter] = useState<ContextFilterMode>('all');
  if (!results) return null;
  const sources = groupMatchesBySource(results.results);
  const hasExtendedContext = results.results.some((r) =>
    r.chunks.some((c) => (c.extendedContext?.length ?? 0) > 0),
  );

  return (
    <aside
      className="results-sidebar overlay-interactive"
      aria-label={t('searchResults')}
    >
      <div className="results-sidebar-heading">
        <ListTree size={17} aria-hidden="true" />
        <span>{t('searchResults')}</span>
      </div>
      {hasExtendedContext ? (
        <div
          className="results-context-filter-pills"
          role="radiogroup"
          aria-label="Filter context scope"
        >
          <button
            type="button"
            className={`filter-pill ${contextFilter === 'all' ? 'active' : ''}`}
            onClick={() => setContextFilter('all')}
            aria-checked={contextFilter === 'all'}
          >
            All
          </button>
          <button
            type="button"
            className={`filter-pill ${contextFilter === 'same-source' ? 'active' : ''}`}
            onClick={() => setContextFilter('same-source')}
            aria-checked={contextFilter === 'same-source'}
          >
            This Document
          </button>
          <button
            type="button"
            className={`filter-pill ${contextFilter === 'adjacent' ? 'active' : ''}`}
            onClick={() => setContextFilter('adjacent')}
            aria-checked={contextFilter === 'adjacent'}
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
              <FileText size={14} aria-hidden="true" />
              <span>{source.sourceName}</span>
            </button>
            <ul className="result-match-list">
              {source.chunks.map((chunk) => {
                const filteredExtended = (chunk.extendedContext ?? []).filter(
                  (extendedChunk) => {
                    if (contextFilter === 'same-source') {
                      return extendedChunk.sourceId === chunk.sourceId;
                    }
                    if (contextFilter === 'adjacent') {
                      return extendedChunk.sourceId !== chunk.sourceId;
                    }
                    return true;
                  },
                );

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
                      <span className="result-kind-badge is-match">Match</span>
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
                      <span className="result-text">
                        {formatInlineSnippet(chunk.content)}
                      </span>
                    </button>
                    {filteredExtended.length > 0 ? (
                      <ul className="result-extended-list">
                        {filteredExtended.map((extendedChunk) => (
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
                              <span className="result-kind-badge is-context">
                                <Sparkles size={10} aria-hidden="true" />
                                Context
                              </span>
                              {extendedChunk.pageNum ? (
                                <span className="result-kind-badge is-pdf-page">
                                  p.{extendedChunk.pageNum}
                                </span>
                              ) : null}
                              {extendedChunk.elementType === 'table' ? (
                                <span className="result-kind-badge is-table">
                                  <Table size={10} aria-hidden="true" />
                                  Table
                                </span>
                              ) : null}
                              <span className="result-text">
                                <strong className="result-source-name">
                                  {extendedChunk.sourceName}:
                                </strong>{' '}
                                {formatInlineSnippet(extendedChunk.content)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
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
