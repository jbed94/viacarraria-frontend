import DOMPurify from 'dompurify';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Code,
  Columns2,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  Link2,
  LoaderCircle,
  Save,
  Sparkles,
  Unlink,
} from 'lucide-react';
import { marked } from 'marked';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../../lib/api';
import { katexExtension } from '../../lib/katex-markdown';
import { useGraphStore } from '../../store/graph-store';
import type { SearchChunk, Source } from '../../types/api';
import { DialogFrame } from './dialog-frame';

// Configure KaTeX extension with marked
marked.use(katexExtension());

type SourceViewerDialogProps = {
  sourceId?: string;
  matches: SearchChunk[];
  focusedMatch?: SearchChunk;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
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

export const MIN_SOURCE_PANEL_WIDTH = 480;
export const MIN_SOURCE_PANEL_HEIGHT = 380;

export type ViewMode = 'preview' | 'split' | 'edit' | 'raw';
export type AutosaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export function SourceViewerDialog({
  sourceId,
  onOpenChange,
  matches,
  focusedMatch,
  canEdit,
}: SourceViewerDialogProps) {
  const storeGraph = useGraphStore((state) => state.graph);
  const hasWriteAccess =
    canEdit !== undefined
      ? canEdit
      : storeGraph !== undefined
        ? Boolean(storeGraph.canEdit ?? storeGraph.isOwned)
        : true;
  const [source, setSource] = useState<Source>();
  const [isLoading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [panelSize, setPanelSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isSyncScrollEnabled, setIsSyncScrollEnabled] = useState(true);
  const hitRef = useRef<HTMLElement>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef<boolean>(false);

  const handleEditorScroll = () => {
    if (!isSyncScrollEnabled || isScrollingSyncRef.current) return;
    const editor = editorTextareaRef.current;
    const preview = previewScrollRef.current;
    if (!editor || !preview) return;

    const editorScrollable = editor.scrollHeight - editor.clientHeight;
    const previewScrollable = preview.scrollHeight - preview.clientHeight;
    if (editorScrollable <= 0 || previewScrollable <= 0) return;

    const ratio = editor.scrollTop / editorScrollable;
    isScrollingSyncRef.current = true;
    preview.scrollTop = ratio * previewScrollable;
    requestAnimationFrame(() => {
      isScrollingSyncRef.current = false;
    });
  };

  const handlePreviewScroll = () => {
    if (!isSyncScrollEnabled || isScrollingSyncRef.current) return;
    const editor = editorTextareaRef.current;
    const preview = previewScrollRef.current;
    if (!editor || !preview) return;

    const editorScrollable = editor.scrollHeight - editor.clientHeight;
    const previewScrollable = preview.scrollHeight - preview.clientHeight;
    if (editorScrollable <= 0 || previewScrollable <= 0) return;

    const ratio = preview.scrollTop / previewScrollable;
    isScrollingSyncRef.current = true;
    editor.scrollTop = ratio * editorScrollable;
    requestAnimationFrame(() => {
      isScrollingSyncRef.current = false;
    });
  };

  const editNameRef = useRef(editName);
  const editContentRef = useRef(editContent);
  const sourceRef = useRef(source);
  const isSavingRef = useRef(isSaving);

  useEffect(() => {
    editNameRef.current = editName;
  }, [editName]);
  useEffect(() => {
    editContentRef.current = editContent;
  }, [editContent]);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  const isDirty = useMemo(() => {
    if (!source) return false;
    return editName !== source.name || editContent !== (source.content ?? '');
  }, [source, editName, editContent]);

  const effectiveMatches = useMemo(() => {
    if (!focusedMatch) return matches;
    if (
      matches.some(
        (m) =>
          (m.chunkId && m.chunkId === focusedMatch.chunkId) ||
          (m.startChar === focusedMatch.startChar &&
            m.endChar === focusedMatch.endChar),
      )
    ) {
      return matches;
    }
    return [focusedMatch, ...matches];
  }, [matches, focusedMatch]);

  const currentMatch = effectiveMatches[activeMatchIndex] ?? focusedMatch;
  const content =
    source?.content ?? currentMatch?.context ?? focusedMatch?.context ?? '';
  const highlightRanges = getHighlightRanges(
    content,
    effectiveMatches,
    currentMatch,
  );
  const focusKey = `${content.length}:${currentMatch?.sourceId ?? ''}:${currentMatch?.startChar ?? ''}:${currentMatch?.endChar ?? ''}:${activeMatchIndex}:${viewMode}`;

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    const dialogEl = (e.currentTarget.closest('.source-dialog') ||
      e.currentTarget.parentElement) as HTMLElement | null;
    const initialWidth =
      panelSize?.width ?? (dialogEl ? dialogEl.offsetWidth : 1180);
    const initialHeight =
      panelSize?.height ?? (dialogEl ? dialogEl.offsetHeight : 820);

    let hasMoved = false;
    setIsResizing(true);
    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        hasMoved = true;
      }
      const minW = MIN_SOURCE_PANEL_WIDTH;
      const minH = MIN_SOURCE_PANEL_HEIGHT;
      const maxW = Math.max(minW, window.innerWidth - 32);
      const maxH = Math.max(minH, window.innerHeight - 32);

      const nextWidth = Math.min(maxW, Math.max(minW, initialWidth + dx * 2));
      const nextHeight = Math.min(maxH, Math.max(minH, initialHeight + dy * 2));

      setPanelSize({
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
      setIsResizing(false);

      if (!hasMoved) {
        const minW = MIN_SOURCE_PANEL_WIDTH;
        const minH = MIN_SOURCE_PANEL_HEIGHT;
        const maxW = Math.max(minW, window.innerWidth - 48);
        const maxH = Math.max(minH, window.innerHeight - 48);
        const isCurrentlyLarge =
          initialWidth >= maxW - 60 && initialHeight >= maxH - 60;

        if (isCurrentlyLarge) {
          setPanelSize({
            width: Math.min(1180, maxW),
            height: Math.min(820, maxH),
          });
        } else {
          setPanelSize({
            width: Math.min(1440, maxW),
            height: Math.min(920, maxH),
          });
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    if (!focusedMatch || effectiveMatches.length === 0) {
      setActiveMatchIndex(0);
      return;
    }
    const idx = effectiveMatches.findIndex(
      (m) =>
        (m.chunkId && m.chunkId === focusedMatch.chunkId) ||
        (m.startChar === focusedMatch.startChar &&
          m.endChar === focusedMatch.endChar &&
          m.pageNum === focusedMatch.pageNum) ||
        (m.content && m.content === focusedMatch.content),
    );
    if (idx !== -1) {
      setActiveMatchIndex(idx);
    } else {
      setActiveMatchIndex(0);
    }
  }, [focusedMatch, effectiveMatches]);

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

  const handleSelectViewMode = (mode: ViewMode) => {
    if (!hasWriteAccess && mode !== 'preview' && mode !== 'split') {
      return;
    }
    setViewMode(mode);
    if (mode === 'split' && (!panelSize || panelSize.width < 1180)) {
      const targetWidth = Math.min(
        1280,
        Math.max(1080, window.innerWidth - 32),
      );
      const targetHeight = Math.min(
        840,
        Math.max(680, window.innerHeight - 32),
      );
      setPanelSize({
        width: targetWidth,
        height: targetHeight,
      });
    }
  };

  useEffect(() => {
    if (!hasWriteAccess && (viewMode === 'edit' || viewMode === 'raw')) {
      setViewMode('preview');
    }
  }, [hasWriteAccess, viewMode]);

  useEffect(() => {
    if (!sourceId) return;
    setLoading(true);
    void api
      .source(sourceId)
      .then((data) => {
        setSource(data);
        setEditName(data.name);
        setEditContent(data.content ?? '');
        setAutosaveStatus('idle');
      })
      .finally(() => setLoading(false));
  }, [sourceId]);

  useEffect(() => {
    if (!content || !currentMatch || viewMode === 'edit') return;
    const timer = setTimeout(() => {
      hitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return () => clearTimeout(timer);
  }, [content, focusKey, currentMatch, activeMatchIndex, viewMode]);

  useEffect(() => {
    if (!sourceId || effectiveMatches.length <= 1 || viewMode === 'edit')
      return;

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
        setActiveMatchIndex((prev) =>
          Math.min(effectiveMatches.length - 1, prev + 1),
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sourceId, viewMode, effectiveMatches.length]);

  const handleSaveNote = async () => {
    if (!hasWriteAccess || !sourceId || isSavingRef.current) return;
    setIsSaving(true);
    isSavingRef.current = true;
    setAutosaveStatus('saving');
    try {
      const updated = await api.updateSource(sourceId, {
        name:
          editNameRef.current.trim() ||
          sourceRef.current?.name ||
          'Untitled Note',
        content: editContentRef.current,
      });
      setSource(updated);
      setEditName(updated.name);
      setEditContent(updated.content ?? '');

      const currentGraph = useGraphStore.getState().graph;
      if (currentGraph) {
        useGraphStore
          .getState()
          .setSources(
            currentGraph.sources.map((item) =>
              item.id === updated.id ? updated : item,
            ),
          );
      }
      setSaveSuccess(true);
      setAutosaveStatus('saved');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update source:', err);
      setAutosaveStatus('error');
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  useEffect(() => {
    if (!hasWriteAccess || !sourceId || !source || !isDirty || isSaving) {
      return;
    }

    setAutosaveStatus('unsaved');
    const timer = setTimeout(() => {
      void handleSaveNote();
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    editName,
    editContent,
    isDirty,
    sourceId,
    source,
    isSaving,
    hasWriteAccess,
  ]);

  const renderAutosaveIndicator = () => {
    if (!hasWriteAccess) return null;
    if (isSaving || autosaveStatus === 'saving') {
      return (
        <span className="autosave-status saving" data-testid="autosave-saving">
          <LoaderCircle className="spinner" size={12} />
          <span>Saving...</span>
        </span>
      );
    }
    if (saveSuccess || autosaveStatus === 'saved') {
      return (
        <span className="autosave-status saved" data-testid="autosave-saved">
          <Check size={12} />
          <span>All changes saved</span>
        </span>
      );
    }
    if (isDirty || autosaveStatus === 'unsaved') {
      return (
        <span
          className="autosave-status unsaved"
          data-testid="autosave-unsaved"
        >
          <span className="unsaved-dot" />
          <span>Unsaved changes</span>
        </span>
      );
    }
    return null;
  };

  return (
    <DialogFrame
      open={Boolean(sourceId)}
      onOpenChange={onOpenChange}
      title={
        source?.name ??
        focusedMatch?.sourceName ??
        effectiveMatches[0]?.sourceName ??
        'Source viewer'
      }
      className={`source-dialog ${viewMode === 'split' ? 'is-split-mode' : ''}`}
      style={
        panelSize
          ? {
              width: `${panelSize.width}px`,
              height: `${panelSize.height}px`,
            }
          : undefined
      }
    >
      <div className="source-viewer-meta">
        <div className="source-meta-info">
          <FileText size={16} />
          <span>{source?.status ?? 'Loading'}</span>
          {focusedMatch ? <span>Page {focusedMatch.pageNum}</span> : null}
          {effectiveMatches.length > 0 ? (
            <span>{effectiveMatches.length} matches</span>
          ) : null}
          {effectiveMatches.length > 1 ? (
            <div
              className="match-stepper-group"
              role="group"
              aria-label="Match navigation stepper"
            >
              <button
                type="button"
                className="match-stepper-btn"
                disabled={activeMatchIndex <= 0}
                onClick={() => setActiveMatchIndex(activeMatchIndex - 1)}
                title="Previous search hit (Press [ or Alt+Left)"
                aria-label="Previous match"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="match-stepper-counter">
                {activeMatchIndex + 1} / {effectiveMatches.length}
              </span>
              <button
                type="button"
                className="match-stepper-btn"
                disabled={activeMatchIndex >= effectiveMatches.length - 1}
                onClick={() => setActiveMatchIndex(activeMatchIndex + 1)}
                title="Next search hit (Press ] or Alt+Right)"
                aria-label="Next match"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          ) : null}
          {currentMatch ? (
            <button
              type="button"
              className={`copy-citation-btn ${copied ? 'copied' : ''}`}
              onClick={() => copyCitation(currentMatch)}
              title="Copy excerpt citation as Markdown"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              <span>{copied ? 'Copied!' : 'Copy Citation'}</span>
            </button>
          ) : null}
        </div>
        <div className="source-viewer-actions">
          <div className="source-view-mode-toggle" role="tablist">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => handleSelectViewMode('preview')}
              role="tab"
              aria-selected={viewMode === 'preview'}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => handleSelectViewMode('split')}
              role="tab"
              aria-selected={viewMode === 'split'}
            >
              <Columns2 size={13} />
              <span>Split</span>
            </button>
            {hasWriteAccess ? (
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'edit' ? 'active' : ''}`}
                onClick={() => handleSelectViewMode('edit')}
                role="tab"
                aria-selected={viewMode === 'edit'}
              >
                <Edit3 size={13} />
                <span>Edit Note</span>
              </button>
            ) : null}
            {hasWriteAccess ? (
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'raw' ? 'active' : ''}`}
                onClick={() => handleSelectViewMode('raw')}
                role="tab"
                aria-selected={viewMode === 'raw'}
              >
                <Code size={13} />
                <span>Raw</span>
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
      {!isLoading &&
      (content ||
        editContent ||
        (hasWriteAccess && viewMode === 'edit') ||
        viewMode === 'split') ? (
        <article className="source-document-container">
          {viewMode === 'preview' ? (
            <div className="source-document markdown-preview">
              {renderMarkdownPreview(content, highlightRanges, hitRef)}
            </div>
          ) : viewMode === 'split' ? (
            <div className="source-document split-editor-container">
              <div className="split-pane split-editor-pane">
                <div className="note-editor-toolbar">
                  <div className="note-editor-title-row">
                    <input
                      type="text"
                      className={`note-editor-title-input ${!hasWriteAccess ? 'read-only' : ''}`}
                      placeholder={
                        hasWriteAccess ? 'Note title (e.g. Notes.md)' : ''
                      }
                      value={editName}
                      readOnly={!hasWriteAccess}
                      onChange={
                        hasWriteAccess
                          ? (e) => setEditName(e.target.value)
                          : undefined
                      }
                      aria-label="Note title"
                    />
                    <div className="note-editor-stats">
                      <span>{editContent.length} chars</span>
                      <span>
                        {editContent.trim().split(/\s+/).filter(Boolean).length}{' '}
                        words
                      </span>
                    </div>
                  </div>
                  {hasWriteAccess ? (
                    <div className="note-editor-actions">
                      {renderAutosaveIndicator()}
                      <button
                        type="button"
                        className={`note-save-btn ${saveSuccess ? 'is-saved' : ''}`}
                        disabled={isSaving}
                        onClick={handleSaveNote}
                      >
                        {isSaving ? (
                          <>
                            <LoaderCircle className="spinner" size={13} />
                            <span>Saving...</span>
                          </>
                        ) : saveSuccess ? (
                          <>
                            <Check size={13} />
                            <span>Saved!</span>
                          </>
                        ) : (
                          <>
                            <Save size={13} />
                            <span>Save Note</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
                <textarea
                  ref={editorTextareaRef}
                  onScroll={handleEditorScroll}
                  className={`note-editor-textarea ${!hasWriteAccess ? 'read-only' : ''}`}
                  placeholder={
                    hasWriteAccess
                      ? 'Write your markdown note here...'
                      : 'Markdown source content...'
                  }
                  value={editContent}
                  readOnly={!hasWriteAccess}
                  onChange={
                    hasWriteAccess
                      ? (e) => setEditContent(e.target.value)
                      : undefined
                  }
                  spellCheck={false}
                />
              </div>
              <div className="split-pane split-preview-pane">
                <div className="split-preview-header">
                  <div className="split-preview-title">
                    <Eye size={13} />
                    <span>Live Preview</span>
                  </div>
                  <button
                    type="button"
                    className={`sync-scroll-btn ${isSyncScrollEnabled ? 'active' : ''}`}
                    onClick={() => setIsSyncScrollEnabled((prev) => !prev)}
                    title={
                      isSyncScrollEnabled
                        ? 'Disable synchronized scroll'
                        : 'Enable synchronized scroll'
                    }
                    aria-label="Toggle synchronized scroll"
                    data-testid="toggle-sync-scroll-btn"
                  >
                    {isSyncScrollEnabled ? (
                      <Link2 size={12} />
                    ) : (
                      <Unlink size={12} />
                    )}
                    <span>{isSyncScrollEnabled ? 'Sync on' : 'Sync off'}</span>
                  </button>
                </div>
                <div
                  ref={previewScrollRef}
                  onScroll={handlePreviewScroll}
                  className="source-document split-preview-scroll markdown-preview"
                >
                  {editContent.trim() ? (
                    renderMarkdownPreview(editContent, highlightRanges, hitRef)
                  ) : (
                    <div className="split-preview-empty">
                      Markdown preview will appear here in real time...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : viewMode === 'edit' ? (
            <div className="source-document note-editor-container">
              <div className="note-editor-toolbar">
                <div className="note-editor-title-row">
                  <input
                    type="text"
                    className="note-editor-title-input"
                    placeholder="Note title (e.g. Notes.md)"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <div className="note-editor-stats">
                    <span>{editContent.length} characters</span>
                    <span>
                      {editContent.trim().split(/\s+/).filter(Boolean).length}{' '}
                      words
                    </span>
                  </div>
                </div>
                <div className="note-editor-actions">
                  {renderAutosaveIndicator()}
                  <button
                    type="button"
                    className={`note-save-btn ${saveSuccess ? 'is-saved' : ''}`}
                    disabled={isSaving}
                    onClick={handleSaveNote}
                  >
                    {isSaving ? (
                      <>
                        <LoaderCircle className="spinner" size={13} />
                        <span>Saving...</span>
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check size={13} />
                        <span>Saved!</span>
                      </>
                    ) : (
                      <>
                        <Save size={13} />
                        <span>Save Note</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <textarea
                className="note-editor-textarea"
                placeholder="Write your markdown note here..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                spellCheck={false}
              />
            </div>
          ) : (
            <pre className="source-document source-raw">
              {renderHighlightedContent(content, highlightRanges, hitRef)}
            </pre>
          )}
        </article>
      ) : null}
      <div
        className={`dialog-resize-handle ${isResizing ? 'is-resizing' : ''}`}
        onMouseDown={handleResizeStart}
        role="separator"
        aria-label="Resize source dialog"
        data-testid="dialog-resize-handle"
        title="Drag to resize panel (or click to toggle size)"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M10 3L3 10M10 6.5L6.5 10M10 9.5L9.5 10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
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
  const allMatches = [...matches];
  if (
    focusedMatch &&
    !allMatches.some(
      (m) =>
        m.sourceId === focusedMatch.sourceId &&
        ((m.chunkId && m.chunkId === focusedMatch.chunkId) ||
          (m.startChar === focusedMatch.startChar &&
            m.endChar === focusedMatch.endChar)),
    )
  ) {
    allMatches.push(focusedMatch);
  }

  const ranges = allMatches
    .map((match) => {
      let start = Math.max(0, match.startChar ?? 0);
      let end = Math.min(content.length, match.endChar ?? 0);

      // Fallback: If chunk character offsets are not provided or invalid, search snippet in content
      if (
        (end <= start ||
          match.startChar === undefined ||
          match.endChar === undefined) &&
        match.content &&
        content
      ) {
        const needle = match.content.trim().slice(0, 40);
        const found = content.indexOf(needle);
        if (found !== -1) {
          start = found;
          end = Math.min(content.length, found + match.content.trim().length);
        }
      }

      const isFocused =
        Boolean(focusedMatch) &&
        match.sourceId === focusedMatch?.sourceId &&
        ((match.chunkId && match.chunkId === focusedMatch?.chunkId) ||
          (match.startChar === focusedMatch?.startChar &&
            match.endChar === focusedMatch?.endChar) ||
          (start >= 0 && start === focusedMatch?.startChar));

      return {
        start,
        end,
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
      ADD_DATA_URI_TAGS: ['img'],
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
