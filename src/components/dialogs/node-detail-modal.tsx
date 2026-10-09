import {
  Compass,
  FileCode,
  FileText,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useGraphStore } from '../../store/graph-store';
import type { SearchChunk } from '../../types/api';
import { DialogFrame } from './dialog-frame';

export function NodeDetailModal() {
  const { t } = useTranslation();
  const maximizedNodeId = useGraphStore((state) => state.maximizedNodeId);
  const setMaximizedNodeId = useGraphStore((state) => state.setMaximizedNodeId);
  const graph = useGraphStore((state) => state.graph);
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);
  const toggleNodeSelection = useGraphStore((state) => state.toggleNodeSelection);
  const crawlStartingNodeIds = useGraphStore(
    (state) => state.crawlStartingNodeIds,
  );
  const toggleCrawlStartingNode = useGraphStore(
    (state) => state.toggleCrawlStartingNode,
  );
  const queryType = useGraphStore((state) => state.queryType);
  const identity = useGraphStore((state) => state.identity);
  const results = useGraphStore((state) => state.results);
  const setActiveSourceId = useGraphStore((state) => state.setActiveSourceId);
  const setActiveMatch = useGraphStore((state) => state.setActiveMatch);

  const node = useMemo(() => {
    if (!maximizedNodeId || !graph) return null;
    return graph.nodes.find((n) => n.id === maximizedNodeId) ?? null;
  }, [maximizedNodeId, graph]);

  const sources = useMemo(() => {
    if (!node || !graph?.sources) return [];
    return graph.sources.filter((s) => s.nodeId === node.id);
  }, [node, graph]);

  const isSelected = Boolean(node && selectedNodeIds.includes(node.id));
  const isCrawlStart = Boolean(node && crawlStartingNodeIds.includes(node.id));

  const isAnonymous = identity?.isGuest ?? identity?.tier === 'ANONYMOUS';
  const selectionLimit = isAnonymous ? 2 : Number.POSITIVE_INFINITY;
  const selectionLimitReached =
    selectedNodeIds.length >= selectionLimit && !isSelected;
  const crawlLimit = isAnonymous ? 1 : Number.POSITIVE_INFINITY;
  const crawlLimitReached =
    crawlStartingNodeIds.length >= crawlLimit && !isCrawlStart;

  const nodeMatches: SearchChunk[] = useMemo(() => {
    if (!node || !results) return [];
    const group = results.results?.find((r) => r.nodeId === node.id);
    return group?.chunks ?? [];
  }, [node, results]);

  if (!node) return null;

  const subject = node.data;

  return (
    <DialogFrame
      open={Boolean(maximizedNodeId && node)}
      onOpenChange={(open) => !open && setMaximizedNodeId(undefined)}
      title={subject.title || 'Topic Details'}
      className="node-detail-dialog"
    >
      <div className="node-detail-modal-body">
        {/* Meta Header Row */}
        <div className="node-detail-meta-row">
          <div className="node-detail-badges">
            <span className="node-detail-type-pill">
              <Layers size={12} aria-hidden="true" />
              <span>Topic</span>
            </span>
            {sources.length > 0 && (
              <span className="node-detail-sources-pill">
                <FileText size={12} aria-hidden="true" />
                <span>
                  {sources.length}{' '}
                  {sources.length === 1 ? 'source' : 'sources'}
                </span>
              </span>
            )}
            {nodeMatches.length > 0 && (
              <span className="node-detail-matches-pill">
                <Sparkles size={12} aria-hidden="true" />
                <span>
                  {nodeMatches.length}{' '}
                  {nodeMatches.length === 1 ? 'match' : 'matches'}
                </span>
              </span>
            )}
          </div>

          <div className="node-detail-actions-group">
            {queryType === 'crawl' ? (
              <button
                type="button"
                className={`command-button ${isCrawlStart ? 'accent' : ''}`}
                disabled={crawlLimitReached}
                onClick={() => toggleCrawlStartingNode(node.id)}
                title={
                  crawlLimitReached
                    ? `Starting node limit reached (${crawlLimit} node for guests)`
                    : undefined
                }
              >
                <Compass size={14} aria-hidden="true" />
                <span>{isCrawlStart ? 'Seed Node (Active)' : 'Set as Seed'}</span>
              </button>
            ) : (
              <button
                type="button"
                className={`command-button ${isSelected ? 'accent' : ''}`}
                disabled={selectionLimitReached}
                onClick={() => toggleNodeSelection(node.id)}
                title={
                  selectionLimitReached
                    ? `Selection limit reached (${selectionLimit} nodes for guests)`
                    : undefined
                }
              >
                <span>{isSelected ? 'Included in Search' : 'Include in Search'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Description / Syllabus Section */}
        <section className="node-detail-section">
          <h3 className="node-detail-section-title">
            {t('topicDescription', 'Description & Syllabus')}
          </h3>
          {subject.description ? (
            <div className="node-detail-description-content">
              {subject.description}
            </div>
          ) : (
            <p className="node-detail-empty-text">
              {t('noDescription', 'No description provided for this topic.')}
            </p>
          )}
        </section>

        {/* Search / Crawl Matches Section */}
        {nodeMatches.length > 0 && (
          <section className="node-detail-section">
            <h3 className="node-detail-section-title">
              <Sparkles size={14} className="section-title-icon" aria-hidden="true" />
              <span>{t('searchMatches', 'Search Matches')}</span>
            </h3>
            <div className="node-detail-matches-list">
              {nodeMatches.map((chunk) => (
                <button
                  key={`${chunk.sourceId}-${chunk.startChar}`}
                  type="button"
                  className="node-detail-match-item"
                  onClick={() => {
                    setActiveSourceId(chunk.sourceId);
                    setActiveMatch(chunk);
                  }}
                >
                  <div className="match-item-header">
                    <span className="match-source-name">{chunk.sourceName}</span>
                    <span className="match-score-badge">
                      {(chunk.score * 100).toFixed(0)}% relevance
                    </span>
                  </div>
                  <p className="match-snippet-text">
                    {chunk.content.slice(0, 180)}...
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Attached Sources Section */}
        <section className="node-detail-section">
          <h3 className="node-detail-section-title">
            <FileText size={14} className="section-title-icon" aria-hidden="true" />
            <span>{t('attachedSources', 'Attached Sources')}</span>
          </h3>
          {sources.length === 0 ? (
            <p className="node-detail-empty-text">
              {t('noSources', 'No documents attached to this topic yet.')}
            </p>
          ) : (
            <div className="node-detail-sources-grid">
              {sources.map((source) => {
                const isPdf =
                  source.fileType === 'application/pdf' ||
                  source.name.toLowerCase().endsWith('.pdf');
                const isMarkdown =
                  source.fileType === 'text/markdown' ||
                  source.name.toLowerCase().endsWith('.md');

                return (
                  <button
                    key={source.id}
                    type="button"
                    className="node-detail-source-card"
                    onClick={() => {
                      setActiveSourceId(source.id);
                      setActiveMatch(undefined);
                    }}
                  >
                    <div className="source-card-icon">
                      {isPdf ? (
                        <FileText size={18} className="icon-pdf" />
                      ) : isMarkdown ? (
                        <FileCode size={18} className="icon-md" />
                      ) : (
                        <FileText size={18} />
                      )}
                    </div>
                    <div className="source-card-info">
                      <span className="source-card-title">{source.name}</span>
                      <span className="source-card-badge">
                        {isPdf ? 'PDF' : isMarkdown ? 'MARKDOWN' : 'DOCUMENT'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DialogFrame>
  );
}
