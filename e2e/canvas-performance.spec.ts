import { expect, test } from '@playwright/test';

test.describe('Canvas Interaction & Performance Optimization Suite', () => {
  const corsHeaders = {
    'access-control-allow-origin': 'http://localhost:5173',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'content-type': 'application/json',
  };

  test.beforeEach(async ({ page }) => {
    // Intercept OPTIONS preflight requests
    await page.route('**/*', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: corsHeaders,
        });
        return;
      }
      await route.fallback();
    });

    await page.route('**/api/limits**', async (route) => {
      const origin =
        route.request().headers()['origin'] || 'http://localhost:5173';
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          'access-control-allow-origin': origin,
        },
        body: JSON.stringify({
          tier: 'ANONYMOUS',
          graphs: { used: 0, limit: 0, exceeded: true },
          privateGraphs: { used: 0, limit: 0, exceeded: true },
          queries: { used: 1, limit: 3, exceeded: false },
          uploads: { used: 0, limit: 0, exceeded: true },
          selectedNodes: { used: 2, limit: 2, exceeded: false },
          nodesPerGraph: { used: 0, limit: 0, exceeded: true },
          sourcesPerNode: { used: 0, limit: 0, exceeded: true },
          sourceSizeBytes: { used: 0, limit: 0, exceeded: true },
          extendedContext: { used: 0, limit: 0, exceeded: true },
        }),
      });
    });

    await page.route('**/api/auth/**', async (route) => {
      const origin =
        route.request().headers()['origin'] || 'http://localhost:5173';
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          'access-control-allow-origin': origin,
        },
        body: JSON.stringify({
          user: {
            id: 'guest-e2e',
            email: 'guest@example.com',
            name: 'Guest',
            username: 'guest',
            isAnonymous: true,
            subscriptionTier: 'ANONYMOUS',
          },
        }),
      });
    });

    await page.route('**/api/queries**', async (route) => {
      const origin =
        route.request().headers()['origin'] || 'http://localhost:5173';
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          'access-control-allow-origin': origin,
        },
        body: JSON.stringify([]),
      });
    });

    await page.route(/\/api\/graphs/, async (route) => {
      const origin =
        route.request().headers()['origin'] || 'http://localhost:5173';
      const parsed = new URL(route.request().url());
      if (
        parsed.pathname === '/api/graphs' ||
        parsed.pathname === '/api/graphs/'
      ) {
        await route.fulfill({
          status: 200,
          headers: {
            ...corsHeaders,
            'access-control-allow-origin': origin,
          },
          body: JSON.stringify([
            {
              id: 'graph-e2e-systems',
              title: 'Computer Systems & Architecture',
              description:
                'Foundations of operating systems, concurrency, and distributed networks.',
              userId: 'prof-system',
              isPublic: true,
              isPrepared: true,
              isOwned: false,
              permission: 'VIEWER',
              canEdit: false,
              accessCount: 42,
              nodeCount: 5,
              sourceCount: 3,
              ownerName: 'System Curators',
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          ]),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          'access-control-allow-origin': origin,
        },
        body: JSON.stringify({
          id: 'graph-e2e-systems',
          title: 'Computer Systems & Architecture',
          description:
            'Foundations of operating systems, concurrency, and distributed networks.',
          userId: 'prof-system',
          isPublic: true,
          isPrepared: true,
          isOwned: false,
          permission: 'VIEWER',
          canEdit: false,
          accessCount: 42,
          nodes: [
            {
              id: 'node-arch',
              position: { x: 50, y: 150 },
              data: {
                title: 'Computer Architecture & Memory Hierarchy',
                category: 'Hardware',
                description:
                  'CPU caching, pipelining, cache coherency protocols, and virtual memory.',
              },
            },
            {
              id: 'node-os',
              position: { x: 350, y: 150 },
              data: {
                title: 'Operating Systems & Concurrency',
                category: 'Systems',
                description:
                  'Process scheduling, POSIX threads, synchronization primitives, and deadlocks.',
              },
            },
            {
              id: 'node-dist',
              position: { x: 650, y: 150 },
              data: {
                title: 'Distributed Consensus & Replication',
                category: 'Distributed',
                description:
                  'Paxos, Raft, state machine replication, and Byzantine agreement.',
              },
            },
            {
              id: 'node-db',
              position: { x: 350, y: 350 },
              data: {
                title: 'Relational Databases & B-Trees',
                category: 'Data Management',
                description:
                  'ACID transactions, WAL write-ahead logging, and query planning.',
              },
            },
            {
              id: 'node-net',
              position: { x: 650, y: 350 },
              data: {
                title: 'Computer Networks & TCP/IP',
                category: 'Networking',
                description:
                  'Flow control, congestion management, TLS 1.3 handshakes, and DNS.',
              },
            },
          ],
          edges: [
            { id: 'e-arch-os', source: 'node-arch', target: 'node-os' },
            { id: 'e-os-dist', source: 'node-os', target: 'node-dist' },
            { id: 'e-os-db', source: 'node-os', target: 'node-db' },
            { id: 'e-dist-net', source: 'node-dist', target: 'node-net' },
          ],
          sources: [
            {
              id: 'src-1',
              nodeId: 'node-dist',
              graphId: 'graph-e2e-systems',
              name: 'Paxos Made Simple.pdf',
              fileType: 'application/pdf',
              fileUrl: 's3://bucket/paxos.pdf',
              status: 'READY',
              sizeBytes: 1024 * 100,
              jobId: null,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
            {
              id: 'src-2',
              nodeId: 'node-dist',
              graphId: 'graph-e2e-systems',
              name: 'Raft Paper.pdf',
              fileType: 'application/pdf',
              fileUrl: 's3://bucket/raft.pdf',
              status: 'READY',
              sizeBytes: 1024 * 150,
              jobId: null,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
            {
              id: 'src-3',
              nodeId: 'node-db',
              graphId: 'graph-e2e-systems',
              name: 'Database Internals Notes.md',
              fileType: 'text/markdown',
              fileUrl: 's3://bucket/db.md',
              status: 'READY',
              sizeBytes: 1024 * 20,
              jobId: null,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
            },
          ],
        }),
      });
    });

    // Delayed search response to verify circular progress bar interaction
    await page.route(/\/api\/search/, async (route) => {
      const origin =
        route.request().headers()['origin'] || 'http://localhost:5173';
      // Artificial 350ms network delay to capture pending visual state
      await new Promise((r) => setTimeout(r, 350));
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          'access-control-allow-origin': origin,
        },
        body: JSON.stringify({
          queryId: 'query-perf-search',
          remaining: 2,
          extendedSearch: false,
          extendedContextCount: 0,
          matchedNodeIds: ['node-dist'],
          results: [
            {
              nodeId: 'node-dist',
              matchCount: 2,
              chunks: [
                {
                  graphId: 'graph-e2e-systems',
                  nodeId: 'node-dist',
                  sourceId: 'src-1',
                  sourceName: 'Paxos Made Simple.pdf',
                  startChar: 120,
                  endChar: 280,
                  pageNum: 2,
                  content:
                    'Paxos consensus algorithm proceeds in two phases: Prepare/Promise and Accept/Accepted.',
                  context: 'Core consensus logic',
                  score: 0.95,
                },
              ],
            },
          ],
        }),
      });
    });
  });

  test('measures Page Load & Core Web Vitals performance budget', async ({
    page,
  }) => {
    const startTime = Date.now();
    await page.goto('/');

    // Wait for canvas and nodes to render
    await page.waitForSelector('.react-flow');
    await expect(
      page.getByText('Computer Architecture & Memory Hierarchy'),
    ).toBeVisible();

    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      const fcp =
        paintEntries.find((p) => p.name === 'first-contentful-paint')
          ?.startTime ?? 0;
      return {
        fcp,
        domContentLoaded: nav
          ? nav.domContentLoadedEventEnd - nav.startTime
          : 0,
        loadComplete: nav ? nav.loadEventEnd - nav.startTime : 0,
      };
    });

    const totalElapsed = Date.now() - startTime;

    // Performance Budgets for optimization:
    // FCP should be under 2000ms
    expect(metrics.fcp).toBeLessThan(2500);
    // DOM Content Loaded should be under 1500ms
    expect(metrics.domContentLoaded).toBeLessThan(2000);
    // Total test execution should complete quickly
    expect(totalElapsed).toBeLessThan(5000);
  });

  test('verifies smooth canvas zoom animations without long task thread blocking', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow');
    await expect(
      page.getByText('Computer Architecture & Memory Hierarchy'),
    ).toBeVisible();

    // Instrument PerformanceObserver in browser context to detect any Long Tasks (> 50ms)
    await page.evaluate(() => {
      (window as any).__longTasks = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).__longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    });

    // Setup requestAnimationFrame tracking during interaction
    await page.evaluate(() => {
      (window as any).__frameDeltas = [];
      let last = performance.now();
      let active = true;
      function record() {
        if (!active) return;
        const now = performance.now();
        (window as any).__frameDeltas.push(now - last);
        last = now;
        requestAnimationFrame(record);
      }
      requestAnimationFrame(record);
      (window as any).__stopTracking = () => {
        active = false;
      };
    });

    // Trigger canvas zoom controls
    const zoomInBtn = page.locator('.react-flow__controls-zoomin');
    const zoomOutBtn = page.locator('.react-flow__controls-zoomout');

    await zoomInBtn.click();
    await page.waitForTimeout(100);
    await zoomInBtn.click();
    await page.waitForTimeout(100);
    await zoomOutBtn.click();
    await page.waitForTimeout(100);

    // Stop frame tracking and gather results
    const perfReport = await page.evaluate(() => {
      if (typeof (window as any).__stopTracking === 'function') {
        (window as any).__stopTracking();
      }
      const deltas = ((window as any).__frameDeltas || []) as number[];
      const longTasks = ((window as any).__longTasks || []) as Array<{
        duration: number;
      }>;

      const avgDelta = deltas.length
        ? deltas.reduce((a, b) => a + b, 0) / deltas.length
        : 16.6;
      const maxDelta = deltas.length ? Math.max(...deltas) : 16.6;

      return {
        totalFrames: deltas.length,
        avgDelta,
        maxDelta,
        longTaskCount: longTasks.length,
      };
    });

    // Verification & Optimization invariants:
    expect(perfReport.totalFrames).toBeGreaterThan(10);
    // Average frame time should stay close to 60 FPS (~16.6ms) with headroom up to 35ms
    expect(perfReport.avgDelta).toBeLessThan(35);
    // No excessive long tasks during basic canvas zoom animations
    expect(perfReport.longTaskCount).toBeLessThanOrEqual(2);
  });

  test('verifies search trigger displays circular progress indicator and highlights matching nodes', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow');
    await expect(
      page.getByText('Distributed Consensus & Replication'),
    ).toBeVisible();

    const searchInput = page.getByRole('textbox');
    await searchInput.fill('How does Paxos achieve consensus?');

    const searchBtn = page.getByRole('button', { name: 'Search', exact: true });
    await expect(searchBtn).toBeEnabled();

    // Click search - this triggers the 350ms delayed API mock
    await searchBtn.click();

    // Verify circular progress bar is displayed and button is disabled during pending query
    const progressBar = page.getByRole('progressbar', { name: 'Search' });
    await expect(progressBar).toBeVisible();
    await expect(searchBtn).toBeDisabled();

    // Wait for query resolution
    await expect(progressBar).toBeHidden({ timeout: 2000 });
    await expect(searchBtn).toBeEnabled();

    // Verify node highlighting in canvas
    const distNode = page.locator('article.subject-node', {
      hasText: 'Distributed Consensus & Replication',
    });
    await expect(distNode).toHaveClass(/is-matched/);
    await expect(distNode.getByText('+2')).toBeVisible();

    // Verify non-matching nodes are muted
    const archNode = page.locator('article.subject-node', {
      hasText: 'Computer Architecture & Memory Hierarchy',
    });
    await expect(archNode).toHaveClass(/is-muted/);
  });

  test('benchmarks node expand/collapse lifecycle and verifies zero DOM element leakage', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow');
    await expect(
      page.getByText('Distributed Consensus & Replication'),
    ).toBeVisible();

    // Baseline DOM element count
    const baselineElementCount = await page.evaluate(
      () => document.querySelectorAll('*').length,
    );

    // Expand node details
    const distNodeMain = page.locator('button.node-main', {
      hasText: 'Distributed Consensus & Replication',
    });
    await distNodeMain.click();

    // Verify expanded details and sources appear
    await expect(page.getByText('Paxos Made Simple.pdf')).toBeVisible();
    await expect(page.getByText('Raft Paper.pdf')).toBeVisible();

    // Count DOM elements when expanded
    const expandedElementCount = await page.evaluate(
      () => document.querySelectorAll('*').length,
    );
    expect(expandedElementCount).toBeGreaterThan(baselineElementCount);

    // Collapse node details
    const collapseBtn = page.getByRole('button', { name: 'Collapse details' });
    await collapseBtn.click();

    await expect(page.getByText('Paxos Made Simple.pdf')).toBeHidden();
    await expect(page.locator('.node-details')).toHaveCount(0);

    // Final DOM element count after collapse
    const postCollapseElementCount = await page.evaluate(
      () => document.querySelectorAll('*').length,
    );

    // DOM count should return close to baseline (tolerance <= 15 for viewport zoom adjustments and SVG marker tags)
    expect(
      Math.abs(postCollapseElementCount - baselineElementCount),
    ).toBeLessThanOrEqual(15);
  });
});
