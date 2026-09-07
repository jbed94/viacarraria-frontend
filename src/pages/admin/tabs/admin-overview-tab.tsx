import {
  Activity,
  Archive,
  ArrowUpRight,
  Clock,
  Coins,
  CreditCard,
  HardDrive,
  Layers,
  Network,
  RefreshCw,
  Server,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import type { AdminOverviewStats } from '../../../types/api';

type AdminOverviewTabProps = {
  onNavigateTab: (tab: string) => void;
};

export function AdminOverviewTab({ onNavigateTab }: AdminOverviewTabProps) {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.overview();
      setStats(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load administrative statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  };

  if (loading && !stats) {
    return (
      <div className="admin-tab-loading">
        <RefreshCw className="spinning" size={24} />
        <span>Loading analytics dashboard...</span>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="admin-tab-error">
        <p>{error}</p>
        <button type="button" className="admin-btn primary" onClick={loadStats}>
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const maxHourlyCount = Math.max(
    1,
    ...stats.requests.hourlyDistribution.map((h) => h.count),
  );

  return (
    <div className="admin-overview-container">
      <div className="admin-tab-header">
        <div>
          <h2>System Analytics & Overview</h2>
          <p className="admin-tab-subtitle">
            Real-time telemetry, revenue metrics, query velocity, and storage
            footprint.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn secondary refresh-btn"
          onClick={loadStats}
          title="Refresh statistics"
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="admin-kpi-grid">
        {/* Total Users */}
        <div
          className="admin-kpi-card"
          onClick={() => onNavigateTab('users')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <div className="kpi-icon users-icon">
              <Users size={20} />
            </div>
            <span className="kpi-tag positive">
              +{stats.users.newLast30Days} in 30d
            </span>
          </div>
          <div className="kpi-metric">{stats.users.total}</div>
          <div className="kpi-label">Registered Accounts</div>
          <div className="kpi-subtext">
            <span>{stats.users.free} Free</span>
            <span className="dot">•</span>
            <span>{stats.users.pro} Pro</span>
            <span className="dot">•</span>
            <span>{stats.users.anonymous} Anon</span>
          </div>
        </div>

        {/* Monthly Revenue (MRR) */}
        <div
          className="admin-kpi-card"
          onClick={() => onNavigateTab('subscriptions')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <div className="kpi-icon revenue-icon">
              <Coins size={20} />
            </div>
            <span className="kpi-tag pro-tag">
              ${stats.revenue.proPriceUsd}/mo Tier
            </span>
          </div>
          <div className="kpi-metric">
            ${stats.revenue.monthlyRecurringRevenue}
          </div>
          <div className="kpi-label">Monthly Recurring Revenue (MRR)</div>
          <div className="kpi-subtext">
            <span>{stats.revenue.activeSubscriptions} Active Pro Seats</span>
          </div>
        </div>

        {/* Requests / Query Velocity */}
        <div className="admin-kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon requests-icon">
              <Activity size={20} />
            </div>
            <span className="kpi-tag">
              {stats.requests.currentRequestsPerHour}/hr Live
            </span>
          </div>
          <div className="kpi-metric">
            {stats.requests.avgRequestsPerHour}{' '}
            <span className="kpi-unit">req/hr</span>
          </div>
          <div className="kpi-label">24h Average Velocity</div>
          <div className="kpi-subtext">
            <span>{stats.requests.queriesLast24Hours} queries past 24h</span>
            <span className="dot">•</span>
            <span>{stats.requests.totalQueries} all-time</span>
          </div>
        </div>

        {/* Knowledge Graphs */}
        <div
          className="admin-kpi-card"
          onClick={() => onNavigateTab('graphs')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <div className="kpi-icon graphs-icon">
              <Network size={20} />
            </div>
            <span className="kpi-tag">
              {stats.graphs.public} Public / {stats.graphs.private} Private
            </span>
          </div>
          <div className="kpi-metric">{stats.graphs.total}</div>
          <div className="kpi-label">Total Knowledge Graphs</div>
          <div className="kpi-subtext">
            <span className="text-mint">{stats.graphs.active} Active</span>
            <span className="dot">•</span>
            <span className="text-amber">{stats.graphs.inactive} Inactive</span>
            {stats.graphs.scheduledForDeletion > 0 ? (
              <>
                <span className="dot">•</span>
                <span className="text-danger">
                  {stats.graphs.scheduledForDeletion} Scheduled Purge
                </span>
              </>
            ) : null}
          </div>
        </div>

        {/* Storage Footprint */}
        <div
          className="admin-kpi-card"
          onClick={() => onNavigateTab('retention')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <div className="kpi-icon storage-icon">
              <HardDrive size={20} />
            </div>
            <span className="kpi-tag">{stats.storage.totalSources} Docs</span>
          </div>
          <div className="kpi-metric">
            {formatBytes(stats.storage.totalStorageBytes)}
          </div>
          <div className="kpi-label">Primary Object Storage</div>
          <div className="kpi-subtext">
            <span>{stats.storage.archivesCount} Cold Archives</span>
            <span className="dot">•</span>
            <span>
              {formatBytes(stats.storage.archivesBytes)} GZ Compressed
            </span>
          </div>
        </div>
      </div>

      {/* 24-Hour Velocity Distribution Chart */}
      <div className="admin-card hourly-chart-card">
        <div className="card-header-row">
          <div className="header-title-group">
            <Clock size={16} />
            <h3>24-Hour Hourly Search & Retrieval Velocity</h3>
          </div>
          <span className="card-legend">
            Peak: {maxHourlyCount} req/hr • Total:{' '}
            {stats.requests.queriesLast24Hours} reqs
          </span>
        </div>
        <div className="hourly-bars-container">
          {stats.requests.hourlyDistribution.length > 0 ? (
            stats.requests.hourlyDistribution.map((item) => {
              const heightPercent = Math.max(
                6,
                Math.round((item.count / maxHourlyCount) * 100),
              );
              const parsedDate = new Date(item.hour);
              const hourLabel = Number.isNaN(parsedDate.getTime())
                ? item.hour
                : parsedDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
              return (
                <div key={item.hour} className="hourly-bar-col">
                  <div
                    className="hourly-bar-fill"
                    style={{ height: `${heightPercent}%` }}
                    title={`${hourLabel}: ${item.count} queries`}
                  >
                    <span className="hourly-bar-tooltip">{item.count}</span>
                  </div>
                  <span className="hourly-bar-label">{hourLabel}</span>
                </div>
              );
            })
          ) : (
            <div className="empty-chart-notice">
              <span>No query events recorded in the past 24 hours.</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Shortcuts & Recent Events */}
      <div className="admin-two-col-grid">
        {/* Quick Management Shortcuts */}
        <div className="admin-card">
          <div className="card-header-row">
            <div className="header-title-group">
              <Layers size={16} />
              <h3>Administrative Shortcuts</h3>
            </div>
          </div>
          <div className="shortcuts-list">
            <button
              type="button"
              className="shortcut-item"
              onClick={() => onNavigateTab('users')}
            >
              <div className="shortcut-icon users">
                <Users size={16} />
              </div>
              <div className="shortcut-info">
                <strong>Manage Accounts & Tiers</strong>
                <span>Grant Pro status, extend subscriptions, view quotas</span>
              </div>
              <ArrowUpRight size={16} className="shortcut-arrow" />
            </button>

            <button
              type="button"
              className="shortcut-item"
              onClick={() => onNavigateTab('graphs')}
            >
              <div className="shortcut-icon graphs">
                <Network size={16} />
              </div>
              <div className="shortcut-info">
                <strong>Knowledge Graphs Registry</strong>
                <span>
                  Modify any graph metadata, canvas nodes, and visibility
                </span>
              </div>
              <ArrowUpRight size={16} className="shortcut-arrow" />
            </button>

            <button
              type="button"
              className="shortcut-item"
              onClick={() => onNavigateTab('retention')}
            >
              <div className="shortcut-icon retention">
                <Archive size={16} />
              </div>
              <div className="shortcut-info">
                <strong>Retention & Cold Storage</strong>
                <span>
                  Execute dry-run sweeps, inspect archives, restore graphs
                </span>
              </div>
              <ArrowUpRight size={16} className="shortcut-arrow" />
            </button>

            <button
              type="button"
              className="shortcut-item"
              onClick={() => onNavigateTab('system')}
            >
              <div className="shortcut-icon system">
                <Server size={16} />
              </div>
              <div className="shortcut-info">
                <strong>Infrastructure Health & Proxy</strong>
                <span>
                  Inspect Weaviate, Redis, MinIO S3/GCP proxy topology
                </span>
              </div>
              <ArrowUpRight size={16} className="shortcut-arrow" />
            </button>
          </div>
        </div>

        {/* Recent Billing Events */}
        <div className="admin-card">
          <div className="card-header-row">
            <div className="header-title-group">
              <CreditCard size={16} />
              <h3>Recent Billing & Subscription Activity</h3>
            </div>
            <button
              type="button"
              className="admin-link-btn"
              onClick={() => onNavigateTab('subscriptions')}
            >
              View all
            </button>
          </div>
          <div className="events-stream-list">
            {stats.revenue.recentEvents.length > 0 ? (
              stats.revenue.recentEvents.map((ev) => (
                <div key={ev.id} className="billing-event-row">
                  <div className="event-badge-cell">
                    <span
                      className={`event-tag ${ev.eventType.includes('pro') ? 'pro' : ''}`}
                    >
                      {ev.eventType}
                    </span>
                  </div>
                  <div className="event-meta-cell">
                    <span className="event-user">
                      User: {ev.userId.slice(0, 8)}...
                    </span>
                    <span className="event-provider">{ev.provider}</span>
                  </div>
                  <span className="event-time">
                    {new Date(ev.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="empty-subtext">No billing events recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
