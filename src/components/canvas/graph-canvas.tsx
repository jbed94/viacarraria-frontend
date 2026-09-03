import {
  Background,
  type Connection,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useRef } from 'react';

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

  if (!graph) {
    return <div className="canvas-loading" />;
  }

  return (
    <ReactFlowProvider key={graph.id}>
      <ReactFlow
        nodes={graph.nodes.map((node) => {
          const width = expandedNodeIds.includes(node.id)
            ? expandedNodeWidth
            : compactNodeWidth;
          const height = expandedNodeIds.includes(node.id)
            ? expandedNodeHeight
            : compactNodeHeight;
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
            zIndex: expandedNodeIds.includes(node.id) ? 10 : 0,
          };
        })}
        edges={graph.edges.map((edge) => ({
          ...edge,
          type: 'smoothstep',
          className: 'canvas-edge',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'var(--canvas-edge)',
            width: 18,
            height: 18,
          },
          animated: Boolean(
            results?.matchedNodeIds.includes(edge.source) &&
              results.matchedNodeIds.includes(edge.target),
          ),
          style:
            results?.matchedNodeIds.includes(edge.source) &&
            results.matchedNodeIds.includes(edge.target)
              ? { stroke: 'var(--mint)', strokeWidth: 2.5 }
              : { stroke: 'var(--canvas-edge)', strokeWidth: 2 },
        }))}
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
        proOptions={{ hideAttribution: true }}
      >
        <ResultsViewport />
        <ExpandedNodeViewport />
        <Background gap={28} size={1} color="var(--canvas-dot)" />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </ReactFlowProvider>
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
