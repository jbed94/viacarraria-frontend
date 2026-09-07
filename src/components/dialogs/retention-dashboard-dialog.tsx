import {
  Activity,
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type {
  GraphArchiveItem,
  RetentionAuditStats,
  RetentionRunResponse,
  StorageProxyStatus,
} from '../../types/api';
import { DialogFrame } from './dialog-frame';

type RetentionDashboardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGraphRestored?: (graphId: string) => void;
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDaysRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Expired';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

export function RetentionDashboardDialog({
  open,
  onOpenChange,
  onGraphRestored,
}: RetentionDashboardDialogProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<RetentionAuditStats | null>(null);
  const [archives, setArchives] = useState<GraphArchiveItem[]>([]);
  const [runningSweep, setRunningSweep] = useState(false);
  const [sweepResult, setSweepResult] = useState<RetentionRunResponse | null>(
    null,
  );
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [proxyStatus, setProxyStatus] = useState<StorageProxyStatus | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [auditStats, archiveList, storageStatus] = await Promise.all([
        api.retentionAudit(),
        api.retentionArchives(),
        api.storageProxyStatus().catch(() => null),
      ]);
      setStats(auditStats);
      setArchives(archiveList);
      if (storageStatus) {
        setProxyStatus(storageStatus);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load retention data.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadData();
      setSweepResult(null);
      setSuccessMessage(null);
    }
  }, [open]);

  async function handleRunSweep(dryRun: boolean) {
    setRunningSweep(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await api.runRetentionSweep(dryRun);
      setSweepResult(result);
      await loadData();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Retention sweep execution failed.',
      );
    } finally {
      setRunningSweep(false);
    }
  }

  async function handleRestore(archive: GraphArchiveItem) {
    setRestoringId(archive.id);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.restoreGraphArchive(archive.id);
      setSuccessMessage(
        `Graph "${res.title}" successfully restored with ${res.sourceCount} source attachments.`,
      );
      await loadData();
      onGraphRestored?.(res.id);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to restore graph from archive.',
      );
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Retention & Cold Storage Dashboard"
      className="retention-dashboard-dialog"
      style={{ maxWidth: '840px', width: '95vw' }}
    >
      <div className="retention-dashboard-content">
        {error ? (
          <div className="retention-alert error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className="retention-alert success" role="status">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        ) : null}

        {sweepResult ? (
          <div
            className={`retention-alert ${sweepResult.dryRun ? 'info' : 'success'}`}
            role="status"
          >
            <Activity size={16} />
            <div className="retention-sweep-summary">
              <strong>
                {sweepResult.dryRun ? 'Dry-Run Simulation' : 'Live Sweep'}{' '}
                Completed
              </strong>
              <span>
                Scheduled: {sweepResult.scheduled.count} | Purged:{' '}
                {sweepResult.purged.count}
                {sweepResult.audit?.estimatedReclaimBytes
                  ? ` | Reclaimable: ${formatBytes(sweepResult.audit.estimatedReclaimBytes)}`
                  : ''}
              </span>
            </div>
          </div>
        ) : null}

        {/* Storage Proxy Topology Banner */}
        <div
          className="retention-storage-proxy-banner"
          role="status"
          aria-label="Storage Proxy Configuration"
        >
          <div className="retention-proxy-info">
            <Database size={15} />
            <span>
              <strong>Storage Topology:</strong>{' '}
              {proxyStatus
                ? proxyStatus.isProxy
                  ? `MinIO Proxy → ${proxyStatus.upstreamProvider === 's3' ? `AWS S3 (${proxyStatus.upstreamBucket || 'cloud bucket'})` : proxyStatus.upstreamProvider === 'gcs' ? `Google Cloud Storage (${proxyStatus.upstreamBucket || 'gcs bucket'})` : 'Local Volume'}`
                  : 'Local Storage Driver'
                : 'MinIO Storage Proxy'}
            </span>
          </div>
          <span
            className={`proxy-status-pill ${proxyStatus?.connected ? 'online' : 'offline'}`}
          >
            {proxyStatus?.connected ? '● Proxy Connected' : '○ Standby'}
          </span>
        </div>

        {/* Telemetry Metrics Grid */}
        <section
          className="retention-metrics-grid"
          aria-label="Retention Metrics"
        >
          <div className="retention-metric-card">
            <div className="metric-header">
              <Database size={15} className="metric-icon" />
              <span>Active Graphs</span>
            </div>
            <div className="metric-value">
              {loading && !stats ? '...' : (stats?.totalActiveGraphs ?? 0)}
            </div>
          </div>

          <div className="retention-metric-card">
            <div className="metric-header">
              <Clock size={15} className="metric-icon" />
              <span>Inactivity Candidates</span>
            </div>
            <div className="metric-value warn">
              {loading && !stats ? '...' : (stats?.inactiveCandidateCount ?? 0)}
            </div>
          </div>

          <div className="retention-metric-card">
            <div className="metric-header">
              <Trash2 size={15} className="metric-icon" />
              <span>Pending Deletion</span>
            </div>
            <div className="metric-value danger">
              {loading && !stats
                ? '...'
                : (stats?.scheduledForDeletionCount ?? 0)}
            </div>
          </div>

          <div className="retention-metric-card">
            <div className="metric-header">
              <Shield size={15} className="metric-icon" />
              <span>Exempt Graphs</span>
            </div>
            <div className="metric-value accent">
              {loading && !stats ? '...' : (stats?.exemptGraphsCount ?? 0)}
            </div>
          </div>

          <div className="retention-metric-card">
            <div className="metric-header">
              <Archive size={15} className="metric-icon" />
              <span>Glacier Archives</span>
            </div>
            <div className="metric-value">
              {loading && !stats ? '...' : (stats?.activeArchivesCount ?? 0)}
            </div>
          </div>

          <div className="retention-metric-card">
            <div className="metric-header">
              <Activity size={15} className="metric-icon" />
              <span>Est. Reclaimable</span>
            </div>
            <div className="metric-value">
              {loading && !stats
                ? '...'
                : formatBytes(stats?.estimatedReclaimBytes ?? 0)}
            </div>
          </div>
        </section>

        {/* Action Controls */}
        <div className="retention-actions-bar">
          <div className="retention-actions-info">
            <span>
              Automated inactivity retention with warning grace period.
            </span>
          </div>
          <div className="retention-action-buttons">
            <button
              type="button"
              className="command-button secondary"
              onClick={() => void handleRunSweep(true)}
              disabled={runningSweep || loading}
            >
              <Play size={14} />
              <span>
                {runningSweep && sweepResult?.dryRun
                  ? 'Simulating...'
                  : 'Dry-Run Sweep'}
              </span>
            </button>

            <button
              type="button"
              className="command-button danger"
              onClick={() => void handleRunSweep(false)}
              disabled={runningSweep || loading}
            >
              <Trash2 size={14} />
              <span>
                {runningSweep && !sweepResult?.dryRun
                  ? 'Executing...'
                  : 'Live Retention Sweep'}
              </span>
            </button>

            <button
              type="button"
              className="icon-button"
              title="Refresh retention data"
              onClick={() => void loadData()}
              disabled={loading || runningSweep}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Cold Storage Archives List */}
        <section
          className="retention-archives-section"
          aria-label="Glacier Cold Storage Archives"
        >
          <div className="retention-section-header">
            <h3>S3 Glacier Cold-Storage Archives</h3>
            <span className="retention-badge">30-Day TTL Grace Window</span>
          </div>

          {archives.length === 0 ? (
            <div className="retention-empty-state">
              <Archive size={32} className="empty-icon" />
              <p>No archived graphs currently stored in cold storage.</p>
              <span>
                When inactive graphs are purged, their .tar.gz packages are
                stored here for 30 days.
              </span>
            </div>
          ) : (
            <div className="retention-table-container">
              <table className="retention-archives-table">
                <thead>
                  <tr>
                    <th>Graph Title</th>
                    <th>Sources</th>
                    <th>Size</th>
                    <th>TTL Window</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archives.map((archive) => (
                    <tr key={archive.id}>
                      <td>
                        <div className="archive-title-cell">
                          <strong>{archive.title}</strong>
                          <span className="archive-graph-id">
                            ID: {archive.graphId}
                          </span>
                        </div>
                      </td>
                      <td>{archive.sourceCount} files</td>
                      <td>{formatBytes(archive.sizeBytes)}</td>
                      <td>
                        <span className="ttl-badge">
                          {formatDaysRemaining(archive.expiresAt)}
                        </span>
                      </td>
                      <td className="actions-col">
                        <div className="archive-row-actions">
                          <a
                            href={api.downloadArchiveUrl(archive.graphId, true)}
                            download
                            className="command-button secondary archive-action-btn"
                            title="Download .tar.gz bundle"
                          >
                            <Download size={13} />
                            <span>Download</span>
                          </a>

                          <button
                            type="button"
                            className="command-button accent archive-action-btn"
                            title="Restore graph and sources from cold archive"
                            onClick={() => void handleRestore(archive)}
                            disabled={restoringId === archive.id}
                          >
                            <RotateCcw
                              size={13}
                              className={
                                restoringId === archive.id ? 'animate-spin' : ''
                              }
                            />
                            <span>
                              {restoringId === archive.id
                                ? 'Restoring...'
                                : 'Restore'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DialogFrame>
  );
}
