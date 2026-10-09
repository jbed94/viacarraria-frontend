import {
  Background,
  type Connection,
  ControlButton,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Focus,
  Map,
  Maximize2,
  Minus,
  Plus,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  compactNodeHeight,
  compactNodeWidth,
  expandedNodeHeight,
  expandedNodeWidth,
  layoutGraph,
} from '../../lib/layout';
import { computeScoreHistogram } from '../../lib/search-utils';
import type { SearchChunk, SearchResponse } from '../../types/api';
import { useDynamicCanvasAd } from '../../hooks/use-dynamic-canvas-ad';
import { api } from '../../lib/api';
import { useGraphStore } from '../../store/graph-store';
import { AdCanvasNode } from './ad-canvas-node';
import { SubjectNode } from './subject-node';
import { ViaCarrariaLogo } from '../brand';

const nodeTypes = {
  subject: SubjectNode,
  ad: AdCanvasNode,
};

export function GraphCanvas() {
  const graph = useGraphStore((state) => state.graph);
  const isEditing = useGraphStore((state) => state.isEditing);
  const applyNodes = useGraphStore((state) => state.applyNodes);
  const applyEdges = useGraphStore((state) => state.applyEdges);
  const connect = useGraphStore((state) => state.connect);
  const results = useGraphStore((state) => state.results);
  const mode = useGraphStore((state) => state.mode);
  const minRelevanceScore = useGraphStore((state) => state.minRelevanceScore);
  const setMinRelevanceScore = useGraphStore(
    (state) => state.setMinRelevanceScore,
  );
  const expandedNodeIds = useGraphStore((state) => state.expandedNodeIds);
  const isFocusMode = useGraphStore((state) => state.isFocusMode);
  const focusedNodeId = useGraphStore((state) => state.focusedNodeId);

  const graphNodes = graph?.nodes;
  const graphEdges = graph?.edges;

  const adsEnabled = true;

  const [adConfig, setAdConfig] = useState<{
    canvasAdDensity: number;
    maxCanvasAds: number;
  }>({
    canvasAdDensity: 35,
    maxCanvasAds: 5,
  });

  useEffect(() => {
    let mounted = true;
    api.ads
      ?.getConfig?.()
      .then((cfg) => {
        if (mounted && cfg) {
          setAdConfig({
            canvasAdDensity: cfg.canvasAdDensity || 35,
            maxCanvasAds: cfg.maxCanvasAds || 5,
          });
        }
      })
      .catch(() => {
        // Fallback default
      });
    return () => {
      mounted = false;
    };
  }, []);

  const [graphAdTags, setGraphAdTags] = useState<
    Array<{ id: string; name: string; slug: string; weight: number }>
  >([]);

  useEffect(() => {
    if (!graph?.id || !adsEnabled) {
      setGraphAdTags([]);
      return;
    }
    let mounted = true;
    api.ads
      ?.getContext?.(graph.id)
      .then((res) => {
        if (mounted && res?.tags) {
          setGraphAdTags(res.tags);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [graph?.id, adsEnabled]);

  const dynamicAd = useDynamicCanvasAd({
    enabled: adsEnabled && (graphNodes?.length ?? 0) > 0,
    graphId: graph?.id,
  });

  const maxAllowedAds = useMemo(() => {
    if (!graphNodes || graphNodes.length === 0) return 0;
    const computed = Math.floor(
      graphNodes.length / (adConfig.canvasAdDensity || 35),
    );
    return Math.min(adConfig.maxCanvasAds || 5, Math.max(1, computed));
  }, [graphNodes?.length, adConfig.canvasAdDensity, adConfig.maxCanvasAds]);

  const nodes = useMemo(() => {
    if (!graphNodes) return [];
    const expandedSet = new Set(expandedNodeIds);
    const regularNodes = graphNodes.map((node) => {
      const isExpanded = expandedSet.has(node.id);
      const width = isExpanded ? expandedNodeWidth : compactNodeWidth;
      const height = isExpanded ? expandedNodeHeight : compactNodeHeight;
      const handleY = (compactNodeHeight - 9) / 2;
      return {
        ...node,
        type: 'subject',
        className: 'canvas-node',
        width,
        height,
        handles: [
          {
            type: 'target' as const,
            position: Position.Left,
            x: 0,
            y: handleY,
            width: 9,
            height: 9,
          },
          {
            type: 'source' as const,
            position: Position.Right,
            x: width - 9,
            y: handleY,
            width: 9,
            height: 9,
          },
        ],
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        zIndex: isExpanded ? 10 : 0,
      };
    });

    if (!adsEnabled || !dynamicAd.isVisible || graphNodes.length === 0) {
      return regularNodes;
    }

    const adNodes = [];
    for (let slot = 0; slot < maxAllowedAds; slot++) {
      const isEven = slot % 2 === 0;
      const slotSide = isEven
        ? dynamicAd.side
        : dynamicAd.side === 'bottom'
          ? 'top'
          : 'bottom';
      const slotShift = (dynamicAd.horizontalShiftRatio + slot * 0.35) % 1;
      const adNode = computeAdNodePlacement({
        regularNodes,
        graphId: graph?.id,
        contextTags: graphAdTags,
        side: slotSide,
        horizontalShiftRatio: slotShift,
        slotIndex:
          slot === 0 ? dynamicAd.cycleId : dynamicAd.cycleId * 10 + slot,
        nodeId: slot === 0 ? 'canvas-ad-node' : `canvas-ad-node-slot-${slot}`,
      });
      adNodes.push(adNode);
    }

    return [...regularNodes, ...(adNodes as any[])];
  }, [
    graphNodes,
    expandedNodeIds,
    adsEnabled,
    graphAdTags,
    dynamicAd.isVisible,
    dynamicAd.side,
    dynamicAd.horizontalShiftRatio,
    dynamicAd.cycleId,
    maxAllowedAds,
    graph?.id,
  ]);

  const filteredMatchedSet = useMemo(
    () => filterMatchedNodeIdsByScore(results, minRelevanceScore),
    [results, minRelevanceScore],
  );

  const edges = useMemo(() => {
    if (!graphEdges) return [];
    return graphEdges.map((edge) => {
      const isMatched = Boolean(
        filteredMatchedSet &&
          filteredMatchedSet.has(edge.source) &&
          filteredMatchedSet.has(edge.target),
      );
      const isSoloEdge = Boolean(
        (isFocusMode || focusedNodeId) &&
          (edge.source === focusedNodeId ||
            edge.target === focusedNodeId ||
            (filteredMatchedSet &&
              filteredMatchedSet.has(edge.source) &&
              filteredMatchedSet.has(edge.target))),
      );
      const isDimmedEdge = Boolean(
        (isFocusMode || focusedNodeId) && !isSoloEdge,
      );

      return {
        ...edge,
        type: 'smoothstep',
        className: `canvas-edge ${isDimmedEdge ? 'is-dimmed-edge' : ''}`,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isSoloEdge || isMatched ? 'var(--mint)' : 'var(--canvas-edge)',
          width: 18,
          height: 18,
        },
        animated: isMatched || isSoloEdge,
        style: isSoloEdge
          ? { stroke: 'var(--mint)', strokeWidth: 3 }
          : isDimmedEdge
            ? { stroke: 'var(--canvas-edge)', strokeWidth: 1, opacity: 0.15 }
            : isMatched
              ? { stroke: 'var(--mint)', strokeWidth: 2.5 }
              : { stroke: 'var(--canvas-edge)', strokeWidth: 2 },
      };
    });
  }, [graphEdges, filteredMatchedSet, isFocusMode, focusedNodeId]);

  const scoreBins = useMemo(() => {
    if (!results?.results?.length) return [];
    const scores = results.results.map((res) =>
      Math.max(
        ...(res.chunks?.map((c) => c.rerankScore ?? c.score ?? 0) ?? [0]),
        0,
      ),
    );
    return computeScoreHistogram(scores, 10);
  }, [results?.results]);

  const maxBinCount = useMemo(() => {
    return Math.max(...scoreBins.map((b) => b.count), 1);
  }, [scoreBins]);

  if (!graph) {
    return <div className="canvas-loading" />;
  }

  return (
    <ReactFlowProvider key={graph.id}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={
          isEditing
            ? (changes) =>
                applyNodes(
                  changes.filter(
                    (c: any) =>
                      !String(c.id).startsWith('canvas-ad-node') &&
                      ('item' in c
                        ? !String((c as any).item?.id).startsWith(
                            'canvas-ad-node',
                          )
                        : true),
                  ),
                )
            : undefined
        }
        onEdgesChange={isEditing ? applyEdges : undefined}
        onConnect={
          isEditing
            ? (connection: Connection) => connect(connection)
            : undefined
        }
        nodesDraggable={isEditing}
        nodesConnectable={isEditing}
        zoomOnPinch={true}
        panOnScroll={false}
        zoomOnScroll={true}
        panOnDrag={true}
        preventScrolling={true}
        fitView
        fitViewOptions={{
          nodes: (graphNodes ?? [])
            .map((n) => ({ id: n.id }))
            .filter((n) => !n.id.startsWith('canvas-ad-node')),
          padding: 0.28,
          maxZoom: 0.9,
        }}
        minZoom={0.28}
        maxZoom={1.9}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <ResultsViewport />
        <ExpandedNodeViewport />
        <Background gap={28} size={1.6} color="var(--canvas-dot)" />
        <CanvasControls />
        {results &&
        (mode === 'VISUAL_RESULTS' || results.results.length > 0) ? (
          <Panel
            position="top-right"
            className="canvas-score-filter-panel overlay-interactive"
          >
            <div className="canvas-score-filter-header">
              <SlidersHorizontal size={13} aria-hidden="true" />
              <span>Min Relevance</span>
              <span className="canvas-score-value">
                {Math.round(minRelevanceScore * 100)}%
              </span>
            </div>
            {scoreBins.length > 0 ? (
              <div
                className="canvas-score-histogram"
                role="figure"
                aria-label="Relevance score distribution"
              >
                {scoreBins.map((bin) => {
                  const heightPercent =
                    bin.count > 0
                      ? Math.max((bin.count / maxBinCount) * 100, 15)
                      : 0;
                  const isDimmed =
                    minRelevanceScore > 0 && bin.max <= minRelevanceScore;
                  const binLabel = `${Math.round(bin.min * 100)}%–${Math.round(bin.max * 100)}%: ${bin.count} node${bin.count === 1 ? '' : 's'}`;
                  return (
                    <div
                      key={bin.binIndex}
                      className={`canvas-histogram-bar ${isDimmed ? 'is-dimmed' : ''}`}
                      style={{ height: `${heightPercent}%` }}
                      title={binLabel}
                      aria-label={binLabel}
                    />
                  );
                })}
              </div>
            ) : null}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minRelevanceScore}
              onChange={(e) =>
                setMinRelevanceScore(Number.parseFloat(e.target.value))
              }
              className="canvas-score-slider"
              aria-label="Min Relevance Score"
            />
            <div className="canvas-score-footer">
              <span>0% (All)</span>
              <span>50%</span>
              <span>100% (Strict)</span>
            </div>
          </Panel>
        ) : null}
      </ReactFlow>
    </ReactFlowProvider>
  );
}

function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const graph = useGraphStore((state) => state.graph);
  const expandedNodeIds = useGraphStore((state) => state.expandedNodeIds);
  const replaceCanvas = useGraphStore((state) => state.replaceCanvas);
  const isFocusMode = useGraphStore((state) => state.isFocusMode);
  const toggleFocusMode = useGraphStore((state) => state.toggleFocusMode);
  const [showMiniMap, setShowMiniMap] = useState(false);

  function handleZoomIn() {
    void zoomIn({ duration: 280 });
  }

  function handleZoomOut() {
    void zoomOut({ duration: 280 });
  }

  function handleFitView() {
    const regularNodes = (graph?.nodes ?? [])
      .map((n) => ({ id: n.id }))
      .filter((n) => !n.id.startsWith('canvas-ad-node'));
    void fitView({
      nodes: regularNodes.length > 0 ? regularNodes : undefined,
      duration: 450,
      padding: window.innerWidth <= 720 ? 0.2 : 0.28,
      maxZoom: 0.9,
    });
  }

  function handleAutoArrange() {
    if (!graph?.nodes?.length) return;
    const arranged = layoutGraph(graph.nodes, graph.edges, expandedNodeIds);
    replaceCanvas(arranged, graph.edges);
    const regularNodes = arranged
      .map((n) => ({ id: n.id }))
      .filter((n) => !n.id.startsWith('canvas-ad-node'));
    void fitView({
      nodes: regularNodes.length > 0 ? regularNodes : undefined,
      duration: 450,
      padding: window.innerWidth <= 720 ? 0.2 : 0.28,
      maxZoom: 0.9,
    });
  }

  return (
    <>
      {showMiniMap ? (
        <Panel
          position="bottom-left"
          className="canvas-minimap-panel overlay-interactive"
        >
          <div className="canvas-minimap-header">
            <span className="canvas-minimap-title">Overview</span>
            <button
              type="button"
              onClick={() => setShowMiniMap(false)}
              className="canvas-minimap-close-btn"
              aria-label="Close minimap"
            >
              ×
            </button>
          </div>
          <MiniMap
            nodeStrokeWidth={2}
            pannable
            zoomable
            maskColor="rgba(11, 15, 25, 0.75)"
            className="canvas-bento-minimap"
            aria-label="Canvas overview minimap"
          />
        </Panel>
      ) : null}
      <Controls
        position="bottom-left"
        showZoom={false}
        showFitView={false}
        showInteractive={false}
        className="canvas-bento-dock"
      >
        <ControlButton
          onClick={handleZoomIn}
          title="Zoom In (+)"
          aria-label="Zoom in"
          className="react-flow__controls-zoomin bento-dock-btn"
        >
          <Plus size={15} />
        </ControlButton>
        <ControlButton
          onClick={handleZoomOut}
          title="Zoom Out (-)"
          aria-label="Zoom out"
          className="react-flow__controls-zoomout bento-dock-btn"
        >
          <Minus size={15} />
        </ControlButton>
        <ControlButton
          onClick={handleFitView}
          title="Fit View"
          aria-label="Fit view"
          className="react-flow__controls-fitview bento-dock-btn"
        >
          <Maximize2 size={14} />
        </ControlButton>
        <ControlButton
          onClick={handleAutoArrange}
          title="Auto-Arrange Layout"
          aria-label="Auto-arrange layout"
          className="bento-dock-btn bento-auto-arrange-btn"
        >
          <Sparkles size={14} />
        </ControlButton>
        <ControlButton
          onClick={toggleFocusMode}
          title={isFocusMode ? 'Exit Focus Mode' : 'Focus Active Paths'}
          aria-label="Toggle focus mode"
          className={`bento-dock-btn bento-focus-btn ${isFocusMode ? 'is-active' : ''}`}
        >
          <Focus size={14} />
        </ControlButton>
        <ControlButton
          onClick={() => setShowMiniMap((prev) => !prev)}
          title={showMiniMap ? 'Hide Minimap' : 'Show Minimap'}
          aria-label="Toggle minimap"
          className={`bento-dock-btn bento-minimap-btn ${showMiniMap ? 'is-active' : ''}`}
        >
          <Map size={14} />
        </ControlButton>
      </Controls>
      <Panel
        position="bottom-right"
        className="canvas-brand-watermark"
        aria-label="Via Carraria Canvas Watermark"
      >
        <ViaCarrariaLogo
          variant="full"
          size={16}
          iconVariant="framed"
          subtitle="Knowledge Canvas"
          className="canvas-watermark-lockup"
        />
      </Panel>
    </>
  );
}

function ExpandedNodeViewport() {
  const expandedNodeIds = useGraphStore((state) => state.expandedNodeIds);
  const { getNode, getViewport, setCenter } = useReactFlow();
  const previouslyExpandedIds = useRef<string[]>([]);

  useEffect(() => {
    const expandedNodeId = getNewlyExpandedNodeId(
      expandedNodeIds,
      previouslyExpandedIds.current,
    );
    previouslyExpandedIds.current = expandedNodeIds;
    if (!expandedNodeId || expandedNodeId.startsWith('canvas-ad-node')) return;

    const timer = window.setTimeout(() => {
      const node = getNode(expandedNodeId);
      if (!node) return;

      const viewport = getViewport();
      const nodeWidth = expandedNodeWidth;
      const nodeHeight = expandedNodeHeight;
      const containerWidth = window.innerWidth;
      const containerHeight = window.innerHeight;

      const isVisible = isNodeInViewport({
        nodePosition: node.position,
        nodeWidth,
        nodeHeight,
        viewport,
        containerWidth,
        containerHeight,
        margin: 48,
      });

      if (isVisible) return;

      const targetZoom = Math.min(
        viewport.zoom,
        Math.max(0.4, (containerWidth - 64) / nodeWidth),
        Math.max(0.4, (containerHeight - 64) / nodeHeight),
      );

      const centerX = node.position.x + nodeWidth / 2;
      const centerY = node.position.y + nodeHeight / 2;

      void setCenter(centerX, centerY, {
        duration: 380,
        zoom: targetZoom,
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [expandedNodeIds, getNode, getViewport, setCenter]);

  return null;
}

export type NodeViewportCheckParams = {
  nodePosition: { x: number; y: number };
  nodeWidth: number;
  nodeHeight: number;
  viewport: { x: number; y: number; zoom: number };
  containerWidth: number;
  containerHeight: number;
  margin?: number;
};

export function isNodeInViewport({
  nodePosition,
  nodeWidth,
  nodeHeight,
  viewport,
  containerWidth,
  containerHeight,
  margin = 48,
}: NodeViewportCheckParams): boolean {
  const left = nodePosition.x * viewport.zoom + viewport.x;
  const top = nodePosition.y * viewport.zoom + viewport.y;
  const right = left + nodeWidth * viewport.zoom;
  const bottom = top + nodeHeight * viewport.zoom;

  return (
    left >= margin &&
    right <= containerWidth - margin &&
    top >= margin &&
    bottom <= containerHeight - margin
  );
}

export function getNewlyExpandedNodeId(
  expandedNodeIds: string[],
  previouslyExpandedIds: string[],
): string | undefined {
  return [...expandedNodeIds]
    .reverse()
    .find((id) => !previouslyExpandedIds.includes(id));
}

function ResultsViewport() {
  const results = useGraphStore((state) => state.results);
  const graph = useGraphStore((state) => state.graph);
  const { fitView } = useReactFlow();
  const hadResults = useRef(false);

  useEffect(() => {
    if (results?.matchedNodeIds.length) {
      const nonAdMatchedIds = results.matchedNodeIds.filter(
        (id) => !id.startsWith('canvas-ad-node'),
      );
      if (nonAdMatchedIds.length > 0) {
        hadResults.current = true;
        void fitView({
          nodes: nonAdMatchedIds.map((id) => ({ id })),
          duration: 800,
          padding: 0.45,
        });
        return;
      }
    }
    if (!hadResults.current) return;
    hadResults.current = false;
    const nonAdNodes = (graph?.nodes ?? [])
      .filter((node) => !node.id.startsWith('canvas-ad-node'))
      .map((node) => ({ id: node.id }));
    if (nonAdNodes.length > 0) {
      void fitView({ nodes: nonAdNodes, duration: 500, padding: 0.22 });
    } else {
      void fitView({ duration: 500, padding: 0.22 });
    }
  }, [fitView, results, graph?.nodes]);

  return null;
}

export type AdPlacementOptions = {
  regularNodes: Array<{
    position: { x: number; y: number };
    width?: number;
    height?: number;
  }>;
  graphId?: string;
  contextTags?: Array<{
    id?: string;
    name: string;
    slug: string;
    weight?: number;
  }>;
  margin?: number;
  side?: 'right' | 'left' | 'bottom' | 'top';
  horizontalShiftRatio?: number;
  slotIndex?: number;
  nodeId?: string;
};

export function computeAdNodePlacement({
  regularNodes,
  graphId,
  contextTags,
  margin = 100,
  side: explicitSide,
  horizontalShiftRatio = 0.5,
  slotIndex,
  nodeId,
}: AdPlacementOptions) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of regularNodes) {
    if (node.position.x < minX) minX = node.position.x;
    const right = node.position.x + (node.width ?? compactNodeWidth);
    if (right > maxX) maxX = right;
    if (node.position.y < minY) minY = node.position.y;
    const bottom = node.position.y + (node.height ?? compactNodeHeight);
    if (bottom > maxY) maxY = bottom;
  }

  const sides: Array<'right' | 'left' | 'bottom' | 'top'> = [
    'right',
    'left',
    'bottom',
    'top',
  ];
  const hash = (graphId || 'default')
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const side = explicitSide ?? sides[hash % sides.length]!;

  let adX = 0;
  let adY = 0;
  let adWidth = 160;
  let adHeight = 600;
  let format: 'vertical' | 'horizontal' = 'vertical';

  if (side === 'left') {
    format = 'vertical';
    adWidth = 160;
    adHeight = 600;
    adX = minX - adWidth - margin;
    adY = minY + Math.max(0, (maxY - minY - adHeight) / 2);
  } else if (side === 'right') {
    format = 'vertical';
    adWidth = 160;
    adHeight = 600;
    adX = maxX + margin;
    adY = minY + Math.max(0, (maxY - minY - adHeight) / 2);
  } else {
    // top or bottom
    format = 'horizontal';
    adWidth = 728;
    adHeight = 90;

    const graphWidth = maxX - minX;
    const ratio = Math.max(0, Math.min(1, horizontalShiftRatio));
    if (graphWidth >= adWidth) {
      adX = minX + (graphWidth - adWidth) * ratio;
    } else {
      const center = minX + (graphWidth - adWidth) / 2;
      const offset = (ratio - 0.5) * 160;
      adX = Math.round(center + offset);
    }

    if (side === 'top') {
      adY = minY - adHeight - margin;
    } else {
      adY = maxY + margin;
    }
  }

  const slotSuffix =
    slotIndex !== undefined
      ? `${slotIndex}-${graphId?.slice(0, 6) || 'def'}`
      : graphId?.slice(0, 6) || 'def';

  return {
    id:
      nodeId ??
      (slotIndex !== undefined && slotIndex >= 10
        ? `canvas-ad-node-${slotIndex}`
        : 'canvas-ad-node'),
    type: 'ad',
    className: 'canvas-ad-node-wrapper',
    position: { x: adX, y: adY },
    width: adWidth,
    height: adHeight,
    data: {
      format,
      side,
      width: adWidth,
      height: adHeight,
      slotId: `ad-slot-${side}-${slotSuffix}`,
      graphId,
      contextTags,
    },
    draggable: false,
    selectable: false,
    zIndex: -1,
  };
}

/**
 * Filters matched node IDs based on minimum relevance score threshold.
 * Uses neural cross-encoder rerankScore when available, otherwise falls back to score.
 */
export function filterMatchedNodeIdsByScore(
  results: SearchResponse | undefined,
  minScore: number,
): Set<string> | null {
  if (!results?.results) return null;
  if (minScore <= 0) {
    return new Set(results.matchedNodeIds);
  }
  const matched = new Set<string>();
  for (const res of results.results) {
    const topScore = Math.max(
      ...(res.chunks?.map((c) => c.rerankScore ?? c.score ?? 0) ?? [0]),
      ...(res.chunks?.map(
        (c: SearchChunk) => c.rerankScore ?? c.score ?? 0,
      ) ?? [0]),
      0,
    );
    if (topScore >= minScore) {
      matched.add(res.nodeId);
    }
  }
  return matched;
}
