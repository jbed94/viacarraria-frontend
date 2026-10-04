import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  Edit,
  History,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { api } from '../../../lib/api';
import type {
  AdAnalyticsSummary,
  AdContextTag,
  AdContextTagStats,
  AdTelemetryStatus,
  PlanDefinition,
  SubscriptionTier,
  TelemetryDateRange,
  UpdatePlanDto,
} from '../../../types/api';

export function AdminPlansTab() {
  const [plans, setPlans] = useState<
    Record<SubscriptionTier, PlanDefinition | null>
  >({
    ANONYMOUS: null,
    REGISTERED: null,
  });
  const [selectedTier, setSelectedTier] =
    useState<SubscriptionTier>('REGISTERED');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states for currently selected tier
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [maxNodes, setMaxNodes] = useState(100000);
  const [maxSourcesPerGraph, setMaxSourcesPerGraph] = useState(1000);
  const [maxSourceMb, setMaxSourceMb] = useState(50);
  const [allowPrivateGraphs, setAllowPrivateGraphs] = useState(true);
  const [extendedContext, setExtendedContext] = useState(true);

  // Ad Context Taxonomy State
  const [adTags, setAdTags] = useState<AdContextTag[]>([]);
  const [adTagStats, setAdTagStats] = useState<AdContextTagStats | null>(null);
  const [loadingAdTags, setLoadingAdTags] = useState(false);
  const [editingTag, setEditingTag] = useState<AdContextTag | null>(null);
  const [isCreateTagModalOpen, setIsCreateTagModalOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagSlug, setTagSlug] = useState('');
  const [tagDescription, setTagDescription] = useState('');
  const [tagIsActive, setTagIsActive] = useState(true);
  const [savingTag, setSavingTag] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const loadAdTagsAndStats = async () => {
    setLoadingAdTags(true);
    try {
      const [tags, stats] = await Promise.all([
        api.admin.getAdTags(),
        api.admin.getAdTagStats(),
      ]);
      setAdTags(tags || []);
      setAdTagStats(stats || null);
    } catch {
      // safe fallback
    } finally {
      setLoadingAdTags(false);
    }
  };

  useEffect(() => {
    void loadAdTagsAndStats();
  }, []);

  const handleOpenCreateTag = () => {
    setEditingTag(null);
    setTagName('');
    setTagSlug('');
    setTagDescription('');
    setTagIsActive(true);
    setTagError(null);
    setIsCreateTagModalOpen(true);
  };

  const handleOpenEditTag = (tag: AdContextTag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagSlug(tag.slug);
    setTagDescription(tag.description);
    setTagIsActive(tag.isActive);
    setTagError(null);
    setIsCreateTagModalOpen(true);
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim() || !tagDescription.trim()) {
      setTagError('Name and description are required.');
      return;
    }
    setSavingTag(true);
    setTagError(null);
    try {
      if (editingTag) {
        await api.admin.updateAdTag(editingTag.id, {
          name: tagName.trim(),
          slug: tagSlug.trim() || undefined,
          description: tagDescription.trim(),
          isActive: tagIsActive,
        });
      } else {
        await api.admin.createAdTag({
          name: tagName.trim(),
          slug: tagSlug.trim() || undefined,
          description: tagDescription.trim(),
          isActive: tagIsActive,
        });
      }
      setIsCreateTagModalOpen(false);
      await loadAdTagsAndStats();
    } catch (err: any) {
      setTagError(err?.message ?? 'Failed to save tag.');
    } finally {
      setSavingTag(false);
    }
  };

  const handleToggleTagStatus = async (tag: AdContextTag) => {
    try {
      await api.admin.updateAdTag(tag.id, {
        isActive: !tag.isActive,
      });
      await loadAdTagsAndStats();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to toggle tag status.');
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete tag "${name}"?`)) {
      return;
    }
    try {
      await api.admin.deleteAdTag(id);
      await loadAdTagsAndStats();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to delete tag.');
    }
  };

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.getPlans();
      const map: Record<SubscriptionTier, PlanDefinition | null> = {
        ANONYMOUS: null,
        REGISTERED: null,
      };
      for (const p of data) {
        if (p.tier in map) {
          map[p.tier] = p;
        }
      }
      setPlans(map);
      populateForm(map[selectedTier] ?? undefined, selectedTier);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load plan configurations.');
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (
    plan?: PlanDefinition,
    tier: SubscriptionTier = selectedTier,
  ) => {
    if (!plan) {
      setName(
        tier === 'ANONYMOUS'
          ? 'Guest / Anonymous Tier'
          : 'Registered Community Tier',
      );
      setDescription('');
      setAdsEnabled(true);
      setMaxNodes(tier === 'ANONYMOUS' ? 0 : 100000);
      setMaxSourcesPerGraph(tier === 'ANONYMOUS' ? 0 : 1000);
      setMaxSourceMb(tier === 'ANONYMOUS' ? 0 : 50);
      setAllowPrivateGraphs(tier === 'REGISTERED');
      setExtendedContext(tier === 'REGISTERED');
      return;
    }

    setName(plan.name);
    setDescription(plan.description ?? '');
    setAdsEnabled(plan.adsEnabled);
    setMaxNodes(plan.limits.maxNodes);
    setMaxSourcesPerGraph(plan.limits.maxSourcesPerGraph);
    setMaxSourceMb(Math.round(plan.limits.maxSourceSizeBytes / (1024 * 1024)));
    setAllowPrivateGraphs(plan.limits.allowPrivateGraphs);
    setExtendedContext(plan.limits.extendedContext);
  };

  const [adAnalytics, setAdAnalytics] = useState<AdAnalyticsSummary | null>(
    null,
  );
  const [telemetryRange, setTelemetryRange] =
    useState<TelemetryDateRange>('30d');
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [telemetryStatus, setTelemetryStatus] =
    useState<AdTelemetryStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [triggeringRollup, setTriggeringRollup] = useState(false);
  const [purgingTelemetry, setPurgingTelemetry] = useState(false);
  const [telemetryActionMessage, setTelemetryActionMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadTelemetryStatus = async () => {
    setLoadingStatus(true);
    try {
      const status = await api.admin.getAdTelemetryStatus();
      setTelemetryStatus(status);
    } catch {
      // safe fallback
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadAdAnalytics = async (
    range: TelemetryDateRange = telemetryRange,
  ) => {
    setLoadingAnalytics(true);
    try {
      const data = await api.admin.getAdAnalytics(range);
      setAdAnalytics(data);
    } catch {
      // safe fallback
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleRangeChange = (range: TelemetryDateRange) => {
    setTelemetryRange(range);
    void loadAdAnalytics(range);
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await api.admin.exportAdTelemetry(telemetryRange);
    } catch (err: any) {
      setError(err?.message || 'Failed to export telemetry CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleTriggerRollup = async () => {
    setTriggeringRollup(true);
    setTelemetryActionMessage(null);
    try {
      const res = await api.admin.triggerAdRollup();
      setTelemetryActionMessage({
        type: 'success',
        text: `Daily aggregation completed: ${res.rowsRolledUp} rows rolled up into reporting summaries.`,
      });
      await Promise.all([
        loadAdAnalytics(telemetryRange),
        loadTelemetryStatus(),
      ]);
    } catch (err: any) {
      setTelemetryActionMessage({
        type: 'error',
        text: err?.message || 'Failed to trigger ad telemetry daily rollup.',
      });
    } finally {
      setTriggeringRollup(false);
    }
  };

  const handlePurgeOldTelemetry = async () => {
    setPurgingTelemetry(true);
    setTelemetryActionMessage(null);
    try {
      const days = telemetryStatus?.retentionDays ?? 90;
      const res = await api.admin.purgeOldAdTelemetry(days);
      setTelemetryActionMessage({
        type: 'success',
        text: `Retention purge executed: ${res.purgedCount} raw events older than ${res.retentionDays} days safely deleted.`,
      });
      await Promise.all([
        loadAdAnalytics(telemetryRange),
        loadTelemetryStatus(),
      ]);
    } catch (err: any) {
      setTelemetryActionMessage({
        type: 'error',
        text: err?.message || 'Failed to purge old ad telemetry.',
      });
    } finally {
      setPurgingTelemetry(false);
    }
  };

  const handleRefreshAllTelemetry = async () => {
    await Promise.all([loadAdAnalytics(telemetryRange), loadTelemetryStatus()]);
  };

  useEffect(() => {
    void loadPlans();
    void loadAdAnalytics('30d');
    void loadTelemetryStatus();
  }, []);

  const handleSelectTier = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    setSuccessMessage(null);
    setError(null);
    populateForm(plans[tier] ?? undefined, tier);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const dto: UpdatePlanDto = {
      name,
      description,
      adsEnabled,
      limits: {
        maxNodes,
        maxSourcesPerGraph,
        maxSourceSizeBytes: maxSourceMb * 1024 * 1024,
        allowPrivateGraphs,
        extendedContext,
      },
    };

    try {
      const updated = await api.admin.updatePlan(selectedTier, dto);
      setPlans((prev) => ({ ...prev, [selectedTier]: updated }));
      setSuccessMessage(
        `Plan terms for ${selectedTier} successfully updated to version v${updated.version}!`,
      );
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update plan configuration.');
    } finally {
      setSaving(false);
    }
  };

  const currentPlan = plans[selectedTier];

  return (
    <div className="admin-plans-container">
      {/* Top Header */}
      <div className="admin-tab-header">
        <div>
          <h2>System Plans & Quota Configuration</h2>
          <p className="admin-tab-subtitle">
            Configure plan parameters, graph authoring allowances, and
            advertising settings for Guest and Registered user tiers.
          </p>
        </div>
        <div className="admin-tab-header-actions">
          <button
            type="button"
            className="admin-btn secondary refresh-btn"
            onClick={loadPlans}
            disabled={loading || saving}
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tier Switcher Sub-Tabs */}
      <div className="admin-plan-tabs-bar">
        {(['ANONYMOUS', 'REGISTERED'] as SubscriptionTier[]).map((tier) => {
          const isActive = selectedTier === tier;
          const plan = plans[tier];
          return (
            <button
              key={tier}
              type="button"
              className={`plan-tier-tab ${isActive ? 'active' : ''} ${tier.toLowerCase()}`}
              onClick={() => handleSelectTier(tier)}
              aria-label={`Tier Tab ${tier}`}
              data-testid={`tier-tab-${tier.toLowerCase()}`}
            >
              <div className="tier-tab-content">
                <span className="tier-name">{tier}</span>
                <span className="tier-badge">
                  {plan ? `v${plan.version}` : 'Default'}
                </span>
              </div>
              <span className="tier-subtext">
                {tier === 'ANONYMOUS'
                  ? 'Unauthenticated Guests'
                  : 'Registered Community'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notifications */}
      {error ? (
        <div className="admin-tab-error">
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      ) : null}

      {successMessage ? (
        <div className="admin-tab-success">
          <CheckCircle2 size={16} />
          <p>{successMessage}</p>
        </div>
      ) : null}

      {/* Main Configuration Form */}
      <form onSubmit={handleSave} className="admin-plan-form">
        <div className="admin-plan-grid">
          {/* Card 1: Plan Metadata & Advertising */}
          <div className="admin-card">
            <div className="admin-card-header">
              <Layers size={18} />
              <h3>Plan Metadata & Advertising Experience</h3>
            </div>
            <div className="admin-card-body">
              <div className="admin-form-group">
                <label htmlFor="plan-name">Plan Display Name</label>
                <input
                  id="plan-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Registered Community Tier"
                  required
                />
              </div>

              <div className="admin-form-group">
                <label htmlFor="plan-description">
                  Description & Information
                </label>
                <input
                  id="plan-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Free registered tier with unlimited graphs and 100MB initial source storage"
                />
              </div>

              <div className="admin-form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={adsEnabled}
                    onChange={(e) => setAdsEnabled(e.target.checked)}
                  />
                  <span>Display In-App Ads & Sponsored Cards</span>
                </label>
                <small className="form-hint">
                  Via Carraria is funded by advertising. Both Anonymous and
                  Registered tiers display privacy-respecting banners.
                </small>
              </div>
            </div>
          </div>

          {/* Card 2: Graph Capabilities & Limits */}
          <div className="admin-card">
            <div className="admin-card-header">
              <Database size={18} />
              <h3>Graph Capabilities & Upload Limits</h3>
            </div>
            <div className="admin-card-body">
              <div className="form-row-2col">
                <div className="admin-form-group">
                  <label htmlFor="plan-nodes">Max Nodes Per Graph</label>
                  <input
                    id="plan-nodes"
                    type="number"
                    min={0}
                    max={100000}
                    value={maxNodes}
                    onChange={(e) => setMaxNodes(Number(e.target.value))}
                    required
                  />
                  <small className="form-hint">
                    Set to 0 to disable graph authoring (e.g. Anonymous guests).
                  </small>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="plan-sources">Max Sources Per Graph</label>
                  <input
                    id="plan-sources"
                    type="number"
                    min={0}
                    max={5000}
                    value={maxSourcesPerGraph}
                    onChange={(e) =>
                      setMaxSourcesPerGraph(Number(e.target.value))
                    }
                    required
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label htmlFor="plan-source-size">
                  Max Single Source Upload Size (MB)
                </label>
                <input
                  id="plan-source-size"
                  type="number"
                  min={0}
                  max={1024}
                  value={maxSourceMb}
                  onChange={(e) => setMaxSourceMb(Number(e.target.value))}
                  required
                />
                <small className="form-hint">
                  Converted to {maxSourceMb * 1024 * 1024} bytes. Global storage
                  limit configured in Settings tab.
                </small>
              </div>

              <div className="admin-form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={allowPrivateGraphs}
                    onChange={(e) => setAllowPrivateGraphs(e.target.checked)}
                  />
                  <span>Allow Creation of Private / Restricted Graphs</span>
                </label>
                <small className="form-hint">
                  If disabled, all created graphs are public knowledge graphs.
                </small>
              </div>

              <div className="admin-form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={extendedContext}
                    onChange={(e) => setExtendedContext(e.target.checked)}
                  />
                  <span>
                    Allow Deep Extended Context Extraction (Reranked Top-K)
                  </span>
                </label>
                <small className="form-hint">
                  Permits pulling extended chunk windows during synthesis.
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="admin-card-actions">
          <div className="version-info">
            <span className="version-label">Active Version:</span>
            <strong>v{currentPlan?.version ?? 1}</strong>
            <span className="effective-date">
              (Effective since{' '}
              {currentPlan?.effectiveAt
                ? new Date(currentPlan.effectiveAt).toLocaleDateString()
                : 'Initial deployment'}
              )
            </span>
          </div>
          <button
            type="submit"
            className="admin-btn primary save-plan-btn"
            disabled={saving}
          >
            <Save size={15} />
            <span>
              {saving
                ? 'Publishing Changes...'
                : `Publish ${selectedTier} Plan (v${(currentPlan?.version ?? 1) + 1})`}
            </span>
          </button>
        </div>
      </form>

      {/* Ad Monetization & Viewability Telemetry Dashboard */}
      <div
        className="admin-card ad-telemetry-dashboard-card"
        data-testid="ad-telemetry-dashboard"
      >
        <div className="admin-card-header">
          <div className="admin-card-title">
            <BarChart3 size={18} className="text-amber-400" />
            <div>
              <h3>Ad Monetization & Viewability Telemetry</h3>
              <p className="admin-card-subtitle">
                Real-time impression tracking, occlusion culling GPU savings,
                IAB-compliant viewability cycles, and estimated Google AdSense
                eCPM revenue for Free & Anonymous tiers.
              </p>
            </div>
          </div>
          <div className="telemetry-header-actions">
            <div
              className="telemetry-range-selector"
              role="group"
              aria-label="Telemetry historical date range"
            >
              {(['7d', '30d', '90d', 'all'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`range-pill-btn ${telemetryRange === r ? 'active' : ''}`}
                  onClick={() => handleRangeChange(r)}
                  disabled={loadingAnalytics}
                >
                  {r === '7d'
                    ? '7D'
                    : r === '30d'
                      ? '30D'
                      : r === '90d'
                        ? '90D'
                        : 'All'}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="admin-btn secondary small"
              onClick={handleTriggerRollup}
              disabled={triggeringRollup}
              title="Trigger ad telemetry daily rollup sweep now"
              data-testid="ad-trigger-rollup-btn"
            >
              <History
                size={13}
                className={triggeringRollup ? 'animate-spin' : ''}
              />
              <span>
                {triggeringRollup ? 'Rolling up...' : 'Trigger Rollup'}
              </span>
            </button>

            <button
              type="button"
              className="admin-btn secondary small"
              onClick={handlePurgeOldTelemetry}
              disabled={purgingTelemetry}
              title={`Safely purge raw events older than ${telemetryStatus?.retentionDays ?? 90} days`}
              data-testid="ad-purge-telemetry-btn"
            >
              <Trash2
                size={13}
                className={purgingTelemetry ? 'animate-spin' : ''}
              />
              <span>
                {purgingTelemetry
                  ? 'Purging...'
                  : `Purge Old (>${telemetryStatus?.retentionDays ?? 90}d)`}
              </span>
            </button>

            <button
              type="button"
              className="admin-btn secondary small"
              onClick={handleExportCsv}
              disabled={exportingCsv}
              title="Export telemetry events to CSV"
            >
              <Download size={13} />
              <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
            </button>

            <button
              type="button"
              className="admin-btn secondary small"
              onClick={handleRefreshAllTelemetry}
              disabled={loadingAnalytics || loadingStatus}
            >
              <RefreshCw
                size={13}
                className={
                  loadingAnalytics || loadingStatus ? 'animate-spin' : ''
                }
              />
              <span>
                {loadingAnalytics || loadingStatus
                  ? 'Refreshing...'
                  : 'Refresh'}
              </span>
            </button>
          </div>
        </div>

        {telemetryActionMessage ? (
          <div
            className={`telemetry-alert-banner ${telemetryActionMessage.type}`}
            data-testid="telemetry-action-banner"
          >
            {telemetryActionMessage.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{telemetryActionMessage.text}</span>
            <button
              type="button"
              className="alert-dismiss-btn"
              onClick={() => setTelemetryActionMessage(null)}
              aria-label="Dismiss banner"
            >
              ×
            </button>
          </div>
        ) : null}

        <div className="ad-telemetry-metrics-grid">
          <div className="telemetry-metric-tile">
            <span className="telemetry-tile-label">Total Impressions</span>
            <div className="telemetry-tile-value">
              {adAnalytics
                ? adAnalytics.totalImpressions.toLocaleString()
                : '0'}
            </div>
            <span className="telemetry-tile-sub">
              {telemetryRange === 'all'
                ? 'All-time served impressions'
                : `Served in last ${telemetryRange.toUpperCase()}`}
            </span>
          </div>

          <div className="telemetry-metric-tile highlight-emerald">
            <span className="telemetry-tile-label">GPU Occlusion Culling</span>
            <div className="telemetry-tile-value">
              {adAnalytics
                ? `${adAnalytics.gpuSavingsPercentage.toFixed(1)}%`
                : '0.0%'}
            </div>
            <span className="telemetry-tile-sub">
              {adAnalytics ? adAnalytics.totalCulled.toLocaleString() : '0'}{' '}
              offscreen renders avoided
            </span>
          </div>

          <div className="telemetry-metric-tile highlight-cyan">
            <span className="telemetry-tile-label">
              Avg. Active Viewability
            </span>
            <div className="telemetry-tile-value">
              {adAnalytics
                ? `${adAnalytics.averageViewabilitySeconds.toFixed(1)}s`
                : '0.0s'}
            </div>
            <span className="telemetry-tile-sub">
              {adAnalytics
                ? `${adAnalytics.totalRefreshes.toLocaleString()} compliant 30s cycles`
                : '0 refresh cycles'}
            </span>
          </div>

          <div className="telemetry-metric-tile highlight-amber">
            <span className="telemetry-tile-label">
              Estimated AdSense Revenue
            </span>
            <div className="telemetry-tile-value">
              $
              {adAnalytics
                ? adAnalytics.estimatedRevenueUsd.toFixed(2)
                : '0.00'}
            </div>
            <span className="telemetry-tile-sub">
              eCPM: $
              {adAnalytics ? adAnalytics.effectiveEcpm.toFixed(2) : '1.50'} USD
            </span>
          </div>
        </div>

        {/* Consent Breakdown */}
        <div className="ad-consent-breakdown-panel">
          <div className="consent-panel-header">
            <h4>Privacy & Consent Breakdown</h4>
            <span className="consent-total-label">
              Total Signals:{' '}
              {(
                (adAnalytics?.consentBreakdown?.personalized ?? 0) +
                (adAnalytics?.consentBreakdown?.contextual ?? 0) +
                (adAnalytics?.consentBreakdown?.declined ?? 0)
              ).toLocaleString()}
            </span>
          </div>
          <div className="consent-bars-wrapper">
            <div className="consent-bar-item">
              <div className="consent-bar-meta">
                <span className="dot dot-emerald" />
                <span className="label">Personalized (Targeted)</span>
                <span className="count">
                  {adAnalytics?.consentBreakdown?.personalized ?? 0}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill fill-emerald"
                  style={{
                    width: `${
                      adAnalytics &&
                      adAnalytics.consentBreakdown.personalized +
                        adAnalytics.consentBreakdown.contextual +
                        adAnalytics.consentBreakdown.declined >
                        0
                        ? (
                            adAnalytics.consentBreakdown.personalized /
                              (adAnalytics.consentBreakdown.personalized +
                                adAnalytics.consentBreakdown.contextual +
                                adAnalytics.consentBreakdown.declined)
                          ) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="consent-bar-item">
              <div className="consent-bar-meta">
                <span className="dot dot-cyan" />
                <span className="label">
                  Contextual Only (Non-Personalized)
                </span>
                <span className="count">
                  {adAnalytics?.consentBreakdown?.contextual ?? 0}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill fill-cyan"
                  style={{
                    width: `${
                      adAnalytics &&
                      adAnalytics.consentBreakdown.personalized +
                        adAnalytics.consentBreakdown.contextual +
                        adAnalytics.consentBreakdown.declined >
                        0
                        ? (
                            adAnalytics.consentBreakdown.contextual /
                              (adAnalytics.consentBreakdown.personalized +
                                adAnalytics.consentBreakdown.contextual +
                                adAnalytics.consentBreakdown.declined)
                          ) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="consent-bar-item">
              <div className="consent-bar-meta">
                <span className="dot dot-rose" />
                <span className="label">Declined (Demo Ads)</span>
                <span className="count">
                  {adAnalytics?.consentBreakdown?.declined ?? 0}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill fill-rose"
                  style={{
                    width: `${
                      adAnalytics &&
                      adAnalytics.consentBreakdown.personalized +
                        adAnalytics.consentBreakdown.contextual +
                        adAnalytics.consentBreakdown.declined >
                        0
                        ? (
                            adAnalytics.consentBreakdown.declined /
                              (adAnalytics.consentBreakdown.personalized +
                                adAnalytics.consentBreakdown.contextual +
                                adAnalytics.consentBreakdown.declined)
                          ) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Storage & Retention Lifecycle Panel */}
        <div
          className="ad-telemetry-storage-panel"
          data-testid="ad-telemetry-storage-panel"
        >
          <div className="storage-panel-header">
            <div className="storage-panel-title">
              <Database size={15} className="text-amber-400" />
              <h4>Storage & Retention Lifecycle</h4>
            </div>
            <span
              className="storage-badge-status"
              data-testid="storage-auto-rollup-badge"
            >
              {telemetryStatus?.autoRollupEnabled
                ? `Auto-Rollup: Every ${telemetryStatus.scheduleIntervalHours}h`
                : 'Auto-Rollup: Disabled'}
            </span>
          </div>

          <div className="storage-stats-grid">
            <div className="storage-stat-item">
              <span className="storage-stat-label">Raw Telemetry Events</span>
              <span
                className="storage-stat-value"
                data-testid="raw-events-count"
              >
                {telemetryStatus
                  ? telemetryStatus.totalEventsCount.toLocaleString()
                  : '—'}
              </span>
              <span className="storage-stat-sub">
                Granular impression/viewability records
              </span>
            </div>

            <div className="storage-stat-item">
              <span className="storage-stat-label">
                Pre-Aggregated Daily Rollups
              </span>
              <span
                className="storage-stat-value"
                data-testid="daily-rollups-count"
              >
                {telemetryStatus
                  ? telemetryStatus.totalRollupsCount.toLocaleString()
                  : '—'}
              </span>
              <span className="storage-stat-sub">
                Last: {telemetryStatus?.lastRollupDate ?? 'None yet'}
              </span>
            </div>

            <div className="storage-stat-item">
              <span className="storage-stat-label">Retention Window</span>
              <span
                className="storage-stat-value"
                data-testid="retention-days-value"
              >
                {telemetryStatus?.retentionDays ?? 90} Days
              </span>
              <span className="storage-stat-sub">
                Auto-purged only after aggregation
              </span>
            </div>

            <div className="storage-stat-item">
              <span className="storage-stat-label">Oldest Raw Event</span>
              <span
                className="storage-stat-value"
                data-testid="oldest-event-date"
              >
                {telemetryStatus?.oldestEventDate
                  ? telemetryStatus.oldestEventDate.split('T')[0]
                  : 'None'}
              </span>
              <span className="storage-stat-sub">
                Newest:{' '}
                {telemetryStatus?.newestEventDate
                  ? telemetryStatus.newestEventDate.split('T')[0]
                  : 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Contextual Ad Taxonomy & Tags Management Panel */}
        <div
          className="ad-telemetry-storage-panel ad-taxonomy-panel"
          data-testid="ad-context-taxonomy-panel"
        >
          <div className="storage-panel-header">
            <div className="storage-panel-title">
              <Tag size={15} className="text-amber-400" />
              <h4>Contextual Ad Taxonomy & Tags</h4>
            </div>
            <div className="telemetry-header-actions">
              <button
                type="button"
                className="admin-btn primary small"
                onClick={handleOpenCreateTag}
                data-testid="add-tag-btn"
              >
                <Plus size={13} />
                <span>Add Tag</span>
              </button>
              <button
                type="button"
                className="admin-btn secondary small"
                onClick={loadAdTagsAndStats}
                disabled={loadingAdTags}
                data-testid="refresh-tags-btn"
              >
                <RefreshCw
                  size={13}
                  className={loadingAdTags ? 'animate-spin' : ''}
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <p className="admin-card-subtitle" style={{ marginBottom: '1rem' }}>
            Predefined safe whitelist of contextual taxonomy tags. Matches
            source concepts via TEI neural rerankers. Zero PII or private
            document text is shared with ad networks.
          </p>

          {/* KPI Cards */}
          <div className="telemetry-kpi-grid">
            <div className="telemetry-kpi-card" data-testid="total-tags-kpi">
              <span className="kpi-label">Total Taxonomy Tags</span>
              <span className="kpi-value">
                {adTagStats?.totalTags ?? adTags.length}
              </span>
              <span className="kpi-sub">Curated safe domains</span>
            </div>
            <div className="telemetry-kpi-card" data-testid="active-tags-kpi">
              <span className="kpi-label">Active Tags</span>
              <span className="kpi-value">
                {adTagStats?.activeTags ??
                  adTags.filter((t) => t.isActive).length}
              </span>
              <span className="kpi-sub">Currently eligible for matching</span>
            </div>
            <div className="telemetry-kpi-card" data-testid="total-matches-kpi">
              <span className="kpi-label">Source Concept Matches</span>
              <span className="kpi-value">
                {(adTagStats?.totalMatches ?? 0).toLocaleString()}
              </span>
              <span className="kpi-sub">Neural TEI reranker associations</span>
            </div>
            <div
              className="telemetry-kpi-card"
              data-testid="total-impressions-kpi"
            >
              <span className="kpi-label">Targeted Impressions</span>
              <span className="kpi-value">
                {(adTagStats?.totalImpressionsSent ?? 0).toLocaleString()}
              </span>
              <span className="kpi-sub">
                Delivered via GPT / AdSense channels
              </span>
            </div>
          </div>

          {/* Tags Table */}
          <div
            className="ad-tags-table-wrapper"
            style={{ overflowX: 'auto', marginTop: '1rem' }}
          >
            <table
              className="admin-table ad-tags-table"
              data-testid="ad-tags-table"
            >
              <thead>
                <tr>
                  <th>Tag Name / Slug</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Matches</th>
                  <th>Impressions</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adTags.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      {loadingAdTags
                        ? 'Loading taxonomy tags...'
                        : 'No contextual tags defined yet.'}
                    </td>
                  </tr>
                ) : (
                  adTags.map((tag) => (
                    <tr key={tag.id} data-testid={`tag-row-${tag.slug}`}>
                      <td>
                        <div className="tag-name-cell">
                          <strong className="tag-name">{tag.name}</strong>
                          <code
                            className="tag-slug"
                            style={{
                              display: 'block',
                              fontSize: '0.75rem',
                              opacity: 0.7,
                            }}
                          >
                            #{tag.slug}
                          </code>
                        </div>
                      </td>
                      <td
                        className="tag-desc-cell"
                        style={{ maxWidth: '320px', fontSize: '0.85rem' }}
                      >
                        {tag.description}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`tag-status-badge ${tag.isActive ? 'active' : 'inactive'}`}
                          onClick={() => handleToggleTagStatus(tag)}
                          title="Click to toggle active status"
                          data-testid={`toggle-status-${tag.slug}`}
                        >
                          {tag.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="tag-stat-cell">
                        {tag.matchCount.toLocaleString()}
                      </td>
                      <td className="tag-stat-cell">
                        {tag.sendCount.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div
                          className="tag-actions-cell"
                          style={{ display: 'inline-flex', gap: '0.5rem' }}
                        >
                          <button
                            type="button"
                            className="admin-btn secondary small"
                            onClick={() => handleOpenEditTag(tag)}
                            title="Edit tag"
                            data-testid={`edit-tag-${tag.slug}`}
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            type="button"
                            className="admin-btn secondary small"
                            onClick={() => handleDeleteTag(tag.id, tag.name)}
                            title="Delete tag"
                            data-testid={`delete-tag-${tag.slug}`}
                          >
                            <Trash2 size={12} />
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

        {/* Create / Edit Tag Modal */}
        {isCreateTagModalOpen && (
          <div className="admin-modal-backdrop" data-testid="ad-tag-modal">
            <div className="admin-modal-card">
              <div className="admin-modal-header">
                <h4>
                  {editingTag ? 'Edit Contextual Tag' : 'Create Contextual Tag'}
                </h4>
                <button
                  type="button"
                  className="admin-modal-close"
                  onClick={() => setIsCreateTagModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              {tagError && (
                <div className="admin-modal-error">
                  <AlertCircle size={14} />
                  <span>{tagError}</span>
                </div>
              )}

              <form onSubmit={handleSaveTag} className="admin-modal-form">
                <div className="admin-field">
                  <label htmlFor="tag-name-input">Tag Name *</label>
                  <input
                    id="tag-name-input"
                    type="text"
                    className="admin-input"
                    placeholder="e.g. Quantum Computing"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    required
                    data-testid="tag-name-input"
                  />
                </div>

                <div className="admin-field">
                  <label htmlFor="tag-slug-input">
                    Slug (optional, auto-generated if empty)
                  </label>
                  <input
                    id="tag-slug-input"
                    type="text"
                    className="admin-input"
                    placeholder="e.g. quantum-computing"
                    value={tagSlug}
                    onChange={(e) => setTagSlug(e.target.value)}
                    data-testid="tag-slug-input"
                  />
                </div>

                <div className="admin-field">
                  <label htmlFor="tag-desc-input">Description *</label>
                  <textarea
                    id="tag-desc-input"
                    className="admin-textarea"
                    rows={3}
                    placeholder="Brief description used for semantic cross-encoder reranker matching..."
                    value={tagDescription}
                    onChange={(e) => setTagDescription(e.target.value)}
                    required
                    data-testid="tag-description-input"
                  />
                </div>

                <div
                  className="admin-checkbox-field"
                  style={{ margin: '0.75rem 0' }}
                >
                  <label
                    className="checkbox-label"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={tagIsActive}
                      onChange={(e) => setTagIsActive(e.target.checked)}
                      data-testid="tag-active-checkbox"
                    />
                    <span>
                      Active (eligible for semantic matching and ad targeting)
                    </span>
                  </label>
                </div>

                <div
                  className="admin-modal-actions"
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem',
                    marginTop: '1rem',
                  }}
                >
                  <button
                    type="button"
                    className="admin-btn secondary"
                    onClick={() => setIsCreateTagModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-btn primary"
                    disabled={savingTag}
                    data-testid="save-tag-btn"
                  >
                    <Save size={13} />
                    <span>{savingTag ? 'Saving...' : 'Save Tag'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
