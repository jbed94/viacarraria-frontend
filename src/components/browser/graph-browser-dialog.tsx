import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type { Identity, PublicGraphItem } from '../../types/api';

type GraphBrowserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity?: Identity;
  onSelectGraph: (graphId: string) => void;
  onCopyGraph: (graph: PublicGraphItem) => void;
  onAttachChange?: () => void;
};

type SortField =
  | 'title'
  | 'viewerCount'
  | 'nodeCount'
  | 'sourceCount'
  | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export function GraphBrowserDialog({
  open,
  onOpenChange,
  identity,
  onSelectGraph,
  onCopyGraph,
  onAttachChange,
}: GraphBrowserDialogProps) {
  const [graphs, setGraphs] = useState<PublicGraphItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('viewerCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchGraphs = useCallback(async (queryText?: string) => {
    setLoading(true);
    try {
      const results = await api.publicGraphs(queryText);
      setGraphs(results);
    } catch {
      setGraphs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchGraphs(search);
    }
  }, [open, fetchGraphs, search]);

  async function handleToggleAttach(graph: PublicGraphItem) {
    if (identity?.isGuest) return;
    setAttachingId(graph.id);
    try {
      if (graph.isAttached) {
        await api.detachGraph(graph.id);
        setGraphs((prev) =>
          prev.map((g) =>
            g.id === graph.id
              ? {
                  ...g,
                  isAttached: false,
                  viewerCount: Math.max(0, g.viewerCount - 1),
                  canQuery: g.isOwned,
                }
              : g,
          ),
        );
      } else {
        await api.attachGraph(graph.id);
        setGraphs((prev) =>
          prev.map((g) =>
            g.id === graph.id
              ? {
                  ...g,
                  isAttached: true,
                  viewerCount: g.viewerCount + 1,
                  canQuery: true,
                }
              : g,
          ),
        );
      }
      onAttachChange?.();
    } finally {
      setAttachingId(null);
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'title' ? 'asc' : 'desc');
    }
  }

  const sortedGraphs = [...graphs].sort((a, b) => {
    let diff = 0;
    if (sortField === 'title') {
      diff = a.title.localeCompare(b.title);
    } else if (sortField === 'viewerCount') {
      diff = a.viewerCount - b.viewerCount;
    } else if (sortField === 'nodeCount') {
      diff = a.nodeCount - b.nodeCount;
    } else if (sortField === 'sourceCount') {
      diff = a.sourceCount - b.sourceCount;
    } else if (sortField === 'updatedAt') {
      diff = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }
    return sortOrder === 'asc' ? diff : -diff;
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-frame browser-dialog-frame">
          <header className="dialog-frame-heading browser-dialog-heading">
            <div className="browser-heading-title">
              <BookOpen size={18} aria-hidden="true" />
              <Dialog.Title className="browser-title-text">
                Public Graph Browser
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button dialog-frame-close"
                aria-label="Close browser"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </header>

          <div className="browser-toolbar">
            <div className="browser-search-box">
              <Search size={15} aria-hidden="true" />
              <input
                type="text"
                placeholder="Filter public graphs by name or topic..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search ? (
                <button
                  type="button"
                  className="browser-search-clear"
                  onClick={() => setSearch('')}
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
            <div className="browser-results-count">
              {loading ? (
                <span className="browser-loading-tag">
                  <Loader2 size={13} className="spin" /> Searching...
                </span>
              ) : (
                <span>
                  {graphs.length} {graphs.length === 1 ? 'graph' : 'graphs'}{' '}
                  found
                </span>
              )}
            </div>
          </div>

          <div className="browser-table-scrollable">
            <table className="browser-table">
              <thead>
                <tr>
                  <th
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort('title')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('title');
                      }
                    }}
                    className="sortable-col"
                  >
                    <div className="th-content">
                      <span>Graph Title & Description</span>
                      <SortIcon
                        field="title"
                        currentField={sortField}
                        order={sortOrder}
                      />
                    </div>
                  </th>
                  <th className="browser-graph-owner">
                    <div className="th-content">
                      <span>Owner</span>
                    </div>
                  </th>
                  <th
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort('viewerCount')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('viewerCount');
                      }
                    }}
                    className="sortable-col num-col"
                  >
                    <div className="th-content" title="Active viewers">
                      <Users size={13} aria-hidden="true" />
                      <span>Viewers</span>
                      <SortIcon
                        field="viewerCount"
                        currentField={sortField}
                        order={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort('nodeCount')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('nodeCount');
                      }
                    }}
                    className="sortable-col num-col"
                  >
                    <div className="th-content">
                      <span>Nodes</span>
                      <SortIcon
                        field="nodeCount"
                        currentField={sortField}
                        order={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort('sourceCount')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('sourceCount');
                      }
                    }}
                    className="sortable-col num-col"
                  >
                    <div className="th-content">
                      <span>Sources</span>
                      <SortIcon
                        field="sourceCount"
                        currentField={sortField}
                        order={sortOrder}
                      />
                    </div>
                  </th>
                  <th
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSort('updatedAt')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort('updatedAt');
                      }
                    }}
                    className="sortable-col date-col"
                  >
                    <div className="th-content">
                      <span>Updated</span>
                      <SortIcon
                        field="updatedAt"
                        currentField={sortField}
                        order={sortOrder}
                      />
                    </div>
                  </th>
                  <th className="action-col">
                    <div className="th-content">
                      <span>Actions</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedGraphs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={7} className="browser-empty-cell">
                      {search
                        ? `No public graphs found matching "${search}".`
                        : 'No public graphs available yet.'}
                    </td>
                  </tr>
                ) : null}
                {sortedGraphs.map((item) => (
                  <tr
                    key={item.id}
                    className={
                      item.isOwned
                        ? 'is-owned-row'
                        : item.isAttached
                          ? 'is-attached-row'
                          : ''
                    }
                  >
                    <td className="browser-graph-primary">
                      <div className="browser-graph-title-row">
                        <button
                          type="button"
                          className="browser-graph-title"
                          onClick={() => {
                            onSelectGraph(item.id);
                            onOpenChange(false);
                          }}
                        >
                          {item.title}
                        </button>
                        {item.isOwned ? (
                          <span className="browser-badge is-mine">Yours</span>
                        ) : item.isAttached ? (
                          <span className="browser-badge is-attached">
                            Attached
                          </span>
                        ) : null}
                        {item.scheduledForDeletionAt ? (
                          <span
                            className="browser-badge is-scheduled-deletion"
                            title={`Scheduled for deletion on ${new Date(item.scheduledForDeletionAt).toLocaleDateString()} due to inactivity. Any interaction restores it.`}
                          >
                            ⚠️ Deletion Scheduled
                          </span>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p className="browser-graph-desc">{item.description}</p>
                      ) : null}
                    </td>
                    <td className="browser-graph-owner">
                      <span className="owner-chip">{item.ownerName}</span>
                    </td>
                    <td className="num-col">
                      <span className="metric-pill">
                        <Users size={11} aria-hidden="true" />
                        {item.viewerCount}
                      </span>
                    </td>
                    <td className="num-col">
                      <span className="metric-pill">{item.nodeCount}</span>
                    </td>
                    <td className="num-col">
                      <span className="metric-pill">
                        <FileText size={11} aria-hidden="true" />
                        {item.sourceCount}
                      </span>
                    </td>
                    <td className="date-col">
                      <span className="date-text">
                        {new Date(item.updatedAt).toLocaleDateString(
                          undefined,
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </span>
                    </td>
                    <td className="action-col">
                      <div className="browser-row-actions">
                        <button
                          type="button"
                          className="command-button compact primary-action"
                          onClick={() => {
                            onSelectGraph(item.id);
                            onOpenChange(false);
                          }}
                          title={
                            item.isOwned || item.isAttached
                              ? 'Open graph'
                              : 'Preview graph'
                          }
                        >
                          <ExternalLink size={12} />
                          <span>
                            {item.isOwned || item.isAttached
                              ? 'Open'
                              : 'Preview'}
                          </span>
                        </button>

                        {!item.isOwned && !identity?.isGuest ? (
                          <button
                            type="button"
                            className={`command-button compact ${item.isAttached ? 'detach-action' : 'attach-action'}`}
                            disabled={attachingId === item.id}
                            onClick={() => void handleToggleAttach(item)}
                            title={
                              item.isAttached
                                ? 'Detach from graph'
                                : 'Attach to graph'
                            }
                          >
                            {attachingId === item.id ? (
                              <Loader2 size={12} className="spin" />
                            ) : item.isAttached ? (
                              <>
                                <BookmarkCheck size={12} />
                                <span>Detach</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus size={12} />
                                <span>Attach</span>
                              </>
                            )}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className="icon-button compact-icon-btn"
                          title="Copy graph into your workspace"
                          onClick={() => {
                            onOpenChange(false);
                            onCopyGraph(item);
                          }}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SortIcon({
  field,
  currentField,
  order,
}: {
  field: SortField;
  currentField: SortField;
  order: SortOrder;
}) {
  if (field !== currentField) {
    return <ArrowUpDown size={11} className="sort-icon inactive" />;
  }
  return order === 'asc' ? (
    <ArrowUp size={11} className="sort-icon active" />
  ) : (
    <ArrowDown size={11} className="sort-icon active" />
  );
}
