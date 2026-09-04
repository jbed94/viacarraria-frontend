import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { create } from 'zustand';

import { layoutGraph } from '../lib/layout';
import type {
  Graph,
  GraphEdge,
  GraphNode,
  GraphSummary,
  Identity,
  QueryHistory,
  SearchChunk,
  SearchResponse,
  Source,
} from '../types/api';

export type GraphMode = 'IDLE' | 'CONTEXT_SELECTION' | 'VISUAL_RESULTS';

type GraphStore = {
  identity?: Identity;
  graph?: Graph;
  graphs: GraphSummary[];
  mode: GraphMode;
  selectedNodeIds: string[];
  results?: SearchResponse;
  history: QueryHistory[];
  expandedNodeIds: string[];
  activeSourceId?: string;
  activeMatch?: SearchChunk;
  editingNodeId?: string;
  pendingDeleteNodeId?: string;
  isEditing: boolean;
  isLoading: boolean;
  error?: string;
  setIdentity: (identity?: Identity) => void;
  setGraphs: (graphs: GraphSummary[]) => void;
  setGraph: (graph: Graph) => void;
  setMode: (mode: GraphMode) => void;
  setHistory: (history: QueryHistory[]) => void;
  setResults: (results?: SearchResponse) => void;
  toggleNodeSelection: (id: string) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  toggleExpanded: (id: string) => void;
  setActiveSourceId: (id?: string) => void;
  setActiveMatch: (match?: SearchChunk) => void;
  setEditingNodeId: (id?: string) => void;
  setPendingDeleteNodeId: (id?: string) => void;
  setEditing: (value: boolean) => void;
  applyNodes: (changes: NodeChange<GraphNode>[]) => void;
  applyEdges: (changes: EdgeChange<GraphEdge>[]) => void;
  connect: (connection: Connection) => void;
  addRoot: () => void;
  addChild: (parentId: string) => void;
  removeNode: (id: string) => void;
  updateNode: (id: string, data: GraphNode['data']) => void;
  replaceCanvas: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  collapseAllNodes: () => void;
  setSources: (sources: Source[]) => void;
  setLoading: (value: boolean) => void;
  setError: (error?: string) => void;
};

