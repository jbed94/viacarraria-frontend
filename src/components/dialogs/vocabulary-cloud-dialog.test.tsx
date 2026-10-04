import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import { useGraphStore } from '../../store/graph-store';
import type { GraphVocabularyItem } from '../../types/api';
import { VocabularyCloudDialog } from './vocabulary-cloud-dialog';

vi.mock('../../lib/api', () => ({
  api: {
    getVocabulary: vi.fn(),
  },
}));

describe('VocabularyCloudDialog', () => {
  const sampleVocabulary: GraphVocabularyItem[] = [
    {
      term: 'Kubernetes Cluster Architecture',
      normalized: 'kubernetes cluster architecture',
      nodeIds: ['node-1'],
      weight: 18,
      sourceType: 'heading',
    },
    {
      term: 'Kubernetes Cluster Nodes',
      normalized: 'kubernetes cluster nodes',
      nodeIds: ['node-2'],
      weight: 14,
      sourceType: 'bold',
    },
    {
      term: 'Raft Consensus',
      normalized: 'raft consensus',
      nodeIds: ['node-3'],
      weight: 16,
      sourceType: 'node_title',
    },
    {
      term: 'RPC',
      normalized: 'rpc',
      nodeIds: ['node-3'],
      weight: 6,
      sourceType: 'acronym',
    },
  ];

  beforeEach(() => {
    vi.mocked(api.getVocabulary).mockResolvedValue(sampleVocabulary);
    useGraphStore.setState({
      graph: { id: 'graph-1', title: 'Knowledge Graph', nodes: [] } as any,
      selectedNodeIds: [],
      previewNodeIds: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not render dialog content when open is false', () => {
    render(<VocabularyCloudDialog open={false} onOpenChange={vi.fn()} />);
    expect(
      screen.queryByText('Graph Concepts & Vocabulary'),
    ).not.toBeInTheDocument();
  });

  it('fetches vocabulary and renders concept cloud pills on open', async () => {
    const onSelectQuery = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <VocabularyCloudDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectQuery={onSelectQuery}
      />,
    );

    expect(
      await screen.findByText('Graph Concepts & Vocabulary'),
    ).toBeInTheDocument();
    expect(api.getVocabulary).toHaveBeenCalledWith(
      'graph-1',
      expect.anything(),
    );

    // Check concept pills rendered
    expect(
      await screen.findByText('Kubernetes Cluster Architecture'),
    ).toBeInTheDocument();
    expect(screen.getByText('Kubernetes Cluster Nodes')).toBeInTheDocument();
    expect(screen.getByText('Raft Consensus')).toBeInTheDocument();
    expect(screen.getByText('RPC')).toBeInTheDocument();
  });

  it('previews node on hover and triggers query selection on concept pill click', async () => {
    const onSelectQuery = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <VocabularyCloudDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectQuery={onSelectQuery}
      />,
    );

    const pill = await screen.findByRole('button', {
      name: /Kubernetes Cluster Architecture/i,
    });

    // Hover previews node-1
    fireEvent.mouseEnter(pill);
    expect(useGraphStore.getState().previewNodeIds).toEqual(['node-1']);

    fireEvent.mouseLeave(pill);
    expect(useGraphStore.getState().previewNodeIds).toEqual([]);

    // Click selects query
    fireEvent.click(pill);
    expect(onSelectQuery).toHaveBeenCalledWith(
      'Kubernetes Cluster Architecture',
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders and interacts with thematic clusters tab', async () => {
    const onSelectQuery = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <VocabularyCloudDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectQuery={onSelectQuery}
      />,
    );

    await screen.findByText('Kubernetes Cluster Architecture');

    // Switch to Thematic Clusters tab
    const clustersTab = screen.getByRole('tab', { name: /Thematic Clusters/i });
    fireEvent.click(clustersTab);

    // K8s cluster should be synthesized
    const clusterCards = await screen.findAllByText(
      'Kubernetes Cluster Architecture',
    );
    expect(clusterCards.length).toBeGreaterThan(0);

    // Query cluster button
    const queryBtn = screen.getByRole('button', {
      name: /Query: Kubernetes Cluster Architecture and Kubernetes Cluster Nodes/i,
    });
    fireEvent.click(queryBtn);

    expect(onSelectQuery).toHaveBeenCalledWith(
      'Kubernetes Cluster Architecture and Kubernetes Cluster Nodes',
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('switches to list tab and jumps to nodes on click', async () => {
    const onOpenChange = vi.fn();

    render(<VocabularyCloudDialog open={true} onOpenChange={onOpenChange} />);

    await screen.findByText('Kubernetes Cluster Architecture');

    // Switch to Terms List tab
    const listTab = screen.getByRole('tab', { name: /Terms List/i });
    fireEvent.click(listTab);

    expect(screen.getByText('Term / Concept')).toBeInTheDocument();
    expect(screen.getByText('Attached Nodes')).toBeInTheDocument();

    // Click first node link
    const nodeLinks = screen.getAllByRole('button', { name: /1 node/i });
    fireEvent.click(nodeLinks[0]!);

    expect(useGraphStore.getState().selectedNodeIds).toEqual(['node-1']);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('filters concepts using search input', async () => {
    render(<VocabularyCloudDialog open={true} onOpenChange={vi.fn()} />);

    await screen.findByText('Kubernetes Cluster Architecture');

    const searchInput = screen.getByPlaceholderText('Filter concepts...');
    fireEvent.change(searchInput, { target: { value: 'raft' } });

    expect(screen.getByText('Raft Consensus')).toBeInTheDocument();
    expect(
      screen.queryByText('Kubernetes Cluster Architecture'),
    ).not.toBeInTheDocument();
  });

  it('supports toggling scope to selected nodes only', async () => {
    useGraphStore.setState({
      selectedNodeIds: ['node-1'],
    });

    render(<VocabularyCloudDialog open={true} onOpenChange={vi.fn()} />);

    const toggle = await screen.findByRole('button', {
      name: /Selected Nodes \(1\)/i,
    });
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(api.getVocabulary).toHaveBeenCalledWith(
        'graph-1',
        expect.objectContaining({ nodeIds: ['node-1'] }),
      );
    });
  });
});
