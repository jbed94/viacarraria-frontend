import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Identity, LimitsSummary } from '../../types/api';
import '../../i18n';
import { Header } from './header';

const graph = {
  id: 'graph',
  title: 'Public graph',
  description: null,
  userId: 'owner',
  isPublic: true,
  isPrepared: true,
  nodes: [],
  edges: [],
  isOwned: false,
  permission: 'VIEWER' as const,
  canEdit: false,
  accessCount: 5,
  sources: [],
};

const props = {
  graphs: [graph],
  isEditing: false,
  onGraphChange: vi.fn(),
  onCopy: vi.fn(),
  onCreate: vi.fn(),
  onToggleEditing: vi.fn(),
  onOpenBrowser: vi.fn(),
  onOpenSettings: vi.fn(),
  onAttachCurrent: vi.fn(),
  onOpenAuth: vi.fn(),
  onOpenProfile: vi.fn(),
  onOpenPricing: vi.fn(),
  theme: 'light' as const,
  onThemeChange: vi.fn(),
  limits: {
    tier: 'FREE' as const,
    graphs: { used: 3, limit: 3, exceeded: true },
    privateGraphs: { used: 1, limit: 2, exceeded: false },
    queries: { used: 20, limit: 20, exceeded: true },
    uploads: { used: 2, limit: 10, exceeded: false },
    selectedNodes: { used: 0, limit: 10, exceeded: false },
    nodesPerGraph: { used: 14, limit: 10, exceeded: true },
    sourcesPerNode: { used: 3, limit: 3, exceeded: true },
    sourceSizeBytes: { used: 0, limit: 2 * 1024 * 1024, exceeded: false },
    extendedContext: { used: 0, limit: 3, exceeded: false },
  } satisfies LimitsSummary,
};

