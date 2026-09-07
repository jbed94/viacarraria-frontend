import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, setAdminKey, triggerBlobDownload } from '../../lib/api';
import { useGraphStore } from '../../store/graph-store';
import type {
  AdminBillingEvent,
  AdminGraph,
  AdminGraphDetails,
  AdminOverviewStats,
  AdminSystemSettings,
  AdminSystemStatus,
  AdminUser,
  AdminAuditEvent,
  AuditLogArchive,
  AdminUserDetails,
  GraphArchiveItem,
  RetentionAuditStats,
} from '../../types/api';
import { AdminAuthGuard } from './admin-auth-guard';
import { AdminPage } from './admin-page';

vi.mock('../../lib/api', () => ({
  getAdminKey: vi.fn(),
  setAdminKey: vi.fn(),
  triggerBlobDownload: vi.fn(),
  api: {
    downloadArchiveUrl: vi.fn(
      (graphId: string, isAdmin?: boolean) =>
        `/api/${isAdmin ? 'admin' : 'graphs'}/${graphId}/archive`,
    ),
    admin: {
      verify: vi.fn(),
      overview: vi.fn(),
      systemStatus: vi.fn(),
      storageProxyStatus: vi.fn(),
      users: vi.fn(),
      user: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      graphs: vi.fn(),
      graph: vi.fn(),
      updateGraph: vi.fn(),
      updateGraphContent: vi.fn(),
      deleteGraph: vi.fn(),
      retentionAudit: vi.fn(),
      retentionArchives: vi.fn(),
      runRetentionSweep: vi.fn(),
      restoreArchive: vi.fn(),
      deleteArchive: vi.fn(),
      subscriptionEvents: vi.fn(),
      grantSubscription: vi.fn(),
      revokeSubscription: vi.fn(),
      exportUsers: vi.fn(),
      exportSubscriptionEvents: vi.fn(),
      batchUsers: vi.fn(),
      batchGraphs: vi.fn(),
      getSettings: vi.fn(),
      updateSettings: vi.fn(),
      getAuditLogs: vi.fn(),
      archiveAuditLogs: vi.fn(),
      getAuditArchives: vi.fn(),
      getAuditArchiveDownloadUrl: vi.fn(),
      previewAuditArchive: vi.fn(),
    },
  },
}));

const mockOverviewStats: AdminOverviewStats = {
  users: {
    total: 240,
    pro: 45,
    free: 180,
    anonymous: 15,
    newLast30Days: 28,
  },
  revenue: {
    monthlyRecurringRevenue: 1350,
    proPriceUsd: 29.99,
    activeSubscriptions: 45,
    recentEvents: [
      {
        id: 'evt-1',
        userId: 'usr-1',
        eventType: 'invoice.payment_succeeded',
        provider: 'stripe',
        createdAt: '2026-09-05T12:00:00.000Z',
      },
    ],
  },
  requests: {
    totalQueries: 3600,
    queriesLast24Hours: 1200,
    currentRequestsPerHour: 180,
    avgRequestsPerHour: 50,
    hourlyDistribution: [
      { hour: '12:00', count: 120 },
      { hour: '13:00', count: 150 },
      { hour: '14:00', count: 180 },
    ],
  },
  graphs: {
    total: 320,
    public: 110,
    private: 210,
    active: 300,
    inactive: 15,
    scheduledForDeletion: 5,
    retentionExempt: 40,
  },
  storage: {
    totalSources: 85,
    totalStorageBytes: 52428800,
    archivesCount: 8,
    archivesBytes: 15728640,
  },
};

const mockUser: AdminUser = {
  id: 'usr-1',
  name: 'Test User',
  email: 'test@example.com',
  username: 'testuser',
  isAnonymous: false,
  subscriptionTier: 'PRO',
  subscriptionExpiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
  preferredLanguage: 'en',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  graphsCount: 4,
  sourcesCount: 12,
};

