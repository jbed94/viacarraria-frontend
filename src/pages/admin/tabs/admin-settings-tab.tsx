import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Save,
  Shield,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import type {
  AdminSystemSettings,
  UpdateAdminSystemSettingsDto,
} from '../../../types/api';

export function AdminSettingsTab() {
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [retentionDays, setRetentionDays] = useState(90);
  const [retentionGraceDays, setRetentionGraceDays] = useState(7);
  const [freeMaxNodes, setFreeMaxNodes] = useState(100);
  const [freeMaxSources, setFreeMaxSources] = useState(5);
  const [freeMaxSourceMb, setFreeMaxSourceMb] = useState(25);
  const [proMaxNodes, setProMaxNodes] = useState(5000);
  const [proMaxSources, setProMaxSources] = useState(50);
  const [proMaxSourceMb, setProMaxSourceMb] = useState(100);
  const [anonymousRateLimit, setAnonymousRateLimit] = useState(30);
  const [authenticatedRateLimit, setAuthenticatedRateLimit] = useState(120);
  const [burstMultiplier, setBurstMultiplier] = useState(2);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowedIpsText, setAllowedIpsText] = useState('127.0.0.1, ::1');
  const [exemptUserIdsText, setExemptUserIdsText] = useState('');
  const [exemptRolesText, setExemptRolesText] = useState('admin');

  const populateForm = (data: AdminSystemSettings) => {
    setSettings(data);
    setRetentionDays(data.retentionDays);
    setRetentionGraceDays(data.retentionGraceDays);
    setFreeMaxNodes(data.freeTierLimits.maxNodes);
    setFreeMaxSources(data.freeTierLimits.maxSourcesPerGraph);
    setFreeMaxSourceMb(
      Math.round(data.freeTierLimits.maxSourceSizeBytes / (1024 * 1024)),
    );
    setProMaxNodes(data.proTierLimits.maxNodes);
    setProMaxSources(data.proTierLimits.maxSourcesPerGraph);
    setProMaxSourceMb(
      Math.round(data.proTierLimits.maxSourceSizeBytes / (1024 * 1024)),
    );
    setAnonymousRateLimit(data.rateLimits.anonymousPerMinute);
    setAuthenticatedRateLimit(data.rateLimits.authenticatedPerMinute);
    setBurstMultiplier(data.rateLimits.burstMultiplier);
    setMaintenanceMode(data.maintenanceMode);
    setAllowedIpsText(
      (data.maintenanceExemptions?.allowedIps ?? ['127.0.0.1', '::1']).join(
        ', ',
      ),
    );
    setExemptUserIdsText(
      (data.maintenanceExemptions?.exemptUserIds ?? []).join(', '),
    );
    setExemptRolesText(
      (data.maintenanceExemptions?.exemptRoles ?? ['admin']).join(', '),
    );
  };

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.getSettings();
      populateForm(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load system configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const parseList = (raw: string) =>
      raw
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const payload: UpdateAdminSystemSettingsDto = {
      retentionDays: Number(retentionDays),
      retentionGraceDays: Number(retentionGraceDays),
      freeTierLimits: {
        maxNodes: Number(freeMaxNodes),
        maxSourcesPerGraph: Number(freeMaxSources),
        maxSourceSizeBytes: Number(freeMaxSourceMb) * 1024 * 1024,
      },
      proTierLimits: {
        maxNodes: Number(proMaxNodes),
        maxSourcesPerGraph: Number(proMaxSources),
        maxSourceSizeBytes: Number(proMaxSourceMb) * 1024 * 1024,
      },
      rateLimits: {
        anonymousPerMinute: Number(anonymousRateLimit),
        authenticatedPerMinute: Number(authenticatedRateLimit),
        burstMultiplier: Number(burstMultiplier),
      },
      maintenanceMode,
      maintenanceExemptions: {
        allowedIps: parseList(allowedIpsText),
        exemptUserIds: parseList(exemptUserIdsText),
        exemptRoles: parseList(exemptRolesText),
      },
    };

    try {
      const updated = await api.admin.updateSettings(payload);
      populateForm(updated);
      setSuccessMessage(
        'System configuration updated and propagated to active services.',
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update system configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setRetentionDays(90);
    setRetentionGraceDays(7);
    setFreeMaxNodes(100);
    setFreeMaxSources(5);
    setFreeMaxSourceMb(25);
    setProMaxNodes(5000);
    setProMaxSources(50);
    setProMaxSourceMb(100);
    setAnonymousRateLimit(30);
    setAuthenticatedRateLimit(120);
    setBurstMultiplier(2);
    setMaintenanceMode(false);
    setAllowedIpsText('127.0.0.1, ::1');
    setExemptUserIdsText('');
    setExemptRolesText('admin');
  };

  if (loading && !settings) {
    return (
      <div className="admin-tab-loading">
        <RefreshCw className="spinning" size={24} />
        <span>Loading system configuration...</span>
      </div>
    );
  }

  return (
    <div className="admin-tab-container admin-settings-container">
      {/* Header */}
      <div className="admin-tab-header">
        <div>
          <h2>System Configuration & Limits</h2>
          <p>
            Dynamically adjust data retention policies, tier quotas, and cluster
            rate limits in real time without container redeployment.
          </p>
        </div>
        <div className="admin-tab-header-actions">
          <button
            type="button"
            className="admin-btn secondary"
            onClick={handleResetDefaults}
            disabled={saving}
          >
            Reset Form
          </button>
          <button
            type="submit"
            form="admin-settings-form"
            className="admin-btn primary"
            disabled={saving}
          >
            {saving ? (
              <RefreshCw className="spinning" size={14} />
            ) : (
              <Save size={14} />
            )}
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="admin-error-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="admin-success-banner">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {maintenanceMode && (
        <div className="admin-maintenance-banner">
          <AlertTriangle size={20} />
          <div>
            <strong>Maintenance Mode Active</strong>
            <p>
              Non-admin write traffic and graph modifications are currently
              restricted cluster-wide.
            </p>
          </div>
        </div>
      )}

      <form id="admin-settings-form" onSubmit={handleSave}>
        <div className="admin-settings-grid">
          {/* Section 1: Retention & Lifecycle */}
          <div className="admin-card settings-section">
            <div className="settings-section-header">
              <Clock className="settings-section-icon" size={20} />
              <div>
                <h3>Graph Lifecycle & Cold Storage Retention</h3>
                <p>
                  Controls graph inactivity expiration and soft deletion grace
                  windows.
                </p>
              </div>
            </div>

            <div className="settings-field-group">
              <div className="settings-field">
                <label htmlFor="retention-days">
                  Inactivity Expiration (Days)
                </label>
                <div className="settings-input-wrapper">
                  <input
                    id="retention-days"
                    type="number"
                    min="1"
                    max="730"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    required
                  />
                  <span className="unit-label">days</span>
                </div>
                <small>
                  Graphs without activity exceeding this threshold are flagged
                  for deletion.
                </small>
              </div>

              <div className="settings-field">
                <label htmlFor="retention-grace-days">
                  Deletion Grace Period (Days)
                </label>
                <div className="settings-input-wrapper">
                  <input
                    id="retention-grace-days"
                    type="number"
                    min="0"
                    max="60"
                    value={retentionGraceDays}
                    onChange={(e) =>
                      setRetentionGraceDays(Number(e.target.value))
                    }
                    required
                  />
                  <span className="unit-label">days</span>
                </div>
                <small>
                  Time granted to users after notice before permanent storage
                  purge.
                </small>
              </div>
            </div>
          </div>

          {/* Section 2: Dynamic Rate Limiting */}
          <div className="admin-card settings-section">
            <div className="settings-section-header">
              <Zap className="settings-section-icon" size={20} />
              <div>
                <h3>Distributed Rate Limiting & Anti-Abuse</h3>
                <p>
                  Active thresholds enforced across API gateways and search
                  endpoints via Redis.
                </p>
              </div>
            </div>

            <div className="settings-field-group">
              <div className="settings-field">
                <label htmlFor="anon-rate-limit">
                  Anonymous IP Requests / Min
                </label>
                <div className="settings-input-wrapper">
                  <input
                    id="anon-rate-limit"
                    type="number"
                    min="5"
                    max="600"
                    value={anonymousRateLimit}
                    onChange={(e) =>
                      setAnonymousRateLimit(Number(e.target.value))
                    }
                    required
                  />
                  <span className="unit-label">req/min</span>
                </div>
                <small>
                  Sliding window ceiling for unauthenticated guest sessions.
                </small>
              </div>

              <div className="settings-field">
                <label htmlFor="auth-rate-limit">
                  Authenticated User Requests / Min
                </label>
                <div className="settings-input-wrapper">
                  <input
                    id="auth-rate-limit"
                    type="number"
                    min="20"
                    max="3000"
                    value={authenticatedRateLimit}
                    onChange={(e) =>
                      setAuthenticatedRateLimit(Number(e.target.value))
                    }
                    required
                  />
                  <span className="unit-label">req/min</span>
                </div>
                <small>
                  Standard API request capacity for signed-in accounts.
                </small>
              </div>

              <div className="settings-field">
                <label htmlFor="burst-multiplier">Burst Surge Multiplier</label>
                <div className="settings-input-wrapper">
                  <input
                    id="burst-multiplier"
                    type="number"
                    min="1"
                    max="5"
                    value={burstMultiplier}
                    onChange={(e) => setBurstMultiplier(Number(e.target.value))}
                    required
                  />
                  <span className="unit-label">x</span>
                </div>
                <small>
                  Short-term burst capacity multiplier permitted during heavy
                  canvas operations.
                </small>
              </div>
            </div>
          </div>

          {/* Section 3: Free vs Pro Tier Limits */}
          <div className="admin-card settings-section full-width">
            <div className="settings-section-header">
              <Layers className="settings-section-icon" size={20} />
              <div>
                <h3>Subscription Quotas & Resource Boundaries</h3>
                <p>
                  Defines canvas node limits, source attachments, and single
                  upload ceilings per tier.
                </p>
              </div>
            </div>

            <div className="tier-quota-columns">
              <div className="tier-quota-card free-tier">
                <div className="tier-quota-header">
                  <span className="tier-badge free">FREE TIER</span>
                  <h4>Free Accounts Quota</h4>
                </div>

                <div className="settings-field">
                  <label htmlFor="free-max-nodes">Max Nodes per Graph</label>
                  <input
                    id="free-max-nodes"
                    type="number"
                    min="10"
                    max="1000"
                    value={freeMaxNodes}
                    onChange={(e) => setFreeMaxNodes(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="free-max-sources">
                    Max Sources per Graph
                  </label>
                  <input
                    id="free-max-sources"
                    type="number"
                    min="1"
                    max="20"
                    value={freeMaxSources}
                    onChange={(e) => setFreeMaxSources(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="free-max-size">
                    Max Single Source File Size (MB)
                  </label>
                  <div className="settings-input-wrapper">
                    <input
                      id="free-max-size"
                      type="number"
                      min="1"
                      max="100"
                      value={freeMaxSourceMb}
                      onChange={(e) =>
                        setFreeMaxSourceMb(Number(e.target.value))
                      }
                      required
                    />
                    <span className="unit-label">MB</span>
                  </div>
                </div>
              </div>

              <div className="tier-quota-card pro-tier">
                <div className="tier-quota-header">
                  <span className="tier-badge pro">PRO TIER</span>
                  <h4>Pro Accounts Quota</h4>
                </div>

                <div className="settings-field">
                  <label htmlFor="pro-max-nodes">Max Nodes per Graph</label>
                  <input
                    id="pro-max-nodes"
                    type="number"
                    min="500"
                    max="50000"
                    value={proMaxNodes}
                    onChange={(e) => setProMaxNodes(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="pro-max-sources">Max Sources per Graph</label>
                  <input
                    id="pro-max-sources"
                    type="number"
                    min="5"
                    max="200"
                    value={proMaxSources}
                    onChange={(e) => setProMaxSources(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="settings-field">
                  <label htmlFor="pro-max-size">
                    Max Single Source File Size (MB)
                  </label>
                  <div className="settings-input-wrapper">
                    <input
                      id="pro-max-size"
                      type="number"
                      min="10"
                      max="1000"
                      value={proMaxSourceMb}
                      onChange={(e) =>
                        setProMaxSourceMb(Number(e.target.value))
                      }
                      required
                    />
                    <span className="unit-label">MB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Maintenance Operations */}
          <div className="admin-card settings-section full-width">
            <div className="settings-section-header">
              <Shield className="settings-section-icon" size={20} />
              <div>
                <h3>Emergency Controls & Global Maintenance</h3>
                <p>
                  Put the cluster into maintenance mode to halt incoming user
                  writes during migrations.
                </p>
              </div>
            </div>

            <div className="maintenance-toggle-row">
              <div className="maintenance-info">
                <strong>Global Maintenance Mode</strong>
                <p>
                  When enabled, all public write operations (graph saves, source
                  uploads, parsing jobs) are rejected with HTTP 503 while
                  administrators maintain full read/write access.
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  aria-label="Toggle Maintenance Mode"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                />
                <span className="slider round" />
              </label>
            </div>

            <div className="maintenance-exemptions-card">
              <h4>Granular Maintenance Exemptions</h4>
              <p className="maintenance-exemptions-hint">
                Traffic originating from matching IP CIDR ranges, or
                authenticated users matching the IDs or roles below, will bypass
                the 503 maintenance mode barrier.
              </p>

              <div className="settings-field">
                <label htmlFor="allowed-ips">
                  Allowed IP Addresses / CIDR Subnets (comma-separated)
                </label>
                <input
                  id="allowed-ips"
                  type="text"
                  placeholder="127.0.0.1, 10.0.0.0/8, 192.168.1.0/24"
                  value={allowedIpsText}
                  onChange={(e) => setAllowedIpsText(e.target.value)}
                />
                <small className="settings-hint">
                  Supports exact IPv4/IPv6 addresses and CIDR subnets (e.g.
                  10.0.0.0/8).
                </small>
              </div>

              <div className="settings-field">
                <label htmlFor="exempt-user-ids">
                  Exempt User IDs (comma-separated)
                </label>
                <input
                  id="exempt-user-ids"
                  type="text"
                  placeholder="usr_123, usr_456"
                  value={exemptUserIdsText}
                  onChange={(e) => setExemptUserIdsText(e.target.value)}
                />
                <small className="settings-hint">
                  Specific user accounts permitted to write to graphs and test
                  during maintenance.
                </small>
              </div>

              <div className="settings-field">
                <label htmlFor="exempt-roles">
                  Exempt User Roles (comma-separated)
                </label>
                <input
                  id="exempt-roles"
                  type="text"
                  placeholder="admin, support"
                  value={exemptRolesText}
                  onChange={(e) => setExemptRolesText(e.target.value)}
                />
                <small className="settings-hint">
                  User roles allowed to bypass maintenance mode (admins always
                  have full access).
                </small>
              </div>
            </div>

            {settings?.updatedAt && (
              <div className="settings-footer-meta">
                <small>
                  Last modified: {new Date(settings.updatedAt).toLocaleString()}
                </small>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
