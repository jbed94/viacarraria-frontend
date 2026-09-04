import {
  Handle,
  type NodeProps,
  NodeToolbar,
  Position,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { ChevronUp, FileText, Maximize2, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useGraphStore } from '../../store/graph-store';
import type { SubjectNodeData } from '../../types/api';

export function SubjectNode({ id, data }: NodeProps) {
  const subject = data as SubjectNodeData;
  const { t } = useTranslation();
  const graph = useGraphStore((state) => state.graph);
  const identity = useGraphStore((state) => state.identity);
  const mode = useGraphStore((state) => state.mode);
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);
  const results = useGraphStore((state) => state.results);
  const expandedNodeIds = useGraphStore((state) => state.expandedNodeIds);
  const isEditing = useGraphStore((state) => state.isEditing);
  const toggleNodeSelection = useGraphStore(
    (state) => state.toggleNodeSelection,
  );
  const toggleExpanded = useGraphStore((state) => state.toggleExpanded);
  const setActiveSourceId = useGraphStore((state) => state.setActiveSourceId);
  const setActiveMatch = useGraphStore((state) => state.setActiveMatch);
  const setEditingNodeId = useGraphStore((state) => state.setEditingNodeId);
  const setPendingDeleteNodeId = useGraphStore(
    (state) => state.setPendingDeleteNodeId,
  );
  const addChild = useGraphStore((state) => state.addChild);
  const updateNodeInternals = useUpdateNodeInternals();

  const sources = graph?.sources.filter((source) => source.nodeId === id) ?? [];
  const hasPdf = sources.some(
    (source) =>
      source.fileType === 'application/pdf' ||
      source.name.toLowerCase().endsWith('.pdf'),
  );
  const match = results?.results.find((result) => result.nodeId === id);
  const isMatched = Boolean(match);
  const isExpanded = expandedNodeIds.includes(id);
  const isSelected = selectedNodeIds.includes(id);
  const selectionLimit =
    identity?.tier === 'ANONYMOUS' ? 2 : Number.POSITIVE_INFINITY;
  const selectionLimitReached =
    selectedNodeIds.length >= selectionLimit && !isSelected;
  const matchesBySource = new Map<
    string,
    NonNullable<typeof match>['chunks']
  >();
  for (const chunk of match?.chunks ?? []) {
    const sourceMatches = matchesBySource.get(chunk.sourceId) ?? [];
    sourceMatches.push(chunk);
    matchesBySource.set(chunk.sourceId, sourceMatches);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => updateNodeInternals(id));
    const transitionDuration = isExpanded ? 360 : 360;
    const timer = window.setTimeout(
      () => updateNodeInternals(id),
      transitionDuration,
    );
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [id, isExpanded, updateNodeInternals]);

  return (
    <article
      className={`subject-node ${isMatched ? 'is-matched' : results ? 'is-muted' : ''} ${isExpanded ? 'is-expanded' : ''}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={`flow-handle ${isEditing ? '' : 'view-handle'}`}
        isConnectable
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`flow-handle ${isEditing ? '' : 'view-handle'}`}
        isConnectable
      />
      {isEditing ? (
        <NodeToolbar isVisible position={Position.Top} className="node-toolbar">
          <button
            type="button"
            title="Add child node"
            onClick={() => addChild(id)}
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            title="Edit node details"
            onClick={() => setEditingNodeId(id)}
          >
            <Maximize2 size={14} />
          </button>
          <button
            type="button"
            title="Delete node"
            className="danger-icon"
            onClick={() => setPendingDeleteNodeId(id)}
          >
            <Trash2 size={14} />
          </button>
        </NodeToolbar>
      ) : null}
      <button
        type="button"
        className="node-main"
        onClick={(event) => {
          event.stopPropagation();
          toggleExpanded(id);
        }}
      >
        <span className="node-topline">
          <span className="node-category">{subject.category ?? 'Topic'}</span>
          {match ? (
            <span className="match-badge">+{match.matchCount}</span>
          ) : null}
        </span>
        <strong>{subject.title}</strong>
        {sources.length > 0 ? (
          <span className="node-attachments">
            <span
              className="source-count-badge"
              title={`${sources.length} ${sources.length === 1 ? 'source' : 'sources'} attached`}
            >
              <FileText size={10} aria-hidden="true" />
              <span>{sources.length}</span>
            </span>
            {hasPdf ? (
              <span
                className="pdf-attachment-badge"
                title="PDF document attached"
              >
                PDF
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
      {mode === 'CONTEXT_SELECTION' ? (
        <label className="node-selector nodrag nopan">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={selectionLimitReached}
            onChange={() => toggleNodeSelection(id)}
          />
          <span>Include</span>
        </label>
      ) : null}
      {isExpanded ? (
        <section className="node-details nodrag nopan">
          <div className="node-details-header">
            <span>{t('topicDetails')}</span>
            <button
              type="button"
              className="collapse-node"
              title={t('collapseDetails')}
              aria-label={t('collapseDetails')}
              onClick={() => toggleExpanded(id)}
            >
              <ChevronUp size={16} aria-hidden="true" />
            </button>
          </div>
          {subject.description ? (
            <div className="detail-section">
              <h3>Description</h3>
              <p>{subject.description}</p>
            </div>
          ) : null}
          {match ? (
            <div className="detail-section">
              <h3>Matches</h3>
              <ul className="match-source-list">
                {[...matchesBySource.entries()].map(
                  ([sourceId, sourceMatches]) => (
                    <li key={sourceId}>
                      <button
                        type="button"
                        className="match-source"
                        onClick={() => {
                          setActiveSourceId(sourceId);
                          setActiveMatch(undefined);
                        }}
                      >
                        <FileText size={14} aria-hidden="true" />
                        <span>{sourceMatches[0]?.sourceName}</span>
                      </button>
                      <ul className="match-list">
                        {sourceMatches.map((chunk) => (
                          <li key={`${chunk.sourceId}-${chunk.startChar}`}>
                            <button
                              type="button"
                              className="match-snippet"
                              onClick={() => {
                                setActiveSourceId(chunk.sourceId);
                                setActiveMatch(chunk);
                              }}
                            >
                              <small>{chunk.content.slice(0, 110)}...</small>
                            </button>
                            {chunk.extendedContext?.length ? (
                              <ul className="extended-context-list">
                                {chunk.extendedContext.map((extendedChunk) => (
                                  <li
                                    key={`${extendedChunk.sourceId}-${extendedChunk.startChar}`}
                                  >
                                    <button
                                      type="button"
                                      className="extended-context-snippet"
                                      onClick={() => {
                                        setActiveSourceId(
                                          extendedChunk.sourceId,
                                        );
                                        setActiveMatch(extendedChunk);
                                      }}
                                    >
                                      <FileText size={13} aria-hidden="true" />
                                      <small>
                                        {extendedChunk.sourceName}:{' '}
                                        {extendedChunk.content.slice(0, 90)}...
                                      </small>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}
          <div className="detail-section">
            <h3>Sources</h3>
            {sources.length === 0 ? <p>{t('noSources')}</p> : null}
            {sources.map((source) => (
              <div key={source.id} className="source-entry">
                <button
                  type="button"
                  className="source-row"
                  onClick={() => {
                    setActiveSourceId(source.id);
                    setActiveMatch(undefined);
                  }}
                >
                  <FileText size={14} />
                  <span>{source.name}</span>
                  {source.fileType === 'application/pdf' ||
                  source.name.toLowerCase().endsWith('.pdf') ? (
                    <span className="source-pdf-tag">PDF</span>
                  ) : null}
                  <small
                    className={`source-status ${source.status.toLowerCase()}`}
                  >
                    {source.status}
                  </small>
                </button>
                {isEditing ? (
                  <button
                    type="button"
                    className="source-delete"
                    title="Delete source"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('via-delete-source', {
                          detail: { sourceId: source.id },
                        }),
                      )
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {isEditing ? (
            <label className="upload-source" title="Upload a source document">
              <Plus size={14} />
              <span>Add source</span>
              <input
                type="file"
                accept=".pdf,.md,.markdown,.txt,application/pdf,text/plain,text/markdown"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) {
                    window.dispatchEvent(
                      new CustomEvent('via-upload-source', {
                        detail: { nodeId: id, file },
                      }),
                    );
                    event.currentTarget.value = '';
                  }
                }}
              />
            </label>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
