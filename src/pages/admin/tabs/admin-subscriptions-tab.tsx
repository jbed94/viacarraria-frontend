import {
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Download,
  Eye,
  RefreshCw,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api, triggerBlobDownload } from '../../../lib/api';
import type { AdminBillingEvent, AdminOverviewStats } from '../../../types/api';

export function AdminSubscriptionsTab() {
  const [events, setEvents] = useState<AdminBillingEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  // Grant modal
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantDays, setGrantDays] = useState(30);
  const [granting, setGranting] = useState(false);

  // Revoke modal
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeUserId, setRevokeUserId] = useState('');
  const [revoking, setRevoking] = useState(false);

  // Raw payload inspector modal
  const [inspectPayload, setInspectPayload] = useState<any | null>(null);

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadData = async (p = page) => {
    setLoading(true);
    try {
      const [eventsData, statsData] = await Promise.all([
        api.admin.subscriptionEvents({ page: p, limit }),
        api.admin.overview(),
      ]);
      setEvents(eventsData.events);
      setTotal(eventsData.pagination.total);
      setTotalPages(eventsData.pagination.totalPages);
      setPage(eventsData.pagination.page);
      setStats(statsData);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message ?? 'Failed to load subscription activity.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(1);
  }, []);

  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId.trim()) return;
    setGranting(true);
    setMessage(null);
    try {
      await api.admin.grantSubscription(grantUserId.trim(), 'PRO', grantDays);
      setGrantModalOpen(false);
      setGrantUserId('');
      setMessage({
        type: 'success',
        text: `PRO subscription successfully granted for ${grantDays} days.`,
      });
      void loadData(page);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message ?? 'Failed to grant subscription.',
      });
    } finally {
      setGranting(false);
    }
  };

  const handleRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeUserId.trim()) return;
    setRevoking(true);
    setMessage(null);
    try {
      await api.admin.revokeSubscription(revokeUserId.trim());
      setRevokeModalOpen(false);
      setRevokeUserId('');
      setMessage({
        type: 'success',
        text: 'PRO subscription revoked; account returned to Free tier.',
      });
      void loadData(page);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message ?? 'Failed to revoke subscription.',
      });
    } finally {
      setRevoking(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(format);
    try {
      const blob = await api.admin.exportSubscriptionEvents({ format });
      const date = new Date().toISOString().split('T')[0];
      triggerBlobDownload(blob, `billing-events-${date}.${format}`);
    } catch (err: any) {
      alert(
        err?.message ??
          `Failed to export subscription events as ${format.toUpperCase()}`,
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="admin-subscriptions-container">
      <div className="admin-tab-header">
        <div>
          <h2>Subscriptions & Revenue Management</h2>
          <p className="admin-tab-subtitle">
            Track Monthly Recurring Revenue ($MRR), audit payment webhooks, and
            manually grant or revoke tier entitlements.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="admin-btn secondary sm"
            disabled={exporting !== null}
            onClick={() => handleExport('csv')}
          >
            <Download
              size={14}
              className={exporting === 'csv' ? 'spinning' : ''}
            />
            <span>{exporting === 'csv' ? 'Exporting...' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            className="admin-btn secondary sm"
            disabled={exporting !== null}
            onClick={() => handleExport('json')}
          >
            <Download
              size={14}
              className={exporting === 'json' ? 'spinning' : ''}
            />
            <span>{exporting === 'json' ? 'Exporting...' : 'Export JSON'}</span>
          </button>
          <button
            type="button"
            className="admin-btn primary sm"
            onClick={() => setGrantModalOpen(true)}
          >
            <UserCheck size={14} />
            <span>Grant Pro Status</span>
          </button>
          <button
            type="button"
            className="admin-btn secondary sm"
            onClick={() => setRevokeModalOpen(true)}
          >
            <UserX size={14} />
            <span>Revoke Pro</span>
          </button>
          <button
            type="button"
            className="admin-btn secondary refresh-btn"
            onClick={() => loadData(page)}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`admin-feedback-banner ${message.type === 'success' ? 'success' : 'error'}`}
        >
          <span>{message.text}</span>
        </div>
      ) : null}

      {/* Revenue KPI Grid */}
      {stats ? (
        <div className="admin-kpi-grid">
          <div className="admin-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon revenue-icon">
                <Coins size={20} />
              </div>
              <span className="kpi-tag pro-tag">Current MRR</span>
            </div>
            <div className="kpi-metric">
              ${stats.revenue.monthlyRecurringRevenue}
            </div>
            <div className="kpi-label">Monthly Recurring Revenue</div>
            <div className="kpi-subtext">Based on active Pro subscribers</div>
          </div>

          <div className="admin-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon users-icon">
                <CreditCard size={20} />
              </div>
              <span className="kpi-tag mint">Active</span>
            </div>
            <div className="kpi-metric">
              {stats.revenue.activeSubscriptions}
            </div>
            <div className="kpi-label">Active Pro Subscribers</div>
            <div className="kpi-subtext">
              {stats.users.total > 0
                ? Math.round(
                    (stats.revenue.activeSubscriptions / stats.users.total) *
                      100,
                  )
                : 0}
              % conversion rate
            </div>
          </div>

          <div className="admin-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon requests-icon">
                <Coins size={20} />
              </div>
              <span className="kpi-tag">Standard Price</span>
            </div>
            <div className="kpi-metric">${stats.revenue.proPriceUsd}</div>
            <div className="kpi-label">Monthly Price / Seat</div>
            <div className="kpi-subtext">Unlimited graphs & high priority</div>
          </div>

          <div className="admin-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon revenue-icon">
                <Coins size={20} />
              </div>
              <span className="kpi-tag pro-tag">Lifetime</span>
            </div>
            <div className="kpi-metric">
              $
              {stats.revenue.totalRevenue ??
                stats.revenue.monthlyRecurringRevenue}
            </div>
            <div className="kpi-label">Actual Total Revenue</div>
            <div className="kpi-subtext">Aggregated billing collections</div>
          </div>
        </div>
      ) : null}

      {/* Monthly Revenue Aggregation */}
      {stats?.revenue.monthlyDistribution &&
      stats.revenue.monthlyDistribution.length > 0 ? (
        <div className="admin-card monthly-revenue-card">
          <div className="card-header-row">
            <div className="header-title-group">
              <Coins size={16} />
              <h3>Monthly Revenue Breakdown</h3>
            </div>
            <span className="card-legend">
              Aggregated across{' '}
              {stats.revenue.monthlyDistribution.reduce(
                (acc, curr) => acc + curr.eventsCount,
                0,
              )}{' '}
              paid billing events
            </span>
          </div>
          <div className="monthly-revenue-grid">
            {stats.revenue.monthlyDistribution.map((m) => {
              const maxRevenue = Math.max(
                ...stats.revenue.monthlyDistribution!.map((d) => d.revenue),
                1,
              );
              const pct = Math.min(
                Math.round((m.revenue / maxRevenue) * 100),
                100,
              );
              return (
                <div key={m.month} className="monthly-revenue-item">
                  <div className="monthly-revenue-item-header">
                    <span className="monthly-label">{m.label}</span>
                    <span className="monthly-amount">
                      ${m.revenue.toFixed(2)}
                    </span>
                  </div>
                  <div className="monthly-bar-track">
                    <div
                      className="monthly-bar-fill"
                      style={{ width: `${Math.max(pct, 6)}%` }}
                    />
                  </div>
                  <div className="monthly-revenue-item-footer">
                    <span>
                      {m.eventsCount} transaction
                      {m.eventsCount === 1 ? '' : 's'}
                    </span>
                    <span>{pct}% peak</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Billing Events Table */}
      <div className="admin-card table-card">
        <div className="card-header-row">
          <div className="header-title-group">
            <CreditCard size={16} />
            <h3>Billing & Webhook Audit Log ({total})</h3>
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Account</th>
                <th>Event Type</th>
                <th>Provider</th>
                <th>Timestamp</th>
                <th className="text-right">Payload</th>
              </tr>
            </thead>
            <tbody>
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <RefreshCw className="spinning inline mr-2" size={16} />
                    Loading billing audit log...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-table-cell">
                    No billing events recorded yet.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <code className="text-xs">{ev.id.slice(0, 16)}...</code>
                    </td>
                    <td>
                      <div className="user-name-cell">
                        <span>{ev.userName || 'Account'}</span>
                        <small className="text-muted">
                          {ev.userEmail || ev.userId}
                        </small>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge-pill ${ev.eventType.includes('pro') ? 'pro' : 'neutral'}`}
                      >
                        {ev.eventType}
                      </span>
                    </td>
                    <td>
                      <span className="provider-pill">{ev.provider}</span>
                    </td>
                    <td>
                      <span className="text-xs text-muted">
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="action-btn"
                        title="Inspect JSON Payload"
                        onClick={() => setInspectPayload(ev.payload)}
                      >
                        <Eye size={14} />
                      </button>
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
            Showing {events.length} of {total} events (Page {page} of{' '}
            {totalPages})
          </span>
          <div className="pagination-buttons">
            <button
              type="button"
              className="admin-btn secondary sm"
              disabled={page <= 1 || loading}
              onClick={() => loadData(page - 1)}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <button
              type="button"
              className="admin-btn secondary sm"
              disabled={page >= totalPages || loading}
              onClick={() => loadData(page + 1)}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Grant Pro Modal */}
      {grantModalOpen ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setGrantModalOpen(false)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleGrantSubmit}>
              <div className="admin-modal-header">
                <div className="header-title-group">
                  <UserCheck size={18} />
                  <h3>Grant Pro Subscription</h3>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setGrantModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label htmlFor="grant-user-id">Target User ID</label>
                  <input
                    id="grant-user-id"
                    type="text"
                    required
                    placeholder="Enter user UUID..."
                    value={grantUserId}
                    onChange={(e) => setGrantUserId(e.target.value)}
                    autoFocus
                  />
                  <small className="form-hint">
                    You can copy user IDs from the Users tab.
                  </small>
                </div>
                <div className="admin-form-group">
                  <label htmlFor="grant-duration-days">Duration (Days)</label>
                  <select
                    id="grant-duration-days"
                    value={grantDays}
                    onChange={(e) => setGrantDays(Number(e.target.value))}
                  >
                    <option value={7}>7 Days (Trial)</option>
                    <option value={30}>30 Days (1 Month)</option>
                    <option value={90}>90 Days (Quarterly)</option>
                    <option value={365}>365 Days (Annual)</option>
                    <option value={3650}>3650 Days (Lifetime)</option>
                  </select>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => setGrantModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn primary"
                  disabled={granting}
                >
                  {granting ? 'Granting...' : 'Grant Pro Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Revoke Pro Modal */}
      {revokeModalOpen ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setRevokeModalOpen(false)}
        >
          <div
            className="admin-modal-card danger-card"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleRevokeSubmit}>
              <div className="admin-modal-header">
                <div className="header-title-group text-danger">
                  <UserX size={18} />
                  <h3>Revoke Pro Subscription</h3>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setRevokeModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label htmlFor="revoke-user-id">Target User ID</label>
                  <input
                    id="revoke-user-id"
                    type="text"
                    required
                    placeholder="Enter user UUID to revert to Free..."
                    value={revokeUserId}
                    onChange={(e) => setRevokeUserId(e.target.value)}
                    autoFocus
                  />
                </div>
                <p className="modal-subtext">
                  This user will immediately be demoted to the FREE tier with
                  standard limits.
                </p>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => setRevokeModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn danger"
                  disabled={revoking}
                >
                  {revoking ? 'Revoking...' : 'Revoke Pro Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Inspect JSON Payload Modal */}
      {inspectPayload ? (
        <div
          className="admin-modal-overlay"
          onClick={() => setInspectPayload(null)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div className="header-title-group">
                <CreditCard size={18} />
                <h3>Event Payload JSON</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setInspectPayload(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <pre className="code-block-display">
                {JSON.stringify(inspectPayload, null, 2)}
              </pre>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setInspectPayload(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
