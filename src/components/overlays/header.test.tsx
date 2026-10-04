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
  theme: 'light' as const,
  onThemeChange: vi.fn(),
  limits: {
    tier: 'REGISTERED' as const,
    storage: {
      usedBytes: 15 * 1024 * 1024,
      limitBytes: 100 * 1024 * 1024,
      limitMb: 100,
      usedPercentage: 15,
      exceeded: false,
    },
    queueOccupation: 'low' as const,
    canCreateGraphs: true,
    crawl: {
      allowedDepths: ['shallow', 'default', 'deep', 'unlimited'],
      maxStartingPoints: null,
      allowComparative: true,
    },
    graphs: { used: 3, limit: null, exceeded: false },
    privateGraphs: { used: 1, limit: null, exceeded: false },
    queries: { used: 20, limit: null, exceeded: false },
    uploads: { used: 2, limit: null, exceeded: false },
    selectedNodes: { used: 0, limit: null, exceeded: false },
    nodesPerGraph: { used: 14, limit: null, exceeded: false },
    sourcesPerNode: { used: 3, limit: null, exceeded: false },
    sourceSizeBytes: { used: 0, limit: 50 * 1024 * 1024, exceeded: false },
    extendedContext: { used: 0, limit: null, exceeded: false },
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

  it('opens the current quota context menu with storage, queue occupation, and capabilities', () => {
    render(<Header {...props} graph={graph} />);

    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));

    expect(screen.getByRole('menu', { name: 'Limits' })).toBeInTheDocument();
    expect(screen.getByText('Source Document Storage')).toBeInTheDocument();
    expect(screen.getByText('Similarity Search Queue')).toBeInTheDocument();
    expect(screen.getByText('Capabilities')).toBeInTheDocument();

    // Storage section
    expect(screen.getByText('15 MB / 100 MB')).toBeInTheDocument();

    // Queue Occupation
    expect(screen.getByText('low')).toBeInTheDocument();

    // Capabilities section
    expect(screen.getByText('Knowledge Graphs')).toBeInTheDocument();
    expect(screen.getAllByText('Unlimited').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Graph Traversal & Crawl')).toBeInTheDocument();
    expect(screen.getByText('Full Depth & Multi-Seed')).toBeInTheDocument();
  });

  it('displays clean anonymous quota and plan limit values without per-node usage ratios', () => {
    const anonymousProps = {
      ...props,
      limits: {
        tier: 'ANONYMOUS' as const,
        storage: {
          usedBytes: 0,
          limitBytes: 0,
          limitMb: 0,
          usedPercentage: 0,
          exceeded: true,
        },
        queueOccupation: 'low' as const,
        canCreateGraphs: false,
        crawl: {
          allowedDepths: ['shallow'],
          maxStartingPoints: 1,
          allowComparative: false,
        },
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

    expect(screen.getByText('Source Document Storage')).toBeInTheDocument();
    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Query / Crawl Only')).toBeInTheDocument();
    expect(screen.getByText('Shallow (1 Seed)')).toBeInTheDocument();
    expect(screen.getByText('Requires Account')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // guest selected nodes limit
    expect(screen.queryByText('Daily queries')).not.toBeInTheDocument();
    expect(screen.queryByText('Nodes per graph')).not.toBeInTheDocument();
    expect(screen.queryByText('1 / 3')).not.toBeInTheDocument();
  });

  it('displays Crawl and PDF capabilities in limits menu for registered users', () => {
    const registeredProps = {
      ...props,
      identity: {
        userId: 'u1',
        email: 'u1@example.com',
        username: 'u1',
        isGuest: false,
        tier: 'REGISTERED' as const,
      },
      limits: {
        tier: 'REGISTERED' as const,
        storage: {
          usedBytes: 15 * 1024 * 1024,
          limitBytes: 100 * 1024 * 1024,
          limitMb: 100,
          usedPercentage: 15,
          exceeded: false,
        },
        queueOccupation: 'low' as const,
        canCreateGraphs: true,
        crawl: {
          allowedDepths: ['shallow', 'default', 'deep', 'unlimited'],
          maxStartingPoints: null,
          allowComparative: true,
        },
      } satisfies LimitsSummary,
    };

    render(<Header {...registeredProps} graph={graph} />);
    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));

    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Full Depth & Multi-Seed')).toBeInTheDocument();
    expect(screen.getByText('Docling AI (Active)')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Upgrade/i }),
    ).not.toBeInTheDocument();
  });

  it('triggers onOpenAuth when guest clicks Create Free Account in limits menu', () => {
    const onOpenAuth = vi.fn();
    const anonProps = {
      ...props,
      onOpenAuth,
      identity: {
        userId: 'guest-1',
        email: null,
        username: null,
        isGuest: true,
        tier: 'ANONYMOUS' as const,
      },
      limits: {
        tier: 'ANONYMOUS' as const,
        storage: {
          usedBytes: 0,
          limitBytes: 0,
          limitMb: 0,
          usedPercentage: 0,
          exceeded: true,
        },
        queueOccupation: 'low' as const,
        canCreateGraphs: false,
        crawl: {
          allowedDepths: ['shallow'],
          maxStartingPoints: 1,
          allowComparative: false,
        },
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

    render(<Header {...anonProps} graph={graph} />);
    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));

    const signUpBtn = screen.getByRole('button', {
      name: 'Create Free Account',
    });
    expect(signUpBtn).toBeInTheDocument();
    fireEvent.click(signUpBtn);
    expect(onOpenAuth).toHaveBeenCalled();
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
      tier: 'REGISTERED' as const,
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

    // Open unified Account & Preferences hub
    const accountTrigger = screen.getByRole('button', {
      name: 'Account & Preferences',
    });
    expect(accountTrigger).toBeInTheDocument();
    fireEvent.click(accountTrigger);

    const retentionBtn = screen.getByTitle('Retention & Cold Storage');
    expect(retentionBtn).toBeInTheDocument();

    fireEvent.click(retentionBtn);
    expect(onOpenRetentionDashboard).toHaveBeenCalledTimes(1);
  });

  it('renders unified Account & Preferences hub with profile, tier, and preferences', () => {
    const onOpenProfile = vi.fn();
    const onThemeChange = vi.fn();
    const authenticatedIdentity = {
      userId: 'user-1',
      username: 'johndoe',
      email: 'john@example.com',
      tier: 'REGISTERED' as const,
      isGuest: false,
    };

    render(
      <Header
        {...props}
        graph={graph}
        identity={authenticatedIdentity}
        onOpenProfile={onOpenProfile}
        onThemeChange={onThemeChange}
      />,
    );

    const accountTrigger = screen.getByRole('button', {
      name: 'Account & Preferences',
    });
    fireEvent.click(accountTrigger);

    expect(
      screen.getByRole('menu', { name: 'Account & Preferences' }),
    ).toBeInTheDocument();
    expect(screen.getByText('johndoe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Registered Plan')).toBeInTheDocument();

    // Click Profile Settings
    const profileBtn = screen.getByRole('menuitem', {
      name: 'Profile Settings',
    });
    fireEvent.click(profileBtn);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it('renders preferences trigger for guest users and switches theme', () => {
    const onThemeChange = vi.fn();
    const guestIdentity = {
      userId: 'guest-1',
      username: null,
      email: null,
      isGuest: true,
      tier: 'ANONYMOUS' as const,
    };

    render(
      <Header
        {...props}
        graph={graph}
        identity={guestIdentity}
        onThemeChange={onThemeChange}
      />,
    );

    const prefsBtn = screen.getByRole('button', { name: 'Preferences' });
    expect(prefsBtn).toBeInTheDocument();
    fireEvent.click(prefsBtn);

    expect(
      screen.getByRole('menu', { name: 'Account & Preferences' }),
    ).toBeInTheDocument();
    const darkThemeBtn = screen.getByRole('radio', { name: 'Dark' });
    fireEvent.click(darkThemeBtn);
    expect(onThemeChange).toHaveBeenCalledWith('dark');
  });

  it('does not render an Admin button for any identity tier or role', () => {
    const adminIdentity: Identity = {
      userId: 'admin-1',
      username: 'admin',
      email: 'admin@example.com',
      tier: 'REGISTERED',
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

  it('renders Privacy & Cookies button in user hub and calls onOpenPrivacy on click', () => {
    const onOpenPrivacy = vi.fn();
    render(
      <Header
        {...props}
        graph={graph}
        identity={{
          userId: 'user-1',
          username: 'johndoe',
          email: 'john@example.com',
          isGuest: false,
          tier: 'REGISTERED',
        }}
        onOpenPrivacy={onOpenPrivacy}
      />,
    );

    const accountTrigger = screen.getByRole('button', {
      name: 'Account & Preferences',
    });
    fireEvent.click(accountTrigger);

    const privacyBtn = screen.getByTestId('user-hub-privacy-btn');
    expect(privacyBtn).toBeInTheDocument();
    fireEvent.click(privacyBtn);
    expect(onOpenPrivacy).toHaveBeenCalledTimes(1);
  });

  it('renders pulsing brand icon when isSearching is true', () => {
    const { container } = render(
      <Header {...props} graph={graph} isSearching={true} />,
    );

    const brandIcon = container.querySelector('.brand-mark svg');
    expect(brandIcon).toHaveClass('is-pulsing');
  });
});
