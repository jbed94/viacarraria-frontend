import {
  ChevronDown,
  CircleUserRound,
  Copy,
  Crown,
  Gauge,
  Monitor,
  Moon,
  Plus,
  Settings2,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Theme } from '../../hooks/use-theme';
import type {
  Graph,
  GraphPermission,
  GraphSummary,
  Identity,
  LimitStatus,
  LimitsSummary,
} from '../../types/api';
import { formatAccessCount } from '../../lib/format';

type HeaderProps = {
  graph?: Graph;
  graphs: GraphSummary[];
  identity?: Identity;
  isEditing: boolean;
  onGraphChange: (id: string) => void;
  onCopy: () => void;
  limits?: LimitsSummary;
  onCreate: () => void;
  onToggleEditing: () => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenPricing: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

const languageOptions = [
  { value: 'en', flag: '🇬🇧', label: 'languageEnglish' },
  { value: 'pl', flag: '🇵🇱', label: 'languagePolish' },
  { value: 'es', flag: '🇪🇸', label: 'languageSpanish' },
  { value: 'it', flag: '🇮🇹', label: 'languageItalian' },
] as const;

export function Header({
  graph,
  graphs,
  identity,
  isEditing,
  onGraphChange,
  onCopy,
  limits,
  onCreate,
  onToggleEditing,
  onOpenAuth,
  onOpenProfile,
  onOpenPricing,
  theme,
  onThemeChange,
}: HeaderProps) {
  const { i18n, t } = useTranslation();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const canEdit = graph?.canEdit ?? graph?.isOwned ?? false;
  const permission: GraphPermission =
    graph?.permission ?? (canEdit ? 'OWNER' : 'VIEWER');
  const permissionLabel =
    permission === 'OWNER' ? 'permissionOwner' : 'permissionViewer';
  const accessCount = graph?.accessCount ?? (graph?.isPublic ? 1 : 1);
  const formattedAccessCount = formatAccessCount(accessCount);
  const selectedLanguage =
    languageOptions.find((option) => option.value === i18n.language) ??
    languageOptions[0];
  const ThemeIcon =
    theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;

  function changeLanguage(
    language: (typeof languageOptions)[number]['value'],
  ): void {
    void i18n.changeLanguage(language);
    setLanguageOpen(false);
  }

  return (
    <header className="topbar overlay-interactive">
      <div className="brand-lockup">
        <span className="brand-mark">VC</span>
        <span className="brand-name">Via Carraria</span>
      </div>
      <div className="graph-picker">
        <select
          aria-label="Choose knowledge graph"
          value={graph?.id ?? ''}
          onChange={(event) => onGraphChange(event.target.value)}
        >
          {graphs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
              {item.isPrepared ? '' : ' - Draft'}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" size={15} />
      </div>
      {graph ? (
        <div
          className="graph-access-summary"
          role="status"
          title={t('graphAccessLabel', { count: formattedAccessCount })}
          aria-label={t('graphAccessLabel', { count: formattedAccessCount })}
        >
          <span className="graph-permission">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>{t(permissionLabel)}</span>
          </span>
          <span className="graph-access-count">
            <Users size={14} aria-hidden="true" />
            <span>{formattedAccessCount}</span>
          </span>
        </div>
      ) : null}
      <nav className="topbar-actions">
        {canEdit ? (
          <button
            type="button"
            className={`icon-button ${isEditing ? 'is-active' : ''}`}
            title={t('edit')}
            onClick={onToggleEditing}
          >
            <Settings2 size={17} />
          </button>
        ) : null}
        {graph ? (
          <button
            type="button"
            className="icon-button"
            title={t('copyGraph')}
            aria-label={t('copyGraph')}
            onClick={onCopy}
          >
            <Copy size={17} />
          </button>
        ) : null}
        <div className="limits-control">
          <button
            type="button"
            className={`icon-button ${limitsOpen ? 'is-active' : ''}`}
            title={t('limits')}
            aria-label={t('limits')}
            aria-expanded={limitsOpen}
            onClick={() => {
              setLimitsOpen((open) => !open);
              setLanguageOpen(false);
              setThemeOpen(false);
            }}
          >
            <Gauge size={17} />
          </button>
          {limitsOpen ? (
            <div className="limits-menu" role="menu" aria-label={t('limits')}>
              <div className="limits-menu-heading">
                <strong>{t('limits')}</strong>
                <span>{limits?.tier ?? identity?.tier ?? 'FREE'}</span>
              </div>
              {limits ? (
                <>
                  <div className="limits-section-title">{t('quotas')}</div>
                  <QuotaRow
                    label={t('limitGraphs')}
                    status={limits.graphs}
                    t={t}
                  />
                  <QuotaRow
                    label={t('limitQueries')}
                    status={limits.queries}
                    t={t}
                  />
                  <QuotaRow
                    label={t('limitUploads')}
                    status={limits.uploads}
                    t={t}
                  />
                  <div className="limits-section-title">{t('planLimits')}</div>
                  <PlanLimitRow
                    label={t('limitNodes')}
                    limit={limits.nodesPerGraph.limit}
                    t={t}
                  />
                  <PlanLimitRow
                    label={t('limitSources')}
                    limit={limits.sourcesPerNode.limit}
                    t={t}
                  />
                  <PlanLimitRow
                    label={t('limitFileSize')}
                    limit={limits.sourceSizeBytes.limit}
                    t={t}
                    formatValue={formatBytes}
                  />
                  <PlanLimitRow
                    label={t('limitSelectedNodes')}
                    limit={limits.selectedNodes.limit}
                    t={t}
                  />
                  <PlanLimitRow
                    label={t('limitExtended')}
                    limit={limits.extendedContext.limit}
                    t={t}
                  />
                </>
              ) : (
                <p className="empty-state">{t('loadingLimits')}</p>
              )}
            </div>
          ) : null}
        </div>
        <button type="button" className="command-button" onClick={onCreate}>
          <Plus size={16} />
          {t('createGraph')}
        </button>
        <div className="picker-control language-picker">
          <button
            type="button"
            className="picker-trigger"
            aria-label={t('language')}
            aria-expanded={languageOpen}
            onClick={() => {
              setLanguageOpen((open) => !open);
              setThemeOpen(false);
            }}
          >
            <span className="country-flag" aria-hidden="true">
              {selectedLanguage.flag}
            </span>
            <span className="picker-code">
              {selectedLanguage.value.toUpperCase()}
            </span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          {languageOpen ? (
            <div className="picker-menu" role="menu" aria-label={t('language')}>
              {languageOptions.map((option) => (
                <button
                  type="button"
                  role="menuitem"
                  className={`picker-option ${option.value === selectedLanguage.value ? 'is-selected' : ''}`}
                  key={option.value}
                  onClick={() => changeLanguage(option.value)}
                >
                  <span className="country-flag" aria-hidden="true">
                    {option.flag}
                  </span>
                  <span>{t(option.label)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="picker-control theme-picker">
          <button
            type="button"
            className="picker-trigger"
            aria-label={t('theme')}
            aria-expanded={themeOpen}
            onClick={() => {
              setThemeOpen((open) => !open);
              setLanguageOpen(false);
            }}
          >
            <ThemeIcon size={15} aria-hidden="true" />
            <span className="picker-label">
              {t(
                theme === 'light'
                  ? 'themeLight'
                  : theme === 'dark'
                    ? 'themeDark'
                    : 'themeSystem',
              )}
            </span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          {themeOpen ? (
            <div className="picker-menu" role="menu" aria-label={t('theme')}>
              {(
                [
                  ['light', Sun, 'themeLight'],
                  ['dark', Moon, 'themeDark'],
                  ['system', Monitor, 'themeSystem'],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  type="button"
                  role="menuitem"
                  className={`picker-option ${value === theme ? 'is-selected' : ''}`}
                  key={value}
                  onClick={() => {
                    onThemeChange(value);
                    setThemeOpen(false);
                  }}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{t(label)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {identity?.isGuest ? (
          <button
            type="button"
            className="command-button accent"
            onClick={onOpenAuth}
          >
            <CircleUserRound size={16} />
            {t('signUp')}
          </button>
        ) : (
          <div className="account-actions">
            <button
              type="button"
              className="tier-button"
              title="Manage subscription"
              onClick={onOpenPricing}
            >
              <Crown size={15} />
              {identity?.tier}
            </button>
            <button
              type="button"
              className="avatar-button"
              title="Open account"
              onClick={onOpenProfile}
            >
              {(identity?.username ?? identity?.email ?? 'U')
                .slice(0, 1)
                .toUpperCase()}
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}

function QuotaRow({
  label,
  status,
  t,
}: {
  label: string;
  status: LimitStatus;
  t: (key: string) => string;
}) {
  const reached = status.limit !== null && status.used >= status.limit;
  const unavailable = status.limit === 0;
  return (
    <div
      className={`limit-row ${reached ? 'is-reached' : ''}`}
      role="menuitem"
      tabIndex={0}
    >
      <span>{label}</span>
      <strong>
        {unavailable
          ? t('notAvailable')
          : `${status.used} / ${status.limit === null ? t('unlimited') : status.limit}`}
      </strong>
      {unavailable ? null : (
        <small>{reached ? t('limitReached') : t('limitAvailable')}</small>
      )}
    </div>
  );
}

function PlanLimitRow({
  label,
  limit,
  t,
  formatValue = String,
}: {
  label: string;
  limit: number | null;
  t: (key: string) => string;
  formatValue?: (value: number) => string;
}) {
  const unavailable = limit === 0;
  const unlimited = limit === null;
  return (
    <div className="limit-row plan-limit-row" role="menuitem" tabIndex={0}>
      <span>{label}</span>
      <strong>
        {unlimited
          ? t('unlimited')
          : unavailable
            ? t('notAvailable')
            : formatValue(limit)}
      </strong>
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value / (1024 * 1024))} MB`;
}