export const useGraphStore = create<GraphStore>((set) => ({
  graphs: [],
  mode: 'IDLE',
  selectedNodeIds: [],
  history: [],
  expandedNodeIds: [],
  isEditing: false,
  isLoading: true,
  setIdentity: (identity) => set({ identity }),
  setGraphs: (graphs) => set({ graphs }),
  setGraph: (graph) =>
    set((state) => ({
      graph,
      selectedNodeIds: graph.nodes
        .slice(0, state.identity?.tier === 'ANONYMOUS' ? 2 : undefined)
        .map((node) => node.id),
      expandedNodeIds: [],
      results: undefined,
      mode: 'IDLE',
      isEditing: false,
      activeSourceId: undefined,
      activeMatch: undefined,
    })),
  setMode: (mode) => set({ mode }),
  setHistory: (history) => set({ history }),
  setResults: (results) =>
    set((state) => ({
      results,
      mode: results ? 'VISUAL_RESULTS' : 'IDLE',
      activeSourceId: results ? state.activeSourceId : undefined,
      activeMatch: results ? state.activeMatch : undefined,
      ...(results
        ? {}
        : {
            expandedNodeIds: [],
            graph: state.graph
              ? {
                  ...state.graph,
                  nodes: layoutGraph(state.graph.nodes, state.graph.edges, []),
                }
              : undefined,
          }),
    })),
  collapseAllNodes: () =>
    set((state) => {
      if (!state.graph || state.expandedNodeIds.length === 0) return state;
      return {
        expandedNodeIds: [],
        graph: {
          ...state.graph,
          nodes: layoutGraph(state.graph.nodes, state.graph.edges, []),
        },
      };
    }),
  toggleNodeSelection: (id) =>
    set((state) => ({
      selectedNodeIds: state.selectedNodeIds.includes(id)
        ? state.selectedNodeIds.filter((nodeId) => nodeId !== id)
        : [...state.selectedNodeIds, id],
    })),
  setSelectedNodeIds: (selectedNodeIds) => set({ selectedNodeIds }),
  toggleExpanded: (id) =>
    set((state) => {
      if (!state.graph) return state;
      const expandedNodeIds = state.expandedNodeIds.includes(id)
        ? state.expandedNodeIds.filter((nodeId) => nodeId !== id)
        : [...state.expandedNodeIds, id];
      return {
        expandedNodeIds,
        graph: {
          ...state.graph,
          nodes: layoutGraph(
            state.graph.nodes,
            state.graph.edges,
            expandedNodeIds,
          ),
        },
      };
    }),
  setActiveSourceId: (activeSourceId) =>
    set({ activeSourceId, activeMatch: undefined }),
  setActiveMatch: (activeMatch) => set({ activeMatch }),
  setEditingNodeId: (editingNodeId) => set({ editingNodeId }),
  setPendingDeleteNodeId: (pendingDeleteNodeId) => set({ pendingDeleteNodeId }),
  setEditing: (isEditing) => set({ isEditing }),
  applyNodes: (changes) =>
    set((state) =>
      state.graph
        ? {
            graph: {
              ...state.graph,
              nodes: applyNodeChanges(changes, state.graph.nodes),
            },
          }
        : state,
    ),
  applyEdges: (changes) =>
    set((state) =>
      state.graph
        ? {
            graph: {
              ...state.graph,
              edges: applyEdgeChanges(changes, state.graph.edges),
            },
          }
        : state,
    ),
  connect: (connection) =>
    set((state) =>
      state.graph
        ? {
            graph: {
              ...state.graph,
              edges: addEdge(
                { ...connection, id: crypto.randomUUID() },
                state.graph.edges,
              ),
            },
          }
        : state,
    ),
  addRoot: () =>
    set((state) => {
      if (!state.graph) return state;
      const index = state.graph.nodes.length + 1;
      const node: GraphNode = {
        id: crypto.randomUUID(),
        position: { x: 80 + index * 20, y: 100 + index * 32 },
        data: {
          title: `Untitled topic ${index}`,
          category: 'New topic',
          description: '',
        },
      };
      return { graph: { ...state.graph, nodes: [...state.graph.nodes, node] } };
    }),
  addChild: (parentId) =>
    set((state) => {
      if (!state.graph) return state;
      const parent = state.graph.nodes.find((node) => node.id === parentId);
      if (!parent) return state;
      const index = state.graph.nodes.length + 1;
      const node: GraphNode = {
        id: crypto.randomUUID(),
        position: { x: parent.position.x + 300, y: parent.position.y + 40 },
        data: {
          title: `Untitled topic ${index}`,
          category: 'New topic',
          description: '',
        },
      };
      return {
        graph: {
          ...state.graph,
          nodes: [...state.graph.nodes, node],
          edges: [
            ...state.graph.edges,
            { id: crypto.randomUUID(), source: parentId, target: node.id },
          ],
        },
      };
    }),
  removeNode: (id) =>
    set((state) =>
      state.graph
        ? {
            graph: {
              ...state.graph,
              nodes: state.graph.nodes.filter((node) => node.id !== id),
              edges: state.graph.edges.filter(
                (edge) => edge.source !== id && edge.target !== id,
              ),
              sources: state.graph.sources.filter(
                (source) => source.nodeId !== id,
              ),
            },
          }
        : state,
    ),
  updateNode: (id, data) =>
    set((state) =>
      state.graph
        ? {
            graph: {
              ...state.graph,
              nodes: state.graph.nodes.map((node) =>
                node.id === id ? { ...node, data } : node,
              ),
            },
          }
        : state,
    ),
  replaceCanvas: (nodes, edges) =>
    set((state) =>
      state.graph ? { graph: { ...state.graph, nodes, edges } } : state,
    ),
  setSources: (sources) =>
    set((state) =>
      state.graph ? { graph: { ...state.graph, sources } } : state,
    ),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
