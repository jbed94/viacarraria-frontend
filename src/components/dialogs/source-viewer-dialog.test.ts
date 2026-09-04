import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../lib/api';
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

describe('SourceViewerDialog - PDF Citation Coordinate Overlays', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders target banner with page, coordinates, and bounding box overlay for PDF search hits', async () => {
    vi.spyOn(api, 'source').mockResolvedValue({
      id: 'src-pdf-1',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'Course-Syllabus.pdf',
      fileType: 'application/pdf',
      fileUrl: 'http://localhost:3000/api/sources/src-pdf-1/download',
      sizeBytes: 2048,
      status: 'READY',
      jobId: null,
      content: '# Syllabus content',
      createdAt: '2026-09-03',
      updatedAt: '2026-09-03',
    });

    const focused = {
      ...match(0, 20),
      sourceId: 'src-pdf-1',
      sourceName: 'Course-Syllabus.pdf',
      pageNum: 2,
      coordinates: [50, 120, 250, 16],
      elementType: 'heading',
    };

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-pdf-1',
        matches: [focused],
        focusedMatch: focused,
        onOpenChange: vi.fn(),
      }),
    );

    // Switch to PDF tab
    const pdfTab = screen.getByRole('tab', { name: /PDF/i });
    fireEvent.click(pdfTab);

    // Verify Target Banner elements
    expect(await screen.findByText(/Page 2/i)).toBeInTheDocument();
    expect(screen.getAllByText(/heading/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Target Box: 50, 120/i)).toBeInTheDocument();

    // Verify visual target bounding box overlay is rendered
    const coordBox = document.body.querySelector('.pdf-coordinate-box');
    expect(coordBox).toBeInTheDocument();
    expect(coordBox?.getAttribute('title')).toContain('Page 2');

    // Verify toggle button turns guide overlay off/on
    const toggleBtn = screen.getByRole('button', { name: /Target Guide: ON/i });
    fireEvent.click(toggleBtn);
    expect(
      document.body.querySelector('.pdf-coordinate-box'),
    ).not.toBeInTheDocument();
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
      content: '# Syllabus content',
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

    const pdfTab = screen.getByRole('tab', { name: /PDF/i });
    fireEvent.click(pdfTab);

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

  it('steps through multiple search hits across pages updating target banner and coordinates', async () => {
    const match1 = {
      ...match(0, 20),
      sourceId: 'src-multi',
      sourceName: 'Algorithms.pdf',
      pageNum: 2,
      coordinates: [50, 100, 220, 20],
      elementType: 'heading',
      content: 'Graph Shortest Paths',
    };
    const match2 = {
      ...match(100, 140),
      sourceId: 'src-multi',
      sourceName: 'Algorithms.pdf',
      pageNum: 5,
      coordinates: [70, 250, 350, 60],
      elementType: 'table',
      content: 'Algorithm Complexity Comparison Table',
    };

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-multi',
        matches: [match1, match2],
        focusedMatch: match1,
        onOpenChange: vi.fn(),
      }),
    );

    const pdfTab = screen.getByRole('tab', { name: /PDF/i });
    fireEvent.click(pdfTab);

    // Initially at match 1 (Page 2)
    expect(await screen.findByText(/1 \/ 2/i)).toBeInTheDocument();
    expect(
      document.body.querySelector('.pdf-target-tag.is-page')?.textContent,
    ).toContain('Page 2');
    expect(screen.getByText(/Target Box: 50, 100/i)).toBeInTheDocument();

    // Click next match stepper button
    const nextBtn = screen.getByRole('button', { name: /Next match/i });
    fireEvent.click(nextBtn);

    // Now at match 2 (Page 5)
    expect(screen.getByText(/2 \/ 2/i)).toBeInTheDocument();
    expect(
      document.body.querySelector('.pdf-target-tag.is-page')?.textContent,
    ).toContain('Page 5');
    expect(screen.getByText(/Target Box: 70, 250/i)).toBeInTheDocument();

    // Verify coordinate box title updated for Page 5
    const coordBox = document.body.querySelector('.pdf-coordinate-box');
    expect(coordBox?.getAttribute('title')).toContain('Page 5');

    // Click previous match stepper button
    const prevBtn = screen.getByRole('button', { name: /Previous match/i });
    fireEvent.click(prevBtn);

    // Back to match 1 (Page 2)
    expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument();
    expect(
      document.body.querySelector('.pdf-target-tag.is-page')?.textContent,
    ).toContain('Page 2');
  });

  it('navigates search hits using [ and ] keyboard shortcuts', async () => {
    const match1 = {
      ...match(0, 20),
      sourceId: 'src-kbd',
      sourceName: 'System-Architecture.pdf',
      pageNum: 1,
      coordinates: [30, 90, 180, 25],
      elementType: 'heading',
      content: 'Kernel vs User Space',
    };
    const match2 = {
      ...match(50, 90),
      sourceId: 'src-kbd',
      sourceName: 'System-Architecture.pdf',
      pageNum: 4,
      coordinates: [60, 150, 300, 40],
      elementType: 'table',
      content: 'System Call Benchmarks',
    };

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-kbd',
        matches: [match1, match2],
        focusedMatch: match1,
        onOpenChange: vi.fn(),
      }),
    );

    const pdfTab = screen.getByRole('tab', { name: /PDF/i });
    fireEvent.click(pdfTab);

    expect(await screen.findByText(/1 \/ 2/i)).toBeInTheDocument();

    // Press ']' key to navigate to next hit
    fireEvent.keyDown(window, { key: ']' });
    expect(screen.getByText(/2 \/ 2/i)).toBeInTheDocument();
    expect(
      document.body.querySelector('.pdf-target-tag.is-page')?.textContent,
    ).toContain('Page 4');

    // Press '[' key to navigate to previous hit
    fireEvent.keyDown(window, { key: '[' });
    expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument();
    expect(
      document.body.querySelector('.pdf-target-tag.is-page')?.textContent,
    ).toContain('Page 1');
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

  it('renders interactive table inspector and highlights selected column', async () => {
    const tableMatch = {
      ...match(0, 50),
      sourceId: 'src-table-doc',
      sourceName: 'Syllabus.pdf',
      pageNum: 2,
      coordinates: [50, 100, 300, 80],
      elementType: 'table',
      content: `| Component | Weight | Due Date |
| --- | --- | --- |
| Midterm Exam | 35% | Week 7 |
| Final Exam | 50% | Week 12 |`,
    };

    render(
      React.createElement(SourceViewerDialog, {
        sourceId: 'src-table-doc',
        matches: [tableMatch],
        focusedMatch: tableMatch,
        onOpenChange: vi.fn(),
      }),
    );

    const pdfTab = screen.getByRole('tab', { name: /PDF/i });
    fireEvent.click(pdfTab);

    // Verify table toggle button is displayed and ON
    expect(await screen.findByText(/Table: ON/i)).toBeInTheDocument();

    // Verify table inspector renders headers
    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('Due Date')).toBeInTheDocument();
    expect(screen.getByText('Midterm Exam')).toBeInTheDocument();

    // Click 'Weight' column header to highlight it
    const weightHeader = screen.getByText('Weight').closest('th');
    expect(weightHeader).not.toBeNull();
    fireEvent.click(weightHeader!);

    // Verify 'Weight' header and its corresponding cells have .is-active-col
    expect(weightHeader?.classList.contains('is-active-col')).toBe(true);
    expect(screen.getByText('Active')).toBeInTheDocument();

    const weightCells = document.body.querySelectorAll(
      '.pdf-table-td.is-active-col',
    );
    expect(weightCells.length).toBe(2);
    expect(weightCells[0]?.textContent).toContain('35%');
    expect(weightCells[1]?.textContent).toContain('50%');

    // Click 'Clear Column Highlight'
    const clearBtn = screen.getByRole('button', {
      name: /Clear Column Highlight/i,
    });
    fireEvent.click(clearBtn);

    expect(
      document.body.querySelectorAll('.pdf-table-td.is-active-col').length,
    ).toBe(0);
    expect(screen.queryByText('Active')).not.toBeInTheDocument();

    // Toggle table inspector off
    const toggleBtn = screen.getByRole('button', { name: /Table: ON/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Table: OFF/i)).toBeInTheDocument();
    expect(document.body.querySelector('.pdf-table-inspector')).toBeNull();
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
});
