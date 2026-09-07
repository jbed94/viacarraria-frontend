import {
  Background,
  type Connection,
  ControlButton,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import {
  compactNodeHeight,
  compactNodeWidth,
  expandedNodeHeight,
  expandedNodeWidth,
} from '../../lib/layout';
import { useGraphStore } from '../../store/graph-store';
import { SubjectNode } from './subject-node';

const nodeTypes = { subject: SubjectNode };

export function GraphCanvas() {
  const graph = useGraphStore((state) => state.graph);
  const isEditing = useGraphStore((state) => state.isEditing);
  const applyNodes = useGraphStore((state) => state.applyNodes);
  const applyEdges = useGraphStore((state) => state.applyEdges);
  const connect = useGraphStore((state) => state.connect);
  const results = useGraphStore((state) => state.results);
  const expandedNodeIds = useGraphStore((state) => state.expandedNodeIds);

  const graphNodes = graph?.nodes;
  const graphEdges = graph?.edges;

  const nodes = useMemo(() => {
    if (!graphNodes) return [];
    const expandedSet = new Set(expandedNodeIds);
    return graphNodes.map((node) => {
      const isExpanded = expandedSet.has(node.id);
      const width = isExpanded ? expandedNodeWidth : compactNodeWidth;
      const height = isExpanded ? expandedNodeHeight : compactNodeHeight;
      const handleY = (height - 9) / 2;
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
  }, [graphNodes, expandedNodeIds]);

  const edges = useMemo(() => {
    if (!graphEdges) return [];
    const matchedSet = results?.matchedNodeIds
      ? new Set(results.matchedNodeIds)
      : null;
    return graphEdges.map((edge) => {
      const isMatched = Boolean(
        matchedSet &&
          matchedSet.has(edge.source) &&
          matchedSet.has(edge.target),
      );
      return {
        ...edge,
        type: 'smoothstep',
        className: 'canvas-edge',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: 'var(--canvas-edge)',
          width: 18,
          height: 18,
        },
        animated: isMatched,
        style: isMatched
          ? { stroke: 'var(--mint)', strokeWidth: 2.5 }
          : { stroke: 'var(--canvas-edge)', strokeWidth: 2 },
      };
    });
  }, [graphEdges, results?.matchedNodeIds]);

  if (!graph) {
    return <div className="canvas-loading" />;
  }

  return (
    <ReactFlowProvider key={graph.id}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={isEditing ? applyNodes : undefined}
        onEdgesChange={isEditing ? applyEdges : undefined}
        onConnect={
          isEditing
            ? (connection: Connection) => connect(connection)
            : undefined
        }
        nodesDraggable={isEditing}
        nodesConnectable={isEditing}
        fitView
        fitViewOptions={{ padding: 0.28, maxZoom: 0.9 }}
        minZoom={0.28}
        maxZoom={1.9}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <ResultsViewport />
        <ExpandedNodeViewport />
        <Background gap={28} size={1.6} color="var(--canvas-dot)" />
        <CanvasControls />
      </ReactFlow>
    </ReactFlowProvider>
  );
}

function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  function handleZoomIn() {
    void zoomIn({ duration: 280 });
  }

  function handleZoomOut() {
    void zoomOut({ duration: 280 });
  }

  function handleFitView() {
    void fitView({
      duration: 450,
      padding: window.innerWidth <= 720 ? 0.2 : 0.28,
      maxZoom: 0.9,
    });
  }

  return (
    <Controls
      position="bottom-right"
      showZoom={false}
      showFitView={false}
      showInteractive={false}
    >
      <ControlButton
        onClick={handleZoomIn}
        title="Zoom In (+)"
        aria-label="Zoom in"
        className="react-flow__controls-zoomin"
      >
        <Plus size={15} />
      </ControlButton>
      <ControlButton
        onClick={handleZoomOut}
        title="Zoom Out (-)"
        aria-label="Zoom out"
        className="react-flow__controls-zoomout"
      >
        <Minus size={15} />
      </ControlButton>
      <ControlButton
        onClick={handleFitView}
        title="Fit View"
        aria-label="Fit view"
        className="react-flow__controls-fitview"
      >
        <Maximize2 size={14} />
      </ControlButton>
    </Controls>
  );
}

function ExpandedNodeViewport() {
  const expandedNodeIds = useGraphStore((state) => state.expandedNodeIds);
  const { fitView } = useReactFlow();
  const previouslyExpandedIds = useRef<string[]>([]);

  useEffect(() => {
    const expandedNodeId = getNewlyExpandedNodeId(
      expandedNodeIds,
      previouslyExpandedIds.current,
    );
    previouslyExpandedIds.current = expandedNodeIds;
    if (!expandedNodeId) return;
    const timer = window.setTimeout(() => {
      void fitView({
        nodes: [{ id: expandedNodeId }],
        duration: 460,
        maxZoom: window.innerWidth <= 720 ? 0.9 : 1.15,
        padding: window.innerWidth <= 720 ? 0.28 : 0.85,
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [expandedNodeIds, fitView]);

  return null;
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
  const { fitView } = useReactFlow();
  const hadResults = useRef(false);

  useEffect(() => {
    if (results?.matchedNodeIds.length) {
      hadResults.current = true;
      void fitView({
        nodes: results.matchedNodeIds.map((id) => ({ id })),
        duration: 800,
        padding: 0.45,
      });
      return;
    }
    if (!hadResults.current) return;
    hadResults.current = false;
    void fitView({ duration: 500, padding: 0.22 });
  }, [fitView, results]);

  return null;
}
