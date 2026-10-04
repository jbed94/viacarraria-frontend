import {
  Activity,
  Archive,
  ArrowUpRight,
  Clock,
  DollarSign,
  Eye,
  HardDrive,
  Layers,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import type {
  AdAnalyticsSummary,
  AdminOverviewStats,
  TelemetryDateRange,
} from '../../../types/api';

type AdminOverviewTabProps = {
  onNavigateTab: (tab: string) => void;
};

export function AdminOverviewTab({ onNavigateTab }: AdminOverviewTabProps) {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [adAnalytics, setAdAnalytics] = useState<AdAnalyticsSummary | null>(
    null,
  );
  const [adRange, setAdRange] = useState<TelemetryDateRange>('30d');
  const [adLoading, setAdLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async (range: TelemetryDateRange = adRange) => {
    setLoading(true);
    setError(null);
    try {
      const [data, adsData] = await Promise.all([
        api.admin.overview(),
        api.ads?.getAnalytics
          ? api.ads.getAnalytics(range).catch(() => null)
          : Promise.resolve(null),
      ]);
      setStats(data);
      if (adsData) {
        setAdAnalytics(adsData);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load administrative statistics.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdRangeChange = async (range: TelemetryDateRange) => {
    setAdRange(range);
    setAdLoading(true);
    try {
      const adsData = api.ads?.getAnalytics
        ? await api.ads.getAnalytics(range)
        : null;
      if (adsData) {
        setAdAnalytics(adsData);
      }
    } catch {
      // Ignore
    } finally {
      setAdLoading(false);
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

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const remainingSecs = Math.round(seconds % 60);
    if (mins < 60) {
      return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins}m`;
    }
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
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
        <button
          type="button"
          className="admin-btn primary"
          onClick={() => void loadStats()}
        >
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
            Real-time telemetry, similarity queue status, query velocity, and
            storage footprint.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn secondary refresh-btn"
          onClick={() => void loadStats()}
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
            <span>
              {stats.users.registered ?? stats.users.free ?? 0} Registered
            </span>
            <span className="dot">•</span>
            <span>{stats.users.anonymous} Anonymous</span>
          </div>
        </div>

        {/* Similarity Search Quota & Queue */}
        <div
          className="admin-kpi-card"
          onClick={() => onNavigateTab('settings')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-top">
            <div className="kpi-icon requests-icon">
              <Zap size={20} />
            </div>
            <span
              className={`kpi-tag ${
                stats.similarityQueue?.occupation === 'high'
                  ? 'text-danger'
                  : stats.similarityQueue?.occupation === 'mid'
                    ? 'text-amber'
                    : 'positive'
              }`}
            >
              Queue:{' '}
              {String(stats.similarityQueue?.occupation ?? 'low').toUpperCase()}
            </span>
          </div>
          <div className="kpi-metric">
            {stats.similarityQueue?.registeredThroughputPerMinute ?? 120}{' '}
            <span className="kpi-unit">
              / {stats.similarityQueue?.anonymousThroughputPerMinute ?? 30}{' '}
              ops/min
            </span>
          </div>
          <div className="kpi-label">Similarity Search Quota</div>
          <div className="kpi-subtext">
            <span>
              Registered:{' '}
              {stats.similarityQueue?.registeredThroughputPerMinute ?? 120}/m
            </span>
            <span className="dot">•</span>
            <span>
              Anon: {stats.similarityQueue?.anonymousThroughputPerMinute ?? 30}
              /m
            </span>
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

        {/* Ad Revenue (Sole Monetization Stream) */}
        <div className="admin-kpi-card ad-revenue-card">
          <div className="kpi-top">
            <div className="kpi-icon revenue-icon">
              <DollarSign size={20} />
            </div>
            <span className="kpi-tag positive">
              ${adAnalytics?.estimatedRevenueUsd?.toFixed(2) ?? '0.00'} Est.
            </span>
          </div>
          <div className="kpi-metric">
            ${adAnalytics?.estimatedRevenueUsd?.toFixed(2) ?? '0.00'}
          </div>
          <div className="kpi-label">Ad Revenue ({adRange})</div>
          <div className="kpi-subtext">
            <span>
              {adAnalytics?.totalImpressions?.toLocaleString() ?? 0} Impressions
            </span>
            <span className="dot">•</span>
            <span>eCPM ${adAnalytics?.effectiveEcpm ?? 1.5}</span>
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

      {/* Ad Revenue Intelligence & Top Knowledge Graphs */}
      <div className="admin-card ad-revenue-dashboard-card">
        <div className="admin-card-header">
          <div className="admin-card-title-group">
            <div className="kpi-icon revenue-icon">
              <DollarSign size={20} />
            </div>
            <div>
              <h3>Ad Revenue Intelligence & Top Knowledge Graphs</h3>
              <p className="admin-card-subtitle">
                Real-time telemetry, GDPR consent breakdown, and top earning
                knowledge graphs (Sole Revenue Stream).
              </p>
            </div>
          </div>
          <div className="admin-card-header-actions">
            <div
              className="ad-range-pill-group"
              role="group"
              aria-label="Date range"
            >
              {(['7d', '30d', '90d', 'all'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`ad-range-pill ${adRange === r ? 'active' : ''}`}
                  onClick={() => void handleAdRangeChange(r)}
                  disabled={adLoading}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ad Metrics Grid */}
        <div className="ad-metrics-row">
          <div className="ad-metric-box">
            <div className="ad-metric-label">
              <DollarSign size={13} className="text-amber" />
              <span>Estimated Ad Revenue</span>
            </div>
            <div className="ad-metric-value text-mint">
              ${adAnalytics?.estimatedRevenueUsd?.toFixed(2) ?? '0.00'}
            </div>
            <div className="ad-metric-subtext">
              eCPM ${adAnalytics?.effectiveEcpm ?? 1.5} per 1k impressions
            </div>
          </div>

          <div className="ad-metric-box">
            <div className="ad-metric-label">
              <Eye size={13} className="text-mint" />
              <span>Active Viewability</span>
            </div>
            <div className="ad-metric-value">
              {adAnalytics?.averageViewabilitySeconds ?? 0}s
            </div>
            <div className="ad-metric-subtext">
              Total{' '}
              {formatDuration(adAnalytics?.totalActiveViewableSeconds ?? 0)}{' '}
              in-view
            </div>
          </div>

          <div className="ad-metric-box">
            <div className="ad-metric-label">
              <Activity size={13} className="text-extended" />
              <span>Total Ad Impressions</span>
            </div>
            <div className="ad-metric-value">
              {adAnalytics?.totalImpressions ?? 0}
            </div>
            <div className="ad-metric-subtext">
              {adAnalytics?.totalRefreshes ?? 0} compliant 30s refreshes
            </div>
          </div>

          <div className="ad-metric-box">
            <div className="ad-metric-label">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>GDPR Consent Status</span>
            </div>
            <div className="ad-metric-value">
              {adAnalytics?.consentBreakdown?.personalized ?? 0}
            </div>
            <div className="ad-metric-subtext">
              {adAnalytics?.consentBreakdown?.contextual ?? 0} contextual •{' '}
              {adAnalytics?.consentBreakdown?.declined ?? 0} denied
            </div>
          </div>

          <div className="ad-metric-box">
            <div className="ad-metric-label">
              <Zap size={13} className="text-amber-500" />
              <span>Occlusion Culling Savings</span>
            </div>
            <div className="ad-metric-value">
              {adAnalytics?.gpuSavingsPercentage ?? 0}%
            </div>
            <div className="ad-metric-subtext">
              {adAnalytics?.totalCulled ?? 0} offscreen ads culled
            </div>
          </div>
        </div>

        {/* Top Graphs Leaderboard Table */}
        <div className="top-graphs-section">
          <div className="top-graphs-title">
            <h4>
              <Trophy size={16} className="text-amber" />
              <span>Top Knowledge Graphs by Ad Revenue</span>
            </h4>
            <span className="card-legend">
              Ranked by impression volume & active canvas viewability
            </span>
          </div>

          {adAnalytics?.topGraphs && adAnalytics.topGraphs.length > 0 ? (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '48px' }}>#</th>
                    <th>Knowledge Graph</th>
                    <th>Visibility</th>
                    <th className="text-right">Impressions</th>
                    <th className="text-right">Viewable Time</th>
                    <th className="text-right">Est. Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {adAnalytics.topGraphs.map((g, idx) => (
                    <tr key={g.graphId}>
                      <td>
                        <span className={`rank-badge rank-${idx + 1}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <Network size={15} className="text-muted" />
                          <strong>{g.graphName}</strong>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`kpi-tag sm ${g.isPublic ? 'positive' : ''}`}
                        >
                          {g.isPublic ? 'Public' : 'Private'}
                        </span>
                      </td>
                      <td className="text-right">
                        {g.impressions.toLocaleString()}
                      </td>
                      <td className="text-right">
                        {formatDuration(g.activeViewableSeconds)}
                      </td>
                      <td className="text-right revenue-text-highlight">
                        ${g.estimatedRevenueUsd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-chart-notice" style={{ padding: '24px 0' }}>
              <span>
                No ad impressions attributed to knowledge graphs yet in this
                date range. Impressions will appear as users browse canvases.
              </span>
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
                <span>Adjust storage limits, view quotas, audit accounts</span>
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

        {/* Similarity Search Queue & Storage Summary */}
        <div className="admin-card">
          <div className="card-header-row">
            <div className="header-title-group">
              <HardDrive size={16} />
              <h3>Similarity Queue & Storage Quota</h3>
            </div>
            <button
              type="button"
              className="admin-link-btn"
              onClick={() => onNavigateTab('settings')}
            >
              Configure
            </button>
          </div>
          <div className="events-stream-list">
            <div className="billing-event-row">
              <div className="event-meta-cell">
                <strong>Default User Storage Limit</strong>
                <span className="event-provider">
                  Per-user source document storage
                </span>
              </div>
              <span className="kpi-tag positive">
                {stats.storageQuota.defaultStorageLimitMb} MB
              </span>
            </div>
            <div className="billing-event-row">
              <div className="event-meta-cell">
                <strong>Total Sources Tracked</strong>
                <span className="event-provider">
                  Indexed in object storage
                </span>
              </div>
              <span className="kpi-tag">
                {stats.storageQuota.totalSources} files
              </span>
            </div>
            <div className="billing-event-row">
              <div className="event-meta-cell">
                <strong>Total Storage Consumed</strong>
                <span className="event-provider">Raw source document size</span>
              </div>
              <span className="kpi-tag">
                {formatBytes(stats.storageQuota.totalStorageBytes)}
              </span>
            </div>
            <div className="billing-event-row">
              <div className="event-meta-cell">
                <strong>Similarity Quota Queue</strong>
                <span className="event-provider">Global postponing status</span>
              </div>
              <span
                className={`kpi-tag ${
                  stats.similarityQueue.occupation === 'high'
                    ? 'text-danger'
                    : stats.similarityQueue.occupation === 'mid'
                      ? 'text-amber'
                      : 'positive'
                }`}
              >
                {String(stats.similarityQueue.occupation).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
