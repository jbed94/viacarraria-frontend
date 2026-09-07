import {
  Clock,
  Download,
  Eye,
  FileCode,
  Globe,
  RefreshCw,
  Search,
  User,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import type { AdminAuditEvent, AuditLogArchive } from '../../../types/api';

interface AuditArchiveViewerModalProps {
  archive: AuditLogArchive;
  onClose: () => void;
}

export function AuditArchiveViewerModal({
  archive,
  onClose,
}: AuditArchiveViewerModalProps) {
  const [items, setItems] = useState<AdminAuditEvent[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const limit = 25;
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.previewAuditArchive(archive.id, {
        search: search.trim() || undefined,
        page,
        limit,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to decompress and preview archive.');
    } finally {
      setLoading(false);
    }
  }, [archive.id, search, page]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        className="admin-modal-card archive-viewer-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-viewer-title"
      >
        <div className="admin-modal-header">
          <div className="header-title-group">
            <Eye size={18} />
            <h3 id="archive-viewer-title">
              Archive Inspector: <code>{archive.filename}</code>
            </h3>
          </div>
          <div className="archive-viewer-header-actions">
            <a
              href={api.admin.getAuditArchiveDownloadUrl(archive.id)}
              download={archive.filename}
              className="admin-btn secondary small"
              title="Download Gzipped NDJSON Archive"
            >
              <Download size={14} />
              <span>Download .gz</span>
            </a>
            <button
              type="button"
              className="close-modal-btn"
              onClick={onClose}
              aria-label="Close archive inspector"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="admin-modal-body archive-viewer-modal-body">
          {/* Metadata chip strip */}
          <div className="archive-metadata-strip">
            <div className="archive-meta-chip">
              <span className="chip-label">Created:</span>
              <span className="chip-value">
                {new Date(archive.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="archive-meta-chip">
              <span className="chip-label">Compressed:</span>
              <span className="chip-value">
                {formatSize(archive.sizeBytes)}
              </span>
            </div>
            <div className="archive-meta-chip">
              <span className="chip-label">Total Events:</span>
              <span className="chip-value">{archive.eventCount}</span>
            </div>
            <div className="archive-meta-chip s3-key-chip" title={archive.key}>
              <span className="chip-label">S3 Key:</span>
              <code className="chip-value">{archive.key}</code>
            </div>
          </div>

          {/* Search toolbar inside archive */}
          <div className="admin-toolbar archive-modal-toolbar">
            <div className="toolbar-search-group">
              <Search size={16} className="toolbar-search-icon" />
              <input
                type="text"
                className="admin-input"
                placeholder="Search archived events (action, actor, target, details)..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="archive-search-count">
              {loading ? (
                <span>Filtering...</span>
              ) : (
                <span>
                  {total} {total === 1 ? 'match' : 'matches'} found
                </span>
              )}
            </div>
          </div>

          {/* Body content */}
          {error && (
            <div className="admin-alert error">
              <span>{error}</span>
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="admin-tab-loading">
              <RefreshCw className="spinning" size={24} />
              <span>Decompressing and parsing archive from S3 / MinIO...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="admin-empty-state compact">
              <FileCode size={36} className="empty-icon" />
              <h4>No matching audit events</h4>
              <p>
                {search
                  ? `No events inside this archive match "${search}".`
                  : 'This cold storage archive contains no events.'}
              </p>
            </div>
          ) : (
            <div className="audit-table-wrapper archive-viewer-table-wrapper">
              <table className="admin-table audit-table archive-viewer-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }} />
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Actor</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ev) => {
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
                                isExpanded
                                  ? 'Collapse details'
                                  : 'Expand details'
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
                            <span>
                              {new Date(ev.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="audit-cell-action">
                          <span className={getActionBadgeClass(ev.action)}>
                            {ev.action}
                          </span>
                        </td>
                        <td className="audit-cell-target">
                          <div className="target-wrapper">
                            <span
                              className={getTargetBadgeClass(ev.targetType)}
                            >
                              {ev.targetType.toUpperCase()}
                            </span>
                            {ev.targetId && (
                              <span className="target-id" title={ev.targetId}>
                                {ev.targetId.length > 16
                                  ? `${ev.targetId.slice(0, 7)}...${ev.targetId.slice(-5)}`
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
        </div>

        <div className="admin-modal-footer archive-viewer-modal-footer">
          {total > limit && (
            <div className="pagination-controls modal-pagination">
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
          )}
          <button
            type="button"
            className="admin-btn secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
