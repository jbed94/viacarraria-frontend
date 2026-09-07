import {
  Archive,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Filter,
  Globe,
  HardDrive,
  RefreshCw,
  ScrollText,
  Shield,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import type { AdminAuditEvent, AuditLogArchive } from '../../../types/api';
import { AuditArchiveViewerModal } from './audit-archive-viewer-modal';

export function AdminAuditTab() {
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [targetTypeFilter, setTargetTypeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [archives, setArchives] = useState<AuditLogArchive[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null);
  const [previewArchive, setPreviewArchive] = useState<AuditLogArchive | null>(
    null,
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.getAuditLogs({
        page,
        limit,
        action: actionFilter.trim() || undefined,
        targetType: targetTypeFilter !== 'all' ? targetTypeFilter : undefined,
      });
      setEvents(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, targetTypeFilter, actionFilter]);

  const loadArchives = useCallback(async () => {
    setLoadingArchives(true);
    try {
      const res = await api.admin.getAuditArchives({ page: 1, limit: 50 });
      setArchives(res?.items ?? []);
    } catch {
      // Non-fatal fallback
    } finally {
      setLoadingArchives(false);
    }
  }, []);

  const handleArchiveNow = async () => {
    setArchiving(true);
    setError(null);
    setArchiveSuccess(null);
    try {
      const res = await api.admin.archiveAuditLogs();
      if (res.eventCount > 0) {
        setArchiveSuccess(
          `Successfully archived ${res.eventCount} audit events into ${res.filename} (${(res.sizeBytes / 1024).toFixed(1)} KB).`,
        );
      } else {
        setArchiveSuccess(
          'No audit events eligible for archival at this time.',
        );
      }
      await Promise.all([loadLogs(), loadArchives()]);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to archive audit logs.');
    } finally {
      setArchiving(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    void loadArchives();
  }, [loadArchives]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const getActionBadgeClass = (action: string) => {
    if (action.includes('delete') || action.includes('revoke')) {
      return 'audit-badge destructive';
    }
    if (action.includes('enable') || action.includes('grant')) {
      return 'audit-badge success';
    }
    if (action.includes('maintenance')) {
      return 'audit-badge warning';
    }
    return 'audit-badge info';
  };

  const getTargetBadgeClass = (targetType: string) => {
    switch (targetType) {
      case 'system':
        return 'audit-target-badge system';
      case 'user':
        return 'audit-target-badge user';
      case 'graph':
        return 'audit-target-badge graph';
      case 'subscription':
        return 'audit-target-badge subscription';
      case 'retention':
        return 'audit-target-badge retention';
      default:
        return 'audit-target-badge';
    }
  };

  return (
    <div className="admin-audit-tab">
      <div className="admin-tab-header">
        <div className="admin-tab-header-title">
          <ScrollText className="admin-tab-icon" size={24} />
          <div>
            <h2>Admin Audit Trail</h2>
            <p className="admin-tab-subtitle">
              Real-time audit log stream capturing administrative operations,
              security policies, and system updates.
            </p>
          </div>
        </div>

        <div className="admin-tab-header-actions">
          <button
            type="button"
            className="admin-btn primary"
            onClick={() => void handleArchiveNow()}
            disabled={archiving || loading}
            title="Archive Active Logs to S3 / MinIO Cold Storage"
          >
            <Archive className={archiving ? 'spinning' : ''} size={16} />
            <span>{archiving ? 'Archiving...' : 'Archive to S3 / MinIO'}</span>
          </button>
          <button
            type="button"
            className="admin-btn secondary"
            onClick={() => void loadLogs()}
            disabled={loading}
            title="Refresh Audit Logs"
          >
            <RefreshCw className={loading ? 'spinning' : ''} size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {archiveSuccess && (
        <div className="admin-alert success">
          <CheckCircle size={16} />
          <span>{archiveSuccess}</span>
        </div>
      )}

      {error && (
        <div className="admin-alert error">
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="admin-toolbar audit-toolbar">
        <div className="toolbar-search-group">
          <Filter size={16} className="toolbar-search-icon" />
          <input
            type="text"
            className="admin-input"
            placeholder="Filter by action (e.g. system.maintenance, user.delete)..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="toolbar-filter-group">
          <label htmlFor="target-type-select" className="sr-only">
            Target Type
          </label>
          <select
            id="target-type-select"
            className="admin-select"
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Targets</option>
            <option value="system">System & Settings</option>
            <option value="user">Users</option>
            <option value="graph">Graphs</option>
            <option value="subscription">Subscriptions</option>
            <option value="retention">Retention Sweeps</option>
          </select>

          <label htmlFor="limit-select" className="sr-only">
            Page Size
          </label>
          <select
            id="limit-select"
            className="admin-select limit-select"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      {/* Audit Events Feed */}
      <div className="admin-card audit-feed-card">
        {loading && events.length === 0 ? (
          <div className="admin-tab-loading">
            <RefreshCw className="spinning" size={24} />
            <span>Loading audit log stream...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="admin-empty-state">
            <Shield size={48} className="empty-icon" />
            <h3>No audit events found</h3>
            <p>
              Administrative actions such as maintenance toggles, user updates,
              and retention runs will be streamed here.
            </p>
          </div>
        ) : (
          <div className="audit-table-wrapper">
            <table className="admin-table audit-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }} />
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const isExpanded = expandedIds.has(ev.id);
                  const hasDetails =
                    ev.details && Object.keys(ev.details).length > 0;

                  return (
                    <tr
                      key={ev.id}
                      className={isExpanded ? 'audit-row-expanded' : ''}
                    >
                      <td>
                        {hasDetails && (
                          <button
                            type="button"
                            className="audit-expand-btn"
                            onClick={() => toggleExpand(ev.id)}
                            aria-label={
                              isExpanded ? 'Collapse details' : 'Expand details'
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="audit-cell-timestamp">
                        <div className="timestamp-wrapper">
                          <Clock size={12} className="meta-icon" />
                          <span>{new Date(ev.timestamp).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="audit-cell-action">
                        <span className={getActionBadgeClass(ev.action)}>
                          {ev.action}
                        </span>
                      </td>
                      <td className="audit-cell-target">
                        <div className="target-wrapper">
                          <span className={getTargetBadgeClass(ev.targetType)}>
                            {ev.targetType.toUpperCase()}
                          </span>
                          {ev.targetId && (
                            <span className="target-id" title={ev.targetId}>
                              {ev.targetId.length > 18
                                ? `${ev.targetId.slice(0, 8)}...${ev.targetId.slice(-6)}`
                                : ev.targetId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="audit-cell-actor">
                        <div className="actor-wrapper">
                          <User size={12} className="meta-icon" />
                          <span className="actor-identity">
                            {ev.actorEmail || ev.actorId}
                          </span>
                          {ev.ip && (
                            <span className="actor-ip" title={`IP: ${ev.ip}`}>
                              <Globe size={10} />
                              {ev.ip}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="audit-cell-details">
                        {hasDetails ? (
                          <div className="details-inline-preview">
                            <span
                              className="details-summary"
                              onClick={() => toggleExpand(ev.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  toggleExpand(ev.id);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              {Object.keys(ev.details).join(', ')} (
                              {Object.keys(ev.details).length} fields)
                            </span>
                            {isExpanded && (
                              <pre className="audit-json-details">
                                {JSON.stringify(ev.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        ) : (
                          <span className="audit-empty-details">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {total > 0 && (
          <div className="admin-pagination-bar">
            <div className="pagination-info">
              Showing {(page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, total)} of {total} events
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="admin-btn secondary small"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </button>
              <span className="pagination-current">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="admin-btn secondary small"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cold Storage Archives Card */}
      <div className="admin-card audit-archives-card">
        <div className="admin-card-header">
          <div className="admin-card-title-group">
            <HardDrive className="admin-tab-icon" size={20} />
            <div>
              <h3>Cold Storage Archives (S3 / MinIO)</h3>
              <p className="admin-card-subtitle">
                Gzip-compressed NDJSON audit snapshots exported from Redis to
                durable object storage.
              </p>
            </div>
          </div>
          <div className="admin-card-header-actions">
            <button
              type="button"
              className="admin-btn secondary small"
              onClick={() => void loadArchives()}
              disabled={loadingArchives}
              title="Refresh Archives"
            >
              <RefreshCw
                className={loadingArchives ? 'spinning' : ''}
                size={14}
              />
              <span>Refresh Archives</span>
            </button>
          </div>
        </div>

        {loadingArchives && archives.length === 0 ? (
          <div className="admin-tab-loading">
            <RefreshCw className="spinning" size={20} />
            <span>Loading cold storage archives...</span>
          </div>
        ) : archives.length === 0 ? (
          <div className="admin-empty-state compact">
            <p>
              No audit log bundles archived in cold storage yet. Click
              &quot;Archive to S3 / MinIO&quot; to rotate active Redis logs.
            </p>
          </div>
        ) : (
          <div className="audit-table-wrapper">
            <table className="admin-table archives-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Filename</th>
                  <th>Events</th>
                  <th>Compressed Size</th>
                  <th>Storage Key</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((arch) => (
                  <tr key={arch.id}>
                    <td className="audit-cell-timestamp">
                      <div className="timestamp-wrapper">
                        <Clock size={12} className="meta-icon" />
                        <span>{new Date(arch.createdAt).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="archive-cell-filename">
                      <code>{arch.filename}</code>
                    </td>
                    <td>
                      <span className="audit-badge info">
                        {arch.eventCount} events
                      </span>
                    </td>
                    <td>
                      {arch.sizeBytes < 1024
                        ? `${arch.sizeBytes} B`
                        : arch.sizeBytes < 1048576
                          ? `${(arch.sizeBytes / 1024).toFixed(1)} KB`
                          : `${(arch.sizeBytes / 1048576).toFixed(2)} MB`}
                    </td>
                    <td className="archive-cell-key">
                      <span className="target-id" title={arch.key}>
                        {arch.key}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="archive-actions-cell">
                        <button
                          type="button"
                          className="admin-btn secondary small"
                          onClick={() => setPreviewArchive(arch)}
                          title="Inspect Archive Events in Browser"
                        >
                          <Eye size={14} />
                          <span>Preview</span>
                        </button>
                        <a
                          href={api.admin.getAuditArchiveDownloadUrl(arch.id)}
                          download={arch.filename}
                          className="admin-btn secondary small"
                          title="Download Gzipped NDJSON Archive"
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewArchive && (
        <AuditArchiveViewerModal
          archive={previewArchive}
          onClose={() => setPreviewArchive(null)}
        />
      )}
    </div>
  );
}
