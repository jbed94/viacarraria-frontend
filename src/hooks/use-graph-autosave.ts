import { useEffect, useRef } from 'react';

import { api } from '../lib/api';
import type { Graph } from '../types/api';

type UseGraphAutosaveProps = {
  graph?: Graph;
  isEditing: boolean;
  onError?: (error: unknown) => void;
};

export function useGraphAutosave({
  graph,
  isEditing,
  onError,
}: UseGraphAutosaveProps) {
  const lastPersisted = useRef<string | undefined>(undefined);

  const primeSnapshot = (nodes: Graph['nodes'], edges: Graph['edges']) => {
    lastPersisted.current = JSON.stringify({ nodes, edges });
  };

  useEffect(() => {
    if (!isEditing || !graph?.isOwned) return;
    const snapshot = JSON.stringify({
      nodes: graph.nodes,
      edges: graph.edges,
    });
    if (snapshot === lastPersisted.current) return;

    const timer = window.setTimeout(() => {
      void api
        .updateGraph(graph.id, graph.nodes, graph.edges)
        .then(() => {
          lastPersisted.current = snapshot;
        })
        .catch((err) => {
          onError?.(err);
        });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [graph?.edges, graph?.id, graph?.isOwned, graph?.nodes, isEditing]);

  return { primeSnapshot, lastPersisted };
}
