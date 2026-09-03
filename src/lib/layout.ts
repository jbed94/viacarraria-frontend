import dagre from 'dagre';

import type { GraphEdge, GraphNode } from '../types/api';

export const compactNodeWidth = 248;
export const compactNodeHeight = 112;
export const expandedNodeWidth = 328;
export const expandedNodeHeight = 360;
const horizontalNodeGap = 220;

export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  expandedNodeIds: string[] = [],
): GraphNode[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 64,
    ranksep: horizontalNodeGap,
    marginx: 32,
    marginy: 32,
  });
  for (const node of nodes) {
    const isExpanded = expandedNodeIds.includes(node.id);
    graph.setNode(node.id, {
      width: isExpanded ? expandedNodeWidth : compactNodeWidth,
      height: isExpanded ? expandedNodeHeight : compactNodeHeight,
    });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target);
  }
  dagre.layout(graph);
  return nodes.map((node) => {
    const position = graph.node(node.id) as { x: number; y: number };
    return {
      ...node,
      position: {
        x:
          position.x -
          (expandedNodeIds.includes(node.id)
            ? expandedNodeWidth
            : compactNodeWidth) /
            2,
        y:
          position.y -
          (expandedNodeIds.includes(node.id)
            ? expandedNodeHeight
            : compactNodeHeight) /
            2,
      },
    };
  });
}
