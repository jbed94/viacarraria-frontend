import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Eye,
  Filter,
  Layers,
  Network,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api, triggerBlobDownload } from '../../../lib/api';
import type {
  AdminUser,
  AdminUserDetails,
  SubscriptionTier,
} from '../../../types/api';

export function AdminUsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-selection & Batch states
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [exporting, setExporting] = useState<string | null>(null);
  const [batchTierModalOpen, setBatchTierModalOpen] = useState(false);
  const [batchTier, setBatchTier] = useState<SubscriptionTier>('PRO');
  const [batchDays, setBatchDays] = useState(30);
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Modal states
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(
    null,
  );
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editTier, setEditTier] = useState<SubscriptionTier>('FREE');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Deletion modal
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = async (p = page, s = search, t = tierFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.users({
        page: p,
        limit,
        search: s.trim() || undefined,
        tier: t,
      });
      setUsers(res.users);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
      setPage(res.pagination.page);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers(1, search, tierFilter);
  }, [tierFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadUsers(1, search, tierFilter);
  };

  const handleViewDetails = async (id: string) => {
    try {
      const details = await api.admin.user(id);
      setSelectedUser(details);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to load user details.');
    }
  };

  const handleOpenEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditTier(user.subscriptionTier);
    setEditExpiresAt(
      user.subscriptionExpiresAt
        ? new Date(user.subscriptionExpiresAt).toISOString().split('T')[0]!
        : '',
    );
    setEditName(user.name);
    setEditUsername(user.username ?? '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      await api.admin.updateUser(editingUser.id, {
        name: editName.trim() || undefined,
        username: editUsername.trim() || undefined,
        subscriptionTier: editTier,
        subscriptionExpiresAt: editExpiresAt
          ? new Date(editExpiresAt).toISOString()
          : null,
      });
      setEditingUser(null);
      void loadUsers(page, search, tierFilter);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update user.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await api.admin.deleteUser(deletingUser.id);
      setDeletingUser(null);
      void loadUsers(page, search, tierFilter);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (users.length === 0) return;
    const allSelected = users.every((u) => selectedUserIds.has(u.id));
    if (allSelected) {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        for (const u of users) next.delete(u.id);
        return next;
      });
    } else {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        for (const u of users) next.add(u.id);
        return next;
      });
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(format);
    try {
      const blob = await api.admin.exportUsers({
        format,
        search: search.trim() || undefined,
        tier: tierFilter,
      });
      const date = new Date().toISOString().split('T')[0];
      triggerBlobDownload(blob, `users-audit-${date}.${format}`);
    } catch (err: any) {
      alert(
        err?.message ?? `Failed to export users as ${format.toUpperCase()}`,
      );
    } finally {
      setExporting(null);
    }
  };

  const handleBatchTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.size === 0) return;
    setBatchProcessing(true);
    try {
      await api.admin.batchUsers({
        userIds: Array.from(selectedUserIds),
        action: 'set_tier',
        tier: batchTier,
        durationDays: batchTier === 'PRO' ? batchDays : undefined,
      });
      setBatchTierModalOpen(false);
      setSelectedUserIds(new Set());
      void loadUsers(page, search, tierFilter);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to execute batch tier update.');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBatchDeleteSubmit = async () => {
    if (selectedUserIds.size === 0) return;
    setBatchProcessing(true);
    try {
      await api.admin.batchUsers({
        userIds: Array.from(selectedUserIds),
        action: 'delete',
      });
      setBatchDeleteModalOpen(false);
      setSelectedUserIds(new Set());
      void loadUsers(page, search, tierFilter);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete selected users.');
    } finally {
      setBatchProcessing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="admin-users-container">
      <div className="admin-tab-header">
        <div>
          <h2>User Accounts & Subscriptions</h2>
          <p className="admin-tab-subtitle">
            Inspect registered accounts, grant or revoke Pro privileges, and
            audit usage.
          </p>
        </div>
        <div className="admin-tab-header-actions">
          <button
            type="button"
            className="admin-btn secondary"
            disabled={exporting !== null}
            onClick={() => handleExport('csv')}
          >
            <Download
              size={14}
              className={exporting === 'csv' ? 'spinning' : ''}
            />
            <span>
              {exporting === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
            </span>
          </button>
          <button
            type="button"
            className="admin-btn secondary"
            disabled={exporting !== null}
            onClick={() => handleExport('json')}
          >
            <Download
              size={14}
              className={exporting === 'json' ? 'spinning' : ''}
            />
            <span>
              {exporting === 'json' ? 'Exporting JSON...' : 'Export JSON'}
            </span>
          </button>
          <button
            type="button"
            className="admin-btn secondary refresh-btn"
            onClick={() => loadUsers(page, search, tierFilter)}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="admin-filter-bar">
        <form onSubmit={handleSearchSubmit} className="admin-search-form">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search users by name, email, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearch('');
                void loadUsers(1, '', tierFilter);
              }}
            >
              <X size={14} />
            </button>
          ) : null}
        </form>

        <div className="admin-tier-pills">
          <Filter size={14} className="filter-icon" />
          {['ALL', 'FREE', 'PRO', 'ANONYMOUS'].map((tier) => (
            <button
              key={tier}
              type="button"
              className={`filter-pill ${tierFilter === tier ? 'active' : ''}`}
              onClick={() => setTierFilter(tier)}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="admin-tab-error">
          <p>{error}</p>
          <button
            type="button"
            className="admin-btn primary"
            onClick={() => loadUsers(page, search, tierFilter)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Batch Selection Toolbar */}
      {selectedUserIds.size > 0 ? (
        <div className="admin-batch-toolbar">
          <div className="admin-batch-info">
            <span className="admin-batch-count">
              {selectedUserIds.size} user{selectedUserIds.size > 1 ? 's' : ''}{' '}
              selected
            </span>
          </div>
          <div className="admin-batch-actions">
            <button
              type="button"
              className="admin-btn secondary batch-action-btn"
              onClick={() => setBatchTierModalOpen(true)}
            >
              <Layers size={14} />
              <span>Change Tier</span>
            </button>
            <button
              type="button"
              className="admin-btn danger batch-action-btn"
              onClick={() => setBatchDeleteModalOpen(true)}
            >
              <Trash2 size={14} />
              <span>Delete Selected</span>
            </button>
            <button
              type="button"
              className="admin-btn secondary text-btn"
              onClick={() => setSelectedUserIds(new Set())}
            >
              <span>Deselect All</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Users Table */}
      <div className="admin-card table-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    checked={
                      users.length > 0 &&
                      users.every((u) => selectedUserIds.has(u.id))
                    }
                    onChange={handleToggleSelectAll}
                    aria-label="Select all users on this page"
                  />
                </th>
                <th>User / Account</th>
                <th>Email</th>
                <th>Tier</th>
                <th>Expires</th>
                <th>Graphs</th>
                <th>Sources</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8">
                    <RefreshCw className="spinning inline mr-2" size={16} />
                    Loading accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-table-cell">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className={
                      selectedUserIds.has(user.id) ? 'row-selected' : ''
                    }
                  >
                    <td className="td-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(user.id)}
                        onChange={() => handleToggleSelectUser(user.id)}
                        aria-label={`Select ${user.name || user.email}`}
                      />
                    </td>
                    <td>
                      <div className="user-name-cell">
                        <strong>{user.name || 'Unnamed'}</strong>
                        {user.username ? (
                          <span className="user-username">
                            @{user.username}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className="user-email">{user.email}</span>
                      {user.isAnonymous ? (
                        <span className="badge-pill guest">Guest</span>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`badge-pill ${user.subscriptionTier.toLowerCase()}`}
                      >
                        {user.subscriptionTier}
                      </span>
                    </td>
                    <td>
                      {user.subscriptionExpiresAt ? (
                        <span className="text-xs">
                          {new Date(
                            user.subscriptionExpiresAt,
                          ).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <span className="count-pill">{user.graphsCount}</span>
                    </td>
                    <td>
                      <span className="count-pill">{user.sourcesCount}</span>
                    </td>
                    <td>
                      <span className="text-xs text-muted">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className="action-btn"
                          title="View user details & graphs"
                          onClick={() => handleViewDetails(user.id)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="action-btn"
                          title="Edit user tier & details"
                          onClick={() => handleOpenEdit(user)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="action-btn danger"
                          title="Delete user"
                          onClick={() => setDeletingUser(user)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="admin-pagination-bar">
          <span className="pagination-info">
            Showing {users.length} of {total} users (Page {page} of {totalPages}
            )
          </span>
          <div className="pagination-buttons">
            <button
              type="button"
              className="admin-btn secondary sm"
              disabled={page <= 1 || loading}
              onClick={() => loadUsers(page - 1, search, tierFilter)}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <button
              type="button"
              className="admin-btn secondary sm"
              disabled={page >= totalPages || loading}
              onClick={() => loadUsers(page + 1, search, tierFilter)}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="header-title-group">
                <Users size={18} />
                <h3>Account Telemetry & Usage</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setSelectedUser(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="user-profile-summary">
                <div className="profile-row">
                  <span className="profile-label">User ID:</span>
                  <code className="profile-value">{selectedUser.user.id}</code>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Name & Email:</span>
                  <span className="profile-value">
                    {selectedUser.user.name} ({selectedUser.user.email})
                  </span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Subscription Tier:</span>
                  <span
                    className={`badge-pill ${selectedUser.user.subscriptionTier.toLowerCase()}`}
                  >
                    {selectedUser.user.subscriptionTier}
                  </span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Storage Footprint:</span>
                  <span className="profile-value">
                    {selectedUser.storage.sourcesCount} files (
                    {formatBytes(selectedUser.storage.totalBytes)})
                  </span>
                </div>
              </div>

              {/* User Graphs */}
              <div className="modal-section">
                <h4>Knowledge Graphs ({selectedUser.graphs.length})</h4>
                {selectedUser.graphs.length > 0 ? (
                  <ul className="modal-item-list">
                    {selectedUser.graphs.map((g) => (
                      <li key={g.id} className="modal-item-row">
                        <div className="item-title-group">
                          <Network size={14} />
                          <strong>{g.title}</strong>
                        </div>
                        <span className="item-tags">
                          {g.isPublic ? (
                            <span className="badge-pill sm">Public</span>
                          ) : (
                            <span className="badge-pill sm muted">Private</span>
                          )}
                          {g.isExemptFromRetention ? (
                            <span className="badge-pill sm mint">Exempt</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-subtext">No graphs created yet.</p>
                )}
              </div>

              {/* Recent Queries */}
              <div className="modal-section">
                <h4>Recent Queries ({selectedUser.recentQueries.length})</h4>
                {selectedUser.recentQueries.length > 0 ? (
                  <ul className="modal-item-list">
                    {selectedUser.recentQueries.map((q) => (
                      <li key={q.id} className="modal-item-row">
                        <span className="query-text">"{q.queryText}"</span>
                        <span className="text-xs text-muted">
                          {new Date(q.createdAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-subtext">No search queries logged.</p>
                )}
              </div>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setSelectedUser(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit User Modal */}
      {editingUser ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setEditingUser(null)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveEdit}>
              <div className="admin-modal-header">
                <div className="header-title-group">
                  <Edit2 size={18} />
                  <h3>Modify Account: {editingUser.name}</h3>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setEditingUser(null)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label htmlFor="edit-user-name">Full Name</label>
                  <input
                    id="edit-user-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="edit-user-username">Username</label>
                  <input
                    id="edit-user-username"
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="edit-user-tier">
                    Subscription Entitlement Tier
                  </label>
                  <select
                    id="edit-user-tier"
                    value={editTier}
                    onChange={(e) =>
                      setEditTier(e.target.value as SubscriptionTier)
                    }
                  >
                    <option value="FREE">
                      FREE User (5 graphs, 20 queries/day)
                    </option>
                    <option value="PRO">
                      PRO Subscriber (Unlimited graphs, 1000 queries/mo)
                    </option>
                    <option value="ANONYMOUS">ANONYMOUS Guest</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label htmlFor="edit-user-expiry">
                    Subscription Expiration Date
                  </label>
                  <input
                    id="edit-user-expiry"
                    type="date"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                  />
                  <small className="form-hint">
                    Leave blank for lifetime/unexpiring access.
                  </small>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => setEditingUser(null)}
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

      {/* Delete User Modal */}
      {deletingUser ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setDeletingUser(null)}
        >
          <div
            className="admin-modal-card danger-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="header-title-group text-danger">
                <Trash2 size={18} />
                <h3>Permanently Delete User</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setDeletingUser(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <p>
                Are you sure you want to permanently delete account{' '}
                <strong>{deletingUser.email}</strong> ({deletingUser.name})?
              </p>
              <div className="admin-callout danger">
                <strong>Warning:</strong> This action will cascade delete all
                graphs, uploaded document sources, S3 storage files, and vector
                tenants belonging to this user. This cannot be undone.
              </div>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setDeletingUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn danger"
                disabled={deleting}
                onClick={handleConfirmDelete}
              >
                {deleting ? 'Deleting...' : 'Delete User & All Data'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Batch Tier Modal */}
      {batchTierModalOpen ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setBatchTierModalOpen(false)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="header-title-group">
                <Layers size={18} />
                <h3>Batch Update Tier ({selectedUserIds.size} Users)</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setBatchTierModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleBatchTierSubmit}>
              <div className="admin-modal-body">
                <p>
                  Update the subscription tier for all{' '}
                  <strong>{selectedUserIds.size}</strong> selected accounts
                  simultaneously:
                </p>
                <div className="admin-form-group">
                  <label htmlFor="batch-tier-select">Subscription Tier</label>
                  <select
                    id="batch-tier-select"
                    value={batchTier}
                    onChange={(e) =>
                      setBatchTier(e.target.value as SubscriptionTier)
                    }
                  >
                    <option value="PRO">PRO</option>
                    <option value="FREE">FREE</option>
                    <option value="ANONYMOUS">ANONYMOUS</option>
                  </select>
                </div>
                {batchTier === 'PRO' ? (
                  <div className="admin-form-group">
                    <label htmlFor="batch-duration-days">Duration (Days)</label>
                    <input
                      id="batch-duration-days"
                      type="number"
                      min={1}
                      max={3650}
                      value={batchDays}
                      onChange={(e) =>
                        setBatchDays(Number.parseInt(e.target.value, 10) || 30)
                      }
                    />
                    <small className="form-hint">
                      Subscription will expire in {batchDays} days.
                    </small>
                  </div>
                ) : null}
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => setBatchTierModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn primary"
                  disabled={batchProcessing}
                >
                  {batchProcessing
                    ? 'Updating...'
                    : `Update ${selectedUserIds.size} Users`}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Batch Delete Modal */}
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
                <h3>Batch Delete Users ({selectedUserIds.size} Users)</h3>
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
                <strong>{selectedUserIds.size}</strong> selected user accounts?
              </p>
              <div className="admin-callout danger">
                <strong>Warning:</strong> This bulk action will permanently
                cascade delete all knowledge graphs, uploaded sources, S3 files,
                and Weaviate vectors belonging to every selected user. This
                cannot be undone.
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
                  : `Permanently Delete ${selectedUserIds.size} Users`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
