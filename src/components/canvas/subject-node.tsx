import {
  Handle,
  type NodeProps,
  NodeToolbar,
  Position,
  useUpdateNodeInternals,
} from '@xyflow/react';
import {
  ChevronUp,
  FileCode,
  FileText,
  Maximize2,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGraphStore } from '../../store/graph-store';
import type { SubjectNodeData } from '../../types/api';
import { CircularProgress } from '../ui/circular-progress';

export function SubjectNode({ id, data }: NodeProps) {
  const subject = data as SubjectNodeData;
  const { t } = useTranslation();
  const graph = useGraphStore((state) => state.graph);
  const identity = useGraphStore((state) => state.identity);
  const mode = useGraphStore((state) => state.mode);
  const queryType = useGraphStore((state) => state.queryType);
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);
  const previewNodeIds = useGraphStore((state) => state.previewNodeIds);
  const crawlStartingNodeIds = useGraphStore(
    (state) => state.crawlStartingNodeIds,
  );
  const results = useGraphStore((state) => state.results);
  const minRelevanceScore = useGraphStore((state) => state.minRelevanceScore);
  const expandedNodeIds = useGraphStore((state) => state.expandedNodeIds);
  const isEditing = useGraphStore((state) => state.isEditing);
  const isFocusMode = useGraphStore((state) => state.isFocusMode);
  const focusedNodeId = useGraphStore((state) => state.focusedNodeId);
  const toggleNodeSelection = useGraphStore(
    (state) => state.toggleNodeSelection,
  );
  const toggleCrawlStartingNode = useGraphStore(
    (state) => state.toggleCrawlStartingNode,
  );
  const toggleExpanded = useGraphStore((state) => state.toggleExpanded);
  const setActiveSourceId = useGraphStore((state) => state.setActiveSourceId);
  const setActiveMatch = useGraphStore((state) => state.setActiveMatch);
  const setEditingNodeId = useGraphStore((state) => state.setEditingNodeId);
  const setPendingDeleteNodeId = useGraphStore(
    (state) => state.setPendingDeleteNodeId,
  );
  const addChild = useGraphStore((state) => state.addChild);
  const updateNode = useGraphStore((state) => state.updateNode);
  const activeUploads = useGraphStore((state) => state.activeUploads);
  const updateNodeInternals = useUpdateNodeInternals();

  const [localTitle, setLocalTitle] = useState(subject.title ?? '');
  const [localCategory, setLocalCategory] = useState(
    subject.category ?? 'Topic',
  );
  const [localDescription, setLocalDescription] = useState(
    subject.description ?? '',
  );
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  useEffect(() => {
    setLocalTitle(subject.title ?? '');
  }, [subject.title]);

  useEffect(() => {
    setLocalCategory(subject.category ?? 'Topic');
  }, [subject.category]);

  useEffect(() => {
    setLocalDescription(subject.description ?? '');
  }, [subject.description]);

  const nodeUploads = useMemo(
    () => Object.values(activeUploads).filter((upload) => upload.nodeId === id),
    [activeUploads, id],
  );
  const sources = useMemo(
    () => graph?.sources.filter((source) => source.nodeId === id) ?? [],
    [graph?.sources, id],
  );
  const processingSource = useMemo(
    () =>
      sources.find(
        (source) =>
          source.status === 'PROCESSING' || source.status === 'PENDING',
      ),
    [sources],
  );
  const activeProgress = processingSource?.progress ?? 0;
  const hasPdf = useMemo(
    () =>
      sources.some(
        (source) =>
          source.fileType === 'application/pdf' ||
          source.name.toLowerCase().endsWith('.pdf'),
      ),
    [sources],
  );
  const match = useMemo(
    () => results?.results.find((result) => result.nodeId === id),
    [results?.results, id],
  );
  const topScore = useMemo(() => {
    if (!match?.chunks?.length) return 0;
    return Math.max(
      ...match.chunks.map((c) => c.rerankScore ?? c.score ?? 0),
      0,
    );
  }, [match]);
  const isMatched = Boolean(
    match && (minRelevanceScore <= 0 || topScore >= minRelevanceScore),
  );
  const isExpanded = expandedNodeIds.includes(id);
  const isSelected = selectedNodeIds.includes(id);
  const isPreviewed = previewNodeIds.includes(id);
  const isCrawlMode =
    queryType === 'crawl' &&
    (mode === 'CRAWL_SELECTION' || crawlStartingNodeIds.length > 0);
  const isCrawlStart =
    queryType === 'crawl' && crawlStartingNodeIds.includes(id);
  const isCrawlDimmed =
    isCrawlMode &&
    crawlStartingNodeIds.length > 0 &&
    !isCrawlStart &&
    !isExpanded;
  const isAnonymous = identity?.isGuest ?? identity?.tier === 'ANONYMOUS';
  const selectionLimit = isAnonymous ? 2 : Number.POSITIVE_INFINITY;
  const selectionLimitReached =
    selectedNodeIds.length >= selectionLimit && !isSelected;
  const crawlLimit = isAnonymous ? 1 : Number.POSITIVE_INFINITY;
  const crawlLimitReached =
    crawlStartingNodeIds.length >= crawlLimit && !isCrawlStart;
  const matchesBySource = useMemo(() => {
    const map = new Map<string, NonNullable<typeof match>['chunks']>();
    for (const chunk of match?.chunks ?? []) {
      const sourceMatches = map.get(chunk.sourceId) ?? [];
      sourceMatches.push(chunk);
      map.set(chunk.sourceId, sourceMatches);
    }
    return map;
  }, [match]);

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

  const hasContextSelector =
    mode === 'CONTEXT_SELECTION' ||
    (queryType === 'simple' && (isSelected || selectedNodeIds.length > 0));
  const hasCrawlSelector =
    mode === 'CRAWL_SELECTION' ||
    (queryType === 'crawl' &&
      (isCrawlStart || crawlStartingNodeIds.length > 0));
  const hasSelector = hasContextSelector || hasCrawlSelector;

  const isSoloFocusTarget = Boolean(focusedNodeId && id === focusedNodeId);
  const isDirectFocusNeighbor = useMemo(() => {
    if (!focusedNodeId || isSoloFocusTarget) return false;
    return Boolean(
      graph?.edges?.some(
        (edge) =>
          (edge.source === focusedNodeId && edge.target === id) ||
          (edge.target === focusedNodeId && edge.source === id),
      ),
    );
  }, [focusedNodeId, isSoloFocusTarget, graph?.edges, id]);

  const isSoloHighlighted =
    isSoloFocusTarget ||
    (isFocusMode &&
      (isMatched || isCrawlStart || (results ? isMatched : isSelected)));

  const isSoloDimmed = Boolean(
    (isFocusMode || focusedNodeId) &&
      !isSoloFocusTarget &&
      !isDirectFocusNeighbor &&
      !(isFocusMode && (isMatched || isCrawlStart)),
  );

  const soloClasses = `${isSoloHighlighted ? 'is-focus-highlight' : ''} ${isSoloDimmed ? 'is-solo-dimmed' : ''}`;

  return (
    <article
      className={`subject-node ${isMatched ? 'is-matched' : results ? 'is-muted' : ''} ${isPreviewed ? 'is-previewed' : ''} ${isExpanded ? 'is-expanded' : ''} ${isCrawlStart ? 'is-crawl-start' : ''} ${isCrawlDimmed ? 'is-crawl-dimmed' : ''} ${hasSelector ? 'has-selector' : ''} ${isSelected ? 'is-selected' : ''} ${soloClasses}`.trim()}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={`flow-handle ${isEditing ? '' : 'view-handle'}`}
        style={{ top: '68px' }}
        isConnectable
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`flow-handle ${isEditing ? '' : 'view-handle'}`}
        style={{ top: '68px' }}
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
            onClick={() => {
              setEditingNodeId(id);
              if (!isExpanded) toggleExpanded(id);
            }}
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
          {isEditing ? (
            <input
              type="text"
              className="inline-category-input nodrag nopan"
              value={localCategory}
              onChange={(e) => setLocalCategory(e.target.value)}
              onBlur={() => {
                if (localCategory !== subject.category) {
                  updateNode(id, {
                    ...subject,
                    category: localCategory.trim() || 'Topic',
                  });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Category"
              aria-label="Edit category"
            />
          ) : (
            <span className="node-category">{subject.category ?? 'Topic'}</span>
          )}
          {match && isMatched ? (
            <span
              className="match-badge"
              title={
                topScore > 0
                  ? `Relevance score: ${Math.round(topScore * 100)}%`
                  : undefined
              }
            >
              +{match.matchCount}
            </span>
          ) : null}
          {isPreviewed ? (
            <span
              className="node-preview-badge"
              title="Suggested Concept Match"
            >
              <Sparkles size={10} />
              <span>Suggested Concept</span>
            </span>
          ) : null}
        </span>
        {isEditing ? (
          <input
            type="text"
            className="inline-title-input nodrag nopan"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={() => {
              if (localTitle.trim() && localTitle !== subject.title) {
                updateNode(id, { ...subject, title: localTitle.trim() });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Topic title"
            aria-label="Edit topic title"
          />
        ) : (
          <strong>{subject.title}</strong>
        )}
        {sources.length > 0 ? (
          <span className="node-attachments">
            {processingSource ? (
              <span
                className="source-progress-badge"
                title={`Processing document: ${activeProgress}%`}
                role="progressbar"
                aria-valuenow={activeProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Processing document: ${activeProgress}%`}
              >
                <CircularProgress
                  size={10}
                  strokeWidth={2.2}
                  aria-label="Processing"
                />
                <span>{activeProgress}%</span>
              </span>
            ) : null}
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
      {hasContextSelector ? (
        <label
          className="node-selector nodrag nopan"
          title={
            selectionLimitReached
              ? `Selection limit reached (${selectionLimit} nodes for guests)`
              : undefined
          }
        >
          <input
            type="checkbox"
            checked={isSelected}
            disabled={selectionLimitReached}
            onChange={() => toggleNodeSelection(id)}
          />
          <span>Include</span>
        </label>
      ) : null}
      {hasCrawlSelector ? (
        <label
          className="node-selector nodrag nopan crawl-selector"
          title={
            crawlLimitReached
              ? `Starting node limit reached (${crawlLimit} node for guests)`
              : undefined
          }
        >
          <input
            type="checkbox"
            checked={isCrawlStart}
            disabled={crawlLimitReached}
            onChange={() => toggleCrawlStartingNode(id)}
          />
          <span>Start Node</span>
        </label>
      ) : null}
      {isExpanded ? (
        <section
          className="node-details nodrag nopan nowheel"
          onWheel={(e) => e.stopPropagation()}
        >
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
          {isEditing ? (
            <div className="detail-section">
              <h3>Description</h3>
              <textarea
                className="inline-description-input nodrag nopan nowheel"
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                onBlur={() => {
                  if (localDescription !== (subject.description ?? '')) {
                    updateNode(id, {
                      ...subject,
                      description: localDescription,
                    });
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="Click to add topic description..."
                rows={3}
                aria-label="Edit topic description"
              />
            </div>
          ) : subject.description ? (
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
            {sources.length === 0 && nodeUploads.length === 0 ? (
              <p>{t('noSources')}</p>
            ) : null}
            {nodeUploads.map((upload) => {
              const isPaused = upload.status === 'paused';
              const isCompleting =
                upload.status === 'completing' || upload.progress >= 100;
              return (
                <div key={upload.uploadKey} className="source-entry">
                  <div
                    className={`source-upload-track ${isPaused ? 'is-paused' : ''}`}
                  >
                    <CircularProgress
                      size={14}
                      strokeWidth={2.5}
                      value={upload.progress}
                      aria-label={`Uploading ${upload.fileName}`}
                    />
                    <span className="upload-filename" title={upload.fileName}>
                      {upload.fileName}
                    </span>
                    {upload.concurrency && upload.concurrency > 1 ? (
                      <span
                        className="upload-stream-pill"
                        title={`${upload.concurrency} concurrent streams`}
                      >
                        {upload.concurrency}x
                      </span>
                    ) : null}
                    {isPaused ? (
                      <span className="upload-status-badge paused">Paused</span>
                    ) : isCompleting ? (
                      <span className="upload-status-badge completing">
                        Finalizing...
                      </span>
                    ) : (
                      <span className="upload-percent">{upload.progress}%</span>
                    )}
                    <div className="upload-actions">
                      {isPaused ? (
                        <button
                          type="button"
                          className="upload-control-btn resume"
                          title="Resume upload"
                          aria-label={`Resume uploading ${upload.fileName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.dispatchEvent(
                              new CustomEvent('via-resume-upload', {
                                detail: { uploadKey: upload.uploadKey },
                              }),
                            );
                          }}
                        >
                          <Play size={11} />
                        </button>
                      ) : !isCompleting ? (
                        <button
                          type="button"
                          className="upload-control-btn pause"
                          title="Pause upload"
                          aria-label={`Pause uploading ${upload.fileName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.dispatchEvent(
                              new CustomEvent('via-pause-upload', {
                                detail: { uploadKey: upload.uploadKey },
                              }),
                            );
                          }}
                        >
                          <Pause size={11} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="upload-control-btn cancel"
                        title="Cancel upload"
                        aria-label={`Cancel uploading ${upload.fileName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(
                            new CustomEvent('via-cancel-upload', {
                              detail: { uploadKey: upload.uploadKey },
                            }),
                          );
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {sources.map((source) => {
              const isPdf =
                source.fileType === 'application/pdf' ||
                source.name.toLowerCase().endsWith('.pdf');
              const isMarkdown =
                source.fileType === 'text/markdown' ||
                source.fileType?.includes('markdown') ||
                source.name.toLowerCase().endsWith('.md') ||
                source.name.toLowerCase().endsWith('.markdown');

              return (
                <div key={source.id} className="source-entry">
                  <button
                    type="button"
                    className="source-row"
                    onClick={() => {
                      setActiveSourceId(source.id);
                      setActiveMatch(undefined);
                    }}
                  >
                    <FileText size={14} className="source-row-icon" />
                    <span className="source-title">{source.name}</span>
                    {isPdf ? (
                      <span
                        className="source-format-badge format-pdf"
                        title="PDF Document"
                      >
                        <FileText size={10} aria-hidden="true" />
                        <span>PDF</span>
                      </span>
                    ) : isMarkdown ? (
                      <span
                        className="source-format-badge format-md"
                        title="Markdown Document"
                      >
                        <FileCode size={10} aria-hidden="true" />
                        <span>Markdown</span>
                      </span>
                    ) : null}
                    <small
                      className={`source-status ${source.status.toLowerCase()}`}
                    >
                      {source.status === 'PROCESSING' &&
                      source.progress !== undefined
                        ? `${source.progress}%`
                        : source.status}
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
              );
            })}
          </div>
          {isEditing ? (
            <div className="sources-actions">
              {isCreatingNote ? (
                <div
                  className="inline-note-creator nodrag nopan"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    className="inline-note-title nodrag nopan"
                    placeholder="Note title (e.g. Overview.md)"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsCreatingNote(false);
                    }}
                  />
                  <textarea
                    className="inline-note-content nodrag nopan nowheel"
                    placeholder="Write markdown note..."
                    rows={3}
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsCreatingNote(false);
                    }}
                  />
                  <div className="inline-note-actions">
                    <button
                      type="button"
                      className="inline-note-btn save"
                      onClick={() => {
                        const title = newNoteTitle.trim() || 'Untitled Note';
                        window.dispatchEvent(
                          new CustomEvent('via-create-note', {
                            detail: {
                              nodeId: id,
                              title,
                              content: newNoteContent,
                            },
                          }),
                        );
                        setNewNoteTitle('');
                        setNewNoteContent('');
                        setIsCreatingNote(false);
                      }}
                    >
                      Save note
                    </button>
                    <button
                      type="button"
                      className="inline-note-btn cancel"
                      onClick={() => {
                        setNewNoteTitle('');
                        setNewNoteContent('');
                        setIsCreatingNote(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="source-add-row">
                  <button
                    type="button"
                    className="add-note-btn"
                    title="Write a new markdown note"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreatingNote(true);
                    }}
                  >
                    <Plus size={13} />
                    <span>New note</span>
                  </button>
                  <label
                    className="upload-source"
                    title="Upload a source document (PDF, Markdown, Office, or Text)"
                  >
                    <Plus size={13} />
                    <span>Add source</span>
                    <input
                      type="file"
                      accept=".pdf,.md,.markdown,.txt,.docx,.pptx,.xlsx,.html,application/pdf,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
