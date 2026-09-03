import { Bookmark, History, Pencil } from 'lucide-react';

import type { QueryHistory, SearchResponse } from '../../types/api';

type HistoryDrawerProps = {
  entries: QueryHistory[];
  onRestore: (entry: QueryHistory) => void;
  onEdit: (entry: QueryHistory) => void;
  onTogglePin: (entry: QueryHistory) => void;
};

export function HistoryDrawer({
  entries,
  onRestore,
  onEdit,
  onTogglePin,
}: HistoryDrawerProps) {
  return (
    <aside className="history-drawer overlay-interactive">
      <div className="drawer-heading">
        <History size={17} />
        <span>Recent queries</span>
      </div>
      <div className="history-list">
        {entries.length === 0 ? (
          <p className="empty-state">Your searches will collect here.</p>
        ) : null}
        {entries.map((entry) => (
          <article key={entry.id} className="history-entry">
            <button
              type="button"
              className="history-query"
              onClick={() => onRestore(entry)}
            >
              <strong>{entry.title ?? entry.queryText}</strong>
              <small>{new Date(entry.createdAt).toLocaleString()}</small>
            </button>
            <div className="history-actions">
              <button
                type="button"
                title={entry.isPinned ? 'Unpin query' : 'Pin query'}
                onClick={() => onTogglePin(entry)}
              >
                <Bookmark
                  size={14}
                  fill={entry.isPinned ? 'currentColor' : 'none'}
                />
              </button>
              <button
                type="button"
                title="Edit query"
                onClick={() => onEdit(entry)}
              >
                <Pencil size={14} />
              </button>
            </div>
          </article>
        ))}
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
