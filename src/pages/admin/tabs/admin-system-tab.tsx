import {
  CheckCircle2,
  Cloud,
  Cpu,
  Database,
  Layers,
  Radio,
  RefreshCw,
  Server,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import type { AdminSystemStatus } from '../../../types/api';

export function AdminSystemTab() {
  const [status, setStatus] = useState<AdminSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.systemStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load system infrastructure status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
  };

  return (
    <div className="admin-system-container">
      <div className="admin-tab-header">
        <div>
          <h2>System Infrastructure & Health Status</h2>
          <p className="admin-tab-subtitle">
            Core cluster dependencies, MinIO storage proxy upstream routing, and
            backend runtime diagnostics.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn secondary refresh-btn"
          onClick={loadStatus}
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error ? (
        <div className="admin-tab-error">
          <p>{error}</p>
          <button
            type="button"
            className="admin-btn primary"
            onClick={loadStatus}
          >
            Retry
          </button>
        </div>
      ) : null}

      {status ? (
        <>
          {/* Cluster Services Health Cards */}
          <div className="admin-card">
            <div className="card-header-row">
              <div className="header-title-group">
                <Server size={16} />
                <h3>Microservices & Data Stores</h3>
              </div>
              <span
                className={`badge-pill ${status.health.status === 'ok' ? 'mint' : 'danger'}`}
              >
                {status.health.status === 'ok'
                  ? 'All Services Healthy'
                  : 'Degraded Subsystems'}
              </span>
            </div>

            <div className="services-health-grid">
              {/* PostgreSQL */}
              <div className="service-card">
                <div className="service-card-top">
                  <div className="service-icon db">
                    <Database size={18} />
                  </div>
                  {status.health.services.database ? (
                    <span className="service-status-pill online">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  ) : (
                    <span className="service-status-pill offline">
                      <XCircle size={12} /> Unreachable
                    </span>
                  )}
                </div>
                <h4>PostgreSQL</h4>
                <p>Relational schemas, JSONB topologies, sessions & users.</p>
              </div>

              {/* Redis */}
              <div className="service-card">
                <div className="service-card-top">
                  <div className="service-icon redis">
                    <Radio size={18} />
                  </div>
                  {status.health.services.redis ? (
                    <span className="service-status-pill online">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  ) : (
                    <span className="service-status-pill offline">
                      <XCircle size={12} /> Unreachable
                    </span>
                  )}
                </div>
                <h4>Redis</h4>
                <p>
                  Rate limiting, quota budgets & WebSocket pub/sub
                  synchronization.
                </p>
              </div>

              {/* RabbitMQ */}
              <div className="service-card">
                <div className="service-card-top">
                  <div className="service-icon rabbitmq">
                    <Workflow size={18} />
                  </div>
                  {status.health.services.rabbitMq ? (
                    <span className="service-status-pill online">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  ) : (
                    <span className="service-status-pill offline">
                      <XCircle size={12} /> Unreachable
                    </span>
                  )}
                </div>
                <h4>RabbitMQ</h4>
                <p>
                  Document ingestion jobs, chunking queues & dead-letter
                  exchange.
                </p>
              </div>

              {/* Weaviate */}
              <div className="service-card">
                <div className="service-card-top">
                  <div className="service-icon weaviate">
                    <Layers size={18} />
                  </div>
                  {status.health.services.weaviate ? (
                    <span className="service-status-pill online">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  ) : (
                    <span className="service-status-pill offline">
                      <XCircle size={12} /> Unreachable
                    </span>
                  )}
                </div>
                <h4>Weaviate Vector DB</h4>
                <p>
                  Multi-tenant dense vectors, hybrid search & document spans.
                </p>
              </div>
            </div>
          </div>

          {/* Storage Topology & Cloud Proxy */}
          <div className="admin-card">
            <div className="card-header-row">
              <div className="header-title-group">
                <Cloud size={16} />
                <h3>Storage Driver & MinIO Cloud Proxy Topology</h3>
              </div>
              <span
                className={`badge-pill ${status.storageProxy.connected ? 'mint' : 'danger'}`}
              >
                {status.storageProxy.connected
                  ? 'Proxy Active'
                  : 'Proxy Disconnected'}
              </span>
            </div>
            <p className="modal-subtext">
              MinIO operates as the uniform S3-compatible ingress gateway,
              abstracting local disk or upstream cloud storage replication.
            </p>

            <div className="storage-topology-grid">
              <div className="topology-item">
                <span className="topology-label">Primary Driver</span>
                <strong>{status.storageProxy.driver.toUpperCase()}</strong>
              </div>
              <div className="topology-item">
                <span className="topology-label">Gateway Endpoint</span>
                <code>{status.storageProxy.proxyEndpoint}</code>
              </div>
              <div className="topology-item">
                <span className="topology-label">App Bucket</span>
                <code>{status.storageProxy.bucket}</code>
              </div>
              <div className="topology-item">
                <span className="topology-label">Upstream Cloud Provider</span>
                <span className="badge-pill sm neutral">
                  {status.storageProxy.upstreamProvider.toUpperCase()}
                </span>
              </div>
              <div className="topology-item">
                <span className="topology-label">Upstream Target Bucket</span>
                <code>
                  {status.storageProxy.upstreamBucket || 'None (Direct MinIO)'}
                </code>
              </div>
              <div className="topology-item">
                <span className="topology-label">Ingress Proxy Mode</span>
                <strong>
                  {status.storageProxy.isProxy ? 'Enabled' : 'Disabled'}
                </strong>
              </div>
            </div>
          </div>

          {/* Runtime Diagnostics */}
          <div className="admin-card">
            <div className="card-header-row">
              <div className="header-title-group">
                <Cpu size={16} />
                <h3>Node.js Process & Memory Profile</h3>
              </div>
            </div>

            <div className="runtime-metrics-grid">
              <div className="runtime-item">
                <span className="runtime-label">Process Uptime</span>
                <strong>{formatUptime(status.process.uptimeSeconds)}</strong>
              </div>
              <div className="runtime-item">
                <span className="runtime-label">Node Runtime</span>
                <code>{status.process.nodeVersion}</code>
              </div>
              <div className="runtime-item">
                <span className="runtime-label">Environment</span>
                <span className="badge-pill sm neutral">
                  {status.process.env}
                </span>
              </div>
              <div className="runtime-item">
                <span className="runtime-label">Resident Set Size (RSS)</span>
                <strong>{status.process.memoryMb.rss} MB</strong>
              </div>
              <div className="runtime-item">
                <span className="runtime-label">V8 Heap Used</span>
                <strong>{status.process.memoryMb.heapUsed} MB</strong>
              </div>
              <div className="runtime-item">
                <span className="runtime-label">V8 Heap Total</span>
                <strong>{status.process.memoryMb.heapTotal} MB</strong>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
