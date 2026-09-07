import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../lib/api';
import type {
  GraphArchiveItem,
  RetentionAuditStats,
  RetentionRunResponse,
} from '../../types/api';
import { RetentionDashboardDialog } from './retention-dashboard-dialog';

vi.mock('../../lib/api', () => ({
  api: {
    retentionAudit: vi.fn(),
    retentionArchives: vi.fn(),
    runRetentionSweep: vi.fn(),
    restoreGraphArchive: vi.fn(),
    storageProxyStatus: vi.fn(),
    downloadArchiveUrl: vi.fn(
      (graphId: string, isAdmin?: boolean) =>
        `/api/${isAdmin ? 'admin' : 'graphs'}/${graphId}/archive`,
    ),
  },
}));

const mockStats: RetentionAuditStats = {
  totalActiveGraphs: 12,
  inactiveCandidateCount: 3,
  scheduledForDeletionCount: 2,
  exemptGraphsCount: 4,
  activeArchivesCount: 1,
  estimatedReclaimBytes: 15728640,
};

const mockArchives: GraphArchiveItem[] = [
  {
    id: 'arch-1',
    graphId: 'graph-123',
    userId: 'user-1',
    title: 'Knowledge Base Archive',
    sourceCount: 5,
    sizeBytes: 10485760,
    archiveUrl: '/api/admin/graphs/graph-123/archive',
    createdAt: '2026-09-01T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

describe('RetentionDashboardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.retentionAudit).mockResolvedValue(mockStats);
    vi.mocked(api.retentionArchives).mockResolvedValue(mockArchives);
    vi.mocked(api.storageProxyStatus).mockResolvedValue({
      driver: 's3',
      proxyEndpoint: 'http://minio:9000',
      bucket: 'viacarraria-sources',
      isProxy: true,
      upstreamProvider: 's3',
      upstreamBucket: 'production-s3',
      connected: true,
    });
  });

  afterEach(cleanup);

  it('loads and renders telemetry metrics and archives on open', async () => {
    render(<RetentionDashboardDialog open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText('12')).toBeInTheDocument(); // Active Graphs
    expect(screen.getByText('3')).toBeInTheDocument(); // Inactivity Candidates
    expect(screen.getByText('2')).toBeInTheDocument(); // Pending Deletion
    expect(screen.getByText('4')).toBeInTheDocument(); // Exempt Graphs
    expect(screen.getByText('1')).toBeInTheDocument(); // Glacier Archives
    expect(screen.getByText('15.0 MB')).toBeInTheDocument(); // Est. Reclaimable

    // Storage Proxy Topology
    expect(
      await screen.findByText(/MinIO Proxy → AWS S3/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Proxy Connected/i)).toBeInTheDocument();

    // Archives table
    expect(screen.getByText('Knowledge Base Archive')).toBeInTheDocument();
    expect(screen.getByText('ID: graph-123')).toBeInTheDocument();
    expect(screen.getByText('5 files')).toBeInTheDocument();
    expect(screen.getByText('10.0 MB')).toBeInTheDocument();
  });

  it('renders empty state when no archives exist', async () => {
    vi.mocked(api.retentionArchives).mockResolvedValue([]);

    render(<RetentionDashboardDialog open={true} onOpenChange={vi.fn()} />);

    expect(
      await screen.findByText(
        /No archived graphs currently stored in cold storage/i,
      ),
    ).toBeInTheDocument();
  });

  it('executes dry-run retention sweep simulation and displays summary alert', async () => {
    const sweepResponse: RetentionRunResponse = {
      dryRun: true,
      scheduled: { count: 3, graphIds: ['g1', 'g2', 'g3'] },
      purged: {
        count: 2,
        details: [
          {
            graphId: 'g4',
            title: 'Graph 4',
            sourcesPurged: 2,
            storageObjectsPurged: 2,
          },
          {
            graphId: 'g5',
            title: 'Graph 5',
            sourcesPurged: 1,
            storageObjectsPurged: 1,
          },
        ],
      },
      audit: mockStats,
    };
    vi.mocked(api.runRetentionSweep).mockResolvedValue(sweepResponse);

    render(<RetentionDashboardDialog open={true} onOpenChange={vi.fn()} />);

    await screen.findByText('Knowledge Base Archive');

    const dryRunBtn = screen.getByRole('button', { name: /Dry-Run Sweep/i });
    fireEvent.click(dryRunBtn);

    expect(api.runRetentionSweep).toHaveBeenCalledWith(true);
    expect(
      await screen.findByText(/Dry-Run Simulation Completed/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Scheduled: 3 \| Purged: 2/i)).toBeInTheDocument();
  });

  it('executes live retention sweep and displays summary alert', async () => {
    const sweepResponse: RetentionRunResponse = {
      dryRun: false,
      scheduled: { count: 1, graphIds: ['g1'] },
      purged: {
        count: 1,
        details: [
          {
            graphId: 'g4',
            title: 'Graph 4',
            sourcesPurged: 2,
            storageObjectsPurged: 2,
          },
        ],
      },
      audit: mockStats,
    };
    vi.mocked(api.runRetentionSweep).mockResolvedValue(sweepResponse);

    render(<RetentionDashboardDialog open={true} onOpenChange={vi.fn()} />);

    await screen.findByText('Knowledge Base Archive');

    const liveSweepBtn = screen.getByRole('button', {
      name: /Live Retention Sweep/i,
    });
    fireEvent.click(liveSweepBtn);

    expect(api.runRetentionSweep).toHaveBeenCalledWith(false);
    expect(
      await screen.findByText(/Live Sweep Completed/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Scheduled: 1 \| Purged: 1/i)).toBeInTheDocument();
  });

  it('restores graph from archive on restore button click', async () => {
    const onGraphRestored = vi.fn();
    vi.mocked(api.restoreGraphArchive).mockResolvedValue({
      id: 'graph-123',
      title: 'Knowledge Base Archive',
      userId: 'user-1',
      sourceCount: 5,
      restored: true,
    });

    render(
      <RetentionDashboardDialog
        open={true}
        onOpenChange={vi.fn()}
        onGraphRestored={onGraphRestored}
      />,
    );

    await screen.findByText('Knowledge Base Archive');

    const restoreBtn = screen.getByRole('button', { name: /Restore/i });
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(api.restoreGraphArchive).toHaveBeenCalledWith('arch-1');
    });
    expect(onGraphRestored).toHaveBeenCalledWith('graph-123');
    expect(
      await screen.findByText(
        'Graph "Knowledge Base Archive" successfully restored with 5 source attachments.',
      ),
    ).toBeInTheDocument();
  });

  it('renders error alert if initial data fetch fails', async () => {
    vi.mocked(api.retentionAudit).mockRejectedValue(
      new Error('Network error loading audit'),
    );

    render(<RetentionDashboardDialog open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Network error loading audit',
    );
  });
});
