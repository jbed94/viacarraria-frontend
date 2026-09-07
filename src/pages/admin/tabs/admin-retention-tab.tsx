import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  Download,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import type {
  GraphArchiveItem,
  RetentionAuditStats,
  RetentionRunResponse,
} from '../../../types/api';

export function AdminRetentionTab() {
  const [audit, setAudit] = useState<RetentionAuditStats | null>(null);
  const [archives, setArchives] = useState<GraphArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sweep controls
  const [isDryRun, setIsDryRun] = useState(true);
  const [runningSweep, setRunningSweep] = useState(false);
  const [sweepResult, setSweepResult] = useState<RetentionRunResponse | null>(
    null,
  );

  // Actions
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [auditData, archivesData] = await Promise.all([
        api.admin.retentionAudit(),
        api.admin.retentionArchives(),
      ]);
      setAudit(auditData);
      setArchives(archivesData);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message ?? 'Failed to load retention state.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleRunSweep = async () => {
    setRunningSweep(true);
    setSweepResult(null);
    setMessage(null);
    try {
      const res = await api.admin.runRetentionSweep(isDryRun);
      setSweepResult(res);
      void loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message ?? 'Failed to execute retention sweep.',
      });
    } finally {
      setRunningSweep(false);
    }
  };

  const handleRestore = async (graphId: string) => {
    setRestoringId(graphId);
    setMessage(null);
    try {
      const res = await api.admin.restoreArchive(graphId);
      setMessage({
        type: 'success',
        text: `Graph successfully restored with ID: ${res.id}`,
      });
      void loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message ?? 'Failed to restore graph from archive.',
      });
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeleteArchive = async (graphId: string) => {
    if (!confirm('Are you sure you want to delete this cold storage archive?'))
      return;
    setDeletingId(graphId);
    setMessage(null);
    try {
      await api.admin.deleteArchive(graphId);
      setMessage({
        type: 'success',
        text: 'Cold storage archive deleted.',
      });
      void loadData();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message ?? 'Failed to delete archive.',
      });
    } finally {
      setDeletingId(null);
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
    <div className="admin-retention-container">
      <div className="admin-tab-header">
        <div>
          <h2>Lifecycle & Retention Management</h2>
          <p className="admin-tab-subtitle">
            Configure inactivity policies, simulate sweeps, manage cold storage
            archives, and restore historical graphs.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn secondary refresh-btn"
          onClick={loadData}
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {message ? (
        <div
          className={`admin-feedback-banner ${message.type === 'success' ? 'success' : 'error'}`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span>{message.text}</span>
        </div>
      ) : null}

      {/* Retention Audit Metrics Grid */}
      {audit ? (
        <div className="admin-kpi-grid">
          <div className="admin-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon graphs-icon">
                <Clock size={20} />
              </div>
              <span className="kpi-tag amber">Candidates</span>
            </div>
            <div className="kpi-metric">{audit.inactiveCandidateCount}</div>
            <div className="kpi-label">Inactive Retention Candidates</div>
            <div className="kpi-subtext">
              No user access past retention window
            </div>
          </div>

          <div className="admin-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon storage-icon">
                <AlertTriangle size={20} />
              </div>
              <span className="kpi-tag danger">7-Day Grace</span>
            </div>
            <div className="kpi-metric">{audit.scheduledForDeletionCount}</div>
            <div className="kpi-label">Scheduled for Deletion</div>
            <div className="kpi-subtext">Will be purged on next cycle</div>
          </div>

          <div className="admin-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon revenue-icon">
                <Shield size={20} />
              </div>
              <span className="kpi-tag mint">Protected</span>
            </div>
            <div className="kpi-metric">{audit.exemptGraphsCount}</div>
            <div className="kpi-label">Retention Exempt Graphs</div>
            <div className="kpi-subtext">Never purged or scheduled</div>
          </div>

          <div className="admin-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon users-icon">
                <Archive size={20} />
              </div>
              <span className="kpi-tag">
                {audit.activeArchivesCount} Tarballs
              </span>
            </div>
            <div className="kpi-metric">
              {formatBytes(audit.estimatedReclaimBytes)}
            </div>
            <div className="kpi-label">Cold Storage Reclaimed</div>
            <div className="kpi-subtext">Archived in MinIO/S3 cold tier</div>
          </div>
        </div>
      ) : null}

      {/* Sweep Execution Box */}
      <div className="admin-card sweep-card">
        <div className="card-header-row">
          <div className="header-title-group">
            <Play size={16} />
            <h3>Execute Retention Sweep</h3>
          </div>
        </div>
        <p className="modal-subtext">
          Scans all knowledge graphs across the database. Graphs inactive past
          the retention window are either scheduled with a grace period, or
          purged/archived to cold storage if grace expired.
        </p>
        <div className="sweep-controls-row">
          <label className="admin-checkbox-label">
            <input
              type="checkbox"
              checked={isDryRun}
              onChange={(e) => setIsDryRun(e.target.checked)}
            />
            <span>
              <strong>Dry Run Simulation</strong> (Calculate affected graphs and
              reclaimable storage without executing deletes)
            </span>
          </label>
          <button
            type="button"
            className={`admin-btn ${isDryRun ? 'secondary' : 'danger'}`}
            disabled={runningSweep}
            onClick={handleRunSweep}
          >
            {runningSweep ? (
              <>
                <RefreshCw size={14} className="spinning mr-2" />
                <span>Running Sweep...</span>
              </>
            ) : (
              <span>
                {isDryRun ? 'Run Simulation Sweep' : 'Execute Live Purge Sweep'}
              </span>
            )}
          </button>
        </div>

        {/* Sweep Output Result */}
        {sweepResult ? (
          <div className="sweep-result-box">
            <h4>
              Sweep Results (
              {sweepResult.dryRun ? 'Simulation' : 'Live Execution'})
            </h4>
            <div className="sweep-metrics-row">
              <div className="sweep-pill">
                <strong>Scheduled:</strong> {sweepResult.scheduled.count} graphs
              </div>
              <div className="sweep-pill">
                <strong>Purged:</strong> {sweepResult.purged.count} graphs
              </div>
              {sweepResult.audit ? (
                <div className="sweep-pill">
                  <strong>Reclaimable Storage:</strong>{' '}
                  {formatBytes(sweepResult.audit.estimatedReclaimBytes)}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Cold Storage Archives Registry */}
      <div className="admin-card table-card">
        <div className="card-header-row">
          <div className="header-title-group">
            <Archive size={16} />
            <h3>Cold Storage Tar.gz Archives ({archives.length})</h3>
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Graph Title / ID</th>
                <th>Owner ID</th>
                <th>Sources</th>
                <th>Archive Size</th>
                <th>Archived Date</th>
                <th>Expires</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {archives.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table-cell">
                    No cold storage archives currently stored.
                  </td>
                </tr>
              ) : (
                archives.map((arch) => (
                  <tr key={arch.id}>
                    <td>
                      <div className="graph-title-cell">
                        <strong>{arch.title}</strong>
                        <small className="text-muted">{arch.graphId}</small>
                      </div>
                    </td>
                    <td>
                      <code className="text-xs">
                        {arch.userId.slice(0, 12)}...
                      </code>
                    </td>
                    <td>
                      <span className="count-pill">{arch.sourceCount}</span>
                    </td>
                    <td>
                      <span>{formatBytes(arch.sizeBytes)}</span>
                    </td>
                    <td>
                      <span className="text-xs text-muted">
                        {new Date(arch.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-muted">
                        {new Date(arch.expiresAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="action-buttons-group">
                        <a
                          href={api.downloadArchiveUrl(arch.graphId, true)}
                          download={`${arch.title}_archive.tar.gz`}
                          className="action-btn"
                          title="Download .tar.gz archive"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          type="button"
                          className="action-btn mint"
                          title="Restore graph back into active database"
                          disabled={restoringId === arch.graphId}
                          onClick={() => handleRestore(arch.graphId)}
                        >
                          <RotateCcw
                            size={14}
                            className={
                              restoringId === arch.graphId ? 'spinning' : ''
                            }
                          />
                        </button>
                        <button
                          type="button"
                          className="action-btn danger"
                          title="Delete archive from cold storage"
                          disabled={deletingId === arch.graphId}
                          onClick={() => handleDeleteArchive(arch.graphId)}
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
      </div>
    </div>
  );
}
