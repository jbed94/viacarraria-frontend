import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Bookmark, Check, History, Pencil, Search, X } from 'lucide-react';

import type { QueryHistory, SearchResponse } from '../../types/api';

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 215;
const EXPANDED_WIDTH = 440;
const EXPANDED_HEIGHT = 360;

const MIN_WIDTH = 240;
const MIN_HEIGHT = 140;

const STORAGE_WIDTH_KEY = 'vc_history_drawer_width';
const STORAGE_HEIGHT_KEY = 'vc_history_drawer_height';

type ResizeDirection = 'top' | 'right' | 'corner' | null;

type HistoryDrawerProps = {
  entries: QueryHistory[];
  onRestore: (entry: QueryHistory) => void;
  onEdit: (entry: QueryHistory) => void;
  onTogglePin: (entry: QueryHistory) => void;
  onRename?: (entry: QueryHistory, title: string) => void | Promise<void>;
};

export function HistoryDrawer({
  entries,
  onRestore,
  onEdit,
  onTogglePin,
  onRename,
}: HistoryDrawerProps) {
  // Dimensions state with localStorage persistence
  const [width, setWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_WIDTH_KEY);
      if (stored) {
        const parsed = Number.parseInt(stored, 10);
        if (!Number.isNaN(parsed) && parsed >= MIN_WIDTH) {
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage access issues
    }
    return DEFAULT_WIDTH;
  });

  const [height, setHeight] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_HEIGHT_KEY);
      if (stored) {
        const parsed = Number.parseInt(stored, 10);
        if (!Number.isNaN(parsed) && parsed >= MIN_HEIGHT) {
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage access issues
    }
    return DEFAULT_HEIGHT;
  });

  // Resizing drag tracking
  const [activeResize, setActiveResize] = useState<ResizeDirection>(null);
  const dragRef = useRef<{
    direction: ResizeDirection;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  }>({
    direction: null,
    startX: 0,
    startY: 0,
    startWidth: DEFAULT_WIDTH,
    startHeight: DEFAULT_HEIGHT,
  });

  // Custom name inline editing state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Persist dimensions
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_WIDTH_KEY, String(width));
      localStorage.setItem(STORAGE_HEIGHT_KEY, String(height));
    } catch {
      // Ignore storage errors
    }
  }, [width, height]);

  // Adjust bounds on window resize
  useEffect(() => {
    function handleWindowResize() {
      const maxW = Math.min(window.innerWidth - 48, 620);
      const maxH = Math.min(window.innerHeight - 100, 560);
      setWidth((prev) => Math.max(MIN_WIDTH, Math.min(prev, maxW)));
      setHeight((prev) => Math.max(MIN_HEIGHT, Math.min(prev, maxH)));
    }
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  function handleStartResize(
    direction: 'top' | 'right' | 'corner',
    e: ReactPointerEvent<HTMLDivElement>,
  ) {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture fallback
    }
    dragRef.current = {
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: width,
      startHeight: height,
    };
    setActiveResize(direction);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const direction = dragRef.current.direction;
    if (!direction) return;
    e.preventDefault();

    const maxW = Math.min(window.innerWidth - 48, 620);
    const maxH = Math.min(window.innerHeight - 100, 560);

    if (direction === 'right' || direction === 'corner') {
      const deltaX = e.clientX - dragRef.current.startX;
      const nextWidth = Math.max(
        MIN_WIDTH,
        Math.min(dragRef.current.startWidth + deltaX, maxW),
      );
      setWidth(nextWidth);
    }

    if (direction === 'top' || direction === 'corner') {
      // Dragging up decreases clientY, which increases height
      const deltaY = dragRef.current.startY - e.clientY;
      const nextHeight = Math.max(
        MIN_HEIGHT,
        Math.min(dragRef.current.startHeight + deltaY, maxH),
      );
      setHeight(nextHeight);
    }
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.direction) return;
    dragRef.current.direction = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    setActiveResize(null);
  }

  function handleToggleSize() {
    if (width > DEFAULT_WIDTH + 40 || height > DEFAULT_HEIGHT + 40) {
      setWidth(DEFAULT_WIDTH);
      setHeight(DEFAULT_HEIGHT);
    } else {
      const maxW = Math.min(window.innerWidth - 48, 620);
      const maxH = Math.min(window.innerHeight - 100, 560);
      setWidth(Math.min(EXPANDED_WIDTH, maxW));
      setHeight(Math.min(EXPANDED_HEIGHT, maxH));
    }
  }

  function startEditing(entry: QueryHistory) {
    setEditingEntryId(entry.id);
    setEditingTitle(entry.title ?? entry.queryText);
  }

  function cancelEditing() {
    setEditingEntryId(null);
    setEditingTitle('');
  }

  function saveEditing(entry: QueryHistory) {
    const trimmed = editingTitle.trim();
    if (onRename) {
      void onRename(entry, trimmed);
    }
    setEditingEntryId(null);
    setEditingTitle('');
  }

  const pinnedEntries = entries.filter((e) => e.isPinned);
  const unpinnedEntries = entries.filter((e) => !e.isPinned);

  function renderEntry(entry: QueryHistory) {
    const isEditing = editingEntryId === entry.id;
    const hasCustomTitle = Boolean(entry.title) && entry.title?.trim() !== '';

    if (isEditing) {
      return (
        <div
          key={entry.id}
          className={`history-entry is-editing ${entry.isPinned ? 'is-pinned' : ''}`}
        >
          <form
            className="history-rename-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveEditing(entry);
            }}
          >
            <input
              type="text"
              className="history-rename-input"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder="Custom search name..."
              autoFocus
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEditing();
                }
              }}
            />
            <div className="history-rename-actions">
              <button
                type="submit"
                className="history-save-btn"
                title="Save custom name (Enter)"
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                className="history-cancel-btn"
                title="Cancel (Esc)"
                onClick={cancelEditing}
              >
                <X size={13} />
              </button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <article
        key={entry.id}
        className={`history-entry ${entry.isPinned ? 'is-pinned' : ''}`}
      >
        <button
          type="button"
          className="history-query"
          onClick={() => onRestore(entry)}
          title={
            hasCustomTitle
              ? `Restore "${entry.title}" (${entry.queryText})`
              : `Restore "${entry.queryText}"`
          }
        >
          {hasCustomTitle ? (
            <>
              <strong className="history-custom-title">{entry.title}</strong>
              <span className="history-original-query">{entry.queryText}</span>
            </>
          ) : (
            <strong>{entry.queryText}</strong>
          )}
          <small>{new Date(entry.createdAt).toLocaleString()}</small>
        </button>

        <div className="history-actions">
          <button
            type="button"
            title="Rename search"
            aria-label="Rename search"
            onClick={() => startEditing(entry)}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            title="Load into search bar"
            aria-label="Load into search bar"
            onClick={() => onEdit(entry)}
          >
            <Search size={13} />
          </button>
          <button
            type="button"
            title={entry.isPinned ? 'Unpin query' : 'Pin query'}
            aria-label={entry.isPinned ? 'Unpin query' : 'Pin query'}
            onClick={() => onTogglePin(entry)}
          >
            <Bookmark
              size={13}
              fill={entry.isPinned ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </article>
    );
  }

  return (
    <aside
      className={`history-drawer overlay-interactive ${activeResize ? 'is-resizing' : ''}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
      aria-label="Recent queries panel"
    >
      {/* Top resize handle (resizes height upwards) */}
      <div
        className="history-resize-handle history-resize-handle-top"
        title="Drag up/down to resize height (double click to toggle)"
        onPointerDown={(e) => handleStartResize('top', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleToggleSize}
      >
        <span className="history-resize-top-pill">
          <span className="history-resize-h-line" />
        </span>
      </div>

      {/* Right resize handle (resizes width rightwards) */}
      <div
        className="history-resize-handle history-resize-handle-right"
        title="Drag left/right to resize width (double click to toggle)"
        onPointerDown={(e) => handleStartResize('right', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleToggleSize}
      >
        <span className="history-resize-right-pill">
          <span className="history-resize-v-line" />
        </span>
      </div>

      {/* Top-Right corner resize handle (resizes both) */}
      <div
        className="history-resize-handle history-resize-handle-corner"
        title="Drag corner to resize width and height (double click to toggle)"
        onPointerDown={(e) => handleStartResize('corner', e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleToggleSize}
      >
        <span className="history-resize-corner-mark" />
      </div>

      <div className="drawer-heading">
        <History size={15} />
        <span>Recent queries</span>
        <span className="history-count-badge">{entries.length}</span>
      </div>

      <div className="history-list">
        {entries.length === 0 ? (
          <p className="empty-state">Your searches will collect here.</p>
        ) : (
          <>
            {pinnedEntries.map(renderEntry)}
            {pinnedEntries.length > 0 && unpinnedEntries.length > 0 ? (
              <div
                className="history-pinned-separator"
                role="separator"
                aria-label="Pinned queries separator"
              />
            ) : null}
            {unpinnedEntries.map(renderEntry)}
          </>
        )}
      </div>
    </aside>
  );
}

export function historyToResults(
  entry: QueryHistory,
): SearchResponse | undefined {
  if (!entry.results) return undefined;
  return {
    queryId: entry.id,
    results: entry.results,
    matchedNodeIds: entry.results.map((result) => result.nodeId),
    remaining: 0,
    extendedSearch: false,
    extendedContextCount: 0,
  };
}
