import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { create } from 'zustand';

import type {
  CrawlResponse,
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

export type QueryType = 'simple' | 'crawl';

export type GraphMode =
  | 'IDLE'
  | 'CONTEXT_SELECTION'
  | 'CRAWL_SELECTION'
  | 'VISUAL_RESULTS'
  | 'CRAWL_RESULTS';

export type LightboxFigure = {
  url: string;
  title?: string;
  pageNum?: number;
  sourceName?: string;
  coordinates?: number[];
};

export type ActiveUpload = {
  uploadKey: string;
  nodeId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'uploading' | 'paused' | 'resuming' | 'completing' | 'error';
  concurrency?: number;
  speedBps?: number;
};

type GraphStore = {
  identity?: Identity;
  graph?: Graph;
  graphs: GraphSummary[];
  mode: GraphMode;
  queryType: QueryType;
  selectedNodeIds: string[];
  previewNodeIds: string[];
  setPreviewNodeIds: (ids: string[]) => void;
  crawlStartingNodeIds: string[];
  results?: SearchResponse;
  crawlResults?: CrawlResponse;
  minRelevanceScore: number;
  history: QueryHistory[];
  expandedNodeIds: string[];
  activeSourceId?: string;
  activeMatch?: SearchChunk;
  activeLightboxFigure?: LightboxFigure | null;
  openLightbox: (figure: LightboxFigure) => void;
  closeLightbox: () => void;
  addNodeFromCrop: (cropBase64: string, title?: string) => string | null;
  editingNodeId?: string;
  pendingDeleteNodeId?: string;
  isEditing: boolean;
  isLoading: boolean;
  error?: string;
  activeUploads: Record<string, ActiveUpload>;
  isFocusMode: boolean;
  focusedNodeId?: string;
  maximizedNodeId?: string;
  setFocusMode: (val: boolean) => void;
  toggleFocusMode: () => void;
  setFocusedNodeId: (id?: string) => void;
  setMaximizedNodeId: (id?: string) => void;
  setIdentity: (identity?: Identity) => void;
  setGraphs: (graphs: GraphSummary[]) => void;
  setGraph: (graph: Graph) => void;
  setMode: (mode: GraphMode) => void;
  setQueryType: (queryType: QueryType) => void;
  setHistory: (history: QueryHistory[]) => void;
  setResults: (results?: SearchResponse) => void;
  setCrawlResults: (crawlResults?: CrawlResponse) => void;
  setMinRelevanceScore: (score: number) => void;
  clearResults: () => void;
  toggleNodeSelection: (id: string) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  toggleCrawlStartingNode: (id: string) => void;
  setCrawlStartingNodeIds: (ids: string[]) => void;
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
  updateSourceProgress: (
    sourceId: string,
    status: Source['status'],
    progress: number,
  ) => void;
  setUploadProgress: (upload: ActiveUpload) => void;
  removeUploadProgress: (uploadKey: string) => void;
  setLoading: (value: boolean) => void;
  setError: (error?: string) => void;
};

export const useGraphStore = create<GraphStore>((set) => ({
  graphs: [],
  mode: 'IDLE',
  queryType: 'simple',
  selectedNodeIds: [],
  previewNodeIds: [],
  setPreviewNodeIds: (previewNodeIds) => set({ previewNodeIds }),
  crawlStartingNodeIds: [],
  minRelevanceScore: 0,
  history: [],
  expandedNodeIds: [],
  maximizedNodeId: undefined,
  isEditing: false,
  isLoading: true,
  activeUploads: {},
  isFocusMode: false,
  focusedNodeId: undefined,
  setFocusMode: (isFocusMode) => set({ isFocusMode }),
  toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),
  setFocusedNodeId: (focusedNodeId) => set({ focusedNodeId }),
  setMaximizedNodeId: (maximizedNodeId) => set({ maximizedNodeId }),
  setIdentity: (identity) => set({ identity }),
  setGraphs: (graphs) => set({ graphs }),
  setGraph: (graph) =>
    set((state) => ({
      graph,
      queryType: 'simple',
      selectedNodeIds: graph.nodes
        .slice(0, state.identity?.tier === 'ANONYMOUS' ? 2 : undefined)
        .map((node) => node.id),
      previewNodeIds: [],
      crawlStartingNodeIds: graph.nodes
        .slice(0, state.identity?.tier === 'ANONYMOUS' ? 1 : undefined)
        .map((node) => node.id),
      expandedNodeIds: [],
      maximizedNodeId: undefined,
      results: undefined,
      crawlResults: undefined,
      minRelevanceScore: 0,
      mode: 'IDLE',
      isEditing: false,
      activeSourceId: undefined,
      activeMatch: undefined,
      isFocusMode: false,
      focusedNodeId: undefined,
    })),
  setMode: (mode) => set({ mode }),
  setQueryType: (queryType) =>
    set((state) => {
      let nextMode = state.mode;
      let nextCrawlStartingNodeIds = state.crawlStartingNodeIds;
      if (queryType === 'crawl') {
        if (state.mode === 'IDLE' || state.mode === 'CONTEXT_SELECTION') {
          nextMode = 'CRAWL_SELECTION';
        }
        if (nextCrawlStartingNodeIds.length === 0 && state.graph) {
          nextCrawlStartingNodeIds = state.graph.nodes
            .slice(0, state.identity?.tier === 'ANONYMOUS' ? 1 : undefined)
            .map((node) => node.id);
        }
      } else {
        if (state.mode === 'CRAWL_SELECTION') {
          nextMode = 'CONTEXT_SELECTION';
        }
      }
      return {
        queryType,
        mode: nextMode,
        crawlStartingNodeIds: nextCrawlStartingNodeIds,
      };
    }),
  setHistory: (history) => set({ history }),
  setResults: (results) =>
    set({
      results,
      crawlResults: undefined,
      mode: results ? 'VISUAL_RESULTS' : 'IDLE',
      activeSourceId: undefined,
      activeMatch: undefined,
      ...(results
        ? {}
        : {
            expandedNodeIds: [],
          }),
    }),
  setCrawlResults: (crawlResults) =>
    set({
      crawlResults,
      results: undefined,
      mode: crawlResults ? 'CRAWL_RESULTS' : 'IDLE',
      activeSourceId: undefined,
      activeMatch: undefined,
    }),
  setMinRelevanceScore: (minRelevanceScore) => set({ minRelevanceScore }),
  clearResults: () =>
    set((state) => ({
      results: undefined,
      crawlResults: undefined,
      minRelevanceScore: 0,
      mode: 'IDLE',
      previewNodeIds: [],
      crawlStartingNodeIds: state.graph
        ? state.graph.nodes
            .slice(0, state.identity?.tier === 'ANONYMOUS' ? 1 : undefined)
            .map((node) => node.id)
        : [],
      activeSourceId: undefined,
      activeMatch: undefined,
      activeLightboxFigure: null,
      expandedNodeIds: [],
      maximizedNodeId: undefined,
      isFocusMode: false,
      focusedNodeId: undefined,
    })),
  collapseAllNodes: () =>
    set((state) => {
      if (state.expandedNodeIds.length === 0) return state;
      return {
        expandedNodeIds: [],
      };
    }),
  toggleNodeSelection: (id) =>
    set((state) => ({
      selectedNodeIds: state.selectedNodeIds.includes(id)
        ? state.selectedNodeIds.filter((nodeId) => nodeId !== id)
        : [...state.selectedNodeIds, id],
    })),
  setSelectedNodeIds: (selectedNodeIds) => set({ selectedNodeIds }),
  toggleCrawlStartingNode: (id) =>
    set((state) => ({
      crawlStartingNodeIds: state.crawlStartingNodeIds.includes(id)
        ? state.crawlStartingNodeIds.filter((nodeId) => nodeId !== id)
        : [...state.crawlStartingNodeIds, id],
    })),
  setCrawlStartingNodeIds: (crawlStartingNodeIds) =>
    set({ crawlStartingNodeIds }),
  toggleExpanded: (id) =>
    set((state) => {
      if (!state.graph) return state;
      const expandedNodeIds = state.expandedNodeIds.includes(id)
        ? state.expandedNodeIds.filter((nodeId) => nodeId !== id)
        : [...state.expandedNodeIds, id];
      return {
        expandedNodeIds,
      };
    }),
  setActiveSourceId: (activeSourceId) =>
    set({ activeSourceId, activeMatch: undefined }),
  setActiveMatch: (activeMatch) => set({ activeMatch }),
  activeLightboxFigure: null,
  openLightbox: (activeLightboxFigure) => set({ activeLightboxFigure }),
  closeLightbox: () => set({ activeLightboxFigure: null }),
  addNodeFromCrop: (cropBase64, title) => {
    let createdId: string | null = null;
    set((state) => {
      if (!state.graph) return state;
      const index = state.graph.nodes.length + 1;
      const targetParent = state.focusedNodeId
        ? state.graph.nodes.find((n) => n.id === state.focusedNodeId)
        : state.graph.nodes[0];
      const targetX = targetParent ? targetParent.position.x + 320 : 200;
      let targetY = targetParent ? targetParent.position.y : 200;

      let collision = true;
      while (collision) {
        const found = state.graph.nodes.some(
          (n) =>
            Math.abs(n.position.x - targetX) < 40 &&
            Math.abs(n.position.y - targetY) < 60,
        );
        if (found) {
          targetY += 120;
        } else {
          collision = false;
        }
      }

      createdId = crypto.randomUUID();
      const nodeTitle = title ? `Crop: ${title}` : `Figure Crop ${index}`;
      const newNode: GraphNode = {
        id: createdId,
        position: { x: targetX, y: targetY },
        data: {
          title: nodeTitle,
          category: 'Figure ROI',
          description: `![${nodeTitle}](${cropBase64})`,
        },
      };

      const edges = [...state.graph.edges];
      if (targetParent) {
        edges.push({
          id: `e-${targetParent.id}-${createdId}`,
          source: targetParent.id,
          target: createdId,
        });
      }

      return {
        graph: {
          ...state.graph,
          nodes: [...state.graph.nodes, newNode],
          edges,
        },
        selectedNodeIds: [createdId],
      };
    });
    return createdId;
  },
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
      const targetX = 80;
      let targetY = 100;
      const rootNodes = state.graph.nodes.filter(
        (node) => !state.graph?.edges.some((edge) => edge.target === node.id),
      );
      if (rootNodes.length > 0) {
        const maxY = Math.max(...rootNodes.map((n) => n.position.y));
        targetY = maxY + 140;
      }
      let collision = true;
      while (collision) {
        const found = state.graph.nodes.some(
          (n) =>
            Math.abs(n.position.x - targetX) < 40 &&
            Math.abs(n.position.y - targetY) < 60,
        );
        if (found) {
          targetY += 120;
        } else {
          collision = false;
        }
      }
      const node: GraphNode = {
        id: crypto.randomUUID(),
        position: { x: targetX, y: targetY },
        data: {
          title: `Untitled topic ${index}`,
          category: 'New topic',
          description: '',
        },
      };
      return {
        graph: { ...state.graph, nodes: [...state.graph.nodes, node] },
        expandedNodeIds: state.expandedNodeIds.includes(node.id)
          ? state.expandedNodeIds
          : [...state.expandedNodeIds, node.id],
      };
    }),
  addChild: (parentId) =>
    set((state) => {
      if (!state.graph) return state;
      const parent = state.graph.nodes.find((node) => node.id === parentId);
      if (!parent) return state;
      const index = state.graph.nodes.length + 1;

      const existingChildEdges = state.graph.edges.filter(
        (edge) => edge.source === parentId,
      );
      const existingChildIds = new Set(
        existingChildEdges.map((edge) => edge.target),
      );
      const existingChildren = state.graph.nodes.filter((node) =>
        existingChildIds.has(node.id),
      );

      const targetX = parent.position.x + 300;
      let targetY: number;

      if (existingChildren.length === 0) {
        targetY = parent.position.y;
      } else {
        const maxY = Math.max(...existingChildren.map((c) => c.position.y));
        targetY = maxY + 130;
      }

      let collision = true;
      while (collision) {
        const found = state.graph.nodes.some(
          (n) =>
            Math.abs(n.position.x - targetX) < 40 &&
            Math.abs(n.position.y - targetY) < 60,
        );
        if (found) {
          targetY += 120;
        } else {
          collision = false;
        }
      }

      const node: GraphNode = {
        id: crypto.randomUUID(),
        position: { x: targetX, y: targetY },
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
        expandedNodeIds: state.expandedNodeIds.includes(node.id)
          ? state.expandedNodeIds
          : [...state.expandedNodeIds, node.id],
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
  updateSourceProgress: (sourceId, status, progress) =>
    set((state) => {
      if (!state.graph) return state;
      return {
        graph: {
          ...state.graph,
          sources: state.graph.sources.map((source) =>
            source.id === sourceId ? { ...source, status, progress } : source,
          ),
        },
      };
    }),
  setUploadProgress: (upload) =>
    set((state) => ({
      activeUploads: {
        ...state.activeUploads,
        [upload.uploadKey]: upload,
      },
    })),
  removeUploadProgress: (uploadKey) =>
    set((state) => {
      const next = { ...state.activeUploads };
      delete next[uploadKey];
      return { activeUploads: next };
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
