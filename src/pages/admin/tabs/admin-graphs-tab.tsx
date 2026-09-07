import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Edit2,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Lock,
  Network,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import type { AdminGraph, AdminGraphDetails } from '../../../types/api';

type AdminGraphsTabProps = {
  onOpenGraphOnCanvas?: (graphId: string) => void;
};

export function AdminGraphsTab({ onOpenGraphOnCanvas }: AdminGraphsTabProps) {
  const [graphs, setGraphs] = useState<AdminGraph[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('ALL');
  const [retentionFilter, setRetentionFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-selection & Batch states
  const [selectedGraphIds, setSelectedGraphIds] = useState<Set<string>>(
    new Set(),
  );
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Modals
  const [selectedGraph, setSelectedGraph] = useState<AdminGraphDetails | null>(
    null,
  );

  // Metadata editor modal
  const [editingGraph, setEditingGraph] = useState<AdminGraph | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editIsExempt, setEditIsExempt] = useState(false);
  const [editResetRetention, setEditResetRetention] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Content JSON editor modal
  const [contentGraph, setContentGraph] = useState<AdminGraphDetails | null>(
    null,
  );
  const [nodesJson, setNodesJson] = useState('');
  const [edgesJson, setEdgesJson] = useState('');
  const [savingContent, setSavingContent] = useState(false);

  // Delete modal
  const [deletingGraph, setDeletingGraph] = useState<AdminGraph | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadGraphs = async (
    p = page,
    s = search,
    vis = visibilityFilter,
    ret = retentionFilter,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.graphs({
        page: p,
        limit,
        search: s.trim() || undefined,
        visibility: vis,
        retention: ret,
      });
      setGraphs(res.graphs);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
      setPage(res.pagination.page);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load knowledge graphs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGraphs(1, search, visibilityFilter, retentionFilter);
  }, [visibilityFilter, retentionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadGraphs(1, search, visibilityFilter, retentionFilter);
  };

  const handleToggleExempt = async (graph: AdminGraph) => {
    try {
      await api.admin.updateGraph(graph.id, {
        isExemptFromRetention: !graph.isExemptFromRetention,
      });
      void loadGraphs(page, search, visibilityFilter, retentionFilter);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to toggle retention exemption.');
    }
  };

  const handleToggleSelectGraph = (id: string) => {
    setSelectedGraphIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (graphs.length === 0) return;
    const allSelected = graphs.every((g) => selectedGraphIds.has(g.id));
    if (allSelected) {
      setSelectedGraphIds((prev) => {
        const next = new Set(prev);
        for (const g of graphs) next.delete(g.id);
        return next;
      });
    } else {
      setSelectedGraphIds((prev) => {
        const next = new Set(prev);
        for (const g of graphs) next.add(g.id);
        return next;
      });
    }
  };

  const handleBatchRetentionExempt = async (exempt: boolean) => {
    if (selectedGraphIds.size === 0) return;
    setBatchProcessing(true);
    try {
      await api.admin.batchGraphs({
        graphIds: Array.from(selectedGraphIds),
        action: 'set_retention_exempt',
        exempt,
      });
      setSelectedGraphIds(new Set());
      void loadGraphs(page, search, visibilityFilter, retentionFilter);
    } catch (err: any) {
      alert(
        err?.message ??
          'Failed to update retention exemption for selected graphs.',
      );
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchVisibility = async (isPublic: boolean) => {
    if (selectedGraphIds.size === 0) return;
    setBatchProcessing(true);
    try {
      await api.admin.batchGraphs({
        graphIds: Array.from(selectedGraphIds),
        action: 'set_visibility',
        isPublic,
      });
      setSelectedGraphIds(new Set());
      void loadGraphs(page, search, visibilityFilter, retentionFilter);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update visibility for selected graphs.');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchDeleteSubmit = async () => {
    if (selectedGraphIds.size === 0) return;
    setBatchProcessing(true);
    try {
      await api.admin.batchGraphs({
        graphIds: Array.from(selectedGraphIds),
        action: 'delete',
      });
      setBatchDeleteModalOpen(false);
      setSelectedGraphIds(new Set());
      void loadGraphs(page, search, visibilityFilter, retentionFilter);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete selected graphs.');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleViewDetails = async (id: string) => {
    try {
      const details = await api.admin.graph(id);
      setSelectedGraph(details);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to load graph details.');
    }
  };

  const handleOpenEdit = (graph: AdminGraph) => {
    setEditingGraph(graph);
    setEditTitle(graph.title);
    setEditDesc(graph.description ?? '');
    setEditIsPublic(graph.isPublic);
    setEditIsExempt(graph.isExemptFromRetention);
    setEditResetRetention(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGraph) return;
    setSavingEdit(true);
    try {
      await api.admin.updateGraph(editingGraph.id, {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        isPublic: editIsPublic,
        isExemptFromRetention: editIsExempt,
        resetRetention: editResetRetention,
      });
      setEditingGraph(null);
      void loadGraphs(page, search, visibilityFilter, retentionFilter);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update graph metadata.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenContentEditor = async (id: string) => {
    try {
      const details = await api.admin.graph(id);
      setContentGraph(details);
      setNodesJson(JSON.stringify(details.nodes, null, 2));
      setEdgesJson(JSON.stringify(details.edges, null, 2));
    } catch (err: any) {
      alert(err?.message ?? 'Failed to load graph content.');
    }
  };

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentGraph) return;
    try {
      const parsedNodes = JSON.parse(nodesJson);
      const parsedEdges = JSON.parse(edgesJson);
      setSavingContent(true);
      await api.admin.updateGraphContent(contentGraph.id, {
        nodes: parsedNodes,
        edges: parsedEdges,
      });
      setContentGraph(null);
      void loadGraphs(page, search, visibilityFilter, retentionFilter);
    } catch (err: any) {
      alert(err?.message ?? 'Invalid JSON syntax for nodes or edges.');
    } finally {
      setSavingContent(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingGraph) return;
    setDeleting(true);
    try {
      await api.admin.deleteGraph(deletingGraph.id);
      setDeletingGraph(null);
      void loadGraphs(page, search, visibilityFilter, retentionFilter);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete graph.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-graphs-container">
      <div className="admin-tab-header">
        <div>
          <h2>Knowledge Graphs Management</h2>
          <p className="admin-tab-subtitle">
            Inspect, modify, or override any graph topology, visibility, and
            lifecycle retention policies across all users.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn secondary refresh-btn"
          onClick={() =>
            loadGraphs(page, search, visibilityFilter, retentionFilter)
          }
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="admin-filter-bar">
        <form onSubmit={handleSearchSubmit} className="admin-search-form">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search graphs by title or owner email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearch('');
                void loadGraphs(1, '', visibilityFilter, retentionFilter);
              }}
            >
              <X size={14} />
            </button>
          ) : null}
        </form>

        <div className="admin-filter-selectors">
          <select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
            className="admin-select"
          >
            <option value="ALL">All Visibilities</option>
            <option value="PUBLIC">Public Only</option>
            <option value="PRIVATE">Private Only</option>
          </select>

          <select
            value={retentionFilter}
            onChange={(e) => setRetentionFilter(e.target.value)}
            className="admin-select"
          >
            <option value="ALL">All Retention States</option>
            <option value="EXEMPT">Exempt from Retention Purge</option>
            <option value="INACTIVE">Inactive (Past Retention)</option>
            <option value="SCHEDULED">Scheduled Deletion</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="admin-tab-error">
          <p>{error}</p>
          <button
            type="button"
            className="admin-btn primary"
            onClick={() =>
              loadGraphs(page, search, visibilityFilter, retentionFilter)
            }
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Batch Selection Toolbar */}
      {selectedGraphIds.size > 0 ? (
        <div className="admin-batch-toolbar">
          <div className="admin-batch-info">
            <span className="admin-batch-count">
              {selectedGraphIds.size} graph
              {selectedGraphIds.size > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="admin-batch-actions">
            <button
              type="button"
              className="admin-btn secondary batch-action-btn"
              disabled={batchProcessing}
              onClick={() => handleBatchRetentionExempt(true)}
            >
              <Shield size={14} />
              <span>Exempt from Retention</span>
            </button>
            <button
              type="button"
              className="admin-btn secondary batch-action-btn"
              disabled={batchProcessing}
              onClick={() => handleBatchRetentionExempt(false)}
            >
              <span>Clear Exemption</span>
            </button>
            <button
              type="button"
              className="admin-btn secondary batch-action-btn"
              disabled={batchProcessing}
              onClick={() => handleBatchVisibility(true)}
            >
              <Globe size={14} />
              <span>Make Public</span>
            </button>
            <button
              type="button"
              className="admin-btn secondary batch-action-btn"
              disabled={batchProcessing}
              onClick={() => handleBatchVisibility(false)}
            >
              <Lock size={14} />
              <span>Make Private</span>
            </button>
            <button
              type="button"
              className="admin-btn danger batch-action-btn"
              disabled={batchProcessing}
              onClick={() => setBatchDeleteModalOpen(true)}
            >
              <Trash2 size={14} />
              <span>Delete Selected</span>
            </button>
            <button
              type="button"
              className="admin-btn secondary text-btn"
              onClick={() => setSelectedGraphIds(new Set())}
            >
              <span>Deselect All</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Graphs Table */}
      <div className="admin-card table-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    checked={
                      graphs.length > 0 &&
                      graphs.every((g) => selectedGraphIds.has(g.id))
                    }
                    onChange={handleToggleSelectAll}
                    aria-label="Select all graphs on this page"
                  />
                </th>
                <th>Graph Title</th>
                <th>Owner</th>
                <th>Visibility</th>
                <th>Nodes</th>
                <th>Sources</th>
                <th>Last Active</th>
                <th>Retention</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && graphs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8">
                    <RefreshCw className="spinning inline mr-2" size={16} />
                    Loading knowledge graphs...
                  </td>
                </tr>
              ) : graphs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-table-cell">
                    No graphs found matching filters.
                  </td>
                </tr>
              ) : (
                graphs.map((graph) => {
                  const isScheduled = Boolean(graph.scheduledForDeletionAt);
                  const isInactive =
                    new Date(graph.lastAccessedAt).getTime() <
                    Date.now() - 90 * 24 * 60 * 60 * 1000;

                  return (
                    <tr
                      key={graph.id}
                      className={
                        selectedGraphIds.has(graph.id) ? 'row-selected' : ''
                      }
                    >
                      <td className="td-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedGraphIds.has(graph.id)}
                          onChange={() => handleToggleSelectGraph(graph.id)}
                          aria-label={`Select ${graph.title}`}
                        />
                      </td>
                      <td>
                        <div className="graph-title-cell">
                          <strong>{graph.title}</strong>
                          {graph.description ? (
                            <span className="graph-desc-snippet">
                              {graph.description.slice(0, 60)}...
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="user-name-cell">
                          <span>{graph.ownerName || 'Unknown'}</span>
                          <small className="text-muted">
                            {graph.ownerEmail}
                          </small>
                        </div>
                      </td>
                      <td>
                        {graph.isPublic ? (
                          <span className="badge-pill public">
                            <Globe size={11} className="inline mr-1" /> Public
                          </span>
                        ) : (
                          <span className="badge-pill private">
                            <Lock size={11} className="inline mr-1" /> Private
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="count-pill">{graph.nodeCount}</span>
                      </td>
                      <td>
                        <span className="count-pill">{graph.sourceCount}</span>
                      </td>
                      <td>
                        <span className="text-xs text-muted">
                          {new Date(graph.lastAccessedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <div className="retention-status-cell">
                          {graph.isExemptFromRetention ? (
                            <span
                              className="badge-pill mint cursor-pointer"
                              title="Click to remove exemption"
                              onClick={() => handleToggleExempt(graph)}
                            >
                              <Shield size={10} className="inline mr-1" />{' '}
                              Exempt
                            </span>
                          ) : isScheduled ? (
                            <span className="badge-pill danger">
                              Purge Scheduled
                            </span>
                          ) : isInactive ? (
                            <span className="badge-pill amber">
                              Inactive (Past Retention)
                            </span>
                          ) : (
                            <span className="badge-pill neutral">Active</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="action-buttons-group">
                          {onOpenGraphOnCanvas ? (
                            <button
                              type="button"
                              className="action-btn"
                              title="Open on Interactive Canvas"
                              onClick={() => onOpenGraphOnCanvas(graph.id)}
                            >
                              <ExternalLink size={14} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="action-btn"
                            title="Inspect Graph Details & Sources"
                            onClick={() => handleViewDetails(graph.id)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            title="Edit Graph Metadata"
                            onClick={() => handleOpenEdit(graph)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            title="Edit Canvas Content JSON (Nodes/Edges)"
                            onClick={() => handleOpenContentEditor(graph.id)}
                          >
                            <Code2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="action-btn danger"
                            title="Delete Graph"
                            onClick={() => setDeletingGraph(graph)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="admin-pagination-bar">
          <span className="pagination-info">
            Showing {graphs.length} of {total} graphs (Page {page} of{' '}
            {totalPages})
          </span>
          <div className="pagination-buttons">
            <button
              type="button"
              className="admin-btn secondary sm"
              disabled={page <= 1 || loading}
              onClick={() =>
                loadGraphs(page - 1, search, visibilityFilter, retentionFilter)
              }
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <button
              type="button"
              className="admin-btn secondary sm"
              disabled={page >= totalPages || loading}
              onClick={() =>
                loadGraphs(page + 1, search, visibilityFilter, retentionFilter)
              }
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Graph Details Modal */}
      {selectedGraph ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setSelectedGraph(null)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="header-title-group">
                <Network size={18} />
                <h3>Graph: {selectedGraph.title}</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setSelectedGraph(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="user-profile-summary">
                <div className="profile-row">
                  <span className="profile-label">Graph ID:</span>
                  <code className="profile-value">{selectedGraph.id}</code>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Owner:</span>
                  <span className="profile-value">
                    {selectedGraph.ownerName} ({selectedGraph.ownerEmail})
                  </span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Topology:</span>
                  <span className="profile-value">
                    {selectedGraph.nodes.length} Nodes •{' '}
                    {selectedGraph.edges.length} Edges
                  </span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Retention Policy:</span>
                  <span className="profile-value">
                    {selectedGraph.isExemptFromRetention
                      ? 'Exempt from retention purge'
                      : 'Subject to standard retention activity policy'}
                  </span>
                </div>
              </div>

              {/* Sources */}
              <div className="modal-section">
                <h4>Attached Documents ({selectedGraph.sources.length})</h4>
                {selectedGraph.sources.length > 0 ? (
                  <ul className="modal-item-list">
                    {selectedGraph.sources.map((s) => (
                      <li key={s.id} className="modal-item-row">
                        <div className="item-title-group">
                          <FileText size={14} />
                          <span>{s.name}</span>
                        </div>
                        <span className="item-tags">
                          <span className="badge-pill sm">{s.fileType}</span>
                          <span className="badge-pill sm mint">{s.status}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-subtext">
                    No sources uploaded for this graph.
                  </p>
                )}
              </div>
            </div>
            <div className="admin-modal-footer">
              {onOpenGraphOnCanvas ? (
                <button
                  type="button"
                  className="admin-btn primary mr-auto"
                  onClick={() => {
                    const id = selectedGraph.id;
                    setSelectedGraph(null);
                    onOpenGraphOnCanvas(id);
                  }}
                >
                  <ExternalLink size={14} />
                  <span>Open in Canvas</span>
                </button>
              ) : null}
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setSelectedGraph(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit Graph Metadata Modal */}
      {editingGraph ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setEditingGraph(null)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveEdit}>
              <div className="admin-modal-header">
                <div className="header-title-group">
                  <Edit2 size={18} />
                  <h3>Edit Graph: {editingGraph.title}</h3>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setEditingGraph(null)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label htmlFor="edit-graph-title">Title</label>
                  <input
                    id="edit-graph-title"
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="edit-graph-desc">Description</label>
                  <textarea
                    id="edit-graph-desc"
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                </div>
                <div className="admin-checkbox-group">
                  <label className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={editIsPublic}
                      onChange={(e) => setEditIsPublic(e.target.checked)}
                    />
                    <span>Public Visibility (Browseable by all users)</span>
                  </label>
                </div>
                <div className="admin-checkbox-group">
                  <label className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={editIsExempt}
                      onChange={(e) => setEditIsExempt(e.target.checked)}
                    />
                    <span>Exempt from inactive retention purge</span>
                  </label>
                </div>
                <div className="admin-checkbox-group">
                  <label className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={editResetRetention}
                      onChange={(e) => setEditResetRetention(e.target.checked)}
                    />
                    <span>
                      Reset retention timer & cancel scheduled deletion now
                    </span>
                  </label>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => setEditingGraph(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Content JSON Editor Modal */}
      {contentGraph ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setContentGraph(null)}
        >
          <div
            className="admin-modal-card lg"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveContent}>
              <div className="admin-modal-header">
                <div className="header-title-group">
                  <Code2 size={18} />
                  <h3>Modify Canvas JSON: {contentGraph.title}</h3>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setContentGraph(null)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="admin-modal-body">
                <p className="modal-subtext">
                  Directly edit or inject React Flow node and edge definitions
                  in PostgreSQL JSONB.
                </p>
                <div className="admin-two-col-grid">
                  <div className="admin-form-group">
                    <label htmlFor="content-nodes-json">Nodes Array JSON</label>
                    <textarea
                      id="content-nodes-json"
                      rows={14}
                      className="code-textarea"
                      value={nodesJson}
                      onChange={(e) => setNodesJson(e.target.value)}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label htmlFor="content-edges-json">Edges Array JSON</label>
                    <textarea
                      id="content-edges-json"
                      rows={14}
                      className="code-textarea"
                      value={edgesJson}
                      onChange={(e) => setEdgesJson(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => setContentGraph(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn primary"
                  disabled={savingContent}
                >
                  {savingContent ? 'Updating JSONB...' : 'Apply Canvas JSON'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Delete Graph Modal */}
      {deletingGraph ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setDeletingGraph(null)}
        >
          <div
            className="admin-modal-card danger-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="header-title-group text-danger">
                <Trash2 size={18} />
                <h3>Delete Knowledge Graph</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setDeletingGraph(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <p>
                Are you sure you want to permanently delete knowledge graph{' '}
                <strong>{deletingGraph.title}</strong>?
              </p>
              <div className="admin-callout danger">
                <strong>Notice:</strong> This will immediately delete all
                attached document sources from storage and purge the tenant
                collection in Weaviate.
              </div>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setDeletingGraph(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn danger"
                disabled={deleting}
                onClick={handleConfirmDelete}
              >
                {deleting ? 'Deleting...' : 'Delete Graph'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Batch Delete Graphs Modal */}
      {batchDeleteModalOpen ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setBatchDeleteModalOpen(false)}
        >
          <div
            className="admin-modal-card danger-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="header-title-group text-danger">
                <Trash2 size={18} />
                <h3>Batch Delete Graphs ({selectedGraphIds.size} Graphs)</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setBatchDeleteModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <p>
                Are you sure you want to permanently delete all{' '}
                <strong>{selectedGraphIds.size}</strong> selected knowledge
                graphs?
              </p>
              <div className="admin-callout danger">
                <strong>Notice:</strong> This bulk action will immediately
                delete all attached document sources, S3 files, and cold storage
                archives, and purge their vector tenants in Weaviate. This
                action cannot be undone.
              </div>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setBatchDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn danger"
                disabled={batchProcessing}
                onClick={handleBatchDeleteSubmit}
              >
                {batchProcessing
                  ? 'Deleting...'
                  : `Permanently Delete ${selectedGraphIds.size} Graphs`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
