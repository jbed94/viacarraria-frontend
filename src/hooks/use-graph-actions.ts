import { useState } from 'react';

import { ApiError, api } from '../lib/api';
import { layoutGraph } from '../lib/layout';
import type {
  Graph,
  GraphEdge,
  GraphNode,
  GraphSummary,
  Identity,
  LimitsSummary,
} from '../types/api';
import type { DialogName } from './use-dialog-state';

export type UseGraphActionsOptions = {
  graph?: Graph;
  graphs: GraphSummary[];
  identity?: Identity;
  dialogs: {
    open: (key: DialogName) => void;
    close: (key: DialogName) => void;
  };
  setGraphs: (graphs: GraphSummary[]) => void;
  loadGraph: (graphId: string) => Promise<void>;
  setEditing: (editing: boolean) => void;
  setLimits: (limits: LimitsSummary) => void;
  refreshNotifications: () => Promise<void>;
  replaceCanvas: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  reportError: (err: unknown) => void;
};

export function useGraphActions({
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
}: UseGraphActionsOptions) {
  const [isFinalizing, setFinalizing] = useState(false);

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
      if (
        requestError instanceof ApiError &&
        requestError.status === 403 &&
        identity?.isGuest
      ) {
        dialogs.open('auth');
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
      if (
        requestError instanceof ApiError &&
        requestError.status === 403 &&
        identity?.isGuest
      ) {
        dialogs.open('auth');
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

  return {
    isFinalizing,
    createGraph,
    copyGraph,
    attachGraph,
    saveGraphSettings,
    finalizeGraph,
    arrangeGraph,
  };
}
