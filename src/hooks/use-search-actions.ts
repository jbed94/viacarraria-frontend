import { useCallback, useRef, useState } from 'react';

import {
  historyToCrawlResults,
  historyToResults,
  isCrawlHistoryEntry,
} from '../components/overlays/history-drawer';
import { ApiError, api } from '../lib/api';
import {
  useGraphStore,
  type GraphMode,
  type QueryType,
} from '../store/graph-store';
import type {
  CrawlDepth,
  CrawlDirection,
  CrawlProgressPayload,
  CrawlResponse,
  CrawlSettings,
  Graph,
  HypothesisGroupDto,
  Identity,
  LimitsSummary,
  QueryHistory,
  SearchScope,
  SearchSensitivity,
} from '../types/api';
import type { DialogName } from './use-dialog-state';

export type UseSearchActionsOptions = {
  graph?: Graph;
  identity?: Identity;
  dialogs: {
    open: (key: DialogName) => void;
    close: (key: DialogName) => void;
  };
  loadGraph: (graphId: string) => Promise<void>;
  setResults: (results?: import('../types/api').SearchResponse) => void;
  setCrawlResults: (crawlResults?: CrawlResponse) => void;
  setHistory: (history: QueryHistory[]) => void;
  setLimits: (limits: LimitsSummary) => void;
  setQueryType: (type: QueryType) => void;
  setMode: (mode: GraphMode) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setCrawlStartingNodeIds: (ids: string[]) => void;
  reportError: (err: unknown) => void;
};

