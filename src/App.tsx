import { BookmarkPlus, BookOpen, Copy } from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CanvasWelcomeHub } from './components/canvas/canvas-welcome-hub';
import { CrawlResultsCanvas } from './components/canvas/crawl-results-canvas';
import { GraphCanvas } from './components/canvas/graph-canvas';
import { AdConsentBanner } from './components/ads/ad-consent-banner';
import { AuthDialog } from './components/dialogs/auth-dialog';
import { ConfirmationDialog } from './components/dialogs/confirmation-dialog';
import { CopyGraphDialog } from './components/dialogs/copy-graph-dialog';
import { GraphDialog } from './components/dialogs/graph-dialog';
import { EditorControls } from './components/overlays/editor-controls';
import { Header } from './components/overlays/header';
import { HistoryDrawer } from './components/overlays/history-drawer';
import { MaintenanceOverlay } from './components/overlays/maintenance-overlay';
import { ResultsSidebar } from './components/overlays/results-sidebar';
import { RetentionWarningBanner } from './components/overlays/retention-warning-banner';
import { SearchBar } from './components/overlays/search-bar';
import { CircularProgress } from './components/ui/circular-progress';
import { useDialogState } from './hooks/use-dialog-state';
import { useEscapeKey } from './hooks/use-escape-key';
import { useGraphActions } from './hooks/use-graph-actions';
import { useGraphAutosave } from './hooks/use-graph-autosave';
import { useNotifications } from './hooks/use-notifications';
import { useSearchActions } from './hooks/use-search-actions';
import { useSocketSync } from './hooks/use-socket-sync';
import { useTheme } from './hooks/use-theme';
import { useUploadManager } from './hooks/use-upload-manager';
import { ApiError, api, subscribeMaintenanceMode } from './lib/api';
import { getSourceMatches } from './lib/search-utils';
import { useGraphStore } from './store/graph-store';
import type { LimitsSummary } from './types/api';

const GraphBrowserDialog = lazy(() =>
  import('./components/browser/graph-browser-dialog').then((m) => ({
    default: m.GraphBrowserDialog,
  })),
);
const GraphSettingsDialog = lazy(() =>
  import('./components/dialogs/graph-settings-dialog').then((m) => ({
    default: m.GraphSettingsDialog,
  })),
);
const ProfileDialog = lazy(() =>
  import('./components/dialogs/profile-dialog').then((m) => ({
    default: m.ProfileDialog,
  })),
);
const SourceViewerDialog = lazy(() =>
  import('./components/dialogs/source-viewer-dialog').then((m) => ({
    default: m.SourceViewerDialog,
  })),
);
const RetentionDashboardDialog = lazy(() =>
  import('./components/dialogs/retention-dashboard-dialog').then((m) => ({
    default: m.RetentionDashboardDialog,
  })),
);
const PrivacyPolicyDialog = lazy(() =>
  import('./components/dialogs/privacy-policy-dialog').then((m) => ({
    default: m.PrivacyPolicyDialog,
  })),
);
const FigureLightboxDialog = lazy(() =>
  import('./components/dialogs/figure-lightbox-dialog').then((m) => ({
    default: m.FigureLightboxDialog,
  })),
);

