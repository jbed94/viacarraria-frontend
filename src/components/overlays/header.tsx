import {
  Archive,
  Bell,
  BookmarkPlus,
  BookOpen,
  ChevronDown,
  CircleUserRound,
  Copy,
  Gauge,
  Globe,
  Lock,
  Monitor,
  Moon,
  Plus,
  Settings2,
  ShieldCheck,
  Sliders,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Theme } from '../../hooks/use-theme';
import type {
  Graph,
  GraphSummary,
  Identity,
  LimitsSummary,
  NotificationItem,
} from '../../types/api';
import { useGraphStore } from '../../store/graph-store';
import { ViaCarrariaIcon } from '../brand';

export type HeaderProps = {
  graph?: Graph | null;
  graphs: GraphSummary[];
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onGraphChange: (graphId: string) => void;
  onCreate: () => void;
  onCopy: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  isEditing?: boolean;
  isSearching?: boolean;
  onToggleEditing?: () => void;
  onOpenSettings?: () => void;
  onOpenBrowser?: () => void;
  onAttachCurrent?: () => void;
  identity?: Identity | null;
  limits?: LimitsSummary | null;
  notifications?: NotificationItem[];
  unreadCount?: number;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onDeleteNotification?: (id: string) => void;
  onNotificationClick?: (notification: NotificationItem) => void;
  onOpenRetentionDashboard?: () => void;
  onRefreshLimits?: () => Promise<void> | void;
  onOpenPrivacy?: () => void;
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
  theme,
  onThemeChange,
  onGraphChange,
  onCreate,
  onCopy,
  onOpenProfile,
  onOpenAuth,
  isEditing = false,
  isSearching,
  onToggleEditing,
  onOpenSettings,
  onOpenBrowser,
  onAttachCurrent,
  identity,
  limits,
  notifications = [],
  unreadCount = 0,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onNotificationClick,
  onOpenRetentionDashboard,
  onRefreshLimits,
  onOpenPrivacy,
}: HeaderProps) {
  const storeLoading = useGraphStore((state) => state.isLoading);
  const isQueryPulsing = isSearching ?? storeLoading;
  const { i18n, t } = useTranslation();
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userHubOpen, setUserHubOpen] = useState(false);
  const userHubRef = useRef<HTMLDivElement>(null);

  const canEdit = graph?.canEdit ?? graph?.isOwned ?? false;
  const selectedLanguage =
    languageOptions.find((option) => option.value === i18n.language) ??
    languageOptions[0];

  const isGuest = !identity || identity.isGuest;
  const effectiveTier =
    limits?.tier ?? identity?.tier ?? (isGuest ? 'ANONYMOUS' : 'REGISTERED');

  const myGraphs = graphs.filter((item) => item.isOwned);
  const attachedGraphs = graphs.filter(
    (item) => !item.isOwned && item.isAttached,
  );
  const otherGraphs = graphs.filter(
    (item) => !item.isOwned && !item.isAttached,
  );
  const isCurrentInGraphs = graphs.some((g) => g.id === graph?.id);
  const isUnattachedPublic = Boolean(
    graph &&
      graph.isPublic &&
      !graph.isOwned &&
      !graph.isAttached &&
      !graph.isPrepared,
  );

  useEffect(() => {
    if (!userHubOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        userHubRef.current &&
        !userHubRef.current.contains(e.target as Node)
      ) {
        setUserHubOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setUserHubOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userHubOpen]);

  function changeLanguage(
    language: (typeof languageOptions)[number]['value'],
  ): void {
    void i18n.changeLanguage(language);
  }

  return (
    <header className="topbar overlay-interactive">
      {/* Zone 1: Workspace & Knowledge Context */}
      <div className="topbar-zone topbar-zone-left">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <ViaCarrariaIcon
              size={21}
              variant="bare"
              pulsing={isQueryPulsing}
              aria-hidden="true"
            />
          </span>
          <span className="brand-name">Via Carraria</span>
        </div>

        <button
          type="button"
          className="icon-button browser-toggle-btn"
          title="Public Graph Browser"
          aria-label="Public Graph Browser"
          onClick={onOpenBrowser}
        >
          <BookOpen size={16} />
        </button>

        <div className="graph-picker">
          <select
            aria-label="Choose knowledge graph"
            value={graph?.id ?? ''}
            onChange={(event) => onGraphChange(event.target.value)}
          >
            {!isCurrentInGraphs && graph ? (
              <option value={graph.id}>{graph.title} (Browsing)</option>
            ) : null}
            {myGraphs.length > 0 ? (
              <optgroup label="My Graphs">
                {myGraphs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.isPrepared ? '' : ' - Draft'}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {attachedGraphs.length > 0 ? (
              <optgroup label="Attached Graphs">
                {attachedGraphs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {otherGraphs.length > 0 ? (
              <optgroup label="Public / Demo">
                {otherGraphs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          <ChevronDown aria-hidden="true" size={15} />
        </div>

        {graph ? (
          <div
            className="graph-access-summary"
            role="status"
            aria-label="Graph access status"
          >
            {graph.isPublic ? (
              <>
                <span
                  className="graph-visibility-badge is-public"
                  title="Public graph"
                >
                  <Globe size={12} aria-hidden="true" />
                  <span>Public</span>
                </span>
                <span className="graph-access-count" title="Active viewers">
                  <Users size={13} aria-hidden="true" />
                  <span>{graph.viewerCount ?? 0}</span>
                </span>
              </>
            ) : (
              <span
                className="graph-visibility-badge is-private"
                title="Private graph"
              >
                <Lock size={12} aria-hidden="true" />
                <span>Priv</span>
              </span>
            )}
            {graph.scheduledForDeletionAt ? (
              <span
                className="graph-visibility-badge is-scheduled-deletion"
                title={`Scheduled for deletion on ${new Date(graph.scheduledForDeletionAt).toLocaleDateString()} due to inactivity. Interacting with this graph will restore it.`}
              >
                <span>⚠️ Deletion Scheduled</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Zone 2: Active Graph Actions Island */}
      {(isUnattachedPublic && onAttachCurrent) || canEdit ? (
        <div className="topbar-zone topbar-zone-center">
          {isUnattachedPublic && onAttachCurrent ? (
            <button
              type="button"
              className="command-button topbar-attach-btn"
              title="Attach this graph to query and save to your list"
              onClick={onAttachCurrent}
            >
              <BookmarkPlus size={14} />
              <span>Attach</span>
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className={`icon-button ${isEditing ? 'is-active' : ''}`}
              title={t('edit')}
              aria-label={t('edit')}
              onClick={onToggleEditing}
            >
              <Settings2 size={17} />
            </button>
          ) : null}
          {canEdit && onOpenSettings ? (
            <button
              type="button"
              className="icon-button"
              title="Graph settings & visibility"
              aria-label="Graph settings & visibility"
              onClick={onOpenSettings}
            >
              <Sliders size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Zone 3: Status & Consolidated Account Hub */}
      <nav
        className="topbar-zone topbar-zone-right topbar-actions"
        aria-label="Account and status"
      >
        {/* Limits Dropdown */}
        <div className="limits-control">
          <button
            type="button"
            className={`icon-button ${limitsOpen ? 'is-active' : ''}`}
            title={t('limits')}
            aria-label={t('limits')}
            aria-expanded={limitsOpen}
            onClick={() => {
              const next = !limitsOpen;
              setLimitsOpen(next);
              if (next) {
                void onRefreshLimits?.();
              }
              setUserHubOpen(false);
              setNotificationsOpen(false);
            }}
          >
            <Gauge size={17} />
          </button>
          {limitsOpen ? (
            <div className="limits-menu" role="menu" aria-label={t('limits')}>
              <div className="limits-menu-heading">
                <strong>{t('limits')}</strong>
                <span>
                  {effectiveTier === 'REGISTERED'
                    ? 'Registered'
                    : isGuest
                      ? 'Guest'
                      : 'Free'}
                </span>
              </div>
              {limits ? (
                <>
                  {/* Storage Status */}
                  <div className="limits-section-title">
                    Source Document Storage
                  </div>
                  <div
                    className="limit-row storage-limit-row"
                    role="menuitem"
                    tabIndex={0}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%',
                        marginBottom: 4,
                      }}
                    >
                      <span>Used Capacity</span>
                      <strong>
                        {formatBytes(limits.storage?.usedBytes ?? 0)} /{' '}
                        {limits.storage?.limitMb ?? 100} MB
                      </strong>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '6px',
                        background: 'var(--line)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        marginTop: '4px',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, limits.storage?.usedPercentage ?? 0))}%`,
                          height: '100%',
                          background:
                            (limits.storage?.usedPercentage ?? 0) >= 100
                              ? 'var(--danger, #ef4444)'
                              : (limits.storage?.usedPercentage ?? 0) >= 80
                                ? 'var(--warning, #f59e0b)'
                                : 'var(--mint, #10b981)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <small style={{ marginTop: '4px' }}>
                      {limits.storage?.exceeded
                        ? 'Storage limit reached. Delete sources or ask an administrator to expand your quota.'
                        : isGuest
                          ? 'Account required to upload and store sources.'
                          : `${(limits.storage?.usedPercentage ?? 0).toFixed(1)}% of available storage allocated`}
                    </small>
                  </div>
                  {limits.sourceSizeBytes &&
                  limits.sourceSizeBytes.limit !== null &&
                  limits.sourceSizeBytes.limit > 0 ? (
                    <div
                      className="limit-row plan-limit-row"
                      role="menuitem"
                      tabIndex={0}
                    >
                      <span>{t('limitFileSize')}</span>
                      <strong>
                        {formatBytes(limits.sourceSizeBytes.limit)}
                      </strong>
                    </div>
                  ) : null}

                  {/* Plan Capabilities */}
                  <div className="limits-section-title">Capabilities</div>
                  <div
                    className="limit-row plan-limit-row"
                    role="menuitem"
                    tabIndex={0}
                  >
                    <span>Knowledge Graphs</span>
                    <strong>
                      {limits.canCreateGraphs
                        ? 'Unlimited'
                        : 'Query / Crawl Only'}
                    </strong>
                  </div>
                  <div
                    className="limit-row plan-limit-row"
                    role="menuitem"
                    tabIndex={0}
                  >
                    <span>Graph Traversal & Crawl</span>
                    <strong>
                      {effectiveTier === 'REGISTERED'
                        ? 'Full Depth & Multi-Seed'
                        : 'Shallow (1 Seed)'}
                    </strong>
                  </div>
                  <div
                    className="limit-row plan-limit-row"
                    role="menuitem"
                    tabIndex={0}
                  >
                    <span>Document Layout AI</span>
                    <strong>
                      {effectiveTier === 'REGISTERED'
                        ? 'Docling AI (Active)'
                        : 'Requires Account'}
                    </strong>
                  </div>
                  {isGuest &&
                  limits.selectedNodes &&
                  limits.selectedNodes.limit !== null ? (
                    <div
                      className="limit-row plan-limit-row"
                      role="menuitem"
                      tabIndex={0}
                    >
                      <span>{t('limitSelectedNodes')}</span>
                      <strong>{limits.selectedNodes.limit}</strong>
                    </div>
                  ) : null}

                  {/* Search Queue Status */}
                  <div className="limits-section-title">
                    Similarity Search Queue
                  </div>
                  <div
                    className="limit-row"
                    role="menuitem"
                    tabIndex={0}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>Global Queue Occupation</span>
                    <span
                      className={`badge-pill sm queue-badge ${limits.queueOccupation ?? 'low'}`}
                      style={{
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background:
                          limits.queueOccupation === 'high'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : limits.queueOccupation === 'mid'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(16, 185, 129, 0.15)',
                        color:
                          limits.queueOccupation === 'high'
                            ? '#ef4444'
                            : limits.queueOccupation === 'mid'
                              ? '#f59e0b'
                              : '#10b981',
                      }}
                    >
                      {limits.queueOccupation ?? 'low'}
                    </span>
                  </div>
                  <small
                    style={{
                      color: 'var(--muted)',
                      fontSize: '11px',
                      padding: '0 8px 6px 8px',
                      display: 'block',
                    }}
                  >
                    Postponing FIFO queue: queries slow down gracefully under
                    peak load.
                  </small>

                  <div className="limits-menu-footer">
                    {isGuest ? (
                      <button
                        type="button"
                        className="command-button accent limits-upgrade-btn"
                        onClick={() => {
                          setLimitsOpen(false);
                          onOpenAuth();
                        }}
                      >
                        Create Free Account
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="empty-state">{t('loadingLimits')}</p>
              )}
            </div>
          ) : null}
        </div>
        {graph ? (
          <button
            type="button"
            className="icon-button copy-graph-btn"
            title={t('copyGraph')}
            aria-label={t('copyGraph')}
            onClick={onCopy}
          >
            <Copy size={17} />
          </button>
        ) : null}
        <button
          type="button"
          className="command-button create-graph-btn"
          title={t('createGraph')}
          aria-label={t('createGraph')}
          onClick={onCreate}
        >
          <Plus size={16} />
          <span>{t('createGraph')}</span>
        </button>

        {/* Notifications Bell */}
        <div className="notifications-control">
          <button
            type="button"
            className={`icon-button notification-bell-btn ${notificationsOpen ? 'is-active' : ''}`}
            title="Notifications"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setLimitsOpen(false);
              setUserHubOpen(false);
            }}
          >
            <Bell size={17} />
            {unreadCount != null && unreadCount > 0 ? (
              <span
                className="notification-badge"
                aria-label={`${unreadCount} unread notifications`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>
          {notificationsOpen ? (
            <div
              className="notifications-menu"
              role="region"
              aria-label="Notifications"
            >
              <div className="notifications-menu-heading">
                <strong>Notifications</strong>
                {unreadCount != null && unreadCount > 0 ? (
                  <span className="unread-counter-tag">{unreadCount} new</span>
                ) : null}
                {unreadCount != null &&
                unreadCount > 0 &&
                onMarkAllNotificationsRead ? (
                  <button
                    type="button"
                    className="link-button mark-all-read-btn"
                    onClick={() => void onMarkAllNotificationsRead()}
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>
              {notifications && notifications.length > 0 ? (
                <div className="notifications-list" role="list">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      role="listitem"
                      className={`notification-card ${!item.isRead ? 'is-unread' : ''} ${item.data?.graphId ? 'is-interactive' : ''}`}
                      onClick={() => {
                        if (onNotificationClick) {
                          onNotificationClick(item);
                        } else {
                          if (!item.isRead && onMarkNotificationRead) {
                            onMarkNotificationRead(item.id);
                          }
                          if (item.data?.graphId) {
                            onGraphChange(item.data.graphId);
                          }
                        }
                        setNotificationsOpen(false);
                      }}
                    >
                      <div className="notification-card-main">
                        <div className="notification-card-header">
                          <span className="notification-card-title">
                            {item.title}
                          </span>
                          {!item.isRead ? (
                            <span
                              className="notification-unread-dot"
                              title="Unread"
                            />
                          ) : null}
                        </div>
                        <p className="notification-card-message">
                          {item.message}
                        </p>
                        <div className="notification-card-footer">
                          <span className="notification-card-time">
                            {new Date(item.createdAt).toLocaleDateString(
                              undefined,
                              {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                          </span>
                          {item.data?.graphId ? (
                            <span className="notification-card-action">
                              Click to keep active
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {onDeleteNotification ? (
                        <button
                          type="button"
                          className="notification-dismiss-btn"
                          title="Dismiss notification"
                          aria-label="Dismiss notification"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNotification(item.id);
                          }}
                        >
                          <X size={13} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state notifications-empty">
                  No notifications
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Unified Account & Preferences Hub */}
        <div className="user-hub-control" ref={userHubRef}>
          {identity?.isGuest ? (
            <div className="user-hub-guest-group">
              <button
                type="button"
                className="command-button accent header-signup-btn"
                onClick={onOpenAuth}
              >
                <CircleUserRound size={16} />
                <span>{t('signUp')}</span>
              </button>
              <button
                type="button"
                className={`icon-button user-hub-trigger-btn ${userHubOpen ? 'is-active' : ''}`}
                title="Preferences"
                aria-label="Preferences"
                aria-expanded={userHubOpen}
                onClick={() => {
                  setUserHubOpen((open) => !open);
                  setLimitsOpen(false);
                  setNotificationsOpen(false);
                }}
              >
                <Globe size={16} />
              </button>
            </div>
          ) : (
            <div className="account-actions">
              <button
                type="button"
                className={`user-hub-trigger-auth ${userHubOpen ? 'is-active' : ''}`}
                title="Account & Preferences"
                aria-label="Account & Preferences"
                aria-expanded={userHubOpen}
                onClick={() => {
                  setUserHubOpen((open) => !open);
                  setLimitsOpen(false);
                  setNotificationsOpen(false);
                }}
              >
                <span className="user-hub-avatar">
                  {(identity?.username ?? identity?.email ?? 'U')
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
                <span className="user-hub-tier-badge">
                  <span>
                    {identity?.tier === 'REGISTERED'
                      ? 'Registered'
                      : identity?.tier}
                  </span>
                </span>
                <ChevronDown size={13} className="user-hub-chevron" />
              </button>
            </div>
          )}

          {userHubOpen ? (
            <div
              className="user-hub-menu"
              role="menu"
              aria-label="Account & Preferences"
            >
              {identity && !identity.isGuest ? (
                <>
                  <div className="user-hub-profile-header">
                    <div className="user-hub-profile-avatar">
                      {(identity.username ?? identity.email ?? 'U')
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                    <div className="user-hub-profile-info">
                      <strong className="user-hub-profile-name">
                        {identity.username ||
                          identity.email?.split('@')[0] ||
                          'User'}
                      </strong>
                      <span className="user-hub-profile-email">
                        {identity.email || ''}
                      </span>
                    </div>
                  </div>

                  <div className="user-hub-tier-row">
                    <span className="user-hub-tier-tag">
                      <span>
                        {identity.tier === 'REGISTERED'
                          ? 'Registered'
                          : identity.tier}{' '}
                        Plan
                      </span>
                    </span>
                  </div>

                  <div className="user-hub-actions-section">
                    <button
                      type="button"
                      role="menuitem"
                      className="user-hub-menu-item"
                      title="Profile Settings"
                      aria-label="Profile Settings"
                      onClick={() => {
                        setUserHubOpen(false);
                        onOpenProfile();
                      }}
                    >
                      <CircleUserRound size={15} />
                      <span>Profile Settings</span>
                    </button>
                    {onOpenRetentionDashboard ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="user-hub-menu-item"
                        title="Retention & Cold Storage"
                        aria-label="Retention & Cold Storage"
                        onClick={() => {
                          setUserHubOpen(false);
                          onOpenRetentionDashboard();
                        }}
                      >
                        <Archive size={15} />
                        <span>Retention & Cold Storage</span>
                      </button>
                    ) : null}
                  </div>
                  <div className="user-hub-divider" />
                </>
              ) : null}

              {/* Preferences Section: Theme */}
              <div className="user-hub-section">
                <span className="user-hub-section-title">{t('theme')}</span>
                <div
                  className="user-hub-theme-segmented"
                  role="radiogroup"
                  aria-label={t('theme')}
                >
                  {(
                    [
                      ['light', Sun, 'themeLight'],
                      ['dark', Moon, 'themeDark'],
                      ['system', Monitor, 'themeSystem'],
                    ] as const
                  ).map(([value, Icon, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={value === theme}
                      className={`user-hub-theme-btn ${value === theme ? 'is-active' : ''}`}
                      onClick={() => onThemeChange(value)}
                    >
                      <Icon size={14} />
                      <span>{t(label)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferences Section: Language */}
              <div className="user-hub-section">
                <span className="user-hub-section-title">{t('language')}</span>
                <div
                  className="user-hub-lang-grid"
                  role="radiogroup"
                  aria-label={t('language')}
                >
                  {languageOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={opt.value === selectedLanguage.value}
                      className={`user-hub-lang-btn ${opt.value === selectedLanguage.value ? 'is-active' : ''}`}
                      onClick={() => changeLanguage(opt.value)}
                    >
                      <span className="country-flag">{opt.flag}</span>
                      <span>{t(opt.label)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {onOpenPrivacy ? (
                <>
                  <div className="user-hub-divider" />
                  <div className="user-hub-actions-section">
                    <button
                      type="button"
                      role="menuitem"
                      className="user-hub-menu-item"
                      title="Privacy & Cookie Policy"
                      aria-label="Privacy & Cookie Policy"
                      onClick={() => {
                        setUserHubOpen(false);
                        onOpenPrivacy();
                      }}
                      data-testid="user-hub-privacy-btn"
                    >
                      <ShieldCheck size={15} />
                      <span>Privacy & Cookies</span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value / (1024 * 1024))} MB`;
}