export function useSearchActions({
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
}: UseSearchActionsOptions) {
  const [queryForEdit, setQueryForEdit] = useState<string>();
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlStepProgress, setCrawlStepProgress] =
    useState<CrawlProgressPayload | null>(null);

  const activeCrawlParamsRef = useRef<{
    query: string;
    direction: CrawlDirection;
    crawlDepth: CrawlDepth;
    sensitivity: SearchSensitivity;
  } | null>(null);
  const activeCrawlJobIdRef = useRef<string | null>(null);
  const activeCrawlAbortRef = useRef<AbortController | null>(null);

  const handleCancelCrawl = useCallback(() => {
    if (activeCrawlJobIdRef.current) {
      void api.cancelCrawl(activeCrawlJobIdRef.current).catch(() => {});
    }
    if (activeCrawlAbortRef.current) {
      activeCrawlAbortRef.current.abort();
      activeCrawlAbortRef.current = null;
    }
    setIsCrawling(false);
    setCrawlStepProgress(null);
  }, []);

  async function search(
    query: string,
    sensitivity?: SearchSensitivity,
    scope?: SearchScope,
  ): Promise<void> {
    if (!graph) return;
    try {
      setResults(
        await api.search(
          graph.id,
          query,
          useGraphStore.getState().selectedNodeIds,
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
        (requestError.status === 403 || requestError.status === 429) &&
        identity?.isGuest
      ) {
        dialogs.open('auth');
      }
      reportError(requestError);
    }
  }

  async function crawl(
    query: string,
    direction: CrawlDirection = 'forward',
    crawlDepth: CrawlDepth = 'default',
    sensitivity: SearchSensitivity = 'medium',
    comparativeMode?: boolean,
    groupBStartingNodeIds?: string[],
    hypothesisGroups?: HypothesisGroupDto[],
    crawlSettings?: CrawlSettings,
  ): Promise<void> {
    if (!graph) return;
    const startingNodeIds = useGraphStore.getState().crawlStartingNodeIds;
    if (startingNodeIds.length === 0) return;
    const jobId = `crawl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const abortController = new AbortController();
    activeCrawlJobIdRef.current = jobId;
    activeCrawlAbortRef.current = abortController;
    setIsCrawling(true);
    setCrawlStepProgress(null);
    activeCrawlParamsRef.current = {
      query,
      direction,
      crawlDepth,
      sensitivity,
    };
    try {
      const res = await api.crawl(
        graph.id,
        query,
        startingNodeIds,
        direction,
        crawlDepth,
        sensitivity,
        comparativeMode,
        groupBStartingNodeIds,
        hypothesisGroups,
        jobId,
        { signal: abortController.signal },
        crawlSettings,
      );
      setCrawlResults(res);
      setHistory(await api.history());
      setLimits(await api.limits());
    } catch (requestError) {
      if ((requestError as any)?.name === 'AbortError') {
        return;
      }
      if (requestError instanceof ApiError && requestError.status === 401) {
        dialogs.open('auth');
      }
      if (
        requestError instanceof ApiError &&
        (requestError.status === 403 || requestError.status === 429) &&
        identity?.isGuest
      ) {
        dialogs.open('auth');
      }
      reportError(requestError);
    } finally {
      setIsCrawling(false);
      setCrawlStepProgress(null);
      activeCrawlParamsRef.current = null;
      activeCrawlJobIdRef.current = null;
      activeCrawlAbortRef.current = null;
    }
  }

  function restoreHistory(entry: QueryHistory): void {
    if (isCrawlHistoryEntry(entry)) {
      const restoredCrawl = historyToCrawlResults(entry);
      if (!restoredCrawl) return;
      void (async () => {
        try {
          if (entry.graphId !== graph?.id) await loadGraph(entry.graphId);
          setQueryForEdit(entry.queryText);
          setCrawlStartingNodeIds(entry.selectedNodeIds);
          setCrawlResults(restoredCrawl);
        } catch (requestError) {
          reportError(requestError);
        }
      })();
      return;
    }
    const restored = historyToResults(entry);
    if (!restored) return;
    void (async () => {
      try {
        if (entry.graphId !== graph?.id) await loadGraph(entry.graphId);
        setQueryForEdit(entry.queryText);
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
    if (isCrawlHistoryEntry(entry)) {
      setCrawlStartingNodeIds(entry.selectedNodeIds);
      setQueryType('crawl');
      setMode('CRAWL_SELECTION');
    } else {
      setSelectedNodeIds(entry.selectedNodeIds);
      setQueryType('simple');
      setMode('CONTEXT_SELECTION');
    }
  }

  async function rerunHistory(entry: QueryHistory): Promise<void> {
    if (identity?.isGuest) {
      dialogs.open('auth');
      return;
    }
    try {
      if (entry.graphId !== graph?.id) {
        await loadGraph(entry.graphId);
      }
      if (isCrawlHistoryEntry(entry)) {
        setCrawlStartingNodeIds(entry.selectedNodeIds);
        const crawlRes = historyToCrawlResults(entry);
        await crawl(
          entry.queryText,
          crawlRes?.direction ?? 'forward',
          crawlRes?.crawlDepth ?? 'default',
          crawlRes?.sensitivity ?? 'medium',
        );
      } else {
        setSelectedNodeIds(entry.selectedNodeIds);
        await search(entry.queryText);
      }
    } catch (requestError) {
      reportError(requestError);
    }
  }

  const handleCrawlProgress = useCallback(
    (progress: CrawlProgressPayload) => {
      setCrawlStepProgress(progress);
      if (
        progress.currentNodes &&
        progress.currentNodes.length > 0 &&
        activeCrawlParamsRef.current
      ) {
        const {
          query,
          direction: d,
          crawlDepth: cd,
          sensitivity: s,
        } = activeCrawlParamsRef.current;
        const interimResults: CrawlResponse = {
          queryId: 'streaming',
          queryType: 'crawl',
          queryText: query,
          startingNodeIds: useGraphStore.getState().crawlStartingNodeIds,
          crawlDepth: cd,
          direction: d,
          sensitivity: s,
          nodes: progress.currentNodes,
          edges: progress.currentEdges ?? [],
          maxLevelReached: progress.level,
          totalMatches: progress.matchesCount ?? progress.currentNodes.length,
          matchedNodeIds: [
            ...new Set(progress.currentNodes.map((n) => n.nodeId)),
          ],
          remaining: 0,
          maxBranchEntropy: progress.maxBranchEntropy,
          prunedBranchesCount: progress.prunedBranchesCount,
        };
        setCrawlResults(interimResults);
      }
    },
    [setCrawlResults],
  );

  return {
    queryForEdit,
    setQueryForEdit,
    isCrawling,
    crawlStepProgress,
    setCrawlStepProgress,
    handleCancelCrawl,
    handleCrawlProgress,
    search,
    crawl,
    restoreHistory,
    editHistory,
    rerunHistory,
  };
}