export function App() {
  const identity = useGraphStore((state) => state.identity);
  const graph = useGraphStore((state) => state.graph);
  const graphs = useGraphStore((state) => state.graphs);
  const history = useGraphStore((state) => state.history);
  const results = useGraphStore((state) => state.results);
  const activeLightboxFigure = useGraphStore(
    (state) => state.activeLightboxFigure,
  );
  const closeLightbox = useGraphStore((state) => state.closeLightbox);
  const isEditing = useGraphStore((state) => state.isEditing);
  const isLoading = useGraphStore((state) => state.isLoading);
  const error = useGraphStore((state) => state.error);
  const activeSourceId = useGraphStore((state) => state.activeSourceId);
  const activeMatch = useGraphStore((state) => state.activeMatch);
  const pendingDeleteNodeId = useGraphStore(
    (state) => state.pendingDeleteNodeId,
  );

  const setIdentity = useGraphStore((state) => state.setIdentity);
  const setGraphs = useGraphStore((state) => state.setGraphs);
  const setGraph = useGraphStore((state) => state.setGraph);
  const setHistory = useGraphStore((state) => state.setHistory);
  const setResults = useGraphStore((state) => state.setResults);
  const mode = useGraphStore((state) => state.mode);
  const crawlResults = useGraphStore((state) => state.crawlResults);
  const setCrawlResults = useGraphStore((state) => state.setCrawlResults);
  const setMode = useGraphStore((state) => state.setMode);
  const setQueryType = useGraphStore((state) => state.setQueryType);
  const setCrawlStartingNodeIds = useGraphStore(
    (state) => state.setCrawlStartingNodeIds,
  );
  const setEditing = useGraphStore((state) => state.setEditing);
  const setActiveSourceId = useGraphStore((state) => state.setActiveSourceId);
  const setActiveMatch = useGraphStore((state) => state.setActiveMatch);
  const setPendingDeleteNodeId = useGraphStore(
    (state) => state.setPendingDeleteNodeId,
  );
  const setSources = useGraphStore((state) => state.setSources);
  const setLoading = useGraphStore((state) => state.setLoading);
  const setError = useGraphStore((state) => state.setError);
  const addRoot = useGraphStore((state) => state.addRoot);
  const removeNode = useGraphStore((state) => state.removeNode);
  const replaceCanvas = useGraphStore((state) => state.replaceCanvas);
  const collapseAllNodes = useGraphStore((state) => state.collapseAllNodes);
  const setSelectedNodeIds = useGraphStore((state) => state.setSelectedNodeIds);

  const dialogs = useDialogState();
  const [limits, setLimits] = useState<LimitsSummary>();
  const { theme, setTheme } = useTheme();
  const [maintenanceState, setMaintenanceState] = useState<{
    active: boolean;
    message?: string;
  }>({ active: false });
  const [ingestionToast, setIngestionToast] = useState<{
    sourceName: string;
    status: 'PROCESSING' | 'READY' | 'ERROR';
    progress?: number;
    message: string;
  } | null>(null);
  const ingestionToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  useEffect(() => {
    setWelcomeDismissed(false);
  }, [graph?.id]);

  useEffect(() => {
    return () => {
      if (ingestionToastTimeoutRef.current) {
        clearTimeout(ingestionToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return subscribeMaintenanceMode((active, message) => {
      setMaintenanceState({ active, message });
    });
  }, []);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/admin') ||
        window.location.search.includes('page=admin'))
    ) {
      const adminUrl =
        import.meta.env.VITE_ADMIN_URL ||
        (window.location.hostname === 'localhost'
          ? `${window.location.protocol}//${window.location.hostname}:4174`
          : '/admin');
      if (adminUrl !== '/admin') {
        window.location.replace(adminUrl);
      }
    }
  }, []);

  const reportError = useEffectEvent((requestError: unknown): void => {
    setError(
      requestError instanceof ApiError
        ? requestError.message
        : 'Something went wrong.',
    );
  });

  const loadGraph = useEffectEvent(async (graphId: string): Promise<void> => {
    const next = await api.graph(graphId);
    primeSnapshot(next.nodes, next.edges);
    setGraph(next);
  });

  // Consolidated notification management
  const {
    notifications,
    unreadCount: unreadNotificationsCount,
    refresh: refreshNotifications,
    markRead: handleMarkNotificationRead,
    markAllRead: handleMarkAllNotificationsRead,
    remove: handleDeleteNotification,
    handleClick: handleNotificationClick,
    pushLiveNotification,
  } = useNotifications({
    identity,
    onNavigateGraph: loadGraph,
    onError: reportError,
  });

  // Debounced autosave persistence
  const { primeSnapshot } = useGraphAutosave({
    graph,
    isEditing,
    onError: reportError,
  });

  // Upload management (controllers, events, auto-resume)
  useUploadManager({
    graph,
    setSources,
    setLimits,
    onError: (uploadError) => {
      reportError(uploadError);
      if (
        uploadError instanceof ApiError &&
        (uploadError.status === 403 || uploadError.status === 429) &&
        identity?.isGuest
      ) {
        dialogs.open('auth');
      }
    },
  });

  // Graph CRUD and layout actions
  const {
    isFinalizing,
    createGraph,
    copyGraph,
    attachGraph,
    saveGraphSettings,
    finalizeGraph,
    arrangeGraph,
  } = useGraphActions({
    graph,
    graphs,
    identity,
    dialogs,
    setGraphs,
    loadGraph,
    setEditing,
    setLimits,
    refreshNotifications,
    replaceCanvas,
    reportError,
  });

  // Search, crawl, and history execution actions
  const {
    queryForEdit,
    isCrawling,
    crawlStepProgress,
    handleCancelCrawl,
    handleCrawlProgress,
    search,
    crawl,
    restoreHistory,
    editHistory,
    rerunHistory,
  } = useSearchActions({
    graph,
    identity,
    dialogs,
    loadGraph,
    setResults,
    setCrawlResults,
    setHistory,
    setLimits,
    setQueryType,
    setMode,
    setSelectedNodeIds,
    setCrawlStartingNodeIds,
    reportError,
  });

  // Global event triggers for auth dialog from canvas components
  useEffect(() => {
    function handleOpenAuth() {
      dialogs.open('auth');
    }
    window.addEventListener('via-open-auth', handleOpenAuth);
    return () => {
      window.removeEventListener('via-open-auth', handleOpenAuth);
    };
  }, [dialogs]);

  // Real-time WebSocket room and notification synchronization
  useSocketSync({
    graphId: graph?.id,
    onProgressUpdate: (update) => {
      const current = useGraphStore.getState().graph;
      if (current) {
        setSources(
          current.sources.map((source) =>
            source.id === update.sourceId
              ? {
                  ...source,
                  status: update.status,
                  progress:
                    update.progress ??
                    (update.status === 'READY' ? 100 : source.progress),
                }
              : source,
          ),
        );

        const targetSource = current.sources.find(
          (s) => s.id === update.sourceId,
        );
        const sourceName = targetSource?.name || 'Document';

        if (ingestionToastTimeoutRef.current) {
          clearTimeout(ingestionToastTimeoutRef.current);
          ingestionToastTimeoutRef.current = null;
        }

        if (update.status === 'READY') {
          pushLiveNotification({
            id: `src-ready-${update.sourceId}-${Date.now()}`,
            userId: identity?.userId ?? 'guest',
            type: 'source_ready',
            title: 'Source Ready',
            message: `"${sourceName}" is now fully indexed and searchable.`,
            isRead: false,
            createdAt: new Date().toISOString(),
            data: { graphId: current.id, sourceId: update.sourceId },
          });

          setIngestionToast({
            sourceName,
            status: 'READY',
            message: `"${sourceName}" ready`,
          });
          ingestionToastTimeoutRef.current = setTimeout(() => {
            setIngestionToast(null);
          }, 4000);
        } else if (update.status === 'ERROR') {
          pushLiveNotification({
            id: `src-err-${update.sourceId}-${Date.now()}`,
            userId: identity?.userId ?? 'guest',
            type: 'source_error',
            title: 'Source Processing Failed',
            message: `Failed to index "${sourceName}".`,
            isRead: false,
            createdAt: new Date().toISOString(),
            data: { graphId: current.id, sourceId: update.sourceId },
          });

          setIngestionToast({
            sourceName,
            status: 'ERROR',
            message: `Failed to index "${sourceName}"`,
          });
          ingestionToastTimeoutRef.current = setTimeout(() => {
            setIngestionToast(null);
          }, 5000);
        } else if (update.status === 'PROCESSING') {
          const progressText =
            typeof update.progress === 'number'
              ? ` (${Math.round(update.progress)}%)`
              : '';
          setIngestionToast({
            sourceName,
            status: 'PROCESSING',
            progress: update.progress,
            message: `Indexing "${sourceName}"${progressText}...`,
          });
        }
      }
    },
    onNewNotification: pushLiveNotification,
    onCrawlProgress: handleCrawlProgress,
  });

  const handleCloseResults = useCallback(() => {
    if (activeSourceId) {
      setActiveSourceId(undefined);
      setActiveMatch(undefined);
      return;
    }
    setResults(undefined);
    setCrawlResults(undefined);
    setActiveMatch(undefined);
    const currentQueryType = useGraphStore.getState().queryType;
    if (currentQueryType === 'crawl') {
      setMode('CRAWL_SELECTION');
    } else {
      const currentSelected = useGraphStore.getState().selectedNodeIds;
      setMode(currentSelected.length > 0 ? 'CONTEXT_SELECTION' : 'IDLE');
    }
    collapseAllNodes();
  }, [
    activeSourceId,
    setActiveSourceId,
    setActiveMatch,
    setResults,
    setCrawlResults,
    setMode,
    collapseAllNodes,
  ]);

  // Global Escape key shortcut (simple search results)
  useEscapeKey({
    hasResults: Boolean(results && mode !== 'CRAWL_RESULTS'),
    onEscapeResults: handleCloseResults,
  });

  const bootstrap = useEffectEvent(
    async (preferredGraphId?: string): Promise<void> => {
      setLoading(true);
      setError(undefined);
      try {
        const viewer = await api.session();
        setIdentity(viewer);
        setLimits(await api.limits());
        const available = await api.graphs();
        setGraphs(available);
        const target = preferredGraphId ?? graph?.id ?? available[0]?.id;
        if (target) await loadGraph(target);
        setHistory(await api.history());
        if (!viewer.isGuest) {
          void refreshNotifications();
        }
      } catch (requestError) {
        reportError(requestError);
      } finally {
        setLoading(false);
      }
    },
  );

  useEffect(() => {
    void bootstrap();
  }, []);

  const sourceMatches = useMemo(
    () => getSourceMatches(results, activeSourceId, crawlResults),
    [results, activeSourceId, crawlResults],
  );

  const isUnattachedPublic = Boolean(
    graph &&
      graph.isPublic &&
      !graph.isOwned &&
      !graph.isAttached &&
      !graph.isPrepared,
  );

  return (
    <main className="app-shell">
      <div className="canvas-layer">
        {mode === 'CRAWL_RESULTS' && crawlResults ? (
          <CrawlResultsCanvas
            crawlResults={crawlResults}
            isStreaming={isCrawling}
            crawlStepProgress={crawlStepProgress ?? undefined}
            onOpenSource={(sourceId, chunk) => {
              setActiveSourceId(sourceId);
              setActiveMatch(chunk);
            }}
            onClose={handleCloseResults}
            onCancel={handleCancelCrawl}
          />
        ) : (
          <GraphCanvas key={graph?.id ?? 'empty'} />
        )}
        {mode !== 'CRAWL_RESULTS' &&
        (!graph || graph.nodes.length === 0) &&
        !welcomeDismissed &&
        !isLoading ? (
          <CanvasWelcomeHub
            graphTitle={graph?.title}
            isGuest={identity?.isGuest}
            canEdit={graph?.canEdit ?? graph?.isOwned ?? false}
            onExploreDemo={() => {
              const demoGraph = graphs.find((g) => !g.isOwned) || graphs[0];
              if (demoGraph) void loadGraph(demoGraph.id).catch(reportError);
              else dialogs.open('browser');
            }}
            onAskQuestion={() => {
              const input = document.getElementById('main-search-input');
              input?.focus();
            }}
            onAddOrImport={() => {
              if (graph?.canEdit ?? graph?.isOwned) {
                if (!isEditing) setEditing(true);
                addRoot();
              } else if (identity?.isGuest) {
                dialogs.open('auth');
              } else {
                dialogs.open('create');
              }
            }}
            onDismiss={() => setWelcomeDismissed(true)}
          />
        ) : null}
      </div>
      <div className="overlay-layer">
        <Header
          graph={graph}
          graphs={graphs}
          identity={identity}
          isEditing={isEditing}
          onGraphChange={(id) => void loadGraph(id).catch(reportError)}
          onCopy={() => {
            if (identity?.isGuest) dialogs.open('auth');
            else dialogs.open('copy');
          }}
          onOpenBrowser={() => dialogs.open('browser')}
          onOpenSettings={() => dialogs.open('settings')}
          onAttachCurrent={() => {
            if (graph) void attachGraph(graph.id);
          }}
          limits={limits}
          onCreate={() =>
            identity?.isGuest ? dialogs.open('auth') : dialogs.open('create')
          }
          onToggleEditing={() => setEditing(!isEditing)}
          onOpenAuth={() => dialogs.open('auth')}
          onOpenProfile={() => dialogs.open('profile')}
          onOpenRetentionDashboard={() => dialogs.open('retention')}
          onOpenPrivacy={() => dialogs.open('privacy')}
          theme={theme}
          onThemeChange={setTheme}
          notifications={notifications}
          unreadCount={unreadNotificationsCount}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onDeleteNotification={handleDeleteNotification}
          onNotificationClick={handleNotificationClick}
        />
        <RetentionWarningBanner
          graph={graph}
          onGraphUpdated={(updated) => {
            setGraph(updated);
            void api.graphs().then(setGraphs);
            void refreshNotifications();
          }}
          onOpenSettings={() => dialogs.open('settings')}
        />
        {isEditing ? (
          <EditorControls
            onAddRoot={addRoot}
            onLayout={arrangeGraph}
            onFinalize={() => void finalizeGraph()}
            isFinalizing={isFinalizing}
          />
        ) : null}
        <HistoryDrawer
          entries={history}
          onRestore={restoreHistory}
          onEdit={editHistory}
          onRerun={rerunHistory}
          onTogglePin={(entry) =>
            void api
              .updateQuery(entry.id, { isPinned: !entry.isPinned })
              .then(() => api.history())
              .then(setHistory)
              .catch(reportError)
          }
          onRename={(entry, title) =>
            void api
              .updateQuery(entry.id, { title })
              .then(() => api.history())
              .then(setHistory)
              .catch(reportError)
          }
        />
        <ResultsSidebar
          results={results}
          activeSourceId={activeSourceId}
          onOpenSource={(sourceId) => {
            setActiveSourceId(sourceId);
            setActiveMatch(undefined);
          }}
          onOpenMatch={(chunk) => {
            setActiveSourceId(chunk.sourceId);
            setActiveMatch(chunk);
          }}
          onSelectNode={(nodeId) => {
            setSelectedNodeIds([nodeId]);
          }}
          onClose={handleCloseResults}
        />
        {mode === 'CRAWL_RESULTS' ? null : isUnattachedPublic && graph ? (
          <div
            className="unattached-query-banner overlay-interactive"
            role="region"
            aria-label="Attach to graph banner"
          >
            <div className="unattached-banner-text">
              <BookOpen size={16} aria-hidden="true" />
              <span>
                Viewing public graph. Attach to enable search and query
                answering.
              </span>
            </div>
            <div className="unattached-banner-actions">
              <button
                type="button"
                className="command-button accent"
                onClick={() => void attachGraph(graph.id)}
              >
                <BookmarkPlus size={14} />
                <span>Attach Graph</span>
              </button>
              <button
                type="button"
                className="command-button"
                onClick={() => dialogs.open('copy')}
              >
                <Copy size={14} />
                <span>Copy Graph</span>
              </button>
            </div>
          </div>
        ) : (
          <SearchBar
            onSearch={search}
            onCrawl={crawl}
            queryForEdit={queryForEdit}
            tier={identity?.tier}
            onRequireAuth={() => dialogs.open('auth')}
          />
        )}
      </div>
      {isCrawling && crawlStepProgress && mode !== 'CRAWL_RESULTS' ? (
        <div className="crawl-streaming-toast overlay-interactive">
          <span className="crawl-streaming-spinner" />
          <span>
            {crawlStepProgress.message || 'Crawling graph frontier...'}
          </span>
        </div>
      ) : null}
      {ingestionToast ? (
        <div
          className={`source-ingestion-toast is-${ingestionToast.status.toLowerCase()} overlay-interactive`}
          role="status"
          aria-live="polite"
        >
          {ingestionToast.status === 'PROCESSING' ? (
            <CircularProgress
              size={16}
              strokeWidth={2.5}
              value={ingestionToast.progress}
            />
          ) : ingestionToast.status === 'READY' ? (
            <span className="toast-check-icon">✓</span>
          ) : (
            <span className="toast-err-icon">!</span>
          )}
          <span>{ingestionToast.message}</span>
        </div>
      ) : null}
      {isLoading ? (
        <div className="page-status">Loading knowledge map...</div>
      ) : null}
      {error ? (
        <button
          type="button"
          className="error-toast"
          onClick={() => setError(undefined)}
        >
          {error}
        </button>
      ) : null}
      <AuthDialog
        open={dialogs.isOpen('auth')}
        onOpenChange={(open) => dialogs.set('auth', open)}
        onAuthenticated={(viewer) => {
          setIdentity(viewer);
          void bootstrap(graph?.id);
        }}
      />
      <GraphDialog
        open={dialogs.isOpen('create')}
        onOpenChange={(open) => dialogs.set('create', open)}
        onCreate={createGraph}
      />
      <CopyGraphDialog
        graph={graph}
        limits={limits}
        open={dialogs.isOpen('copy')}
        onOpenChange={(open) => dialogs.set('copy', open)}
        onCopy={copyGraph}
      />
      <Suspense fallback={null}>
        <GraphSettingsDialog
          graph={graph}
          limits={limits}
          open={dialogs.isOpen('settings')}
          onOpenChange={(open) => dialogs.set('settings', open)}
          onSave={saveGraphSettings}
        />
        <GraphBrowserDialog
          open={dialogs.isOpen('browser')}
          onOpenChange={(open) => dialogs.set('browser', open)}
          identity={identity}
          onSelectGraph={(id) => {
            void loadGraph(id).catch(reportError);
          }}
          onCopyGraph={(target) => {
            void api.graph(target.id).then((g) => {
              setGraph(g);
              dialogs.open('copy');
            });
          }}
          onAttachChange={() => {
            void api.graphs().then(setGraphs);
            if (graph) void loadGraph(graph.id);
          }}
        />
        <SourceViewerDialog
          sourceId={activeSourceId}
          matches={sourceMatches}
          focusedMatch={activeMatch}
          canEdit={graph?.canEdit ?? graph?.isOwned ?? false}
          onOpenChange={(open) => {
            if (!open) {
              setActiveSourceId(undefined);
              setActiveMatch(undefined);
            }
          }}
        />
        <ProfileDialog
          identity={identity}
          open={dialogs.isOpen('profile')}
          onOpenChange={(open) => dialogs.set('profile', open)}
          onIdentityChange={setIdentity}
          onLogout={async () => {
            await api.logout();
            dialogs.close('profile');
            await bootstrap();
          }}
          onOpenRetention={() => {
            dialogs.close('profile');
            dialogs.open('retention');
          }}
          onOpenPrivacy={() => {
            dialogs.close('profile');
            dialogs.open('privacy');
          }}
        />
        <RetentionDashboardDialog
          open={dialogs.isOpen('retention')}
          onOpenChange={(open) => dialogs.set('retention', open)}
          onGraphRestored={(restoredGraphId) => {
            void api.graphs().then(setGraphs);
            void loadGraph(restoredGraphId);
          }}
        />
        <PrivacyPolicyDialog
          open={dialogs.isOpen('privacy')}
          onOpenChange={(open) => dialogs.set('privacy', open)}
        />
        <FigureLightboxDialog
          figure={activeLightboxFigure ?? null}
          onClose={closeLightbox}
        />
      </Suspense>
      <ConfirmationDialog
        open={Boolean(pendingDeleteNodeId)}
        onOpenChange={(open) => !open && setPendingDeleteNodeId(undefined)}
        title="Delete topic"
        message="Attached sources will also be removed from this graph."
        onConfirm={() => {
          if (pendingDeleteNodeId) removeNode(pendingDeleteNodeId);
          setPendingDeleteNodeId(undefined);
        }}
      />
      <AdConsentBanner onOpenPrivacy={() => dialogs.open('privacy')} />
      {maintenanceState.active && (
        <MaintenanceOverlay
          message={maintenanceState.message}
          onDismiss={() => {
            setMaintenanceState({ active: false });
            void bootstrap(graph?.id);
          }}
        />
      )}
    </main>
  );
}