describe('Header graph access controls', () => {
  afterEach(cleanup);

  it('shows public badge and viewer count for public graphs', () => {
    const publicGraph = {
      ...graph,
      isPublic: true,
      viewerCount: 5,
    };
    render(<Header {...props} graph={publicGraph} />);

    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy graph' }),
    ).toBeInTheDocument();
    expect(screen.queryByTitle('Edit graph')).not.toBeInTheDocument();
  });

  it('shows Priv indicator without access count for private graphs', () => {
    const privateGraph = {
      ...graph,
      isPublic: false,
      viewerCount: 0,
    };
    render(<Header {...props} graph={privateGraph} />);

    expect(screen.getByText('Priv')).toBeInTheDocument();
    expect(screen.queryByText('Public')).not.toBeInTheDocument();
  });

  it('shows edit and settings controls only when the server grants edit permission', () => {
    const ownedGraph = {
      ...graph,
      isPublic: false,
      isOwned: true,
      permission: 'OWNER' as const,
      canEdit: true,
      accessCount: 1,
    };
    render(<Header {...props} graph={ownedGraph} />);

    expect(screen.getByTitle('Edit graph')).toBeInTheDocument();
    expect(
      screen.getByTitle('Graph settings & visibility'),
    ).toBeInTheDocument();
    expect(screen.getByText('Priv')).toBeInTheDocument();
  });

  it('shows scheduled for deletion warning badge when scheduledForDeletionAt is present', () => {
    const scheduledGraph = {
      ...graph,
      scheduledForDeletionAt: '2026-10-15T00:00:00.000Z',
    };
    render(<Header {...props} graph={scheduledGraph} />);

    expect(screen.getByText('⚠️ Deletion Scheduled')).toBeInTheDocument();
  });

  it('opens the current quota context menu with separate Quotas and Plan limits sections', () => {
    render(<Header {...props} graph={graph} />);

    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));

    expect(screen.getByRole('menu', { name: 'Limits' })).toBeInTheDocument();
    expect(screen.getByText('Quotas')).toBeInTheDocument();
    expect(screen.getByText('Plan limits')).toBeInTheDocument();

    // Quotas section
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByText('20 / 20')).toBeInTheDocument();
    expect(screen.getByText('2 / 10')).toBeInTheDocument();
    expect(screen.getAllByText('At limit').length).toBeGreaterThanOrEqual(2);

    // Plan limits section
    expect(screen.getByText('Nodes per graph')).toBeInTheDocument();
    expect(screen.getByText('Sources per node')).toBeInTheDocument();
    expect(screen.getByText('Max file size')).toBeInTheDocument();
    expect(screen.getByText('2 MB')).toBeInTheDocument();
    expect(screen.getByText('Nodes per search')).toBeInTheDocument();
    expect(screen.getByText('Extended search chunks')).toBeInTheDocument();
  });

  it('displays clean anonymous quota and plan limit values without per-node usage ratios', () => {
    const anonymousProps = {
      ...props,
      limits: {
        tier: 'ANONYMOUS' as const,
        graphs: { used: 0, limit: 0, exceeded: true },
        privateGraphs: { used: 0, limit: 0, exceeded: true },
        queries: { used: 1, limit: 3, exceeded: false },
        uploads: { used: 0, limit: 0, exceeded: true },
        selectedNodes: { used: 0, limit: 2, exceeded: false },
        nodesPerGraph: { used: 0, limit: 0, exceeded: true },
        sourcesPerNode: { used: 0, limit: 0, exceeded: true },
        sourceSizeBytes: { used: 0, limit: 0, exceeded: false },
        extendedContext: { used: 0, limit: 0, exceeded: false },
      } satisfies LimitsSummary,
    };
    render(<Header {...anonymousProps} graph={graph} />);

    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // selected nodes limit
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText('0 / 0')).not.toBeInTheDocument();
  });

  it('renders notification bell with badge and displays notifications list on click', () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        userId: 'owner',
        type: 'GRAPH_INACTIVITY_WARNING',
        title: 'Graph scheduled for deletion',
        message: 'Your graph "Architecture" has been inactive for 90 days.',
        data: { graphId: 'arch-graph-123' },
        isRead: false,
        createdAt: '2026-09-06T10:00:00.000Z',
      },
      {
        id: 'notif-2',
        userId: 'owner',
        type: 'GENERAL',
        title: 'System maintenance',
        message: 'Scheduled maintenance completed.',
        data: null,
        isRead: true,
        createdAt: '2026-09-05T10:00:00.000Z',
      },
    ];

    const onMarkAllRead = vi.fn();
    const onMarkRead = vi.fn();
    const onDelete = vi.fn();
    const onGraphChange = vi.fn();

    render(
      <Header
        {...props}
        graph={graph}
        notifications={mockNotifications}
        unreadCount={1}
        onMarkAllNotificationsRead={onMarkAllRead}
        onMarkNotificationRead={onMarkRead}
        onDeleteNotification={onDelete}
        onGraphChange={onGraphChange}
      />,
    );

    // Bell button and unread badge
    const bellBtn = screen.getByRole('button', { name: 'Notifications' });
    expect(bellBtn).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    // Click to open popover
    fireEvent.click(bellBtn);
    expect(
      screen.getByRole('region', { name: 'Notifications' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Graph scheduled for deletion'),
    ).toBeInTheDocument();
    expect(screen.getByText('System maintenance')).toBeInTheDocument();

    // Mark all read button
    const markAllBtn = screen.getByRole('button', { name: /Mark all read/i });
    fireEvent.click(markAllBtn);
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);

    // Dismiss button on notification
    const dismissBtns = screen.getAllByRole('button', {
      name: 'Dismiss notification',
    });
    expect(dismissBtns[0]).toBeDefined();
    fireEvent.click(dismissBtns[0]!);
    expect(onDelete).toHaveBeenCalledWith('notif-1');

    // Clicking notification card triggers graph change and mark read
    const notifCard = screen
      .getByText('Graph scheduled for deletion')
      .closest('.notification-card')!;
    fireEvent.click(notifCard);
    expect(onMarkRead).toHaveBeenCalledWith('notif-1');
    expect(onGraphChange).toHaveBeenCalledWith('arch-graph-123');
  });

  it('renders retention dashboard button for authenticated users and triggers callback', () => {
    const onOpenRetentionDashboard = vi.fn();
    const authenticatedIdentity = {
      userId: 'user-1',
      username: 'johndoe',
      email: 'john@example.com',
      tier: 'FREE' as const,
      isGuest: false,
    };

    render(
      <Header
        {...props}
        graph={graph}
        identity={authenticatedIdentity}
        onOpenRetentionDashboard={onOpenRetentionDashboard}
      />,
    );

    const retentionBtn = screen.getByTitle('Retention & Cold Storage');
    expect(retentionBtn).toBeInTheDocument();

    fireEvent.click(retentionBtn);
    expect(onOpenRetentionDashboard).toHaveBeenCalledTimes(1);
  });

  it('does not render an Admin button for any identity tier or role', () => {
    const adminIdentity: Identity = {
      userId: 'admin-1',
      username: 'admin',
      email: 'admin@example.com',
      tier: 'PRO',
      role: 'admin',
      isGuest: false,
    };

    render(<Header {...props} graph={graph} identity={adminIdentity} />);

    expect(
      screen.queryByRole('button', { name: /Admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTitle('Open Administration Dashboard'),
    ).not.toBeInTheDocument();
  });
});
