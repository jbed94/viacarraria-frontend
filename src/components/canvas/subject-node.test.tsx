import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../../i18n';
import { useGraphStore } from '../../store/graph-store';
import type { Graph, Identity, SearchResponse, Source } from '../../types/api';
import { SubjectNode } from './subject-node';

vi.mock('@xyflow/react', () => ({
  Handle: ({
    type,
    position,
    className,
  }: {
    type: string;
    position: string;
    className?: string;
  }) => (
    <div
      data-testid={`handle-${type}-${position}`}
      className={className}
      data-handle-type={type}
      data-handle-position={position}
    />
  ),
  NodeToolbar: ({
    children,
    isVisible,
    className,
  }: {
    children: React.ReactNode;
    isVisible?: boolean;
    className?: string;
  }) =>
    isVisible ? (
      <div data-testid="node-toolbar" className={className}>
        {children}
      </div>
    ) : null,
  Position: {
    Left: 'left',
    Right: 'right',
    Top: 'top',
    Bottom: 'bottom',
  },
  useUpdateNodeInternals: () => vi.fn(),
}));

describe('SubjectNode Canvas Component', () => {
  const defaultIdentity: Identity = {
    userId: 'user-1',
    email: 'user@example.com',
    username: 'testuser',
    isGuest: false,
    tier: 'FREE',
  };

  const anonIdentity: Identity = {
    userId: 'anon-1',
    email: null,
    username: null,
    isGuest: true,
    tier: 'ANONYMOUS',
  };

  const sampleSources: Source[] = [
    {
      id: 'src-1',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Algorithm Analysis.pdf',
      fileType: 'application/pdf',
      fileUrl: 's3://bucket/alg.pdf',
      status: 'READY',
      sizeBytes: 1024,
      jobId: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'src-2',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Summary.md',
      fileType: 'text/markdown',
      fileUrl: 's3://bucket/sum.md',
      status: 'READY',
      sizeBytes: 512,
      jobId: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const baseGraph: Graph = {
    id: 'graph-1',
    title: 'Computer Science',
    description: 'Overview',
    userId: 'user-1',
    isPublic: true,
    isPrepared: true,
    isOwned: true,
    nodes: [
      {
        id: 'node-1',
        position: { x: 0, y: 0 },
        data: {
          title: 'Sorting Algorithms',
          category: 'Algorithms',
          description: 'A study of QuickSort and MergeSort.',
        },
      },
      {
        id: 'node-2',
        position: { x: 100, y: 100 },
        data: { title: 'Search Trees', category: 'Data Structures' },
      },
      {
        id: 'node-3',
        position: { x: 200, y: 200 },
        data: { title: 'Dynamic Programming' },
      },
    ],
    edges: [],
    sources: sampleSources,
    permission: 'OWNER',
    canEdit: true,
    accessCount: 5,
  };

  beforeEach(() => {
    useGraphStore.setState({
      graph: baseGraph,
      identity: defaultIdentity,
      mode: 'IDLE',
      selectedNodeIds: [],
      expandedNodeIds: [],
      results: undefined,
      isEditing: false,
      activeSourceId: undefined,
      activeMatch: undefined,
      editingNodeId: undefined,
      pendingDeleteNodeId: undefined,
    });
  });

  afterEach(cleanup);

  it('renders category, title, handles, and attachment badges', () => {
    render(
      <SubjectNode
        id="node-1"
        data={{
          title: 'Sorting Algorithms',
          category: 'Algorithms',
          description: 'A study of QuickSort and MergeSort.',
        }}
        {...({} as any)}
      />,
    );

    expect(screen.getByText('Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Sorting Algorithms')).toBeInTheDocument();

    // Source count badge (2 sources attached)
    expect(screen.getByText('2')).toBeInTheDocument();
    // PDF badge
    expect(screen.getByText('PDF')).toBeInTheDocument();

    // Left and right handles with view-handle styling
    const leftHandle = screen.getByTestId('handle-target-left');
    const rightHandle = screen.getByTestId('handle-source-right');
    expect(leftHandle).toHaveClass('flow-handle', 'view-handle');
    expect(rightHandle).toHaveClass('flow-handle', 'view-handle');
  });

  it('falls back to "Topic" when category is missing', () => {
    render(
      <SubjectNode
        id="node-3"
        data={{ title: 'Dynamic Programming' }}
        {...({} as any)}
      />,
    );

    expect(screen.getByText('Topic')).toBeInTheDocument();
    expect(screen.getByText('Dynamic Programming')).toBeInTheDocument();
  });

  it('toggles expansion when clicking the node main button', () => {
    render(
      <SubjectNode
        id="node-1"
        data={{
          title: 'Sorting Algorithms',
          category: 'Algorithms',
          description: 'A study of QuickSort and MergeSort.',
        }}
        {...({} as any)}
      />,
    );

    expect(
      screen.queryByText('A study of QuickSort and MergeSort.'),
    ).not.toBeInTheDocument();

    // Click main button to expand
    fireEvent.click(screen.getByRole('button', { name: /Sorting Algorithms/ }));
    expect(useGraphStore.getState().expandedNodeIds).toContain('node-1');
  });

  it('renders expanded details with description, sources list, format badges, and collapses', () => {
    useGraphStore.setState({ expandedNodeIds: ['node-1'] });

    render(
      <SubjectNode
        id="node-1"
        data={{
          title: 'Sorting Algorithms',
          category: 'Algorithms',
          description: 'A study of QuickSort and MergeSort.',
        }}
        {...({} as any)}
      />,
    );

    // Description is visible
    expect(
      screen.getByText('A study of QuickSort and MergeSort.'),
    ).toBeInTheDocument();

    // Sources are listed
    expect(screen.getByText('Algorithm Analysis.pdf')).toBeInTheDocument();
    expect(screen.getByText('Summary.md')).toBeInTheDocument();
    expect(screen.getByText('Markdown')).toBeInTheDocument();

    // Collapse details button
    const collapseBtn = screen.getByRole('button', {
      name: 'Collapse details',
    });
    fireEvent.click(collapseBtn);
    expect(useGraphStore.getState().expandedNodeIds).not.toContain('node-1');
  });

  it('sets activeSourceId when a source row is clicked in expanded view', () => {
    useGraphStore.setState({ expandedNodeIds: ['node-1'] });

    render(
      <SubjectNode
        id="node-1"
        data={{
          title: 'Sorting Algorithms',
          category: 'Algorithms',
        }}
        {...({} as any)}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Algorithm Analysis\.pdf/ }),
    );
    expect(useGraphStore.getState().activeSourceId).toBe('src-1');
  });

  describe('Search results & matches', () => {
    const searchResults: SearchResponse = {
      queryId: 'q-101',
      remaining: 18,
      extendedSearch: false,
      extendedContextCount: 0,
      matchedNodeIds: ['node-1'],
      results: [
        {
          nodeId: 'node-1',
          matchCount: 3,
          chunks: [
            {
              graphId: 'graph-1',
              nodeId: 'node-1',
              sourceId: 'src-1',
              sourceName: 'Algorithm Analysis.pdf',
              startChar: 100,
              endChar: 250,
              pageNum: 1,
              content:
                'QuickSort divides array into sub-arrays through pivot selection and recurses efficiently.',
              context: 'QuickSort algorithm overview',
              score: 0.94,
              extendedContext: [
                {
                  graphId: 'graph-1',
                  nodeId: 'node-1',
                  sourceId: 'src-2',
                  sourceName: 'Summary.md',
                  startChar: 0,
                  endChar: 80,
                  pageNum: 1,
                  content: 'Pivot choice affects worst case time complexity.',
                  context: 'Complexity analysis',
                  score: 0.85,
                },
              ],
            },
          ],
        },
      ],
    };

    it('highlights matched node with badge and renders matches in expanded view', () => {
      useGraphStore.setState({
        results: searchResults,
        expandedNodeIds: ['node-1'],
      });

      const { container } = render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms', category: 'Algorithms' }}
          {...({} as any)}
        />,
      );

      // Node article has is-matched class
      const article = container.querySelector('article.subject-node');
      expect(article).toHaveClass('is-matched');

      // Match count badge
      expect(screen.getByText('+3')).toBeInTheDocument();

      // Expanded match section displays snippet and extended context snippet
      expect(
        screen.getByText(/QuickSort divides array into sub-arrays/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Pivot choice affects worst case time complexity/),
      ).toBeInTheDocument();
    });

    it('applies is-muted class when results exist but node is not matched', () => {
      useGraphStore.setState({
        results: searchResults,
      });

      const { container } = render(
        <SubjectNode
          id="node-2"
          data={{ title: 'Search Trees', category: 'Data Structures' }}
          {...({} as any)}
        />,
      );

      const article = container.querySelector('article.subject-node');
      expect(article).toHaveClass('is-muted');
      expect(article).not.toHaveClass('is-matched');
      expect(screen.queryByText(/^\+\d+/)).not.toBeInTheDocument();
    });

    it('navigates to source and match on snippet click', () => {
      useGraphStore.setState({
        results: searchResults,
        expandedNodeIds: ['node-1'],
      });

      render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: /QuickSort divides array/ }),
      );

      expect(useGraphStore.getState().activeSourceId).toBe('src-1');
      expect(useGraphStore.getState().activeMatch?.startChar).toBe(100);
    });
  });

  describe('Context Selection mode & Anonymous user limits', () => {
    it('shows checkbox in CONTEXT_SELECTION mode and toggles selection', () => {
      useGraphStore.setState({
        mode: 'CONTEXT_SELECTION',
        selectedNodeIds: [],
        identity: defaultIdentity,
      });

      render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      const checkbox = screen.getByRole('checkbox', { name: 'Include' });
      expect(checkbox).not.toBeChecked();
      expect(checkbox).not.toBeDisabled();

      fireEvent.click(checkbox);
      expect(useGraphStore.getState().selectedNodeIds).toContain('node-1');
    });

    it('enforces 2-node selection limit for ANONYMOUS users', () => {
      useGraphStore.setState({
        mode: 'CONTEXT_SELECTION',
        selectedNodeIds: ['node-2', 'node-3'], // already 2 nodes selected
        identity: anonIdentity,
      });

      render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      const checkbox = screen.getByRole('checkbox', { name: 'Include' });
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toBeDisabled(); // Disabled because anonymous limit reached
    });

    it('allows deselecting an already selected node even if anonymous limit is reached', () => {
      useGraphStore.setState({
        mode: 'CONTEXT_SELECTION',
        selectedNodeIds: ['node-1', 'node-2'], // limit 2 reached, but node-1 is already selected
        identity: anonIdentity,
      });

      render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      const checkbox = screen.getByRole('checkbox', { name: 'Include' });
      expect(checkbox).toBeChecked();
      expect(checkbox).not.toBeDisabled(); // can still uncheck!

      fireEvent.click(checkbox);
      expect(useGraphStore.getState().selectedNodeIds).not.toContain('node-1');
    });

    it('does not limit selections for registered users', () => {
      useGraphStore.setState({
        mode: 'CONTEXT_SELECTION',
        selectedNodeIds: ['node-2', 'node-3', 'node-4'], // > 2 nodes selected
        identity: defaultIdentity, // FREE tier
      });

      render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      const checkbox = screen.getByRole('checkbox', { name: 'Include' });
      expect(checkbox).not.toBeDisabled();
    });
  });

  describe('Editing mode toolbar and actions', () => {
    it('renders editing toolbar with Add child, Edit details, and Delete node buttons', () => {
      useGraphStore.setState({ isEditing: true });

      render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      expect(screen.getByTestId('node-toolbar')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Add child node' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Edit node details' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Delete node' }),
      ).toBeInTheDocument();
    });

    it('triggers addChild, setEditingNodeId, and setPendingDeleteNodeId on button clicks', () => {
      useGraphStore.setState({ isEditing: true });

      render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      // Edit node details
      fireEvent.click(
        screen.getByRole('button', { name: 'Edit node details' }),
      );
      expect(useGraphStore.getState().editingNodeId).toBe('node-1');

      // Delete node
      fireEvent.click(screen.getByRole('button', { name: 'Delete node' }));
      expect(useGraphStore.getState().pendingDeleteNodeId).toBe('node-1');

      // Add child node
      fireEvent.click(screen.getByRole('button', { name: 'Add child node' }));
      // In graph-store, addChild adds a new node connected to node-1
      expect(useGraphStore.getState().graph?.nodes.length).toBe(4);
    });

    it('dispatches custom event on source deletion and source upload', () => {
      useGraphStore.setState({ isEditing: true, expandedNodeIds: ['node-1'] });

      const deleteListener = vi.fn();
      const uploadListener = vi.fn();
      window.addEventListener('via-delete-source', deleteListener);
      window.addEventListener('via-upload-source', uploadListener);

      render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      // Delete source button exists in edit mode
      const deleteSourceBtns = screen.getAllByRole('button', {
        name: 'Delete source',
      });
      const firstDeleteBtn = deleteSourceBtns[0];
      expect(firstDeleteBtn).toBeDefined();
      fireEvent.click(firstDeleteBtn as HTMLElement);
      expect(deleteListener).toHaveBeenCalled();
      const firstDeleteCall = deleteListener.mock.calls[0];
      expect(firstDeleteCall).toBeDefined();
      const deleteEvent = (firstDeleteCall as unknown[])[0] as CustomEvent;
      expect(deleteEvent.detail).toEqual({ sourceId: 'src-1' });

      // File upload input
      const file = new File(['# Sample doc'], 'doc.md', {
        type: 'text/markdown',
      });
      const fileInput = screen.getByLabelText('Add source');
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(uploadListener).toHaveBeenCalled();
      const firstUploadCall = uploadListener.mock.calls[0];
      expect(firstUploadCall).toBeDefined();
      const uploadEvent = (firstUploadCall as unknown[])[0] as CustomEvent;
      expect(uploadEvent.detail).toEqual({ nodeId: 'node-1', file });

      window.removeEventListener('via-delete-source', deleteListener);
      window.removeEventListener('via-upload-source', uploadListener);
    });

    it('renders real-time progress badge when source is processing and updates upon completion', () => {
      const processingSource: Source = {
        id: 'src-proc-1',
        nodeId: 'node-1',
        graphId: 'graph-1',
        name: 'LectureNotes.pdf',
        fileType: 'application/pdf',
        fileUrl: 's3://bucket/notes.pdf',
        sizeBytes: 1024 * 50,
        status: 'PROCESSING',
        jobId: 'job-p1',
        progress: 68,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      useGraphStore.setState({
        graph: {
          ...baseGraph,
          sources: [processingSource],
        },
      });

      const { rerender } = render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      // Verify progress badge is displayed on node with percentage
      const progressBar = screen.getByRole('progressbar', {
        name: 'Processing document: 68%',
      });
      expect(progressBar).toBeDefined();
      expect(screen.getByText('68%')).toBeDefined();

      // Simulate completion via store update
      useGraphStore.getState().updateSourceProgress('src-proc-1', 'READY', 100);

      rerender(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      // Progress bar should be hidden once READY
      expect(
        screen.queryByRole('progressbar', {
          name: /Processing document/i,
        }),
      ).toBeNull();
    });

    it('renders active uploads with progress, stream pill, and pause/resume/cancel controls', () => {
      const pauseListener = vi.fn();
      const resumeListener = vi.fn();
      const cancelListener = vi.fn();
      window.addEventListener('via-pause-upload', pauseListener);
      window.addEventListener('via-resume-upload', resumeListener);
      window.addEventListener('via-cancel-upload', cancelListener);

      const uploadKey = 'node-1_Paper.pdf_5242880';
      useGraphStore.setState({
        graph: baseGraph,
        expandedNodeIds: ['node-1'],
        activeUploads: {
          [uploadKey]: {
            uploadKey,
            nodeId: 'node-1',
            fileName: 'Paper.pdf',
            fileSize: 5242880,
            progress: 45,
            status: 'uploading',
            concurrency: 4,
          },
        },
      });

      const { rerender } = render(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      // Verify file name, percent, and stream pill
      expect(screen.getByText('Paper.pdf')).toBeDefined();
      expect(screen.getByText('45%')).toBeDefined();
      expect(screen.getByText('4x')).toBeDefined();

      // Click pause button
      const pauseBtn = screen.getByRole('button', {
        name: 'Pause uploading Paper.pdf',
      });
      fireEvent.click(pauseBtn);
      expect(pauseListener).toHaveBeenCalled();
      const pauseEvent = (
        pauseListener.mock.calls[0] as unknown[]
      )[0] as CustomEvent;
      expect(pauseEvent.detail).toEqual({ uploadKey });

      // Simulate paused state in store
      useGraphStore.getState().setUploadProgress({
        uploadKey,
        nodeId: 'node-1',
        fileName: 'Paper.pdf',
        fileSize: 5242880,
        progress: 45,
        status: 'paused',
        concurrency: 4,
      });

      rerender(
        <SubjectNode
          id="node-1"
          data={{ title: 'Sorting Algorithms' }}
          {...({} as any)}
        />,
      );

      // Verify 'Paused' badge and resume button
      expect(screen.getByText('Paused')).toBeDefined();
      const resumeBtn = screen.getByRole('button', {
        name: 'Resume uploading Paper.pdf',
      });
      fireEvent.click(resumeBtn);
      expect(resumeListener).toHaveBeenCalled();
      const resumeEvent = (
        resumeListener.mock.calls[0] as unknown[]
      )[0] as CustomEvent;
      expect(resumeEvent.detail).toEqual({ uploadKey });

      // Click cancel button
      const cancelBtn = screen.getByRole('button', {
        name: 'Cancel uploading Paper.pdf',
      });
      fireEvent.click(cancelBtn);
      expect(cancelListener).toHaveBeenCalled();
      const cancelEvent = (
        cancelListener.mock.calls[0] as unknown[]
      )[0] as CustomEvent;
      expect(cancelEvent.detail).toEqual({ uploadKey });

      window.removeEventListener('via-pause-upload', pauseListener);
      window.removeEventListener('via-resume-upload', resumeListener);
      window.removeEventListener('via-cancel-upload', cancelListener);
    });
  });
});
