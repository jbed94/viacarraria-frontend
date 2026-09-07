import {
  Archive,
  ArrowLeft,
  CreditCard,
  LayoutDashboard,
  Menu,
  Moon,
  Network,
  ScrollText,
  Server,
  Shield,
  Sliders,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { useTheme } from '../../hooks/use-theme';
import { useGraphStore } from '../../store/graph-store';
import { AdminAuthGuard } from './admin-auth-guard';
import { AdminAuditTab } from './tabs/admin-audit-tab';
import { AdminGraphsTab } from './tabs/admin-graphs-tab';
import { AdminOverviewTab } from './tabs/admin-overview-tab';
import { AdminRetentionTab } from './tabs/admin-retention-tab';
import { AdminSettingsTab } from './tabs/admin-settings-tab';
import { AdminSubscriptionsTab } from './tabs/admin-subscriptions-tab';
import { AdminSystemTab } from './tabs/admin-system-tab';
import { AdminUsersTab } from './tabs/admin-users-tab';

type AdminTab =
  | 'overview'
  | 'users'
  | 'graphs'
  | 'retention'
  | 'subscriptions'
  | 'settings'
  | 'system'
  | 'audit';

type AdminPageProps = {
  onBackToCanvas: () => void;
  onOpenGraphOnCanvas?: (graphId: string) => void;
};

export function AdminPage({
  onBackToCanvas,
  onOpenGraphOnCanvas,
}: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const identity = useGraphStore((state) => state.identity);

  const tabs: Array<{
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: 'overview', label: 'Overview & KPIs', icon: LayoutDashboard },
    { id: 'users', label: 'User Accounts', icon: Users },
    { id: 'graphs', label: 'Knowledge Graphs', icon: Network },
    { id: 'retention', label: 'Retention & Archives', icon: Archive },
    { id: 'subscriptions', label: 'Revenue & Billing', icon: CreditCard },
    { id: 'settings', label: 'System Configuration', icon: Sliders },
    { id: 'system', label: 'Cluster & Proxy Health', icon: Server },
    { id: 'audit', label: 'Admin Audit Trail', icon: ScrollText },
  ];

  return (
    <AdminAuthGuard onBackToCanvas={onBackToCanvas}>
      <div className="admin-portal-root">
        {/* Top Navigation Bar */}
        <header className="admin-portal-header">
          <div className="portal-brand">
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="portal-logo-group" onClick={onBackToCanvas}>
              <div className="portal-badge-icon">
                <Shield size={18} />
              </div>
              <h1>Via Carraria</h1>
              <span className="admin-env-pill">ADMIN</span>
            </div>
          </div>

          <div className="portal-header-actions">
            <div className="portal-user-meta">
              <span className="portal-user-role">Administrator</span>
              <span className="portal-user-email">
                {identity?.email || identity?.username || 'Key Authorized'}
              </span>
            </div>

            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              type="button"
              className="admin-btn secondary back-canvas-btn"
              onClick={onBackToCanvas}
            >
              <ArrowLeft size={14} />
              <span>Back to Canvas</span>
            </button>
          </div>
        </header>

        {/* Main Body Layout */}
        <div className="admin-portal-body">
          {/* Sidebar */}
          <aside
            className={`admin-portal-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}
          >
            <nav className="portal-nav-list">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`portal-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <IconComponent size={17} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="portal-sidebar-footer">
              <div className="footer-system-summary">
                <span className="pulse-dot" />
                <span>Cluster Online</span>
              </div>
              <small className="footer-version">v0.1.0 • Via Carraria</small>
            </div>
          </aside>

          {/* Tab Content Panel */}
          <main className="admin-portal-content">
            {activeTab === 'overview' && (
              <AdminOverviewTab
                onNavigateTab={(tab) => setActiveTab(tab as AdminTab)}
              />
            )}
            {activeTab === 'users' && <AdminUsersTab />}
            {activeTab === 'graphs' && (
              <AdminGraphsTab onOpenGraphOnCanvas={onOpenGraphOnCanvas} />
            )}
            {activeTab === 'retention' && <AdminRetentionTab />}
            {activeTab === 'subscriptions' && <AdminSubscriptionsTab />}
            {activeTab === 'settings' && <AdminSettingsTab />}
            {activeTab === 'system' && <AdminSystemTab />}
            {activeTab === 'audit' && <AdminAuditTab />}
          </main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
