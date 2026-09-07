import { BookmarkPlus, BookOpen, Copy } from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react';
import { GraphCanvas } from './components/canvas/graph-canvas';
import { AuthDialog } from './components/dialogs/auth-dialog';
import { ConfirmationDialog } from './components/dialogs/confirmation-dialog';
import { CopyGraphDialog } from './components/dialogs/copy-graph-dialog';
import { GraphDialog } from './components/dialogs/graph-dialog';
import { EditorControls } from './components/overlays/editor-controls';
import { Header } from './components/overlays/header';
import {
  HistoryDrawer,
  historyToResults,
} from './components/overlays/history-drawer';
import { MaintenanceOverlay } from './components/overlays/maintenance-overlay';
import { ResultsSidebar } from './components/overlays/results-sidebar';
import { RetentionWarningBanner } from './components/overlays/retention-warning-banner';
import { SearchBar } from './components/overlays/search-bar';
import { useDialogState } from './hooks/use-dialog-state';
import { useEscapeKey } from './hooks/use-escape-key';
import { useGraphAutosave } from './hooks/use-graph-autosave';
import { useNotifications } from './hooks/use-notifications';
import { useSocketSync } from './hooks/use-socket-sync';
import { useTheme } from './hooks/use-theme';
import { useUploadManager } from './hooks/use-upload-manager';
import { ApiError, api, subscribeMaintenanceMode } from './lib/api';
import { layoutGraph } from './lib/layout';
import { getSourceMatches } from './lib/search-utils';
import { useGraphStore } from './store/graph-store';
import type { LimitsSummary, QueryHistory } from './types/api';

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
const NodeEditorDialog = lazy(() =>
  import('./components/dialogs/node-editor-dialog').then((m) => ({
    default: m.NodeEditorDialog,
  })),
);
const PricingDialog = lazy(() =>
  import('./components/dialogs/pricing-dialog').then((m) => ({
    default: m.PricingDialog,
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

export function App() {
  const identity = useGraphStore((state) => state.identity);
  const graph = useGraphStore((state) => state.graph);
  const graphs = useGraphStore((state) => state.graphs);
  const history = useGraphStore((state) => state.history);
  const results = useGraphStore((state) => state.results);
  const isEditing = useGraphStore((state) => state.isEditing);
  const isLoading = useGraphStore((state) => state.isLoading);
  const error = useGraphStore((state) => state.error);
  const activeSourceId = useGraphStore((state) => state.activeSourceId);
  const activeMatch = useGraphStore((state) => state.activeMatch);
  const editingNodeId = useGraphStore((state) => state.editingNodeId);
  const pendingDeleteNodeId = useGraphStore(
    (state) => state.pendingDeleteNodeId,
  );

  const setIdentity = useGraphStore((state) => state.setIdentity);
  const setGraphs = useGraphStore((state) => state.setGraphs);
  const setGraph = useGraphStore((state) => state.setGraph);
  const setHistory = useGraphStore((state) => state.setHistory);
  const setResults = useGraphStore((state) => state.setResults);
  const setMode = useGraphStore((state) => state.setMode);
  const setEditing = useGraphStore((state) => state.setEditing);
  const setActiveSourceId = useGraphStore((state) => state.setActiveSourceId);
  const setActiveMatch = useGraphStore((state) => state.setActiveMatch);
  const setEditingNodeId = useGraphStore((state) => state.setEditingNodeId);
  const setPendingDeleteNodeId = useGraphStore(
    (state) => state.setPendingDeleteNodeId,
  );
  const setSources = useGraphStore((state) => state.setSources);
  const setLoading = useGraphStore((state) => state.setLoading);
  const setError = useGraphStore((state) => state.setError);
  const addRoot = useGraphStore((state) => state.addRoot);
  const removeNode = useGraphStore((state) => state.removeNode);
  const updateNode = useGraphStore((state) => state.updateNode);
  const replaceCanvas = useGraphStore((state) => state.replaceCanvas);
  const collapseAllNodes = useGraphStore((state) => state.collapseAllNodes);
  const setSelectedNodeIds = useGraphStore((state) => state.setSelectedNodeIds);

  const dialogs = useDialogState();
  const [limits, setLimits] = useState<LimitsSummary>();
  const [queryForEdit, setQueryForEdit] = useState<string>();
  const [isFinalizing, setFinalizing] = useState(false);
  const { theme, setTheme } = useTheme();
  const [maintenanceState, setMaintenanceState] = useState<{
    active: boolean;
    message?: string;
  }>({ active: false });

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
    onError: reportError,
  });

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
      }
    },
    onNewNotification: pushLiveNotification,
  });

  const handleCloseResults = useCallback(() => {
    if (activeSourceId) {
      setActiveSourceId(undefined);
      setActiveMatch(undefined);
      return;
    }
    setResults(undefined);
    setActiveMatch(undefined);
    collapseAllNodes();
  }, [
    activeSourceId,
    setActiveSourceId,
    setActiveMatch,
    setResults,
    collapseAllNodes,
  ]);

  // Global Escape key shortcut
  useEscapeKey({
    hasResults: Boolean(results),
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

  async function search(
    query: string,
    extendedSearch: boolean,
    sensitivity?: 'low' | 'medium' | 'high',
    scope?: 'narrow' | 'normal' | 'wide',
  ): Promise<void> {
    if (!graph) return;
    try {
      setResults(
        await api.search(
          graph.id,
          query,
          useGraphStore.getState().selectedNodeIds,
          extendedSearch,
          sensitivity,
          scope,
        ),
      );
      setHistory(await api.history());
      setLimits(await api.limits());
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        dialogs.open('auth');
      }
      if (
        requestError instanceof ApiError &&
        (requestError.status === 403 || requestError.status === 429)
      ) {
        dialogs.open('pricing');
      }
      reportError(requestError);
    }
  }

  async function createGraph(
    title: string,
    description: string,
    isPublic = false,
  ): Promise<void> {
    if (identity?.isGuest) {
      dialogs.close('create');
      dialogs.open('auth');
      return;
    }
    try {
      const next = await api.createGraph(title, description, isPublic);
      setGraphs([...graphs, next]);
      await loadGraph(next.id);
      setLimits(await api.limits());
      setEditing(true);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 403) {
        dialogs.open('pricing');
      }
      reportError(requestError);
    }
  }

  async function copyGraph(title: string, isPublic = false): Promise<boolean> {
    if (!graph) return false;
    if (!identity || identity.isGuest) {
      dialogs.open('auth');
      return false;
    }
    try {
      const copied = await api.copyGraph(graph.id, title, isPublic);
      setGraphs(await api.graphs());
      await loadGraph(copied.id);
      setEditing(true);
      setLimits(await api.limits());
      return true;
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 403) {
        dialogs.open('pricing');
      }
      reportError(requestError);
      return false;
    }
  }

  async function attachGraph(id: string): Promise<void> {
    if (identity?.isGuest) {
      dialogs.open('auth');
      return;
    }
    try {
      await api.attachGraph(id);
      setGraphs(await api.graphs());
      if (graph?.id === id) {
        await loadGraph(id);
      }
    } catch (requestError) {
      reportError(requestError);
    }
  }

  async function saveGraphSettings(values: {
    title: string;
    description: string;
    isPublic: boolean;
    isExemptFromRetention?: boolean;
  }): Promise<void> {
    if (!graph) return;
    try {
      await api.updateSettings(graph.id, values);
      setGraphs(await api.graphs());
      await loadGraph(graph.id);
      setLimits(await api.limits());
      void refreshNotifications();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 403) {
        dialogs.open('pricing');
      }
      reportError(requestError);
    }
  }

  async function finalizeGraph(): Promise<void> {
    if (!graph) return;
    setFinalizing(true);
    try {
      await api.finalizeGraph(graph.id);
      await loadGraph(graph.id);
      setGraphs(await api.graphs());
    } catch (requestError) {
      reportError(requestError);
    } finally {
      setFinalizing(false);
    }
  }

  function arrangeGraph(): void {
    if (graph) {
      replaceCanvas(layoutGraph(graph.nodes, graph.edges), graph.edges);
    }
  }

  function restoreHistory(entry: QueryHistory): void {
    const restored = historyToResults(entry);
    if (!restored) return;
    void (async () => {
      try {
        if (entry.graphId !== graph?.id) await loadGraph(entry.graphId);
        setSelectedNodeIds(entry.selectedNodeIds);
        setResults(restored);
      } catch (requestError) {
        reportError(requestError);
      }
    })();
  }

  function editHistory(entry: QueryHistory): void {
    if (entry.graphId !== graph?.id) {
      void loadGraph(entry.graphId).catch(reportError);
    }
    setQueryForEdit(entry.queryText);
    setSelectedNodeIds(entry.selectedNodeIds);
    setMode('CONTEXT_SELECTION');
  }

  const currentNode = graph?.nodes.find((node) => node.id === editingNodeId);
  const sourceMatches = useMemo(
    () => getSourceMatches(results, activeSourceId),
    [results, activeSourceId],
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
        <GraphCanvas key={graph?.id ?? 'empty'} />
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
          onOpenPricing={() => dialogs.open('pricing')}
          onOpenRetentionDashboard={() => dialogs.open('retention')}
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
        {isUnattachedPublic && graph ? (
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
            queryForEdit={queryForEdit}
            tier={identity?.tier}
            onRequireAuth={() => dialogs.open('auth')}
          />
        )}
      </div>
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
        privateQuota={limits?.privateGraphs}
        tier={identity?.tier}
        onOpenPricing={() => {
          dialogs.close('create');
          dialogs.open('pricing');
        }}
      />
      <CopyGraphDialog
        graph={graph}
        limits={limits}
        open={dialogs.isOpen('copy')}
        onOpenChange={(open) => dialogs.set('copy', open)}
        onCopy={copyGraph}
        onOpenPricing={() => {
          dialogs.close('copy');
          dialogs.open('pricing');
        }}
      />
      <Suspense fallback={null}>
        <GraphSettingsDialog
          graph={graph}
          limits={limits}
          open={dialogs.isOpen('settings')}
          onOpenChange={(open) => dialogs.set('settings', open)}
          onSave={saveGraphSettings}
          onOpenPricing={() => {
            dialogs.close('settings');
            dialogs.open('pricing');
          }}
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
        <NodeEditorDialog
          node={currentNode}
          onOpenChange={(open) => !open && setEditingNodeId(undefined)}
          onSave={updateNode}
        />
        <SourceViewerDialog
          sourceId={activeSourceId}
          matches={sourceMatches}
          focusedMatch={activeMatch}
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
        />
        <PricingDialog
          identity={identity}
          open={dialogs.isOpen('pricing')}
          onOpenChange={(open) => dialogs.set('pricing', open)}
          onUpgraded={() => bootstrap(graph?.id)}
        />
        <RetentionDashboardDialog
          open={dialogs.isOpen('retention')}
          onOpenChange={(open) => dialogs.set('retention', open)}
          onGraphRestored={(restoredGraphId) => {
            void api.graphs().then(setGraphs);
            void loadGraph(restoredGraphId);
          }}
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
