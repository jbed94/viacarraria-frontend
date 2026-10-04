import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../lib/api';
import { useGraphStore } from '../../store/graph-store';
import type { SearchChunk } from '../../types/api';
import {
  getHighlightRanges,
  isPdfSource,
  parseMarkdownTable,
  renderMarkdownPreview,
  SourceViewerDialog,
} from './source-viewer-dialog';

const match = (startChar: number, endChar: number) => ({
  graphId: 'graph',
  sourceId: 'source',
  sourceName: 'Notes.md',
  nodeId: 'node',
  content: 'match',
  context: 'A source context.',
  startChar,
  endChar,
  pageNum: 1,
  score: 0.9,
});

describe('getHighlightRanges', () => {
  it('keeps all source matches and marks the selected match as focused', () => {
    const ranges = getHighlightRanges(
      '01234567890123456789',
      [match(1, 4), match(10, 14), match(12, 17)],
      match(10, 14),
    );

    expect(ranges).toEqual([
      { start: 1, end: 4, focused: false, kind: 'MATCH' },
      { start: 10, end: 17, focused: true, kind: 'MATCH' },
    ]);
  });

  it('clips matches to the available source content', () => {
    expect(getHighlightRanges('short', [match(-3, 20)])).toEqual([
      { start: 0, end: 5, focused: false, kind: 'MATCH' },
    ]);
  });

  it('preserves the blue extended-context type when no direct match overlaps it', () => {
    expect(
      getHighlightRanges('extended context', [
        { ...match(0, 8), kind: 'EXTENDED' },
      ]),
    ).toEqual([{ start: 0, end: 8, focused: false, kind: 'EXTENDED' }]);
  });

  it('falls back to finding text content when character offsets are 0 or undefined', () => {
    const content =
      'Introductory text. Neural search matches this section. Final text.';
    const zeroOffsetMatch = {
      ...match(0, 0),
      content: 'Neural search matches this section',
    };
    const ranges = getHighlightRanges(
      content,
      [zeroOffsetMatch],
      zeroOffsetMatch,
    );
    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.start).toBe(content.indexOf('Neural search'));
    expect(ranges[0]?.focused).toBe(true);
  });
});

describe('renderMarkdownPreview', () => {
  it('renders markdown structure and highlights matching blocks with orange Match badges', () => {
    const markdown = `# Algorithms & Data Structures\n\n## 1. Complexity\n\nBig-O notation describes asymptotic bounds.\n\n## 2. Trees\n\nRed-Black trees maintain balanced depth.`;

    // Match on Section 2 (around "Red-Black trees")
    const matchStart = markdown.indexOf('## 2. Trees');
    const matchEnd = markdown.length;

    const ranges = [
      {
        start: matchStart,
        end: matchEnd,
        focused: true,
        kind: 'MATCH' as const,
      },
    ];

    const ref = { current: null };
    const elements = renderMarkdownPreview(markdown, ranges, ref);

    const { container } = render(React.createElement('div', null, elements));

    // Check heading 1 was rendered as h1
    expect(container.querySelector('h1')).toHaveTextContent(
      'Algorithms & Data Structures',
    );

    // Check hit block exists with is-match and is-focused
    const hitBlock = container.querySelector('.preview-hit-block');
    expect(hitBlock).toBeInTheDocument();
    expect(hitBlock).toHaveClass('is-match');
    expect(hitBlock).toHaveClass('is-focused');
    expect(hitBlock?.textContent).toContain('Match');
    expect(hitBlock?.textContent).toContain('Red-Black trees');
  });

  it('renders extended context blocks with is-context styling and blue Context badge', () => {
    const markdown = `## Adjacent Subject\n\nThis is related context from neighbor node.`;
    const ranges = [
      {
        start: 0,
        end: markdown.length,
        focused: false,
        kind: 'EXTENDED' as const,
      },
    ];

    const ref = { current: null };
    const elements = renderMarkdownPreview(markdown, ranges, ref);

    const { container } = render(React.createElement('div', null, elements));

    const extendedBlock = container.querySelector('.preview-hit-block');
    expect(extendedBlock).toBeInTheDocument();
    expect(extendedBlock).toHaveClass('is-context');
    expect(extendedBlock?.textContent).toContain('Context');
    expect(extendedBlock?.textContent).toContain(
      'related context from neighbor node',
    );
  });

  it('renders LaTeX mathematical equations via KaTeX', () => {
    const markdown = `B+ Trees execute lookups in $O(\\log_B N)$ disk page reads.`;
    const ranges: any[] = [];
    const ref = { current: null };

    const elements = renderMarkdownPreview(markdown, ranges, ref);
    const { container } = render(React.createElement('div', null, elements));

    // Verify KaTeX math structure is generated
    const katexEl = container.querySelector('.katex');
    expect(katexEl).toBeInTheDocument();
    expect(container.innerHTML).toMatch(/katex|math/);
  });
});

