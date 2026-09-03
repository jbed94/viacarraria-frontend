import { FileText, ListTree, Sparkles } from 'lucide-react';
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

export function ResultsSidebar({
  results,
  onOpenSource,
  onOpenMatch,
}: ResultsSidebarProps) {
  const { t } = useTranslation();
  if (!results) return null;
  const sources = groupMatchesBySource(results.results);

  return (
    <aside
      className="results-sidebar overlay-interactive"
      aria-label={t('searchResults')}
    >
      <div className="results-sidebar-heading">
        <ListTree size={17} aria-hidden="true" />
        <span>{t('searchResults')}</span>
      </div>
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
              {source.chunks.map((chunk) => (
                <li
                  key={`${chunk.sourceId}-${chunk.startChar}-${chunk.endChar}`}
                >
                  <button
                    type="button"
                    className="result-match-button"
                    onClick={() => onOpenMatch(chunk)}
                  >
                    <span>{chunk.content}</span>
                  </button>
                  {chunk.extendedContext?.length ? (
                    <ul className="result-extended-list">
                      {chunk.extendedContext.map((extendedChunk) => (
                        <li
                          key={`${extendedChunk.sourceId}-${extendedChunk.startChar}-${extendedChunk.endChar}`}
                        >
                          <button
                            type="button"
                            className="result-extended-button"
                            onClick={() => onOpenMatch(extendedChunk)}
                          >
                            <Sparkles size={13} aria-hidden="true" />
                            <span>
                              {extendedChunk.sourceName}:{' '}
                              {extendedChunk.content}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
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
