import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../../lib/api';
import type { PlanDefinition } from '../../../types/api';
import { AdminPlansTab } from './admin-plans-tab';

vi.mock('../../../lib/api', () => ({
  api: {
    admin: {
      getPlans: vi.fn(),
      getPlan: vi.fn(),
      updatePlan: vi.fn(),
      getAdAnalytics: vi.fn(),
      exportAdTelemetry: vi.fn(),
      triggerAdRollup: vi.fn(),
      purgeOldAdTelemetry: vi.fn(),
      getAdTelemetryStatus: vi.fn(),
      getAdTags: vi.fn(),
      getAdTagStats: vi.fn(),
      createAdTag: vi.fn(),
      updateAdTag: vi.fn(),
      deleteAdTag: vi.fn(),
    },
  },
}));

const mockPlans: PlanDefinition[] = [
  {
    tier: 'ANONYMOUS',
    version: 1,
    name: 'Guest / Anonymous Tier',
    description: 'Unauthenticated guests',
    renewableCredits: 0,
    renewalPeriodDays: 0,
    priceUsd: 0,
    adsEnabled: true,
    planMultiplier: 1.0,
    limits: {
      maxNodes: 0,
      maxSourcesPerGraph: 0,
      maxSourceSizeBytes: 0,
      allowPrivateGraphs: false,
      extendedContext: false,
    },
    costConfig: {
      queryBaseCost: 0,
      crawlBaseCost: 0,
      crawlStepCost: 0,
      sourceBaseCost: 0,
      sourceChunkMultiplier: 0,
    },
    grandfatheringPolicy: 'RENEWAL_MIGRATION',
    effectiveAt: '2026-09-01T00:00:00.000Z',
  },
  {
    tier: 'REGISTERED',
    version: 1,
    name: 'Registered Community Tier',
    description: 'Free registered tier with unlimited graphs',
    renewableCredits: 0,
    renewalPeriodDays: 0,
    priceUsd: 0,
    adsEnabled: true,
    planMultiplier: 1.0,
    limits: {
      maxNodes: 100000,
      maxSourcesPerGraph: 1000,
      maxSourceSizeBytes: 52428800,
      allowPrivateGraphs: true,
      extendedContext: true,
    },
    costConfig: {
      queryBaseCost: 0,
      crawlBaseCost: 0,
      crawlStepCost: 0,
      sourceBaseCost: 0,
      sourceChunkMultiplier: 0,
    },
    grandfatheringPolicy: 'RENEWAL_MIGRATION',
    effectiveAt: '2026-09-01T00:00:00.000Z',
  },
];