describe('isPdfSource', () => {
  it('detects PDF source by fileType application/pdf', () => {
    expect(isPdfSource({ fileType: 'application/pdf', name: 'Document' })).toBe(
      true,
    );
  });

  it('detects PDF source by .pdf file extension', () => {
    expect(
      isPdfSource({
        fileType: 'application/octet-stream',
        name: 'syllabus.pdf',
      }),
    ).toBe(true);
    expect(isPdfSource(undefined, { sourceName: 'guide.PDF' })).toBe(true);
  });

  it('returns false for non-pdf markdown or text sources', () => {
    expect(isPdfSource({ fileType: 'text/markdown', name: 'Notes.md' })).toBe(
      false,
    );
    expect(isPdfSource(undefined, { sourceName: 'Review.txt' })).toBe(false);
    expect(isPdfSource(undefined, undefined)).toBe(false);
  });
});

describe('SourceViewerDialog - Notes & Search Highlights', () => {
  afterEach(() => {
    cleanup();
  });

  it('switches between Preview, Edit Note, and Raw tabs with note editing and saving', async () => {
    const updateSpy = vi.spyOn(api, 'updateSource').mockResolvedValue({
      id: 'src-note-1',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Updated Note Title.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 1024,
      status: 'READY',
      jobId: null,
      content: '# Updated note content from editor',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-note-1',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Initial Note.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 1024,
      status: 'READY',
      jobId: null,
      content: '# Initial Note Content\n\nSome introductory remarks.',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-note-1',
        matches: [],
        onOpenChange: vi.fn(),
      }),
    );

    // Initial view is Preview
    expect(await screen.findByText('Initial Note Content')).toBeInTheDocument();

    // Switch to Edit Note tab
    const editTab = screen.getByRole('tab', { name: /Edit Note/i });
    fireEvent.click(editTab);

    // Verify note editor title and textarea
    const titleInput = screen.getByPlaceholderText(
      /Note title/i,
    ) as HTMLInputElement;
    expect(titleInput.value).toBe('Initial Note.md');
    const textarea = screen.getByPlaceholderText(
      /Write your markdown note here/i,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Initial Note Content');

    // Modify title and content
    fireEvent.change(titleInput, {
      target: { value: 'Updated Note Title.md' },
    });
    fireEvent.change(textarea, {
      target: { value: '# Updated note content from editor' },
    });

    // Click Save Note
    const saveBtn = screen.getByRole('button', { name: /Save Note/i });
    fireEvent.click(saveBtn);

    expect(updateSpy).toHaveBeenCalledWith('src-note-1', {
      name: 'Updated Note Title.md',
      content: '# Updated note content from editor',
    });
    expect(await screen.findByText(/Saved!/i)).toBeInTheDocument();

    // Switch to Raw tab
    const rawTab = screen.getByRole('tab', { name: /Raw/i });
    fireEvent.click(rawTab);
    expect(
      screen.getByText(/Updated note content from editor/i),
    ).toBeInTheDocument();
  });

  it('copies citation to clipboard with markdown formatting and feedback', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-pdf-copy',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Distributed-Systems.pdf',
      fileType: 'application/pdf',
      fileUrl: 'http://localhost:3000/api/sources/src-pdf-copy/download',
      sizeBytes: 2048,
      status: 'READY',
      jobId: null,
      content:
        '# Distributed Systems\n\nConsensus matrix and fault tolerance limits',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    const focused = {
      ...match(0, 25),
      sourceId: 'src-pdf-copy',
      sourceName: 'Distributed-Systems.pdf',
      pageNum: 3,
      coordinates: [40, 80, 200, 30],
      elementType: 'table',
      content: 'Consensus matrix and fault tolerance limits',
    };

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-pdf-copy',
        matches: [focused],
        focusedMatch: focused,
        onOpenChange: vi.fn(),
      }),
    );

    const copyBtn = await screen.findByRole('button', {
      name: /Copy Citation/i,
    });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('Consensus matrix and fault tolerance limits'),
    );
    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('Distributed-Systems.pdf, p. 3'),
    );

    // Verify feedback indicator
    expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
  });

  it('steps through multiple search hits across matches', async () => {
    const match1 = {
      ...match(0, 20),
      sourceId: 'src-multi',
      sourceName: 'Algorithms.md',
      pageNum: 2,
      elementType: 'heading',
      content: 'Graph Shortest Paths',
    };
    const match2 = {
      ...match(100, 140),
      sourceId: 'src-multi',
      sourceName: 'Algorithms.md',
      pageNum: 5,
      elementType: 'table',
      content: 'Algorithm Complexity Comparison Table',
    };

    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-multi',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Algorithms.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 2048,
      status: 'READY',
      jobId: null,
      content:
        '# Graph Shortest Paths\n\nSome description.\n\nAlgorithm Complexity Comparison Table',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-multi',
        matches: [match1, match2],
        focusedMatch: match1,
        onOpenChange: vi.fn(),
      }),
    );

    // Initially at match 1
    expect(await screen.findByText(/1 \/ 2/i)).toBeInTheDocument();

    // Click next match stepper button
    const nextBtn = screen.getByRole('button', { name: /Next match/i });
    fireEvent.click(nextBtn);

    // Now at match 2
    expect(screen.getByText(/2 \/ 2/i)).toBeInTheDocument();

    // Click previous match stepper button
    const prevBtn = screen.getByRole('button', { name: /Previous match/i });
    fireEvent.click(prevBtn);

    // Back to match 1
    expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument();
  });

  it('navigates search hits using [ and ] keyboard shortcuts', async () => {
    const match1 = {
      ...match(0, 20),
      sourceId: 'src-kbd',
      sourceName: 'System-Architecture.md',
      pageNum: 1,
      elementType: 'heading',
      content: 'Kernel vs User Space',
    };
    const match2 = {
      ...match(50, 90),
      sourceId: 'src-kbd',
      sourceName: 'System-Architecture.md',
      pageNum: 4,
      elementType: 'table',
      content: 'System Call Benchmarks',
    };

    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-kbd',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'System-Architecture.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 2048,
      status: 'READY',
      jobId: null,
      content: '# Kernel vs User Space\n\nSystem Call Benchmarks',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-kbd',
        matches: [match1, match2],
        focusedMatch: match1,
        onOpenChange: vi.fn(),
      }),
    );

    expect(await screen.findByText(/1 \/ 2/i)).toBeInTheDocument();

    // Press ']' key to navigate to next hit
    fireEvent.keyDown(window, { key: ']' });
    expect(screen.getByText(/2 \/ 2/i)).toBeInTheDocument();

    // Press '[' key to navigate to previous hit
    fireEvent.keyDown(window, { key: '[' });
    expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument();
  });

  it('parses markdown table into headers and rows', () => {
    const tableMd = `| Component | Weight | Due Date |
| --- | --- | --- |
| Problem Set | 20% | Week 3 |
| Midterm | 35% | Week 7 |
| Final Exam | 45% | Week 12 |`;

    const parsed = parseMarkdownTable(tableMd);
    expect(parsed).not.toBeNull();
    expect(parsed?.headers).toEqual(['Component', 'Weight', 'Due Date']);
    expect(parsed?.rows).toHaveLength(3);
    expect(parsed?.rows[1]).toEqual(['Midterm', '35%', 'Week 7']);

    expect(parseMarkdownTable('Plain non table text')).toBeNull();
  });

  it('renders corner resize grip handle and supports interactive panel resizing', async () => {
    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-resize',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Resizing-Doc.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 1024,
      status: 'READY',
      jobId: null,
      content: '# Resize test document',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-resize',
        matches: [],
        onOpenChange: vi.fn(),
      }),
    );

    const resizeHandle = await screen.findByTestId('dialog-resize-handle');
    expect(resizeHandle).toBeInTheDocument();
    expect(resizeHandle).toHaveAttribute('aria-label', 'Resize source dialog');

    const dialogContent = document.querySelector(
      '.source-dialog',
    ) as HTMLElement;
    expect(dialogContent).not.toBeNull();

    // Trigger click on resize grip to toggle large size
    fireEvent.mouseDown(resizeHandle, { clientX: 500, clientY: 400 });
    fireEvent.mouseUp(window);

    // Verify dialog style was updated with panelSize
    expect(dialogContent.style.width).toMatch(/px$/);
    expect(dialogContent.style.height).toMatch(/px$/);
    const parsedWidth = Number.parseInt(dialogContent.style.width, 10);
    const parsedHeight = Number.parseInt(dialogContent.style.height, 10);
    expect(parsedWidth).toBeGreaterThanOrEqual(480);
    expect(parsedHeight).toBeGreaterThanOrEqual(380);
  });

  it('switches to Split view mode and displays live markdown preview side-by-side with editor', async () => {
    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-split',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Split-Document.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 1024,
      status: 'READY',
      jobId: null,
      content: '# Initial Title\n\nInitial paragraph text.',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-split',
        matches: [],
        onOpenChange: vi.fn(),
      }),
    );

    // Initial view is Preview
    expect(await screen.findByText('Initial Title')).toBeInTheDocument();

    // Switch to Split tab
    const splitTab = screen.getByRole('tab', { name: /Split/i });
    fireEvent.click(splitTab);

    // Verify split container exists
    const splitContainer = document.querySelector('.split-editor-container');
    expect(splitContainer).toBeInTheDocument();

    const editorPane = document.querySelector('.split-editor-pane');
    const previewPane = document.querySelector('.split-preview-pane');
    expect(editorPane).toBeInTheDocument();
    expect(previewPane).toBeInTheDocument();

    // Verify live preview header
    expect(screen.getByText(/Live Preview/i)).toBeInTheDocument();

    // Update note content in split mode
    const textarea = screen.getByPlaceholderText(
      /Write your markdown note here/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: {
        value: '# Realtime Header\n\nLive preview update verified.',
      },
    });

    // Verify preview immediately reflects the new content
    expect(previewPane?.querySelector('h1')?.textContent).toBe(
      'Realtime Header',
    );
    expect(previewPane?.textContent).toContain('Live preview update verified.');
  });

  it('automatically saves note after debounced delay when content is edited', async () => {
    vi.useFakeTimers();

    const updateSpy = vi.spyOn(api, 'updateSource').mockResolvedValue({
      id: 'src-autosave',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Autosave-Doc.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 1024,
      status: 'READY',
      jobId: null,
      content: '# Content after autosave debounce',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-autosave',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Autosave-Doc.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 1024,
      status: 'READY',
      jobId: null,
      content: '# Initial Autosave Content',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-autosave',
        matches: [],
        onOpenChange: vi.fn(),
      }),
    );

    // Let the initial source fetch promise resolve
    await vi.advanceTimersByTimeAsync(10);

    // Switch to Edit Note tab
    const editTab = screen.getByRole('tab', { name: /Edit Note/i });
    fireEvent.click(editTab);

    const textarea = screen.getByPlaceholderText(
      /Write your markdown note here/i,
    ) as HTMLTextAreaElement;

    // Modify text to trigger dirty state
    fireEvent.change(textarea, {
      target: { value: '# Content after autosave debounce' },
    });

    // Unsaved changes status should appear
    expect(screen.getByTestId('autosave-unsaved')).toBeInTheDocument();
    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();

    // Advance timers by debounce duration (1200ms)
    await vi.advanceTimersByTimeAsync(1300);
    await Promise.resolve();

    // Expect updateSource to have been called automatically
    expect(updateSpy).toHaveBeenCalledWith('src-autosave', {
      name: 'Autosave-Doc.md',
      content: '# Content after autosave debounce',
    });

    await vi.advanceTimersByTimeAsync(50);

    // Verify saved status indicator
    expect(screen.getByTestId('autosave-saved')).toBeInTheDocument();
    expect(screen.getByText(/All changes saved/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('synchronizes scroll positions proportionally between editor and preview in split mode', async () => {
    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-sync-scroll',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Long-Doc.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 4096,
      status: 'READY',
      jobId: null,
      content: '# Heading 1\n\n' + 'Paragraph text.\n\n'.repeat(50),
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-sync-scroll',
        matches: [],
        onOpenChange: vi.fn(),
      }),
    );

    await screen.findByText('Heading 1');

    // Switch to Split tab
    const splitTab = screen.getByRole('tab', { name: /Split/i });
    fireEvent.click(splitTab);

    // Verify sync scroll button starts enabled
    const syncBtn = screen.getByTestId('toggle-sync-scroll-btn');
    expect(syncBtn).toHaveTextContent('Sync on');

    const textarea = screen.getByPlaceholderText(
      /Write your markdown note here/i,
    ) as HTMLTextAreaElement;
    const previewScroll = document.querySelector(
      '.split-preview-scroll',
    ) as HTMLDivElement;

    // Define scroll dimensions on textarea and preview container
    Object.defineProperty(textarea, 'scrollHeight', {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(textarea, 'clientHeight', {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(previewScroll, 'scrollHeight', {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(previewScroll, 'clientHeight', {
      value: 400,
      configurable: true,
    });

    // Scroll textarea to 400 (50% of scrollable range: 400 / 800)
    textarea.scrollTop = 400;
    fireEvent.scroll(textarea);

    // Preview scrollable range is 1600 (2000 - 400). 50% = 800
    expect(previewScroll.scrollTop).toBe(800);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Scroll preview to 1200 (75% of 1600)
    previewScroll.scrollTop = 1200;
    fireEvent.scroll(previewScroll);

    // Textarea scrollable range is 800. 75% = 600
    expect(textarea.scrollTop).toBe(600);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Toggle sync scroll off
    fireEvent.click(syncBtn);
    expect(syncBtn).toHaveTextContent('Sync off');

    // Scrolling when disabled should not update the other pane
    textarea.scrollTop = 100;
    fireEvent.scroll(textarea);
    expect(previewScroll.scrollTop).toBe(1200);
  });

  it('hides edit mode and save button when user lacks write access (canEdit=false)', async () => {
    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-readonly-1',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Readonly-Document.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 1024,
      status: 'READY',
      jobId: null,
      content: '# Read Only Header\n\nContent for viewing only.',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-readonly-1',
        matches: [],
        canEdit: false,
        onOpenChange: vi.fn(),
      }),
    );

    // Initial view is Preview
    expect(await screen.findByText('Read Only Header')).toBeInTheDocument();

    // Mode tabs: Preview and Split are visible
    expect(screen.getByRole('tab', { name: /Preview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Split/i })).toBeInTheDocument();

    // Edit Note and Raw tabs are NOT visible
    expect(screen.queryByRole('tab', { name: /Edit Note/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Raw/i })).toBeNull();

    // Save Note button is NOT visible anywhere
    expect(screen.queryByRole('button', { name: /Save Note/i })).toBeNull();
    expect(screen.queryByTestId('autosave-unsaved')).toBeNull();

    // Switch to Split tab
    const splitTab = screen.getByRole('tab', { name: /Split/i });
    fireEvent.click(splitTab);

    // Verify split container is active
    expect(
      document.querySelector('.split-editor-container'),
    ).toBeInTheDocument();

    // Verify Title input is read-only
    const titleInput = screen.getByLabelText(/Note title/i) as HTMLInputElement;
    expect(titleInput).toBeInTheDocument();
    expect(titleInput.readOnly).toBe(true);

    // Verify Textarea is read-only
    const textarea = screen.getByPlaceholderText(
      /Markdown source content.../i,
    ) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.readOnly).toBe(true);

    // Verify Save Note button is NOT in split toolbar
    expect(screen.queryByRole('button', { name: /Save Note/i })).toBeNull();
    expect(screen.queryByTestId('autosave-unsaved')).toBeNull();

    // Verify live preview still renders content in split mode
    const previewPane = document.querySelector('.split-preview-pane');
    expect(previewPane?.querySelector('h1')?.textContent).toBe(
      'Read Only Header',
    );
  });

  it('derives write access from useGraphStore permissions when canEdit prop is omitted', async () => {
    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-store-perm',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Store-Perm.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 1024,
      status: 'READY',
      jobId: null,
      content: '# Store Permissions Test',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    // Case 1: graph in store cannot be edited
    useGraphStore.setState({
      graph: {
        id: 'graph-1',
        title: 'Public Graph',
        description: null,
        userId: 'other-user',
        isPublic: true,
        isPrepared: true,
        nodes: [],
        edges: [],
        sources: [],
        isOwned: false,
        permission: 'VIEWER',
        canEdit: false,
        accessCount: 1,
      },
    });

    const { unmount } = render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-store-perm',
        matches: [],
        onOpenChange: vi.fn(),
      }),
    );

    expect(
      await screen.findByText('Store Permissions Test'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Edit Note/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Raw/i })).toBeNull();

    unmount();

    // Case 2: graph in store can be edited
    useGraphStore.setState({
      graph: {
        id: 'graph-1',
        title: 'Owned Graph',
        description: null,
        userId: 'my-user',
        isPublic: false,
        isPrepared: true,
        nodes: [],
        edges: [],
        sources: [],
        isOwned: true,
        permission: 'OWNER',
        canEdit: true,
        accessCount: 1,
      },
    });

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-store-perm',
        matches: [],
        onOpenChange: vi.fn(),
      }),
    );

    expect(
      await screen.findByText('Store Permissions Test'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Edit Note/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Raw/i })).toBeInTheDocument();

    // Clean up store
    useGraphStore.setState({ graph: undefined });
  });

  it('prevents saving and autosaving when write access is false', async () => {
    vi.useFakeTimers();

    const updateSpy = vi.spyOn(api, 'updateSource');

    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-no-save',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'No-Save.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 1024,
      status: 'READY',
      jobId: null,
      content: '# Initial Content',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-no-save',
        matches: [],
        canEdit: false,
        onOpenChange: vi.fn(),
      }),
    );

    await vi.advanceTimersByTimeAsync(20);

    // Switch to Split tab
    const splitTab = screen.getByRole('tab', { name: /Split/i });
    fireEvent.click(splitTab);

    // Advance timers well beyond debounced autosave interval
    await vi.advanceTimersByTimeAsync(3000);

    expect(updateSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('navigates matches via stepper and updates counter and active match focus', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const sampleContent =
      '# Document Title\n\nFirst paragraph with alpha content.\n\nSecond paragraph with beta content.';

    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-stepper',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Stepper.md',
      fileType: 'text/markdown',
      fileUrl: '',
      sizeBytes: 1024,
      status: 'READY',
      jobId: null,
      content: sampleContent,
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    const matches: SearchChunk[] = [
      {
        graphId: 'graph-1',
        nodeId: 'node-1',
        sourceId: 'src-stepper',
        sourceName: 'Stepper.md',
        startChar: 18,
        endChar: 52,
        content: 'First paragraph with alpha content.',
        context: 'First paragraph with alpha content.',
        pageNum: 1,
        score: 0.95,
      },
      {
        graphId: 'graph-1',
        nodeId: 'node-1',
        sourceId: 'src-stepper',
        sourceName: 'Stepper.md',
        startChar: 54,
        endChar: 88,
        content: 'Second paragraph with beta content.',
        context: 'Second paragraph with beta content.',
        pageNum: 1,
        score: 0.88,
      },
    ];

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-stepper',
        matches,
        onOpenChange: vi.fn(),
      }),
    );

    expect(await screen.findByText('Document Title')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: /Next match/i });
    expect(nextBtn).toBeEnabled();

    fireEvent.click(nextBtn);

    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });
});