const mockUserDetails: AdminUserDetails = {
  user: mockUser,
  graphs: [
    {
      id: 'g-101',
      title: 'Distributed Systems Map',
      isPublic: true,
      isExemptFromRetention: true,
      lastAccessedAt: '2026-09-05T00:00:00.000Z',
      createdAt: '2026-08-10T00:00:00.000Z',
    },
  ],
  recentQueries: [
    {
      id: 'q-1',
      graphId: 'g-101',
      queryText: 'Find edge router node',
      createdAt: '2026-09-05T00:00:00.000Z',
    },
  ],
  billingEvents: [
    {
      id: 'evt-1',
      provider: 'stripe',
      eventType: 'payment_succeeded',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  storage: {
    sourcesCount: 3,
    totalBytes: 15728640,
  },
};

const mockGraph: AdminGraph = {
  id: 'g-101',
  title: 'Distributed Systems Map',
  description: 'Microservices & event topology',
  userId: 'usr-1',
  isPublic: true,
  isPrepared: true,
  lastAccessedAt: '2026-09-05T00:00:00.000Z',
  scheduledForDeletionAt: null,
  isExemptFromRetention: true,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-09-05T00:00:00.000Z',
  ownerEmail: 'test@example.com',
  ownerName: 'Test User',
  nodeCount: 18,
  sourceCount: 3,
};

const mockGraphDetails: AdminGraphDetails = {
  ...mockGraph,
  nodes: [
    {
      id: 'n-1',
      position: { x: 100, y: 100 },
      data: { title: 'Cluster Gateway', description: 'API ingress' },
    },
  ],
  edges: [
    {
      id: 'e-1',
      source: 'n-1',
      target: 'n-2',
    },
  ],
  sources: [],
};

const mockRetentionAudit: RetentionAuditStats = {
  totalActiveGraphs: 320,
  inactiveCandidateCount: 12,
  scheduledForDeletionCount: 5,
  exemptGraphsCount: 40,
  activeArchivesCount: 8,
  estimatedReclaimBytes: 52428800,
};

const mockArchive: GraphArchiveItem = {
  id: 'arch-101',
  graphId: 'g-101',
  userId: 'usr-1',
  title: 'Distributed Systems Map Archive',
  sourceCount: 3,
  sizeBytes: 15728640,
  archiveUrl: '/api/admin/graphs/g-101/archive',
  createdAt: '2026-09-01T00:00:00.000Z',
  expiresAt: new Date(Date.now() + 86400000 * 15).toISOString(),
};

const mockBillingEvent: AdminBillingEvent = {
  id: 'evt-1',
  userId: 'usr-1',
  provider: 'stripe',
  externalEventId: 'evt_stripe_123',
  eventType: 'invoice.payment_succeeded',
  payload: { invoiceId: 'inv-9988' },
  createdAt: '2026-09-05T12:00:00.000Z',
  userEmail: 'test@example.com',
  userName: 'Test User',
};

const mockSystemStatus: AdminSystemStatus = {
  health: {
    status: 'ok',
    services: {
      database: true,
      redis: true,
      rabbitMq: true,
      weaviate: true,
    },
  },
  storageProxy: {
    driver: 's3',
    proxyEndpoint: 'http://minio:9000',
    bucket: 'viacarraria-sources',
    isProxy: true,
    upstreamProvider: 's3',
    upstreamBucket: 'production-s3',
    connected: true,
  },
  process: {
    uptimeSeconds: 86400,
    nodeVersion: 'v22.18.0',
    memoryMb: {
      rss: 120,
      heapTotal: 90,
      heapUsed: 65,
    },
    env: 'production',
  },
};

const mockSystemSettings: AdminSystemSettings = {
  retentionDays: 90,
  retentionGraceDays: 7,
  freeTierLimits: {
    maxNodes: 100,
    maxSourcesPerGraph: 5,
    maxSourceSizeBytes: 26214400,
  },
  proTierLimits: {
    maxNodes: 5000,
    maxSourcesPerGraph: 50,
    maxSourceSizeBytes: 104857600,
  },
  rateLimits: {
    anonymousPerMinute: 30,
    authenticatedPerMinute: 120,
    burstMultiplier: 2,
  },
  maintenanceMode: false,
  maintenanceExemptions: {
    allowedIps: ['127.0.0.1', '::1'],
    exemptUserIds: ['usr-exempt-1'],
    exemptRoles: ['admin'],
  },
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const mockAuditEvent: AdminAuditEvent = {
  id: 'audit-101',
  timestamp: '2026-09-06T20:00:00.000Z',
  actorId: 'admin-1',
  actorEmail: 'admin@viacarraria.io',
  action: 'system.maintenance_enable',
  targetType: 'system',
  targetId: 'settings',
  details: { maintenanceMode: true, reason: 'Cluster upgrade' },
  ip: '127.0.0.1',
};

const mockAuditArchive: AuditLogArchive = {
  id: 'arch-101',
  key: 'audit-logs/2026/09/audit-log-2026-09-07T00-00-00-000Z-arch-101.json.gz',
  filename: 'audit-log-2026-09-07T00-00-00-000Z-arch-101.json.gz',
  eventCount: 42,
  sizeBytes: 15360,
  firstEventTimestamp: '2026-09-01T00:00:00.000Z',
  lastEventTimestamp: '2026-09-07T00:00:00.000Z',
  createdAt: '2026-09-07T00:00:00.000Z',
};

describe('Admin Portal Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.admin.verify).mockResolvedValue({
      authorized: true,
      identity: { id: 'admin-1', email: 'admin@viacarraria.io', role: 'admin' },
    });
    vi.mocked(api.admin.overview).mockResolvedValue(mockOverviewStats);
    vi.mocked(api.admin.users).mockResolvedValue({
      users: [mockUser],
      pagination: {
        total: 1,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
    });
    vi.mocked(api.admin.user).mockResolvedValue(mockUserDetails);
    vi.mocked(api.admin.updateUser).mockResolvedValue(mockUserDetails);
    vi.mocked(api.admin.deleteUser).mockResolvedValue({
      deleted: true,
      userId: 'usr-1',
    });
    vi.mocked(api.admin.graphs).mockResolvedValue({
      graphs: [mockGraph],
      pagination: {
        total: 1,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
    });
    vi.mocked(api.admin.graph).mockResolvedValue(mockGraphDetails);
    vi.mocked(api.admin.updateGraph).mockResolvedValue(mockGraphDetails);
    vi.mocked(api.admin.updateGraphContent).mockResolvedValue(mockGraphDetails);
    vi.mocked(api.admin.deleteGraph).mockResolvedValue({
      deleted: true,
      graphId: 'g-101',
    });
    vi.mocked(api.admin.retentionAudit).mockResolvedValue(mockRetentionAudit);
    vi.mocked(api.admin.retentionArchives).mockResolvedValue([mockArchive]);
    vi.mocked(api.admin.subscriptionEvents).mockResolvedValue({
      events: [mockBillingEvent],
      pagination: {
        total: 1,
        page: 1,
        limit: 15,
        totalPages: 1,
      },
    });
    vi.mocked(api.admin.systemStatus).mockResolvedValue(mockSystemStatus);
    vi.mocked(api.admin.exportUsers).mockResolvedValue(
      new Blob(['id,name\nusr-1,Alice']),
    );
    vi.mocked(api.admin.exportSubscriptionEvents).mockResolvedValue(
      new Blob(['id,eventType\nevt-1,invoice.payment_succeeded']),
    );
    vi.mocked(api.admin.batchUsers).mockResolvedValue({
      success: true,
      action: 'set_tier',
      count: 1,
    });
    vi.mocked(api.admin.batchGraphs).mockResolvedValue({
      success: true,
      action: 'set_retention_exempt',
      count: 1,
    });
    vi.mocked(api.admin.getSettings).mockResolvedValue(mockSystemSettings);
    vi.mocked(api.admin.updateSettings).mockImplementation(async (patch) => ({
      ...mockSystemSettings,
      ...patch,
      freeTierLimits: {
        ...mockSystemSettings.freeTierLimits,
        ...(patch.freeTierLimits ?? {}),
      },
      proTierLimits: {
        ...mockSystemSettings.proTierLimits,
        ...(patch.proTierLimits ?? {}),
      },
      rateLimits: {
        ...mockSystemSettings.rateLimits,
        ...(patch.rateLimits ?? {}),
      },
      maintenanceExemptions: {
        ...mockSystemSettings.maintenanceExemptions,
        ...(patch.maintenanceExemptions ?? {}),
      },
      updatedAt: '2026-09-06T22:00:00.000Z',
    }));
    vi.mocked(api.admin.getAuditLogs).mockResolvedValue({
      items: [mockAuditEvent],
      total: 1,
      limit: 25,
      offset: 0,
    });
    vi.mocked(api.admin.getAuditArchives).mockResolvedValue({
      items: [mockAuditArchive],
      total: 1,
      limit: 50,
      offset: 0,
    });
    vi.mocked(api.admin.archiveAuditLogs).mockResolvedValue(mockAuditArchive);
    vi.mocked(api.admin.getAuditArchiveDownloadUrl).mockImplementation(
      (id: string) => `/mock/download/${id}`,
    );
    vi.mocked(api.admin.previewAuditArchive).mockResolvedValue({
      archive: mockAuditArchive,
      items: [
        {
          id: 'ev-archived-1',
          timestamp: '2026-09-07T00:00:00.000Z',
          actorId: 'admin-1',
          actorEmail: 'admin@viacarraria.io',
          action: 'system.maintenance_enable',
          targetType: 'system',
          targetId: 'settings',
          details: { reason: 'Scheduled DB upgrade' },
        },
      ],
      total: 1,
      limit: 25,
      offset: 0,
    });

    useGraphStore.getState().setIdentity({
      userId: 'admin-1',
      email: 'admin@viacarraria.io',
      username: 'admin',
      isGuest: false,
      role: 'admin',
      tier: 'PRO',
    });
  });

  afterEach(cleanup);

  describe('AdminAuthGuard', () => {
    it('shows loading indicator while verifying authorization', () => {
      vi.mocked(api.admin.verify).mockReturnValue(new Promise(() => {}));
      render(
        <AdminAuthGuard>
          <div>Secret Portal</div>
        </AdminAuthGuard>,
      );

      expect(
        screen.getByText(/Verifying administrative privileges.../i),
      ).toBeInTheDocument();
    });

    it('renders unauthorized access screen when verification fails', async () => {
      vi.mocked(api.admin.verify).mockResolvedValue({
        authorized: false,
        identity: null,
      });

      render(
        <AdminAuthGuard onBackToCanvas={vi.fn()}>
          <div>Secret Portal</div>
        </AdminAuthGuard>,
      );

      expect(
        await screen.findByText(/Administrative Access Required/i),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Administrator Secret Key/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Secret Portal/i)).not.toBeInTheDocument();
    });

    it('allows entering admin key to elevate and renders content upon success', async () => {
      vi.mocked(api.admin.verify)
        .mockResolvedValueOnce({ authorized: false, identity: null })
        .mockResolvedValueOnce({
          authorized: true,
          identity: { id: 'admin-1', role: 'admin' },
        });

      render(
        <AdminAuthGuard>
          <div>Secret Portal</div>
        </AdminAuthGuard>,
      );

      expect(
        await screen.findByText(/Administrative Access Required/i),
      ).toBeInTheDocument();

      const input = screen.getByPlaceholderText(/Enter ADMIN_KEY.../i);
      fireEvent.change(input, { target: { value: 'master-secret-key-123' } });

      const elevateBtn = screen.getByRole('button', { name: /Elevate/i });
      fireEvent.click(elevateBtn);

      expect(setAdminKey).toHaveBeenCalledWith('master-secret-key-123');
      expect(await screen.findByText(/Secret Portal/i)).toBeInTheDocument();
    });

    it('triggers onBackToCanvas callback when Return button is clicked', async () => {
      const onBackToCanvas = vi.fn();
      vi.mocked(api.admin.verify).mockResolvedValue({
        authorized: false,
        identity: null,
      });

      render(
        <AdminAuthGuard onBackToCanvas={onBackToCanvas}>
          <div>Secret Portal</div>
        </AdminAuthGuard>,
      );

      const returnBtn = await screen.findByRole('button', {
        name: /Return to Knowledge Canvas/i,
      });
      fireEvent.click(returnBtn);

      expect(onBackToCanvas).toHaveBeenCalledTimes(1);
    });
  });

  describe('AdminPage Navigation and Tabs', () => {
    it('renders admin header with Administrator identity and tab sidebar', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      expect(await screen.findByText('Via Carraria')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
      expect(screen.getByText('admin@viacarraria.io')).toBeInTheDocument();

      // Navigation sidebar items
      expect(
        screen.getByRole('button', { name: /Overview & KPIs/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /User Accounts/i }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole('button', { name: /Knowledge Graphs/i })[0],
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Retention & Archives/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Revenue & Billing/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Cluster & Proxy Health/i }),
      ).toBeInTheDocument();
    });

    it('navigates to Canvas when Back to Canvas button is clicked', async () => {
      const onBackToCanvas = vi.fn();
      render(<AdminPage onBackToCanvas={onBackToCanvas} />);

      const backBtn = await screen.findByRole('button', {
        name: /Back to Canvas/i,
      });
      fireEvent.click(backBtn);

      expect(onBackToCanvas).toHaveBeenCalledTimes(1);
    });

    it('switches to User Accounts tab and displays user table', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const usersNavBtn = await screen.findByRole('button', {
        name: /User Accounts/i,
      });
      fireEvent.click(usersNavBtn);

      expect(await screen.findByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('@testuser')).toBeInTheDocument();
      expect(screen.getAllByText('PRO').length).toBeGreaterThanOrEqual(1);
    });

    it('switches to Knowledge Graphs tab and displays graphs list with canvas action', async () => {
      const onOpenGraphOnCanvas = vi.fn();
      render(
        <AdminPage
          onBackToCanvas={vi.fn()}
          onOpenGraphOnCanvas={onOpenGraphOnCanvas}
        />,
      );

      const graphsNavBtn = await screen.findByRole('button', {
        name: /Knowledge Graphs/i,
      });
      fireEvent.click(graphsNavBtn);

      expect(
        await screen.findByText('Distributed Systems Map'),
      ).toBeInTheDocument();

      const openCanvasBtn = screen.getByTitle('Open on Interactive Canvas');
      fireEvent.click(openCanvasBtn);

      expect(onOpenGraphOnCanvas).toHaveBeenCalledWith('g-101');
    });

    it('switches to Retention & Archives tab and displays audit stats', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const retentionNavBtn = await screen.findByRole('button', {
        name: /Retention & Archives/i,
      });
      fireEvent.click(retentionNavBtn);

      expect(
        await screen.findByText(/Lifecycle & Retention Management/i),
      ).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument(); // Inactive candidate count
      expect(
        screen.getByText('Distributed Systems Map Archive'),
      ).toBeInTheDocument();
    });

    it('switches to Revenue & Billing tab and displays subscription telemetry', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const billingNavBtn = await screen.findByRole('button', {
        name: /Revenue & Billing/i,
      });
      fireEvent.click(billingNavBtn);

      expect(
        await screen.findByText(/Subscriptions & Revenue Management/i),
      ).toBeInTheDocument();
      expect(screen.getByText('invoice.payment_succeeded')).toBeInTheDocument();
    });

    it('switches to Cluster & Proxy Health tab and displays service health cards', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const systemNavBtn = await screen.findByRole('button', {
        name: /Cluster & Proxy Health/i,
      });
      fireEvent.click(systemNavBtn);

      expect(
        await screen.findByText(/System Infrastructure & Health Status/i),
      ).toBeInTheDocument();
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
      expect(
        screen.getByText(/Storage Driver & MinIO Cloud Proxy Topology/i),
      ).toBeInTheDocument();
      expect(screen.getByText('production-s3')).toBeInTheDocument();
    });

    it('switches to System Configuration tab and displays settings form', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const settingsNavBtn = await screen.findByRole('button', {
        name: /System Configuration/i,
      });
      fireEvent.click(settingsNavBtn);

      expect(
        await screen.findByText(/System Configuration & Limits/i),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Inactivity Expiration \(Days\)/i),
      ).toBeInTheDocument();
    });
  });

  describe('AdminOverviewTab KPI Rendering', () => {
    it('displays summary metrics cards and hourly activity distribution', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      expect(await screen.findByText('240')).toBeInTheDocument(); // Total users
      expect(screen.getByText(/45 Pro/i)).toBeInTheDocument(); // Pro users
      expect(screen.getByText(/180\/hr Live/i)).toBeInTheDocument(); // Requests/hr
      expect(screen.getByText('$1350')).toBeInTheDocument(); // MRR
      expect(screen.getByText('50 MB')).toBeInTheDocument(); // Storage
      expect(
        screen.getByText(/Hourly Search & Retrieval Velocity/i),
      ).toBeInTheDocument();
    });
  });

  describe('AdminUsersTab Operations', () => {
    it('opens user details modal when inspect button is clicked', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const usersNavBtn = await screen.findByRole('button', {
        name: /User Accounts/i,
      });
      fireEvent.click(usersNavBtn);

      await screen.findByText('test@example.com');
      const inspectBtn = screen.getByTitle('View user details & graphs');
      fireEvent.click(inspectBtn);

      await waitFor(() => {
        expect(api.admin.user).toHaveBeenCalledWith('usr-1');
      });
      expect(
        await screen.findByRole('heading', {
          name: /Account Telemetry & Usage/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Test User \(test@example\.com\)/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/15 MB/i)).toBeInTheDocument(); // Storage
    });

    it('opens edit user modal and saves subscription tier changes', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const usersNavBtn = await screen.findByRole('button', {
        name: /User Accounts/i,
      });
      fireEvent.click(usersNavBtn);

      await screen.findByText('test@example.com');
      const editBtn = screen.getByTitle('Edit user tier & details');
      fireEvent.click(editBtn);

      expect(
        await screen.findByText(/Modify Account: Test User/i),
      ).toBeInTheDocument();

      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(api.admin.updateUser).toHaveBeenCalledWith('usr-1', {
          name: 'Test User',
          username: 'testuser',
          subscriptionTier: 'PRO',
          subscriptionExpiresAt: expect.any(String),
        });
      });
    });

    it('opens delete confirmation modal and executes user deletion', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const usersNavBtn = await screen.findByRole('button', {
        name: /User Accounts/i,
      });
      fireEvent.click(usersNavBtn);

      await screen.findByText('test@example.com');
      const deleteBtn = screen.getByTitle('Delete user');
      fireEvent.click(deleteBtn);

      expect(
        await screen.findByRole('heading', {
          name: /Permanently Delete User/i,
        }),
      ).toBeInTheDocument();

      const confirmDeleteBtn = screen.getByRole('button', {
        name: /Delete User & All Data/i,
      });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(api.admin.deleteUser).toHaveBeenCalledWith('usr-1');
      });
    });

    it('triggers audit export for users in CSV and JSON formats', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const usersNavBtn = await screen.findByRole('button', {
        name: /User Accounts/i,
      });
      fireEvent.click(usersNavBtn);

      await screen.findByText('test@example.com');
      const exportCsvBtn = screen.getByRole('button', {
        name: /Export CSV/i,
      });
      fireEvent.click(exportCsvBtn);

      await waitFor(() => {
        expect(api.admin.exportUsers).toHaveBeenCalledWith({
          format: 'csv',
          search: undefined,
          tier: 'ALL',
        });
        expect(triggerBlobDownload).toHaveBeenCalled();
      });

      const exportJsonBtn = screen.getByRole('button', {
        name: /Export JSON/i,
      });
      fireEvent.click(exportJsonBtn);

      await waitFor(() => {
        expect(api.admin.exportUsers).toHaveBeenCalledWith({
          format: 'json',
          search: undefined,
          tier: 'ALL',
        });
      });
    });

    it('supports multi-selection and batch tier modification', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const usersNavBtn = await screen.findByRole('button', {
        name: /User Accounts/i,
      });
      fireEvent.click(usersNavBtn);

      await screen.findByText('test@example.com');
      const rowCheckbox = screen.getByLabelText(/Select Test User/i);
      fireEvent.click(rowCheckbox);

      expect(screen.getByText(/1 user selected/i)).toBeInTheDocument();

      const changeTierBtn = screen.getByRole('button', {
        name: /Change Tier/i,
      });
      fireEvent.click(changeTierBtn);

      expect(
        await screen.findByText(/Batch Update Tier \(1 Users\)/i),
      ).toBeInTheDocument();

      const submitBtn = screen.getByRole('button', {
        name: /Update 1 Users/i,
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.admin.batchUsers).toHaveBeenCalledWith({
          userIds: ['usr-1'],
          action: 'set_tier',
          tier: 'PRO',
          durationDays: 30,
        });
      });
    });

    it('supports batch user deletion', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const usersNavBtn = await screen.findByRole('button', {
        name: /User Accounts/i,
      });
      fireEvent.click(usersNavBtn);

      await screen.findByText('test@example.com');
      const rowCheckbox = screen.getByLabelText(/Select Test User/i);
      fireEvent.click(rowCheckbox);

      const deleteSelectedBtn = screen.getByRole('button', {
        name: /Delete Selected/i,
      });
      fireEvent.click(deleteSelectedBtn);

      expect(
        await screen.findByText(/Batch Delete Users \(1 Users\)/i),
      ).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', {
        name: /Permanently Delete 1 Users/i,
      });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(api.admin.batchUsers).toHaveBeenCalledWith({
          userIds: ['usr-1'],
          action: 'delete',
        });
      });
    });
  });

  describe('AdminGraphsTab Operations', () => {
    it('opens metadata edit modal and saves graph updates', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const graphsNavBtn = await screen.findByRole('button', {
        name: /Knowledge Graphs/i,
      });
      fireEvent.click(graphsNavBtn);

      await screen.findByText('Distributed Systems Map');
      const editBtn = screen.getByTitle('Edit Graph Metadata');
      fireEvent.click(editBtn);

      expect(
        await screen.findByText(/Edit Graph: Distributed Systems Map/i),
      ).toBeInTheDocument();

      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(api.admin.updateGraph).toHaveBeenCalledWith('g-101', {
          title: 'Distributed Systems Map',
          description: 'Microservices & event topology',
          isPublic: true,
          isExemptFromRetention: true,
          resetRetention: false,
        });
      });
    });

    it('opens content JSON editor modal for graph canvas inspect', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const graphsNavBtn = await screen.findByRole('button', {
        name: /Knowledge Graphs/i,
      });
      fireEvent.click(graphsNavBtn);

      await screen.findByText('Distributed Systems Map');
      const contentBtn = screen.getByTitle(
        'Edit Canvas Content JSON (Nodes/Edges)',
      );
      fireEvent.click(contentBtn);

      await waitFor(() => {
        expect(api.admin.graph).toHaveBeenCalledWith('g-101');
      });
      expect(
        await screen.findByText(/Modify Canvas JSON: Distributed Systems Map/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Nodes Array JSON/i)).toBeInTheDocument();
      expect(screen.getByText(/Edges Array JSON/i)).toBeInTheDocument();
    });

    it('supports multi-selection and batch retention exemption and visibility', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const graphsNavBtn = await screen.findByRole('button', {
        name: /Knowledge Graphs/i,
      });
      fireEvent.click(graphsNavBtn);

      await screen.findByText('Distributed Systems Map');
      const rowCheckbox = screen.getByLabelText(
        /Select Distributed Systems Map/i,
      );
      fireEvent.click(rowCheckbox);

      expect(screen.getByText(/1 graph selected/i)).toBeInTheDocument();

      const exemptBtn = screen.getByRole('button', {
        name: /Exempt from Retention/i,
      });
      fireEvent.click(exemptBtn);

      await waitFor(() => {
        expect(api.admin.batchGraphs).toHaveBeenCalledWith({
          graphIds: ['g-101'],
          action: 'set_retention_exempt',
          exempt: true,
        });
      });

      // Re-select and change visibility
      const rowCheckbox2 = screen.getByLabelText(
        /Select Distributed Systems Map/i,
      );
      fireEvent.click(rowCheckbox2);

      const makePrivateBtn = screen.getByRole('button', {
        name: /Make Private/i,
      });
      fireEvent.click(makePrivateBtn);

      await waitFor(() => {
        expect(api.admin.batchGraphs).toHaveBeenCalledWith({
          graphIds: ['g-101'],
          action: 'set_visibility',
          isPublic: false,
        });
      });
    });

    it('supports batch graph deletion', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const graphsNavBtn = await screen.findByRole('button', {
        name: /Knowledge Graphs/i,
      });
      fireEvent.click(graphsNavBtn);

      await screen.findByText('Distributed Systems Map');
      const rowCheckbox = screen.getByLabelText(
        /Select Distributed Systems Map/i,
      );
      fireEvent.click(rowCheckbox);

      const deleteSelectedBtn = screen.getByRole('button', {
        name: /Delete Selected/i,
      });
      fireEvent.click(deleteSelectedBtn);

      expect(
        await screen.findByText(/Batch Delete Graphs \(1 Graphs\)/i),
      ).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', {
        name: /Permanently Delete 1 Graphs/i,
      });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(api.admin.batchGraphs).toHaveBeenCalledWith({
          graphIds: ['g-101'],
          action: 'delete',
        });
      });
    });
  });

  describe('AdminSubscriptionsTab Operations', () => {
    it('triggers audit export for subscription billing events in CSV and JSON formats', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const subNavBtn = await screen.findByRole('button', {
        name: /Revenue & Billing/i,
      });
      fireEvent.click(subNavBtn);

      await screen.findByText(/Subscriptions & Revenue Management/i);
      const exportCsvBtn = screen.getByRole('button', {
        name: /Export CSV/i,
      });
      fireEvent.click(exportCsvBtn);

      await waitFor(() => {
        expect(api.admin.exportSubscriptionEvents).toHaveBeenCalledWith({
          format: 'csv',
        });
        expect(triggerBlobDownload).toHaveBeenCalled();
      });

      const exportJsonBtn = screen.getByRole('button', {
        name: /Export JSON/i,
      });
      fireEvent.click(exportJsonBtn);

      await waitFor(() => {
        expect(api.admin.exportSubscriptionEvents).toHaveBeenCalledWith({
          format: 'json',
        });
      });
    });
  });

  describe('AdminSettingsTab Operations', () => {
    it('displays active configuration settings and updates values on save', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const settingsNavBtn = await screen.findByRole('button', {
        name: /System Configuration/i,
      });
      fireEvent.click(settingsNavBtn);

      await screen.findByText(/System Configuration & Limits/i);

      const retentionInput = screen.getByLabelText(
        /Inactivity Expiration \(Days\)/i,
      ) as HTMLInputElement;
      expect(retentionInput.value).toBe('90');

      fireEvent.change(retentionInput, { target: { value: '120' } });
      expect(retentionInput.value).toBe('120');

      const maintenanceSwitch = screen.getByLabelText(
        /Toggle Maintenance Mode/i,
      );
      fireEvent.click(maintenanceSwitch);

      const saveBtn = screen.getByRole('button', {
        name: /Save Configuration/i,
      });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(api.admin.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            retentionDays: 120,
            maintenanceMode: true,
          }),
        );
      });

      expect(
        await screen.findByText(/System configuration updated and propagated/i),
      ).toBeInTheDocument();
    });

    it('resets form inputs to defaults when Reset Form is clicked', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const settingsNavBtn = await screen.findByRole('button', {
        name: /System Configuration/i,
      });
      fireEvent.click(settingsNavBtn);

      await screen.findByText(/System Configuration & Limits/i);

      const retentionInput = screen.getByLabelText(
        /Inactivity Expiration \(Days\)/i,
      ) as HTMLInputElement;
      fireEvent.change(retentionInput, { target: { value: '180' } });
      expect(retentionInput.value).toBe('180');

      const resetBtn = screen.getByRole('button', { name: /Reset Form/i });
      fireEvent.click(resetBtn);

      expect(retentionInput.value).toBe('90');
    });

    it('manages granular maintenance exemptions for IP CIDRs, user IDs, and roles', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const settingsNavBtn = await screen.findByRole('button', {
        name: /System Configuration/i,
      });
      fireEvent.click(settingsNavBtn);

      await screen.findByText(/System Configuration & Limits/i);

      const ipsInput = screen.getByLabelText(
        /Allowed IP Addresses \/ CIDR Subnets/i,
      ) as HTMLInputElement;
      expect(ipsInput.value).toBe('127.0.0.1, ::1');

      fireEvent.change(ipsInput, {
        target: { value: '127.0.0.1, 10.0.0.0/8, 192.168.1.0/24' },
      });

      const userIdsInput = screen.getByLabelText(
        /Exempt User IDs/i,
      ) as HTMLInputElement;
      fireEvent.change(userIdsInput, {
        target: { value: 'usr-exempt-1, usr-exempt-2' },
      });

      const rolesInput = screen.getByLabelText(
        /Exempt User Roles/i,
      ) as HTMLInputElement;
      fireEvent.change(rolesInput, {
        target: { value: 'admin, support' },
      });

      const saveBtn = screen.getByRole('button', {
        name: /Save Configuration/i,
      });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(api.admin.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            maintenanceExemptions: {
              allowedIps: ['127.0.0.1', '10.0.0.0/8', '192.168.1.0/24'],
              exemptUserIds: ['usr-exempt-1', 'usr-exempt-2'],
              exemptRoles: ['admin', 'support'],
            },
          }),
        );
      });
    });
  });

  describe('AdminAuditTab Operations', () => {
    it('displays audit logs feed with action badges, actor info, and target details', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const auditNavBtn = await screen.findByRole('button', {
        name: /Admin Audit Trail/i,
      });
      fireEvent.click(auditNavBtn);

      await screen.findByRole('heading', {
        name: /Admin Audit Trail/i,
        level: 2,
      });
      expect(
        await screen.findByText(/system\.maintenance_enable/i),
      ).toBeInTheDocument();
      expect(
        screen.getAllByText('admin@viacarraria.io').length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('SYSTEM')).toBeInTheDocument();
      expect(screen.getByText('127.0.0.1')).toBeInTheDocument();
    });

    it('filters audit logs by action input and target type select', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const auditNavBtn = await screen.findByRole('button', {
        name: /Admin Audit Trail/i,
      });
      fireEvent.click(auditNavBtn);

      await screen.findByRole('heading', {
        name: /Admin Audit Trail/i,
        level: 2,
      });

      const actionInput = screen.getByPlaceholderText(/Filter by action/i);
      fireEvent.change(actionInput, { target: { value: 'user.delete' } });

      await waitFor(() => {
        expect(api.admin.getAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'user.delete',
          }),
        );
      });

      const targetSelect = screen.getByRole('combobox', {
        name: /Target Type/i,
      });
      fireEvent.change(targetSelect, { target: { value: 'user' } });

      await waitFor(() => {
        expect(api.admin.getAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({
            targetType: 'user',
          }),
        );
      });
    });

    it('expands JSON details payload on click', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const auditNavBtn = await screen.findByRole('button', {
        name: /Admin Audit Trail/i,
      });
      fireEvent.click(auditNavBtn);

      await screen.findByRole('heading', {
        name: /Admin Audit Trail/i,
        level: 2,
      });

      const expandBtn = await screen.findByRole('button', {
        name: /Expand details/i,
      });
      fireEvent.click(expandBtn);

      expect(await screen.findByText(/"Cluster upgrade"/i)).toBeInTheDocument();
    });

    it('displays cold storage archives and supports manual archival', async () => {
      render(<AdminPage onBackToCanvas={vi.fn()} />);

      const auditNavBtn = await screen.findByRole('button', {
        name: /Admin Audit Trail/i,
      });
      fireEvent.click(auditNavBtn);

      await screen.findByRole('heading', {
        name: /Admin Audit Trail/i,
        level: 2,
      });

      // Verify Cold Storage Archives section
      expect(
        await screen.findByRole('heading', {
          name: /Cold Storage Archives/i,
          level: 3,
        }),
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(api.admin.getAuditArchives).toHaveBeenCalled();
      });

      const matchedElements = await screen.findAllByText(
        /audit-log-2026-09-07T00-00-00-000Z-arch-101.json.gz/i,
      );
      expect(matchedElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/42 events/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Download/i })).toHaveAttribute(
        'href',
        '/mock/download/arch-101',
      );

      // Trigger manual archival
      const archiveBtn = screen.getByRole('button', {
        name: /Archive to S3 \/ MinIO/i,
      });
      fireEvent.click(archiveBtn);

      expect(
        await screen.findByText(/Successfully archived 42 audit events/i),
      ).toBeInTheDocument();

      // Preview in-browser archive inspection
      const previewBtn = screen.getByRole('button', { name: /Preview/i });
      expect(previewBtn).toBeInTheDocument();
      fireEvent.click(previewBtn);

      await waitFor(() => {
        expect(api.admin.previewAuditArchive).toHaveBeenCalledWith(
          'arch-101',
          expect.anything(),
        );
      });

      const dialog = await screen.findByRole('dialog');
      const dialogWithin = within(dialog);
      expect(dialogWithin.getByText(/Archive Inspector:/i)).toBeInTheDocument();
      expect(dialogWithin.getByText(/reason/i)).toBeInTheDocument();

      // Expand details row
      const expandBtn = dialogWithin.getByRole('button', {
        name: /Expand details/i,
      });
      fireEvent.click(expandBtn);
      expect(
        dialogWithin.getByText(/Scheduled DB upgrade/i),
      ).toBeInTheDocument();

      // Search inside modal
      const searchInput = dialogWithin.getByPlaceholderText(
        /Search archived events/i,
      );
      fireEvent.change(searchInput, { target: { value: 'maintenance' } });

      // Close modal
      const closeBtn = dialogWithin.getByRole('button', {
        name: /Close archive inspector/i,
      });
      fireEvent.click(closeBtn);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });
});