describe('AdminPlansTab', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.admin.getPlans).mockResolvedValue(mockPlans);
    vi.mocked(api.admin.updatePlan).mockImplementation(async (tier, data) => {
      const base = mockPlans.find((p) => p.tier === tier)!;
      return {
        ...base,
        name: data.name ?? base.name,
        description: data.description ?? base.description,
        adsEnabled: data.adsEnabled ?? base.adsEnabled,
        limits: {
          ...base.limits,
          ...(data.limits ?? {}),
        },
        version: 2,
        effectiveAt: new Date().toISOString(),
      };
    });
    vi.mocked(api.admin.getAdAnalytics).mockResolvedValue({
      totalImpressions: 2450,
      totalCulled: 1050,
      totalRefreshes: 80,
      averageViewabilitySeconds: 18.4,
      totalActiveViewableSeconds: 45080,
      estimatedRevenueUsd: 3.68,
      effectiveEcpm: 1.5,
      gpuSavingsPercentage: 30.0,
      consentBreakdown: {
        personalized: 1500,
        contextual: 750,
        declined: 200,
      },
    });
    vi.mocked(api.admin.getAdTelemetryStatus).mockResolvedValue({
      totalEventsCount: 1250,
      totalRollupsCount: 28,
      oldestEventDate: '2026-06-01T00:00:00.000Z',
      newestEventDate: '2026-09-17T10:00:00.000Z',
      lastRollupDate: '2026-09-16',
      retentionDays: 90,
      autoRollupEnabled: true,
      scheduleIntervalHours: 24,
    });
    vi.mocked(api.admin.triggerAdRollup).mockResolvedValue({
      success: true,
      rowsRolledUp: 35,
    });
    vi.mocked(api.admin.purgeOldAdTelemetry).mockResolvedValue({
      success: true,
      purgedCount: 120,
      retentionDays: 90,
    });
    vi.mocked(api.admin.getAdTags).mockResolvedValue([
      {
        id: 'tag-1',
        name: 'Artificial Intelligence',
        slug: 'ai-machine-learning',
        description: 'Machine learning, deep learning, LLMs',
        isActive: true,
        matchCount: 15,
        sendCount: 30,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'tag-2',
        name: 'Cloud Computing',
        slug: 'cloud-devops',
        description: 'Kubernetes, microservices, cloud infra',
        isActive: false,
        matchCount: 8,
        sendCount: 12,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ]);
    vi.mocked(api.admin.getAdTagStats).mockResolvedValue({
      totalTags: 2,
      activeTags: 1,
      totalMatches: 23,
      totalImpressionsSent: 42,
      topMatchedTags: [
        {
          slug: 'ai-machine-learning',
          name: 'Artificial Intelligence',
          matchCount: 15,
        },
      ],
      topImpressionTags: [
        {
          slug: 'ai-machine-learning',
          name: 'Artificial Intelligence',
          sendCount: 30,
        },
      ],
    });
    vi.mocked(api.admin.updateAdTag).mockResolvedValue({
      id: 'tag-1',
      name: 'Artificial Intelligence',
      slug: 'ai-machine-learning',
      description: 'Machine learning, deep learning, LLMs',
      isActive: false,
      matchCount: 15,
      sendCount: 30,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });
    vi.mocked(api.admin.createAdTag).mockResolvedValue({
      id: 'tag-3',
      name: 'Cybersecurity',
      slug: 'cybersecurity',
      description: 'Security & cryptography',
      isActive: true,
      matchCount: 0,
      sendCount: 0,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    });
  });

  it('renders ANONYMOUS and REGISTERED tier sub-tabs and loads default REGISTERED plan', async () => {
    render(<AdminPlansTab />);

    await waitFor(() => {
      expect(api.admin.getPlans).toHaveBeenCalled();
    });

    expect(screen.getByTestId('tier-tab-anonymous')).toBeDefined();
    expect(screen.getByTestId('tier-tab-registered')).toBeDefined();

    // Default tab is REGISTERED
    const nameInput = screen.getByLabelText(
      /Plan Display Name/i,
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('Registered Community Tier');

    const maxNodesInput = screen.getByLabelText(
      /Max Nodes Per Graph/i,
    ) as HTMLInputElement;
    expect(maxNodesInput.value).toBe('100000');

    const maxSourceMbInput = screen.getByLabelText(
      /Max Single Source Upload Size \(MB\)/i,
    ) as HTMLInputElement;
    expect(maxSourceMbInput.value).toBe('50');

    expect(
      screen.getByRole('button', { name: /Publish REGISTERED Plan/i }),
    ).toBeDefined();
  });

  it('switches to ANONYMOUS tab and displays restricted guest allowances', async () => {
    render(<AdminPlansTab />);

    await waitFor(() => {
      expect(api.admin.getPlans).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('tier-tab-anonymous'));

    const nameInput = screen.getByLabelText(
      /Plan Display Name/i,
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('Guest / Anonymous Tier');

    const maxNodesInput = screen.getByLabelText(
      /Max Nodes Per Graph/i,
    ) as HTMLInputElement;
    expect(maxNodesInput.value).toBe('0');

    expect(
      screen.getByRole('button', { name: /Publish ANONYMOUS Plan/i }),
    ).toBeDefined();
  });

  it('updates plan configuration successfully when form is submitted', async () => {
    render(<AdminPlansTab />);

    await waitFor(() => {
      expect(api.admin.getPlans).toHaveBeenCalled();
    });

    const maxNodesInput = screen.getByLabelText(/Max Nodes Per Graph/i);
    fireEvent.change(maxNodesInput, { target: { value: '80000' } });

    const maxSourceMbInput = screen.getByLabelText(
      /Max Single Source Upload Size \(MB\)/i,
    );
    fireEvent.change(maxSourceMbInput, { target: { value: '75' } });

    const saveBtn = screen.getByRole('button', {
      name: /Publish REGISTERED Plan/i,
    });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.admin.updatePlan).toHaveBeenCalledWith(
        'REGISTERED',
        expect.objectContaining({
          limits: expect.objectContaining({
            maxNodes: 80000,
            maxSourceSizeBytes: 75 * 1024 * 1024,
          }),
        }),
      );
    });

    expect(
      screen.getByText(
        /Plan terms for REGISTERED successfully updated to version v2!/i,
      ),
    ).toBeDefined();
  });

  it('renders Ad Monetization & Viewability Telemetry section with metrics and consent breakdown', async () => {
    render(<AdminPlansTab />);

    await waitFor(() => {
      expect(api.admin.getAdAnalytics).toHaveBeenCalled();
    });

    expect(
      screen.getByText('Ad Monetization & Viewability Telemetry'),
    ).toBeInTheDocument();
    expect(screen.getByText('2,450')).toBeInTheDocument(); // total impressions
    expect(screen.getByText('30.0%')).toBeInTheDocument(); // GPU savings percentage
    expect(screen.getByText('18.4s')).toBeInTheDocument(); // Avg viewability
    expect(screen.getByText('$3.68')).toBeInTheDocument(); // Estimated revenue
    expect(screen.getByText(/Personalized \(Targeted\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Contextual Only/i)).toBeInTheDocument();
  });

  it('renders Ad Telemetry Storage & Retention Lifecycle panel with status metrics', async () => {
    render(<AdminPlansTab />);

    await waitFor(() => {
      expect(api.admin.getAdTelemetryStatus).toHaveBeenCalled();
    });

    expect(
      screen.getByTestId('ad-telemetry-storage-panel'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Storage & Retention Lifecycle'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('storage-auto-rollup-badge')).toHaveTextContent(
      'Auto-Rollup: Every 24h',
    );
    expect(screen.getByTestId('raw-events-count')).toHaveTextContent('1,250');
    expect(screen.getByTestId('daily-rollups-count')).toHaveTextContent('28');
    expect(screen.getByTestId('retention-days-value')).toHaveTextContent(
      '90 Days',
    );
    expect(screen.getByTestId('oldest-event-date')).toHaveTextContent(
      '2026-06-01',
    );
  });

  it('triggers daily ad telemetry rollup and shows feedback banner', async () => {
    render(<AdminPlansTab />);

    await waitFor(() => {
      expect(screen.getByTestId('ad-trigger-rollup-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('ad-trigger-rollup-btn'));

    await waitFor(() => {
      expect(api.admin.triggerAdRollup).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('telemetry-action-banner')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Daily aggregation completed: 35 rows rolled up/i),
    ).toBeInTheDocument();
  });

  it('purges old ad telemetry and shows feedback banner', async () => {
    render(<AdminPlansTab />);

    await waitFor(() => {
      expect(screen.getByTestId('ad-purge-telemetry-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('ad-purge-telemetry-btn'));

    await waitFor(() => {
      expect(api.admin.purgeOldAdTelemetry).toHaveBeenCalledWith(90);
    });

    await waitFor(() => {
      expect(screen.getByTestId('telemetry-action-banner')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        /Retention purge executed: 120 raw events older than 90 days safely deleted/i,
      ),
    ).toBeInTheDocument();
  });

  it('renders contextual ad taxonomy panel with KPI cards and tag list', async () => {
    render(<AdminPlansTab />);

    await waitFor(() => {
      expect(api.admin.getAdTags).toHaveBeenCalled();
      expect(api.admin.getAdTagStats).toHaveBeenCalled();
    });

    expect(screen.getByTestId('ad-context-taxonomy-panel')).toBeInTheDocument();
    expect(screen.getByTestId('total-tags-kpi')).toBeInTheDocument();
    expect(screen.getByTestId('active-tags-kpi')).toBeInTheDocument();
    expect(screen.getByTestId('total-matches-kpi')).toBeInTheDocument();
    expect(screen.getByTestId('total-impressions-kpi')).toBeInTheDocument();

    expect(
      screen.getByTestId('tag-row-ai-machine-learning'),
    ).toBeInTheDocument();
    expect(screen.getByText('Artificial Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Cloud Computing')).toBeInTheDocument();
  });

  it('allows toggling tag active status', async () => {
    render(<AdminPlansTab />);

    await waitFor(() => {
      expect(
        screen.getByTestId('toggle-status-ai-machine-learning'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-status-ai-machine-learning'));

    await waitFor(() => {
      expect(api.admin.updateAdTag).toHaveBeenCalledWith('tag-1', {
        isActive: false,
      });
    });
  });

  it('allows creating a new tag via modal', async () => {
    render(<AdminPlansTab />);

    await waitFor(() => {
      expect(screen.getByTestId('add-tag-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-tag-btn'));

    expect(screen.getByTestId('ad-tag-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('tag-name-input'), {
      target: { value: 'Cybersecurity' },
    });
    fireEvent.change(screen.getByTestId('tag-description-input'), {
      target: { value: 'Security & cryptography' },
    });

    fireEvent.click(screen.getByTestId('save-tag-btn'));

    await waitFor(() => {
      expect(api.admin.createAdTag).toHaveBeenCalledWith({
        name: 'Cybersecurity',
        slug: undefined,
        description: 'Security & cryptography',
        isActive: true,
      });
    });
  });
});
