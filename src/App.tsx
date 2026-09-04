import { BookmarkPlus, BookOpen, Copy } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { GraphBrowserDialog } from './components/browser/graph-browser-dialog';
import { GraphCanvas } from './components/canvas/graph-canvas';
import { AuthDialog } from './components/dialogs/auth-dialog';
import { ConfirmationDialog } from './components/dialogs/confirmation-dialog';
import { CopyGraphDialog } from './components/dialogs/copy-graph-dialog';
import { GraphDialog } from './components/dialogs/graph-dialog';
import { GraphSettingsDialog } from './components/dialogs/graph-settings-dialog';
import { NodeEditorDialog } from './components/dialogs/node-editor-dialog';
import { PricingDialog } from './components/dialogs/pricing-dialog';
import { ProfileDialog } from './components/dialogs/profile-dialog';
import { SourceViewerDialog } from './components/dialogs/source-viewer-dialog';
import { EditorControls } from './components/overlays/editor-controls';
import { Header } from './components/overlays/header';
import {
  HistoryDrawer,
  historyToResults,
} from './components/overlays/history-drawer';
import { ResultsSidebar } from './components/overlays/results-sidebar';
import { SearchBar } from './components/overlays/search-bar';
import { useTheme } from './hooks/use-theme';
import { ApiError, api } from './lib/api';
import { layoutGraph } from './lib/layout';
import { useGraphStore } from './store/graph-store';
import type { LimitsSummary, QueryHistory, SearchChunk } from './types/api';

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
  const lastPersisted = useRef<string | undefined>(undefined);
  const [authOpen, setAuthOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [limits, setLimits] = useState<LimitsSummary>();
  const [queryForEdit, setQueryForEdit] = useState<string>();
  const [isFinalizing, setFinalizing] = useState(false);
  const { theme, setTheme } = useTheme();

  const reportError = useEffectEvent((requestError: unknown): void => {
    setError(
      requestError instanceof ApiError
        ? requestError.message
        : 'Something went wrong.',
    );
  });

  const loadGraph = useEffectEvent(async (graphId: string): Promise<void> => {
    const next = await api.graph(graphId);
    lastPersisted.current = JSON.stringify({
      nodes: next.nodes,
      edges: next.edges,
    });
    setGraph(next);
  });

  const pollSource = useEffectEvent((sourceId: string): void => {
    window.setTimeout(() => {
      void api
        .source(sourceId)
        .then((source) => {
          const current = useGraphStore.getState().graph;
          if (current)
            setSources(
              current.sources.map((item) =>
                item.id === source.id ? source : item,
              ),
            );
          if (source.status === 'PENDING' || source.status === 'PROCESSING')
            pollSource(sourceId);
        })
        .catch(reportError);
    }, 700);
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

  useEffect(() => {
    if (!isEditing || !graph?.isOwned) return;
    const snapshot = JSON.stringify({ nodes: graph.nodes, edges: graph.edges });
    if (snapshot === lastPersisted.current) return;
    const timer = window.setTimeout(() => {
      void api
        .updateGraph(graph.id, graph.nodes, graph.edges)
        .then(() => {
          lastPersisted.current = snapshot;
        })
        .catch(reportError);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [graph?.edges, graph?.id, graph?.isOwned, graph?.nodes, isEditing]);

  useEffect(() => {
    function uploadListener(event: Event): void {
      const detail = (event as CustomEvent<{ nodeId: string; file: File }>)
        .detail;
      if (!graph || !detail) return;
      void api
        .uploadSource(graph.id, detail.nodeId, detail.file)
        .then((source) => {
          setSources([...graph.sources, source]);
          void api.limits().then(setLimits).catch(reportError);
          pollSource(source.id);
        })
        .catch(reportError);
    }
    window.addEventListener('via-upload-source', uploadListener);
    function deleteListener(event: Event): void {
      const detail = (event as CustomEvent<{ sourceId: string }>).detail;
      if (!detail) return;
      void api
        .deleteSource(detail.sourceId)
        .then(() => {
          const current = useGraphStore.getState().graph;
          if (current)
            setSources(
              current.sources.filter((source) => source.id !== detail.sourceId),
            );
        })
        .catch(reportError);
    }
    window.addEventListener('via-delete-source', deleteListener);
    return () => {
      window.removeEventListener('via-upload-source', uploadListener);
      window.removeEventListener('via-delete-source', deleteListener);
    };
  }, [graph, setSources]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws', {
      transports: ['websocket'],
      withCredentials: true,
    });
    socket.on(
      'progress:update',
      (update: {
        sourceId: string;
        status: 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';
      }) => {
        const current = useGraphStore.getState().graph;
        if (current)
          setSources(
            current.sources.map((source) =>
              source.id === update.sourceId
                ? { ...source, status: update.status }
                : source,
            ),
          );
      },
    );
    return () => {
      socket.close();
    };
  }, [setSources]);

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
      if (requestError instanceof ApiError && requestError.status === 401)
        setAuthOpen(true);
      if (
        requestError instanceof ApiError &&
        (requestError.status === 403 || requestError.status === 429)
      )
        setPricingOpen(true);
      reportError(requestError);
    }
  }

  const handleCloseResults = useCallback(() => {
    setResults(undefined);
    setActiveMatch(undefined);
    collapseAllNodes();
  }, [setResults, setActiveMatch, collapseAllNodes]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      // Do not intercept if a modal dialog is currently open
      if (document.querySelector('[role="dialog"]')) return;

      if (results) {
        event.preventDefault();
        handleCloseResults();
        return;
      }

      const { expandedNodeIds, collapseAllNodes: collapse } =
        useGraphStore.getState();
      if (expandedNodeIds.length > 0) {
        event.preventDefault();
        collapse();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, handleCloseResults]);

  async function createGraph(
    title: string,
    description: string,
    isPublic = false,
  ): Promise<void> {
    if (identity?.isGuest) {
      setCreateOpen(false);
      setAuthOpen(true);
      return;
    }
    try {
      const next = await api.createGraph(title, description, isPublic);
      setGraphs([...graphs, next]);
      await loadGraph(next.id);
      setLimits(await api.limits());
      setEditing(true);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 403)
        setPricingOpen(true);
      reportError(requestError);
    }
  }

  async function copyGraph(title: string, isPublic = false): Promise<boolean> {
    if (!graph) return false;
    if (!identity || identity.isGuest) {
      setAuthOpen(true);
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
        setPricingOpen(true);
      }
      reportError(requestError);
      return false;
    }
  }

  async function attachGraph(id: string): Promise<void> {
    if (identity?.isGuest) {
      setAuthOpen(true);
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
  }): Promise<void> {
    if (!graph) return;
    try {
      await api.updateSettings(graph.id, values);
      setGraphs(await api.graphs());
      await loadGraph(graph.id);
      setLimits(await api.limits());
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 403) {
        setPricingOpen(true);
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
    if (graph)
      replaceCanvas(layoutGraph(graph.nodes, graph.edges), graph.edges);
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
    if (entry.graphId !== graph?.id)
      void loadGraph(entry.graphId).catch(reportError);
    setQueryForEdit(entry.queryText);
    setSelectedNodeIds(entry.selectedNodeIds);
    setMode('CONTEXT_SELECTION');
  }

  const currentNode = graph?.nodes.find((node) => node.id === editingNodeId);
  const sourceMatches =
    activeSourceId && results
      ? (() => {
          const allQueryChunks = results.results
            .flatMap((result) => result.chunks)
            .flatMap((chunk) => [chunk, ...(chunk.extendedContext ?? [])])
            .filter((chunk) => chunk.sourceId === activeSourceId);

          const unique = new Map<string, SearchChunk>();
          for (const chunk of allQueryChunks) {
            const key = `${chunk.sourceId}:${chunk.startChar}:${chunk.endChar}`;
            if (!unique.has(key) || chunk.kind === 'MATCH') {
              unique.set(key, chunk);
            }
          }
          return [...unique.values()];
        })()
      : [];

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
            if (identity?.isGuest) setAuthOpen(true);
            else setCopyOpen(true);
          }}
          onOpenBrowser={() => setBrowserOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onAttachCurrent={() => {
            if (graph) void attachGraph(graph.id);
          }}
          limits={limits}
          onCreate={() =>
            identity?.isGuest ? setAuthOpen(true) : setCreateOpen(true)
          }
          onToggleEditing={() => setEditing(!isEditing)}
          onOpenAuth={() => setAuthOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
          onOpenPricing={() => setPricingOpen(true)}
          theme={theme}
          onThemeChange={setTheme}
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
                onClick={() => setCopyOpen(true)}
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
        open={authOpen}
        onOpenChange={setAuthOpen}
        onAuthenticated={(viewer) => {
          setIdentity(viewer);
          void bootstrap(graph?.id);
        }}
      />
      <GraphDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={createGraph}
        privateQuota={limits?.privateGraphs}
        tier={identity?.tier}
        onOpenPricing={() => {
          setCreateOpen(false);
          setPricingOpen(true);
        }}
      />
      <CopyGraphDialog
        graph={graph}
        limits={limits}
        open={copyOpen}
        onOpenChange={setCopyOpen}
        onCopy={copyGraph}
        onOpenPricing={() => {
          setCopyOpen(false);
          setPricingOpen(true);
        }}
      />
      <GraphSettingsDialog
        graph={graph}
        limits={limits}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSave={saveGraphSettings}
        onOpenPricing={() => {
          setSettingsOpen(false);
          setPricingOpen(true);
        }}
      />
      <GraphBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        identity={identity}
        onSelectGraph={(id) => {
          void loadGraph(id).catch(reportError);
        }}
        onCopyGraph={(target) => {
          void api.graph(target.id).then((g) => {
            setGraph(g);
            setCopyOpen(true);
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
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onIdentityChange={setIdentity}
        onLogout={async () => {
          await api.logout();
          setProfileOpen(false);
          await bootstrap();
        }}
      />
      <PricingDialog
        identity={identity}
        open={pricingOpen}
        onOpenChange={setPricingOpen}
        onUpgraded={() => bootstrap(graph?.id)}
      />
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
    </main>
  );
}
