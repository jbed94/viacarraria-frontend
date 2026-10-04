import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  HardDrive,
  Languages,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
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
  const [anonQueueThroughput, setAnonQueueThroughput] = useState(30);
  const [regQueueThroughput, setRegQueueThroughput] = useState(120);
  const [defaultStorageLimitMb, setDefaultStorageLimitMb] = useState(100);
  const [anonymousRateLimit, setAnonymousRateLimit] = useState(30);
  const [authenticatedRateLimit, setAuthenticatedRateLimit] = useState(120);
  const [burstMultiplier, setBurstMultiplier] = useState(2);
  const [effectiveEcpm, setEffectiveEcpm] = useState(1.5);
  const [canvasAdDensity, setCanvasAdDensity] = useState(35);
  const [maxCanvasAds, setMaxCanvasAds] = useState(5);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowedIpsText, setAllowedIpsText] = useState('127.0.0.1, ::1');
  const [exemptUserIdsText, setExemptUserIdsText] = useState('');
  const [exemptRolesText, setExemptRolesText] = useState('admin');
  const [synonyms, setSynonyms] = useState<Record<string, string[]>>({});
  const [newSynonymKey, setNewSynonymKey] = useState('');
  const [newSynonymTerms, setNewSynonymTerms] = useState('');

  const populateForm = (data: AdminSystemSettings) => {
    setSettings(data);
    setRetentionDays(data.retentionDays);
    setRetentionGraceDays(data.retentionGraceDays);
    setAnonQueueThroughput(
      data.similarityQuota?.anonymousThroughputPerMinute ?? 30,
    );
    setRegQueueThroughput(
      data.similarityQuota?.registeredThroughputPerMinute ?? 120,
    );
    setDefaultStorageLimitMb(data.storageConfig?.defaultStorageLimitMb ?? 100);
    setEffectiveEcpm(data.adConfig?.effectiveEcpm ?? 1.5);
    setCanvasAdDensity(data.adConfig?.canvasAdDensity ?? 35);
    setMaxCanvasAds(data.adConfig?.maxCanvasAds ?? 5);
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
    setSynonyms(data.synonymsConfig ?? {});
  };

  const handleAddSynonym = () => {
    const key = newSynonymKey.trim().toLowerCase();
    if (!key) return;
    const terms = newSynonymTerms
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (terms.length === 0) return;

    setSynonyms((prev) => ({
      ...prev,
      [key]: [...new Set([...(prev[key] ?? []), ...terms])],
    }));
    setNewSynonymKey('');
    setNewSynonymTerms('');
  };

  const handleRemoveSynonym = (keyToRemove: string) => {
    setSynonyms((prev) => {
      const next = { ...prev };
      delete next[keyToRemove];
      return next;
    });
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
      similarityQuota: {
        anonymousThroughputPerMinute: Number(anonQueueThroughput),
        registeredThroughputPerMinute: Number(regQueueThroughput),
      },
      storageConfig: {
        defaultStorageLimitMb: Number(defaultStorageLimitMb),
      },
      adConfig: {
        effectiveEcpm: Number(effectiveEcpm),
        canvasAdDensity: Number(canvasAdDensity),
        maxCanvasAds: Number(maxCanvasAds),
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
      synonymsConfig: synonyms,
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
    setAnonQueueThroughput(30);
    setRegQueueThroughput(120);
    setDefaultStorageLimitMb(100);
    setAnonymousRateLimit(30);
    setAuthenticatedRateLimit(120);
    setBurstMultiplier(2);
    setMaintenanceMode(false);
    setAllowedIpsText('127.0.0.1, ::1');
    setExemptUserIdsText('');
    setExemptRolesText('admin');
    setSynonyms(settings?.synonymsConfig ?? {});
    setNewSynonymKey('');
    setNewSynonymTerms('');
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

          {/* Section 3: Similarity Search Quota & Storage Boundaries */}
          <div className="admin-card settings-section full-width">
            <div className="settings-section-header">
              <HardDrive className="settings-section-icon" size={20} />
              <div>
                <h3>Similarity Search Queue Quota & Storage Boundaries</h3>
                <p>
                  Configure postponing queue throughput for Weaviate similarity
                  searches and default user document storage capacity.
                </p>
              </div>
            </div>

            <div className="tier-quota-columns">
              <div className="tier-quota-card free-tier">
                <div className="tier-quota-header">
                  <span className="tier-badge free">SEARCH QUEUE</span>
                  <h4>Weaviate Similarity Quota</h4>
                </div>

                <div className="settings-field">
                  <label htmlFor="anon-queue-throughput">
                    Anonymous Search Throughput / Min
                  </label>
                  <div className="settings-input-wrapper">
                    <input
                      id="anon-queue-throughput"
                      type="number"
                      min="1"
                      max="1000"
                      value={anonQueueThroughput}
                      onChange={(e) =>
                        setAnonQueueThroughput(Number(e.target.value))
                      }
                      required
                    />
                    <span className="unit-label">ops/min</span>
                  </div>
                  <small>
                    Guest search capacity. Requests above this rate are
                    postponed in the FIFO queue without throwing errors.
                  </small>
                </div>

                <div className="settings-field">
                  <label htmlFor="reg-queue-throughput">
                    Registered Search Throughput / Min
                  </label>
                  <div className="settings-input-wrapper">
                    <input
                      id="reg-queue-throughput"
                      type="number"
                      min="1"
                      max="5000"
                      value={regQueueThroughput}
                      onChange={(e) =>
                        setRegQueueThroughput(Number(e.target.value))
                      }
                      required
                    />
                    <span className="unit-label">ops/min</span>
                  </div>
                  <small>
                    Registered user search capacity. Heavy concurrent queries
                    are delayed gracefully when queue fills.
                  </small>
                </div>
              </div>

              <div className="tier-quota-card pro-tier">
                <div className="tier-quota-header">
                  <span className="tier-badge pro">STORAGE QUOTA</span>
                  <h4>Registered Storage Limits</h4>
                </div>

                <div className="settings-field">
                  <label htmlFor="default-storage-limit">
                    Default User Document Storage Limit (MB)
                  </label>
                  <div className="settings-input-wrapper">
                    <input
                      id="default-storage-limit"
                      type="number"
                      min="1"
                      max="102400"
                      value={defaultStorageLimitMb}
                      onChange={(e) =>
                        setDefaultStorageLimitMb(Number(e.target.value))
                      }
                      required
                    />
                    <span className="unit-label">MB</span>
                  </div>
                  <small>
                    Default source document quota allocated to every registered
                    account. Can be customized per user in the Users tab.
                  </small>
                </div>

                <div className="admin-callout info mt-3">
                  <strong>Zero-Monetization Architecture:</strong>
                  <p className="text-xs text-muted mt-1">
                    Knowledge graphs and node counts are unlimited for
                    registered users. Anonymous guests may query and crawl
                    public templates but cannot store documents or create
                    graphs.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Ad Monetization & Canvas Density Configuration */}
          <div className="admin-card settings-section full-width">
            <div className="settings-section-header">
              <DollarSign className="settings-section-icon" size={20} />
              <div>
                <h3>Ad Monetization & Canvas Density Parameters</h3>
                <p>
                  Configure baseline eCPM revenue estimation and calibrate
                  dynamic canvas ad unit frequency across knowledge graphs.
                </p>
              </div>
            </div>

            <div className="settings-field-group">
              <div className="settings-field">
                <label htmlFor="effective-ecpm">
                  Base eCPM Calculation Rate ($ / 1,000 Impressions)
                </label>
                <div className="settings-input-wrapper">
                  <input
                    id="effective-ecpm"
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.01"
                    value={effectiveEcpm}
                    onChange={(e) => setEffectiveEcpm(Number(e.target.value))}
                    required
                  />
                  <span className="unit-label">USD</span>
                </div>
                <small>
                  Used across admin analytics dashboards and knowledge graph
                  leaderboard calculations.
                </small>
              </div>

              <div className="settings-field">
                <label htmlFor="canvas-ad-density">
                  Canvas Ad Node Density Ratio
                </label>
                <div className="settings-input-wrapper">
                  <input
                    id="canvas-ad-density"
                    type="number"
                    min="5"
                    max="500"
                    value={canvasAdDensity}
                    onChange={(e) => setCanvasAdDensity(Number(e.target.value))}
                    required
                  />
                  <span className="unit-label">nodes/ad</span>
                </div>
                <small>
                  Ratio of subject nodes required before introducing an
                  additional canvas ad unit.
                </small>
              </div>

              <div className="settings-field">
                <label htmlFor="max-canvas-ads">
                  Maximum Concurrent Canvas Ads
                </label>
                <div className="settings-input-wrapper">
                  <input
                    id="max-canvas-ads"
                    type="number"
                    min="1"
                    max="20"
                    value={maxCanvasAds}
                    onChange={(e) => setMaxCanvasAds(Number(e.target.value))}
                    required
                  />
                  <span className="unit-label">ads</span>
                </div>
                <small>
                  Strict ceiling on simultaneous canvas ad nodes to preserve
                  rendering performance and user experience.
                </small>
              </div>
            </div>
          </div>

          {/* Section: Search Synonyms & Acronym Expansion Dictionary */}
          <div className="admin-card settings-section full-width">
            <div className="settings-section-header">
              <Languages className="settings-section-icon" size={20} />
              <div>
                <h3>Search Synonyms & Technical Acronym Expansion</h3>
                <p>
                  Configure acronym and domain synonym mappings used during
                  Weaviate hybrid search BM25 expansion.
                </p>
              </div>
            </div>

            <div className="synonyms-dictionary-card">
              <div className="synonym-add-row">
                <div className="synonym-add-field key-field">
                  <label htmlFor="new-synonym-key">Acronym / Keyword</label>
                  <input
                    id="new-synonym-key"
                    type="text"
                    placeholder="e.g. k8s, bfs, db"
                    value={newSynonymKey}
                    onChange={(e) => setNewSynonymKey(e.target.value)}
                  />
                </div>
                <div className="synonym-add-field">
                  <label htmlFor="new-synonym-terms">
                    Expansion Terms (comma-separated)
                  </label>
                  <input
                    id="new-synonym-terms"
                    type="text"
                    placeholder="e.g. kubernetes, container orchestration"
                    value={newSynonymTerms}
                    onChange={(e) => setNewSynonymTerms(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSynonym();
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={handleAddSynonym}
                  disabled={!newSynonymKey.trim() || !newSynonymTerms.trim()}
                  title="Add synonym mapping"
                >
                  <Plus size={14} />
                  <span>Add Mapping</span>
                </button>
              </div>

              <div className="synonyms-items-grid">
                {Object.entries(synonyms).map(([key, terms]) => (
                  <div key={key} className="synonym-item-card">
                    <div className="synonym-item-info">
                      <span className="synonym-item-key">{key}</span>
                      <span
                        className="synonym-item-terms"
                        title={terms.join(', ')}
                      >
                        {terms.join(', ')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="synonym-remove-btn"
                      onClick={() => handleRemoveSynonym(key)}
                      title={`Remove synonym for "${key}"`}
                      aria-label={`Remove synonym for ${key}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 5: Maintenance Operations */}
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
