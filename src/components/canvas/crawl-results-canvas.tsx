import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import {
  Compass,
  Download,
  FileText,
  GitCompare,
  GitMerge,
  Image as ImageIcon,
  Info,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CrawlEdge,
  CrawlMatchType,
  CrawlNode,
  CrawlProgressPayload,
  CrawlResponse,
  SearchChunk,
} from '../../types/api';
import { partitionHypothesisGraphs } from '../../lib/search-utils';
import { formatInlineSnippet } from '../overlays/results-sidebar';
import { useGraphStore } from '../../store/graph-store';

const ALL_MATCH_TYPES: CrawlMatchType[] = ['seed', 'dig', 'link', 'jump'];

const MATCH_TYPE_META: Record<
  CrawlMatchType,
  { labelKey: string; defaultLabel: string; color: string }
> = {
  seed: { labelKey: 'matchTypeSeed', defaultLabel: 'Seed', color: '#3b82f6' },
  dig: { labelKey: 'crawlDigs', defaultLabel: 'Digs', color: '#10b981' },
  link: { labelKey: 'crawlLinks', defaultLabel: 'Links', color: '#f59e0b' },
  jump: { labelKey: 'crawlJumps', defaultLabel: 'Jumps', color: '#8b5cf6' },
};

const CRAWL_NODE_WIDTH = 340;
const CRAWL_NODE_HEIGHT = 160;

function layoutCrawlNodes(
  nodesList: CrawlNode[],
  edgesList: CrawlEdge[],
  originX = 0,
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: 110,
    ranksep: 160,
    marginx: 40,
    marginy: 60,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodesList) {
    g.setNode(n.id, { width: CRAWL_NODE_WIDTH, height: CRAWL_NODE_HEIGHT });
  }

  const nodeIds = new Set(nodesList.map((n) => n.id));
  for (const e of edgesList) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  // Compute horizontal bounding box to center around originX
  let minX = Infinity;
  let maxX = -Infinity;
  for (const n of nodesList) {
    const pos = g.node(n.id) as { x: number; y: number } | undefined;
    if (pos) {
      minX = Math.min(minX, pos.x - CRAWL_NODE_WIDTH / 2);
      maxX = Math.max(maxX, pos.x + CRAWL_NODE_WIDTH / 2);
    }
  }

  const centerOffset =
    minX !== Infinity && maxX !== -Infinity ? (minX + maxX) / 2 : 0;

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of nodesList) {
    const pos = g.node(n.id) as { x: number; y: number } | undefined;
    if (pos) {
      positions.set(n.id, {
        x: pos.x - CRAWL_NODE_WIDTH / 2 - centerOffset + originX,
        y: pos.y - CRAWL_NODE_HEIGHT / 2 + 20,
      });
    } else {
      positions.set(n.id, { x: originX, y: 80 });
    }
  }

  return positions;
}

export function formatCrawlEdgeLabel(
  edge: CrawlEdge,
  options?: { isEdgeInPath?: boolean; stepNumber?: number },
): string {
  const matchTypePrefix =
    edge.matchType === 'jump'
      ? 'Jump · '
      : edge.matchType === 'link'
        ? 'Link · '
        : edge.matchType === 'dig'
          ? 'Dig · '
          : '';
  const simPart =
    edge.similarityScore !== undefined
      ? ` · ${Math.round(edge.similarityScore * 100)}% Sim`
      : '';
  const kwPart =
    edge.sharedKeywords && edge.sharedKeywords.length > 0
      ? ` · [${edge.sharedKeywords.slice(0, 2).join(', ')}]`
      : '';
  if (options?.isEdgeInPath && options.stepNumber !== undefined) {
    return `${matchTypePrefix}Step ${options.stepNumber} · Hop ${edge.level}${simPart}${kwPart}`;
  }
  return `${matchTypePrefix}Hop ${edge.level}${simPart}${kwPart}`;
}

export type SubtreeSynthesis = {
  rootNodeId: string;
  rootTitle: string;
  totalNodes: number;
  totalHops: number;
  averageSimilarity: number;
  topicTrajectory: string[];
  sharedThemes: string[];
  keyTakeaways: Array<{
    nodeId: string;
    title: string;
    level: number;
    sourceName: string;
    pageNum?: number;
    snippet: string;
    score: number;
  }>;
  narrative: string;
};

export function synthesizeSubtree(
  rootNode: CrawlNode,
  descendantNodes: CrawlNode[],
  subtreeEdges: CrawlEdge[],
): SubtreeSynthesis {
  const allSubtreeNodes = [
    rootNode,
    ...descendantNodes.filter((n) => n.id !== rootNode.id),
  ];

  const sortedNodes = [...allSubtreeNodes].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    const scoreA = a.rerankScore ?? a.score;
    const scoreB = b.rerankScore ?? b.score;
    return scoreB - scoreA;
  });

  const maxLevel = Math.max(...sortedNodes.map((n) => n.level));
  const totalHops = Math.max(0, maxLevel - rootNode.level);

  const trajectorySet = new Set<string>();
  const topicTrajectory: string[] = [];
  for (const n of sortedNodes) {
    if (!trajectorySet.has(n.nodeTitle)) {
      trajectorySet.add(n.nodeTitle);
      topicTrajectory.push(n.nodeTitle);
    }
  }

  let simSum = 0;
  let simCount = 0;
  for (const edge of subtreeEdges) {
    if (edge.similarityScore !== undefined) {
      simSum += edge.similarityScore;
      simCount += 1;
    }
  }
  let averageSimilarity = 0;
  if (simCount > 0) {
    averageSimilarity = Math.round((simSum / simCount) * 100) / 100;
  } else {
    const nodeScores = sortedNodes.map((n) => n.rerankScore ?? n.score);
    averageSimilarity =
      nodeScores.length > 0
        ? Math.round(
            (nodeScores.reduce((acc, s) => acc + s, 0) / nodeScores.length) *
              100,
          ) / 100
        : 0;
  }

  const keywordFreq = new Map<string, number>();
  for (const edge of subtreeEdges) {
    if (edge.sharedKeywords) {
      for (const kw of edge.sharedKeywords) {
        const trimmed = kw.trim();
        if (trimmed) {
          keywordFreq.set(trimmed, (keywordFreq.get(trimmed) ?? 0) + 1);
        }
      }
    }
  }
  const sharedThemes = Array.from(keywordFreq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([kw]) => kw);

  const keyTakeaways = sortedNodes.map((n) => ({
    nodeId: n.id,
    title: n.nodeTitle,
    level: n.level,
    sourceName: n.chunk.sourceName,
    pageNum: n.chunk.pageNum,
    snippet: formatInlineSnippet(n.chunk.content),
    score: n.rerankScore ?? n.score,
  }));

  const hopsText = `${totalHops} hop${totalHops === 1 ? '' : 's'}`;
  const nodesText = `${allSubtreeNodes.length} node${allSubtreeNodes.length === 1 ? '' : 's'}`;
  const simText =
    averageSimilarity > 0
      ? ` with ${Math.round(averageSimilarity * 100)}% average similarity`
      : '';
  const trajectoryText = topicTrajectory.join(' → ');
  const themesText =
    sharedThemes.length > 0
      ? ` Recurring conceptual themes include: ${sharedThemes.join(', ')}.`
      : '';
  const evidencePoints = keyTakeaways
    .slice(0, 3)
    .map(
      (k) =>
        `"${k.title}" (${k.sourceName}${k.pageNum ? `, p. ${k.pageNum}` : ''}) highlighting "${k.snippet.slice(0, 100)}"`,
    )
    .join('; ');

  const narrative = `Investigation branch rooted at "${rootNode.nodeTitle}" traverses ${hopsText} across ${nodesText}${simText}. Topic trajectory: ${trajectoryText}.${themesText} Key evidence includes: ${evidencePoints}.`;

  return {
    rootNodeId: rootNode.id,
    rootTitle: rootNode.nodeTitle,
    totalNodes: allSubtreeNodes.length,
    totalHops,
    averageSimilarity,
    topicTrajectory,
    sharedThemes,
    keyTakeaways,
    narrative,
  };
}

export type CrawlNodeData = {
  crawlNode: CrawlNode;
  onOpenSource: (sourceId: string, chunk: SearchChunk) => void;
  onSelectPath?: (nodeId: string) => void;
  onSynthesizeSubtree?: (nodeId: string) => void;
  isSeed?: boolean;
  isPathHighlighted?: boolean;
  isPathDimmed?: boolean;
  isActiveTrailTarget?: boolean;
  trailSequenceStep?: number;
  groupColor?: string;
  groupName?: string;
  childCount?: number;
  isSubtreeCollapsed?: boolean;
  onToggleCollapseSubtree?: (nodeId: string) => void;
  isPruned?: boolean;
  onJumpToHypothesis?: (hypothesisIndex: number) => void;
  otherHypotheses?: Array<{ index: number; id: string; name: string }>;
};

export type LaneHeaderNodeData = {
  title: string;
  lane: string;
  count: number;
  color?: string;
};

export function CrawlResultNode({ data }: NodeProps) {
  const { t } = useTranslation();
  const nodeData = data as unknown as CrawlNodeData;
  const {
    crawlNode,
    onOpenSource,
    onSelectPath,
    onSynthesizeSubtree,
    isSeed,
    isPathHighlighted,
    isPathDimmed,
    isActiveTrailTarget,
    trailSequenceStep,
    childCount,
    isSubtreeCollapsed,
    onToggleCollapseSubtree,
  } = nodeData;
  const chunk = crawlNode.chunk;
  const scorePercent = Math.round(
    (crawlNode.rerankScore ?? crawlNode.score) * 100,
  );

  const matchType = crawlNode.matchType ?? (isSeed ? 'seed' : 'dig');
  const isConvergence =
    crawlNode.groupOrigin === 'intersection' ||
    Boolean(crawlNode.reachedGroupIds && crawlNode.reachedGroupIds.length >= 2);

  return (
    <article
      className={`crawl-result-node match-type-${matchType} ${isSeed ? 'is-seed' : ''} ${
        isPathHighlighted ? 'is-path-highlighted' : ''
      } ${isPathDimmed ? 'is-path-dimmed' : ''} ${
        isActiveTrailTarget ? 'is-trail-target' : ''
      } ${isConvergence ? 'is-convergence-bridge' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelectPath) {
          onSelectPath(crawlNode.id);
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onSelectPath) {
            onSelectPath(crawlNode.id);
          }
        }
      }}
      title="Click node to focus and view its traversal trail"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="flow-handle view-handle"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="flow-handle view-handle"
        isConnectable={false}
      />

      <header className="crawl-node-header">
        <div className="crawl-node-tags">
          <span className={`crawl-level-badge ${matchType}`}>
            {isSeed ? 'Level 0 · Seed' : `Level ${crawlNode.level}`}
          </span>
          <span className={`crawl-match-type-tag is-${matchType}`}>
            {matchType === 'seed'
              ? 'Seed'
              : matchType === 'dig'
                ? 'Dig'
                : matchType === 'link'
                  ? 'Link'
                  : 'Jump'}
          </span>
          {childCount && childCount > 0 ? (
            <button
              type="button"
              className={`subtree-toggle-btn ${isSubtreeCollapsed ? 'is-collapsed' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleCollapseSubtree) {
                  onToggleCollapseSubtree(crawlNode.id);
                }
              }}
              title={
                isSubtreeCollapsed
                  ? `Expand downstream subtree (${childCount} branch${childCount > 1 ? 'es' : ''})`
                  : `Collapse downstream subtree (${childCount} branch${childCount > 1 ? 'es' : ''})`
              }
              aria-label={
                isSubtreeCollapsed
                  ? `Expand downstream subtree (${childCount} branch${childCount > 1 ? 'es' : ''})`
                  : `Collapse downstream subtree (${childCount} branch${childCount > 1 ? 'es' : ''})`
              }
            >
              {isSubtreeCollapsed ? (
                <>
                  <Plus size={10} aria-hidden="true" />
                  <span>{childCount}</span>
                </>
              ) : (
                <>
                  <Minus size={10} aria-hidden="true" />
                  <span>{childCount}</span>
                </>
              )}
            </button>
          ) : null}
          {trailSequenceStep !== undefined ? (
            <span
              className={`crawl-level-badge sequence-step ${
                isActiveTrailTarget ? 'target' : isSeed ? 'seed' : 'step'
              }`}
            >
              {isActiveTrailTarget
                ? `Target · Step ${trailSequenceStep}`
                : isSeed
                  ? 'Seed · Root'
                  : `Step ${trailSequenceStep}`}
            </span>
          ) : null}
          {crawlNode.groupOrigin === 'intersection' ? (
            <span
              className="crawl-origin-badge intersection"
              title="Convergence point reached by multiple hypothesis trajectories"
            >
              {crawlNode.reachedGroupIds && crawlNode.reachedGroupIds.length > 2
                ? `Convergence (${crawlNode.reachedGroupIds.length} Groups)`
                : 'Convergence Point'}
            </span>
          ) : crawlNode.groupOrigin ? (
            <span
              className={`crawl-origin-badge ${
                crawlNode.groupOrigin === 'groupA'
                  ? 'group-a'
                  : crawlNode.groupOrigin === 'groupB'
                    ? 'group-b'
                    : 'custom-group'
              }`}
              style={
                nodeData.groupColor
                  ? {
                      backgroundColor: `${nodeData.groupColor}22`,
                      borderColor: `${nodeData.groupColor}66`,
                      color: nodeData.groupColor,
                    }
                  : undefined
              }
            >
              {nodeData.groupName ||
                (crawlNode.groupOrigin === 'groupA'
                  ? 'Hypothesis A'
                  : crawlNode.groupOrigin === 'groupB'
                    ? 'Hypothesis B'
                    : crawlNode.groupOrigin)}
            </span>
          ) : null}
        </div>
        <span className="crawl-score-badge" title="Relevance match score">
          {scorePercent}% match
        </span>
      </header>

      <div className="crawl-node-body">
        <h4 className="crawl-node-title" title={crawlNode.nodeTitle}>
          {crawlNode.nodeTitle}
        </h4>
        {crawlNode.stepDescription &&
        crawlNode.stepDescription !== crawlNode.nodeTitle ? (
          <p className="crawl-node-subtitle" title={crawlNode.stepDescription}>
            {crawlNode.stepDescription}
          </p>
        ) : null}

        {nodeData.otherHypotheses && nodeData.otherHypotheses.length > 0 ? (
          <div className="crawl-node-convergence-row">
            {nodeData.otherHypotheses.map((oh) => (
              <button
                key={oh.id}
                type="button"
                className="crawl-convergence-bridge-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  if (nodeData.onJumpToHypothesis) {
                    nodeData.onJumpToHypothesis(oh.index);
                  }
                }}
                title={`Shared convergence node also present in ${oh.name}. Click to view.`}
              >
                <GitMerge size={10} aria-hidden="true" />
                <span>Shared with {oh.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Source Document Header & Match Excerpt */}
        {chunk ? (
          <>
            <div
              className="crawl-source-banner is-clickable"
              title={chunk.sourceName}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSource(chunk.sourceId, chunk);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenSource(chunk.sourceId, chunk);
                }
              }}
            >
              <FileText
                size={12}
                className="crawl-source-icon"
                aria-hidden="true"
              />
              <span className="crawl-source-name">{chunk.sourceName}</span>
              {chunk.pageNum ? (
                <span className="crawl-page-pill">p. {chunk.pageNum}</span>
              ) : null}
              {chunk.imageAssetUrl ? (
                <span className="crawl-page-pill is-image">
                  <ImageIcon size={10} aria-hidden="true" /> Figure
                </span>
              ) : null}
            </div>

            {chunk.imageAssetUrl ? (
              <div
                className="crawl-match-image-preview is-clickable"
                style={
                  chunk.lqip
                    ? {
                        backgroundImage: `url("${chunk.lqip}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSource?.(chunk.sourceId, chunk);
                  useGraphStore.getState().openLightbox({
                    url: chunk.imageAssetUrl!,
                    title: chunk.content.slice(0, 80),
                    pageNum: chunk.pageNum,
                    sourceName: chunk.sourceName,
                    coordinates: chunk.coordinates,
                  });
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenSource?.(chunk.sourceId, chunk);
                    useGraphStore.getState().openLightbox({
                      url: chunk.imageAssetUrl!,
                      title: chunk.content.slice(0, 80),
                      pageNum: chunk.pageNum,
                      sourceName: chunk.sourceName,
                      coordinates: chunk.coordinates,
                    });
                  }
                }}
                title="Click image to view full-resolution figure in lightbox"
              >
                <img
                  src={chunk.imageAssetUrl}
                  alt={chunk.content.slice(0, 60)}
                  className="crawl-match-thumbnail"
                  loading="lazy"
                />
              </div>
            ) : null}

            {/* Match Excerpt Box - Clicking opens source at match */}
            <div
              className="crawl-match-excerpt is-clickable"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSource(chunk.sourceId, chunk);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenSource(chunk.sourceId, chunk);
                }
              }}
              title="Click match text to inspect document source"
            >
              <p className="crawl-node-snippet">
                {formatInlineSnippet(chunk.content)}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {onSynthesizeSubtree && (isSeed || (childCount && childCount > 0)) ? (
        <footer className="crawl-node-footer">
          <button
            type="button"
            className="crawl-synthesize-action"
            onClick={(e) => {
              e.stopPropagation();
              onSynthesizeSubtree(crawlNode.id);
            }}
            title="Synthesize downstream branch narrative"
          >
            <Sparkles size={11} aria-hidden="true" />
            <span>{t('synthesizeBranch', 'Synthesize')}</span>
          </button>
        </footer>
      ) : null}
    </article>
  );
}

export function LaneHeaderNode({ data }: NodeProps) {
  const nodeData = data as unknown as LaneHeaderNodeData;
  const isIntersection = nodeData.lane === 'intersection';
  const customColor = nodeData.color;

  return (
    <div
      className={`diff-lane-badge lane-${nodeData.lane}`}
      style={
        customColor
          ? {
              borderLeft: `4px solid ${customColor}`,
              borderColor: `${customColor}55`,
              color: customColor,
              backgroundColor: `${customColor}14`,
            }
          : undefined
      }
    >
      <div className="diff-lane-badge-title">
        {isIntersection ? (
          <GitCompare size={13} aria-hidden="true" />
        ) : (
          <Layers size={13} aria-hidden="true" />
        )}
        <span>{nodeData.title}</span>
      </div>
      <span
        className="diff-lane-badge-count"
        style={
          customColor
            ? {
                backgroundColor: `${customColor}28`,
                color: customColor,
              }
            : undefined
        }
      >
        {nodeData.count} matches
      </span>
    </div>
  );
}

const nodeTypes = {
  crawlResult: CrawlResultNode,
  laneHeader: LaneHeaderNode,
};

export type CrawlResultsCanvasProps = {
  crawlResults: CrawlResponse;
  isStreaming?: boolean;
  crawlStepProgress?: CrawlProgressPayload;
  onOpenSource: (sourceId: string, chunk: SearchChunk) => void;
  onClose: () => void;
  onCancel?: () => void;
};

type CrawlResultsCanvasInnerProps = CrawlResultsCanvasProps;

function CrawlResultsCanvasInner({
  crawlResults,
  isStreaming,
  crawlStepProgress,
  onOpenSource,
  onClose,
  onCancel,
}: CrawlResultsCanvasInnerProps) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const [activePathNodeId, setActivePathNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'unified' | 'split'>(
    'single',
  );
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);

  const isComparative = Boolean(crawlResults.comparative?.isComparative);

  // Partition crawl into distinct hypotheses sorted by ascending Graph Entropy
  const hypothesisPartitions = useMemo(
    () => partitionHypothesisGraphs(crawlResults),
    [crawlResults],
  );
  const [activeHypothesisIndex, setActiveHypothesisIndex] = useState<number>(0);

  const currentHypothesis = useMemo(() => {
    if (hypothesisPartitions.length === 0) return null;
    const clampedIndex = Math.min(
      Math.max(0, activeHypothesisIndex),
      hypothesisPartitions.length - 1,
    );
    return hypothesisPartitions[clampedIndex] ?? hypothesisPartitions[0]!;
  }, [hypothesisPartitions, activeHypothesisIndex]);

  const activeHypothesisNodeIds = useMemo(() => {
    if (!currentHypothesis) return null;
    return new Set(currentHypothesis.nodes.map((n) => n.id));
  }, [currentHypothesis]);

  // Keyboard navigation across hypotheses (Left / Right arrow keys)
  useEffect(() => {
    if (hypothesisPartitions.length <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        setActiveHypothesisIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveHypothesisIndex((prev) =>
          Math.min(hypothesisPartitions.length - 1, prev + 1),
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hypothesisPartitions.length]);

  useEffect(() => {
    if (viewMode === 'single' && hypothesisPartitions.length > 1) {
      fitView({ duration: 300, padding: 0.15 });
    }
  }, [activeHypothesisIndex, viewMode, hypothesisPartitions.length, fitView]);

  // Active hypothesis groups definition (N >= 2)
  const activeGroups = useMemo(() => {
    if (
      crawlResults.comparative?.groups &&
      crawlResults.comparative.groups.length >= 2
    ) {
      return crawlResults.comparative.groups;
    }
    if (isComparative) {
      return [
        {
          id: 'groupA',
          name: 'Hypothesis A',
          count: crawlResults.comparative?.groupACount ?? 0,
          color: '#38bdf8',
        },
        {
          id: 'groupB',
          name: 'Hypothesis B',
          count: crawlResults.comparative?.groupBCount ?? 0,
          color: '#a855f7',
        },
      ];
    }
    return [];
  }, [crawlResults.comparative, isComparative]);

  // Interactive Traversal Filtering State
  const [minScore, setMinScore] = useState<number>(0);
  const [maxVisibleLevel, setMaxVisibleLevel] = useState<number>(
    crawlResults.maxLevelReached,
  );
  const [maxBranchEntropyFilter, setMaxBranchEntropyFilter] =
    useState<number>(1.0);
  const [selectedMatchTypeFilters, setSelectedMatchTypeFilters] = useState<
    Set<CrawlMatchType>
  >(() => new Set(ALL_MATCH_TYPES));
  const [selectedGroupFilters, setSelectedGroupFilters] = useState<Set<string>>(
    () => new Set(['intersection', ...activeGroups.map((g) => g.id)]),
  );
  const [collapsedSubtreeNodeIds, setCollapsedSubtreeNodeIds] = useState<
    Set<string>
  >(new Set());
  const [selectedKeywordFilters, setSelectedKeywordFilters] = useState<
    Set<string>
  >(new Set());
  const [activeSynthesisNodeId, setActiveSynthesisNodeId] = useState<
    string | null
  >(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const availableSharedKeywords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of crawlResults.edges) {
      if (edge.sharedKeywords) {
        for (const kw of edge.sharedKeywords) {
          const trimmed = kw.trim();
          if (trimmed) {
            counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
          }
        }
      }
    }
    return Array.from(counts.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
  }, [crawlResults.edges]);

  const matchTypeCounts = useMemo(() => {
    const counts: Record<CrawlMatchType, number> = {
      seed: 0,
      dig: 0,
      link: 0,
      jump: 0,
    };
    for (const n of crawlResults.nodes) {
      const type: CrawlMatchType =
        n.matchType ?? (n.level === 0 ? 'seed' : 'dig');
      if (type in counts) {
        counts[type] += 1;
      }
    }
    return counts;
  }, [crawlResults.nodes]);

  const directChildCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of crawlResults.edges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    }
    return counts;
  }, [crawlResults.edges]);

  useEffect(() => {
    setMaxVisibleLevel(crawlResults.maxLevelReached);
    setMinScore(0);
    setMaxBranchEntropyFilter(1.0);
    setSelectedMatchTypeFilters(new Set(ALL_MATCH_TYPES));
    setSelectedGroupFilters(
      new Set(['intersection', ...activeGroups.map((g) => g.id)]),
    );
    setCollapsedSubtreeNodeIds(new Set());
    setSelectedKeywordFilters(new Set());
    setActiveSynthesisNodeId(null);
  }, [crawlResults, activeGroups]);

  const hasActiveFilters =
    minScore > 0 ||
    maxVisibleLevel < crawlResults.maxLevelReached ||
    maxBranchEntropyFilter < 1.0 ||
    selectedMatchTypeFilters.size < ALL_MATCH_TYPES.length ||
    collapsedSubtreeNodeIds.size > 0 ||
    selectedKeywordFilters.size > 0 ||
    (isComparative &&
      activeGroups.length > 0 &&
      selectedGroupFilters.size < activeGroups.length + 1);

  const handleResetFilters = () => {
    setMinScore(0);
    setMaxVisibleLevel(crawlResults.maxLevelReached);
    setMaxBranchEntropyFilter(1.0);
    setSelectedMatchTypeFilters(new Set(ALL_MATCH_TYPES));
    setSelectedGroupFilters(
      new Set(['intersection', ...activeGroups.map((g) => g.id)]),
    );
    setCollapsedSubtreeNodeIds(new Set());
    setSelectedKeywordFilters(new Set());
    setActiveSynthesisNodeId(null);
  };

  const toggleMatchTypeFilter = (type: CrawlMatchType) => {
    setSelectedMatchTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) {
          next.delete(type);
        }
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const toggleKeywordFilter = (keyword: string) => {
    setSelectedKeywordFilters((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      return next;
    });
  };

  const clearKeywordFilters = () => {
    setSelectedKeywordFilters(new Set());
  };

  const handleSynthesizeSubtree = (nodeId: string) => {
    setActiveSynthesisNodeId((prev) => (prev === nodeId ? null : nodeId));
  };

  const handleToggleCollapseSubtree = (nodeId: string) => {
    setCollapsedSubtreeNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const toggleGroupFilter = (groupId: string) => {
    setSelectedGroupFilters((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        if (next.size > 1) {
          next.delete(groupId);
        }
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Traversal Filtering & Orphan Pruning Algorithm
  const { survivingNodes, survivingEdges, orphanPrunedCount } = useMemo(() => {
    // 1. Direct match filter
    const passesDirect = (node: CrawlNode): boolean => {
      const score = node.rerankScore ?? node.score;
      if (score < minScore) return false;
      if (node.level > maxVisibleLevel) return false;
      const nodeType: CrawlMatchType =
        node.matchType ?? (node.level === 0 ? 'seed' : 'dig');
      if (!selectedMatchTypeFilters.has(nodeType)) return false;
      if (
        maxBranchEntropyFilter < 1.0 &&
        typeof node.branchEntropy === 'number' &&
        node.branchEntropy > maxBranchEntropyFilter
      ) {
        return false;
      }
      if (isComparative && activeGroups.length > 0) {
        if (node.groupOrigin === 'intersection') {
          if (!selectedGroupFilters.has('intersection')) return false;
        } else if (
          node.groupOrigin &&
          !selectedGroupFilters.has(node.groupOrigin)
        ) {
          return false;
        }
      }
      return true;
    };

    const directNodes = crawlResults.nodes.filter(passesDirect);
    const directNodeIds = new Set(directNodes.map((n) => n.id));

    // Surviving edges between nodes that pass direct criteria
    let candidateEdges = crawlResults.edges.filter(
      (e) => directNodeIds.has(e.source) && directNodeIds.has(e.target),
    );
    let candidateNodes = directNodes;

    // Apply keyword / semantic concept multiselect filter (union of selected keywords)
    if (selectedKeywordFilters.size > 0) {
      const matchingEdges = candidateEdges.filter((e) =>
        e.sharedKeywords?.some((kw) => selectedKeywordFilters.has(kw)),
      );
      if (matchingEdges.length === 0) {
        return {
          survivingNodes: [],
          survivingEdges: [],
          orphanPrunedCount: directNodes.length,
        };
      }

      // Build backward adjacency (target -> sources) and forward adjacency (source -> targets)
      const reverseAdj = new Map<
        string,
        Array<{ sourceId: string; edgeId: string }>
      >();
      const forwardAdjAll = new Map<
        string,
        Array<{ targetId: string; edgeId: string }>
      >();
      for (const e of candidateEdges) {
        const revList = reverseAdj.get(e.target) ?? [];
        revList.push({ sourceId: e.source, edgeId: e.id });
        reverseAdj.set(e.target, revList);

        const fwdList = forwardAdjAll.get(e.source) ?? [];
        fwdList.push({ targetId: e.target, edgeId: e.id });
        forwardAdjAll.set(e.source, fwdList);
      }

      const relevantNodeIds = new Set<string>();
      const relevantEdgeIds = new Set<string>();

      for (const me of matchingEdges) {
        relevantNodeIds.add(me.source);
        relevantNodeIds.add(me.target);
        relevantEdgeIds.add(me.id);
      }

      // Traverse ancestors backwards from matching edge sources
      const ancestorQueue = matchingEdges.map((e) => e.source);
      const visitedAncestors = new Set<string>(ancestorQueue);
      while (ancestorQueue.length > 0) {
        const curr = ancestorQueue.shift()!;
        const incoming = reverseAdj.get(curr) ?? [];
        for (const item of incoming) {
          relevantEdgeIds.add(item.edgeId);
          relevantNodeIds.add(item.sourceId);
          if (!visitedAncestors.has(item.sourceId)) {
            visitedAncestors.add(item.sourceId);
            ancestorQueue.push(item.sourceId);
          }
        }
      }

      // Traverse descendants forward from matching edge targets
      const descendantQueue = matchingEdges.map((e) => e.target);
      const visitedDescendants = new Set<string>(descendantQueue);
      while (descendantQueue.length > 0) {
        const curr = descendantQueue.shift()!;
        const outgoing = forwardAdjAll.get(curr) ?? [];
        for (const item of outgoing) {
          relevantEdgeIds.add(item.edgeId);
          relevantNodeIds.add(item.targetId);
          if (!visitedDescendants.has(item.targetId)) {
            visitedDescendants.add(item.targetId);
            descendantQueue.push(item.targetId);
          }
        }
      }

      candidateNodes = directNodes.filter((n) => relevantNodeIds.has(n.id));
      candidateEdges = candidateEdges.filter((e) => relevantEdgeIds.has(e.id));
    }

    // Forward adjacency for reachability traversal (excluding outgoing edges of collapsed subtrees)
    const forwardAdj = new Map<string, string[]>();
    for (const edge of candidateEdges) {
      if (!collapsedSubtreeNodeIds.has(edge.source)) {
        const list = forwardAdj.get(edge.source) ?? [];
        list.push(edge.target);
        forwardAdj.set(edge.source, list);
      }
    }

    // Surviving seeds: Level 0 nodes that pass direct criteria
    const reachableNodeIds = new Set<string>();
    const seedQueue: string[] = [];
    for (const n of candidateNodes) {
      if (n.level === 0) {
        reachableNodeIds.add(n.id);
        seedQueue.push(n.id);
      }
    }

    // Traverse forward from surviving seeds
    while (seedQueue.length > 0) {
      const curr = seedQueue.shift()!;
      const children = forwardAdj.get(curr) ?? [];
      for (const childId of children) {
        if (!reachableNodeIds.has(childId)) {
          reachableNodeIds.add(childId);
          seedQueue.push(childId);
        }
      }
    }

    const surviving = candidateNodes.filter((n) => reachableNodeIds.has(n.id));
    const survivingIdSet = new Set(surviving.map((n) => n.id));
    const edges = candidateEdges.filter(
      (e) =>
        survivingIdSet.has(e.source) &&
        survivingIdSet.has(e.target) &&
        !collapsedSubtreeNodeIds.has(e.source),
    );

    return {
      survivingNodes: surviving,
      survivingEdges: edges,
      orphanPrunedCount: directNodes.length - surviving.length,
    };
  }, [
    crawlResults.nodes,
    crawlResults.edges,
    minScore,
    maxVisibleLevel,
    maxBranchEntropyFilter,
    selectedMatchTypeFilters,
    selectedGroupFilters,
    collapsedSubtreeNodeIds,
    selectedKeywordFilters,
    isComparative,
    activeGroups,
  ]);

  // Clear active path or active synthesis if the focused node was filtered out
  useEffect(() => {
    if (
      activePathNodeId &&
      !survivingNodes.some((n) => n.id === activePathNodeId)
    ) {
      setActivePathNodeId(null);
    }
    if (
      activeSynthesisNodeId &&
      !survivingNodes.some((n) => n.id === activeSynthesisNodeId)
    ) {
      setActiveSynthesisNodeId(null);
    }
  }, [survivingNodes, activePathNodeId, activeSynthesisNodeId]);

  // Trace ancestor lineage and descendant subtrees from active path node
  const associatedPath = useMemo(() => {
    if (!activePathNodeId) {
      return {
        nodeIds: new Set<string>(),
        edgeIds: new Set<string>(),
        edgeSequenceMap: new Map<string, number>(),
        nodeStepMap: new Map<string, number>(),
      };
    }

    const nodeIds = new Set<string>([activePathNodeId]);
    const edgeIds = new Set<string>();

    // 1. Ancestors: traverse backward along edges (target -> source)
    const targetToSources = new Map<
      string,
      Array<{ sourceId: string; edgeId: string; level: number }>
    >();
    for (const edge of survivingEdges) {
      const list = targetToSources.get(edge.target) ?? [];
      list.push({ sourceId: edge.source, edgeId: edge.id, level: edge.level });
      targetToSources.set(edge.target, list);
    }

    const ancestorQueue = [activePathNodeId];
    const visitedAncestors = new Set<string>([activePathNodeId]);
    while (ancestorQueue.length > 0) {
      const curr = ancestorQueue.shift()!;
      const parents = targetToSources.get(curr) ?? [];
      for (const p of parents) {
        edgeIds.add(p.edgeId);
        nodeIds.add(p.sourceId);
        if (!visitedAncestors.has(p.sourceId)) {
          visitedAncestors.add(p.sourceId);
          ancestorQueue.push(p.sourceId);
        }
      }
    }

    // 2. Descendants: traverse forward along edges (source -> target)
    const sourceToTargets = new Map<
      string,
      Array<{ targetId: string; edgeId: string; level: number }>
    >();
    for (const edge of survivingEdges) {
      const list = sourceToTargets.get(edge.source) ?? [];
      list.push({ targetId: edge.target, edgeId: edge.id, level: edge.level });
      sourceToTargets.set(edge.source, list);
    }

    const descendantQueue = [activePathNodeId];
    const visitedDescendants = new Set<string>([activePathNodeId]);
    while (descendantQueue.length > 0) {
      const curr = descendantQueue.shift()!;
      const children = sourceToTargets.get(curr) ?? [];
      for (const c of children) {
        edgeIds.add(c.edgeId);
        nodeIds.add(c.targetId);
        if (!visitedDescendants.has(c.targetId)) {
          visitedDescendants.add(c.targetId);
          descendantQueue.push(c.targetId);
        }
      }
    }

    // 3. Numbered sequence along the trail
    const edgeSequenceMap = new Map<string, number>();
    const nodeStepMap = new Map<string, number>();

    const pathEdges = survivingEdges
      .filter((e) => edgeIds.has(e.id))
      .sort((a, b) => a.level - b.level);

    pathEdges.forEach((e, idx) => {
      edgeSequenceMap.set(e.id, idx + 1);
    });

    const crawlNodeMap = new Map(survivingNodes.map((n) => [n.id, n]));
    for (const id of nodeIds) {
      const cn = crawlNodeMap.get(id);
      if (cn) {
        nodeStepMap.set(id, cn.level);
      }
    }

    return { nodeIds, edgeIds, edgeSequenceMap, nodeStepMap };
  }, [activePathNodeId, survivingEdges, survivingNodes]);

  const handleSelectPath = (nodeId: string) => {
    setActivePathNodeId((prev) => (prev === nodeId ? null : nodeId));
  };

  // Compute hierarchical layout (unified tree or comparative split diff)
  // Compute hierarchical layout (single hypothesis, unified tree, or comparative split diff)
  const { flowNodes, flowEdges } = useMemo(() => {
    const nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      selectable?: boolean;
      draggable?: boolean;
      data: CrawlNodeData | LaneHeaderNodeData;
    }> = [];

    // Filter surviving nodes and edges when in single hypothesis mode
    const displayedSurvivingNodes =
      viewMode === 'single' &&
      hypothesisPartitions.length > 1 &&
      activeHypothesisNodeIds
        ? survivingNodes.filter((n) => activeHypothesisNodeIds.has(n.id))
        : survivingNodes;

    const displayedNodeIdSet = new Set(
      displayedSurvivingNodes.map((n) => n.id),
    );

    const displayedSurvivingEdges = survivingEdges.filter(
      (e) =>
        displayedNodeIdSet.has(e.source) && displayedNodeIdSet.has(e.target),
    );

    if (viewMode === 'split' && isComparative) {
      // Split Comparative View across N hypothesis groups + Convergence Points
      const laneNodes = new Map<string, CrawlNode[]>();
      for (const g of activeGroups) {
        laneNodes.set(g.id, []);
      }
      laneNodes.set('intersection', []);

      for (const node of survivingNodes) {
        if (node.groupOrigin === 'intersection') {
          laneNodes.get('intersection')?.push(node);
        } else if (node.groupOrigin && laneNodes.has(node.groupOrigin)) {
          laneNodes.get(node.groupOrigin)?.push(node);
        } else {
          laneNodes.get(activeGroups[0]?.id ?? 'groupA')?.push(node);
        }
      }

      const half = Math.ceil(activeGroups.length / 2);
      const leftGroups = activeGroups.slice(0, half);
      const rightGroups = activeGroups.slice(half);

      const laneList: Array<{
        id: string;
        title: string;
        color: string;
        isIntersection: boolean;
        nodes: CrawlNode[];
      }> = [
        ...leftGroups.map((g) => ({
          id: g.id,
          title: g.name,
          color: g.color || '#38bdf8',
          isIntersection: false,
          nodes: laneNodes.get(g.id) ?? [],
        })),
        {
          id: 'intersection',
          title: 'Convergence Points',
          color: '#10b981',
          isIntersection: true,
          nodes: laneNodes.get('intersection') ?? [],
        },
        ...rightGroups.map((g) => ({
          id: g.id,
          title: g.name,
          color: g.color || '#a855f7',
          isIntersection: false,
          nodes: laneNodes.get(g.id) ?? [],
        })),
      ];

      const LANE_SPACING = 560;
      const totalLanes = laneList.length;

      laneList.forEach((lane, index) => {
        const centerX = (index - (totalLanes - 1) / 2) * LANE_SPACING;

        // Add lane guide header badge
        nodes.push({
          id: `lane-header-${lane.id}`,
          type: 'laneHeader',
          position: { x: centerX - CRAWL_NODE_WIDTH / 2, y: 0 },
          selectable: false,
          draggable: false,
          data: {
            title: lane.title,
            lane: lane.id,
            count: lane.nodes.length,
            color: lane.color,
          },
        });

        const lanePositions = layoutCrawlNodes(
          lane.nodes,
          survivingEdges,
          centerX,
        );

        lane.nodes.forEach((node) => {
          const pos = lanePositions.get(node.id) ?? { x: centerX, y: 80 };
          const isHighlighted =
            activePathNodeId !== null && associatedPath.nodeIds.has(node.id);
          const isDimmed =
            activePathNodeId !== null && !associatedPath.nodeIds.has(node.id);
          const isTarget = node.id === activePathNodeId;

          const otherHypotheses: Array<{
            index: number;
            id: string;
            name: string;
          }> = [];
          if (hypothesisPartitions.length > 1) {
            hypothesisPartitions.forEach((p, idx) => {
              if (
                idx !== activeHypothesisIndex &&
                p.nodes.some(
                  (pn) => pn.id === node.id || pn.nodeId === node.nodeId,
                )
              ) {
                otherHypotheses.push({
                  index: idx,
                  id: p.id,
                  name: p.name,
                });
              }
            });
          }

          nodes.push({
            id: node.id,
            type: 'crawlResult',
            position: pos,
            data: {
              crawlNode: node,
              onOpenSource,
              onSelectPath: handleSelectPath,
              isSeed: node.level === 0,
              isPathHighlighted: isHighlighted,
              isPathDimmed: isDimmed,
              isActiveTrailTarget: isTarget,
              trailSequenceStep: isHighlighted
                ? associatedPath.nodeStepMap.get(node.id)
                : undefined,
              groupColor: lane.color,
              groupName: lane.title,
              childCount: directChildCountMap.get(node.id) || 0,
              isSubtreeCollapsed: collapsedSubtreeNodeIds.has(node.id),
              onToggleCollapseSubtree: handleToggleCollapseSubtree,
              onSynthesizeSubtree: handleSynthesizeSubtree,
              isPruned: node.isPruned,
              otherHypotheses,
              onJumpToHypothesis: (targetIdx: number) => {
                setViewMode('single');
                setActiveHypothesisIndex(targetIdx);
              },
            },
          });
        });
      });
    } else {
      // Group nodes with Dagre hierarchical layout (single hypothesis or unified layout)
      const groupMap = new Map(activeGroups.map((g) => [g.id, g]));
      const unifiedPositions = layoutCrawlNodes(
        displayedSurvivingNodes,
        displayedSurvivingEdges,
        0,
      );

      displayedSurvivingNodes.forEach((node) => {
        const pos = unifiedPositions.get(node.id) ?? { x: 0, y: 80 };
        const isHighlighted =
          activePathNodeId !== null && associatedPath.nodeIds.has(node.id);
        const isDimmed =
          activePathNodeId !== null && !associatedPath.nodeIds.has(node.id);
        const isTarget = node.id === activePathNodeId;
        const grp = node.groupOrigin
          ? groupMap.get(node.groupOrigin)
          : undefined;
        const groupColor =
          node.groupOrigin === 'intersection'
            ? '#10b981'
            : grp?.color || currentHypothesis?.color || '#38bdf8';
        const groupName =
          node.groupOrigin === 'intersection'
            ? 'Convergence Points'
            : grp?.name || currentHypothesis?.hypothesisName || 'Trajectory';

        const otherHypotheses: Array<{
          index: number;
          id: string;
          name: string;
        }> = [];
        if (hypothesisPartitions.length > 1) {
          hypothesisPartitions.forEach((p, idx) => {
            if (
              idx !== activeHypothesisIndex &&
              p.nodes.some(
                (pn) => pn.id === node.id || pn.nodeId === node.nodeId,
              )
            ) {
              otherHypotheses.push({
                index: idx,
                id: p.id,
                name: p.name,
              });
            }
          });
        }

        nodes.push({
          id: node.id,
          type: 'crawlResult',
          position: pos,
          data: {
            crawlNode: node,
            onOpenSource,
            onSelectPath: handleSelectPath,
            isSeed: node.level === 0,
            isPathHighlighted: isHighlighted,
            isPathDimmed: isDimmed,
            isActiveTrailTarget: isTarget,
            trailSequenceStep: isHighlighted
              ? associatedPath.nodeStepMap.get(node.id)
              : undefined,
            groupColor,
            groupName,
            childCount: directChildCountMap.get(node.id) || 0,
            isSubtreeCollapsed: collapsedSubtreeNodeIds.has(node.id),
            onToggleCollapseSubtree: handleToggleCollapseSubtree,
            onSynthesizeSubtree: handleSynthesizeSubtree,
            isPruned: node.isPruned,
            otherHypotheses,
            onJumpToHypothesis: (targetIdx: number) => {
              setViewMode('single');
              setActiveHypothesisIndex(targetIdx);
            },
          },
        });
      });
    }

    const edgesToRender =
      viewMode === 'split' && isComparative
        ? survivingEdges
        : displayedSurvivingEdges;

    const edges = edgesToRender.map((edge: CrawlEdge) => {
      const isEdgeInPath =
        activePathNodeId !== null && associatedPath.edgeIds.has(edge.id);
      const isDimmedEdge = activePathNodeId !== null && !isEdgeInPath;
      const stepNumber = associatedPath.edgeSequenceMap.get(edge.id);

      const matchType = edge.matchType ?? 'dig';
      let matchTypeColor = '#10b981'; // emerald for dig
      if (matchType === 'seed') matchTypeColor = '#3b82f6';
      else if (matchType === 'link')
        matchTypeColor = '#f59e0b'; // amber for link
      else if (matchType === 'jump') matchTypeColor = '#8b5cf6'; // purple for jump

      const strokeColor = isDimmedEdge
        ? 'var(--line-soft)'
        : isEdgeInPath
          ? '#22c55e'
          : matchTypeColor;

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        className: `crawl-flow-edge match-type-${matchType}`,
        animated: !isDimmedEdge,
        style: {
          stroke: strokeColor,
          strokeWidth: isEdgeInPath ? 3.5 : isDimmedEdge ? 1 : 2,
          opacity: isDimmedEdge ? 0.15 : 1,
          filter: isEdgeInPath
            ? 'drop-shadow(0 0 6px rgba(46, 204, 113, 0.8))'
            : undefined,
        },
        zIndex: isEdgeInPath ? 10 : isDimmedEdge ? 0 : 1,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: isEdgeInPath ? 16 : 14,
          height: isEdgeInPath ? 16 : 14,
          color: strokeColor,
        },
        label: isDimmedEdge
          ? undefined
          : formatCrawlEdgeLabel(edge, { isEdgeInPath, stepNumber }),
        labelStyle: {
          fill: isEdgeInPath ? '#86efac' : strokeColor,
          fontSize: isEdgeInPath ? 11 : 10,
          fontWeight: isEdgeInPath ? 700 : 600,
        },
        labelBgStyle: {
          fill: isEdgeInPath ? '#064e3b' : 'var(--panel)',
          fillOpacity: isDimmedEdge ? 0.2 : 0.95,
          stroke: isEdgeInPath ? '#22c55e' : undefined,
          strokeWidth: isEdgeInPath ? 1 : 0,
        },
        labelBgPadding: [4, 6] as [number, number],
        labelBgBorderRadius: 4,
      };
    });

    return { flowNodes: nodes, flowEdges: edges };
  }, [
    survivingNodes,
    survivingEdges,
    activeGroups,
    onOpenSource,
    activePathNodeId,
    associatedPath,
    viewMode,
    isComparative,
    directChildCountMap,
    collapsedSubtreeNodeIds,
    hypothesisPartitions.length,
    activeHypothesisNodeIds,
    currentHypothesis,
  ]);

  function handleExportTrail(): void {
    const lines: string[] = [];
    lines.push(`# Investigation Trail: ${crawlResults.queryText}`);
    lines.push(`- **Date**: ${new Date().toLocaleString()}`);
    lines.push(`- **Traversed Levels**: ${crawlResults.maxLevelReached + 1}`);
    lines.push(`- **Total Matches**: ${crawlResults.totalMatches}`);
    lines.push(
      `- **Visible Filtered Matches**: ${survivingNodes.length}${orphanPrunedCount > 0 ? ` (${orphanPrunedCount} pruned orphans)` : ''}`,
    );
    if (hasActiveFilters) {
      const filterParts: string[] = [];
      if (minScore > 0)
        filterParts.push(`Min Score >= ${Math.round(minScore * 100)}%`);
      if (maxVisibleLevel < crawlResults.maxLevelReached)
        filterParts.push(`Max Level <= ${maxVisibleLevel}`);
      if (selectedMatchTypeFilters.size < ALL_MATCH_TYPES.length)
        filterParts.push(
          `Match Types = "${Array.from(selectedMatchTypeFilters).join(', ')}"`,
        );
      if (selectedKeywordFilters.size > 0)
        filterParts.push(
          `Keyword Filters = "${Array.from(selectedKeywordFilters).join(', ')}"`,
        );
      lines.push(`- **Filters Applied**: ${filterParts.join(', ')}`);
    }
    lines.push(`- **Direction**: ${crawlResults.direction}`);
    lines.push(`- **Max Crawl Depth**: ${crawlResults.crawlDepth}`);
    lines.push(`- **Sensitivity**: ${crawlResults.sensitivity ?? 'medium'}`);
    lines.push('');

    // Match classification breakdown
    const seedNode = survivingNodes.find(
      (n) => (n.matchType ?? (n.level === 0 ? 'seed' : 'dig')) === 'seed',
    );
    const digsCount = survivingNodes.filter(
      (n) => (n.matchType ?? (n.level === 0 ? 'seed' : 'dig')) === 'dig',
    ).length;
    const linksCount = survivingNodes.filter(
      (n) => (n.matchType ?? (n.level === 0 ? 'seed' : 'dig')) === 'link',
    ).length;
    const jumpsCount = survivingNodes.filter(
      (n) => (n.matchType ?? (n.level === 0 ? 'seed' : 'dig')) === 'jump',
    ).length;

    lines.push(`## Exploration & Match Classification`);
    if (seedNode) {
      lines.push(`- **Starting Seed Topic**: ${seedNode.nodeTitle}`);
    }
    lines.push(`- **Digs (Topic Elaborations)**: ${digsCount}`);
    lines.push(`- **Links (Perspective Bridges)**: ${linksCount}`);
    lines.push(`- **Jumps (Topic Transitions)**: ${jumpsCount}`);
    lines.push('');

    if (crawlResults.summary) {
      lines.push(`## Executive Summary`);
      lines.push(crawlResults.summary);
      lines.push('');
    }

    if (crawlResults.comparative?.isComparative) {
      lines.push(`## Comparative Analysis & Hypotheses`);
      for (const g of activeGroups) {
        const count = survivingNodes.filter(
          (n) => n.groupOrigin === g.id,
        ).length;
        lines.push(`- **${g.name} Matches**: ${count}`);
      }
      const convergenceCount = survivingNodes.filter(
        (n) => n.groupOrigin === 'intersection',
      ).length;
      lines.push(`- **Convergence / Intersection Nodes**: ${convergenceCount}`);
      if (crawlResults.comparative.intersectionNodeTitles.length > 0) {
        lines.push(
          `- **Shared Convergence Points**: ${crawlResults.comparative.intersectionNodeTitles.join(', ')}`,
        );
      }
      lines.push('');
    }

    // Subtree Narrative Syntheses for branches with children
    const branchRoots = survivingNodes.filter(
      (n) => (directChildCountMap.get(n.id) ?? 0) > 0,
    );
    if (branchRoots.length > 0) {
      lines.push(`## Subtree Narrative Syntheses`);
      for (const root of branchRoots) {
        const sourceToTargets = new Map<
          string,
          Array<{ targetId: string; edge: CrawlEdge }>
        >();
        for (const edge of survivingEdges) {
          const list = sourceToTargets.get(edge.source) ?? [];
          list.push({ targetId: edge.target, edge });
          sourceToTargets.set(edge.source, list);
        }
        const descendantIds = new Set<string>();
        const subtreeEdgeList: CrawlEdge[] = [];
        const queue = [root.id];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          const targets = sourceToTargets.get(curr) ?? [];
          for (const { targetId, edge } of targets) {
            subtreeEdgeList.push(edge);
            if (!descendantIds.has(targetId)) {
              descendantIds.add(targetId);
              queue.push(targetId);
            }
          }
        }
        const descendantNodes = survivingNodes.filter((n) =>
          descendantIds.has(n.id),
        );
        const synth = synthesizeSubtree(root, descendantNodes, subtreeEdgeList);
        lines.push(`### Branch: ${synth.rootTitle}`);
        lines.push(`- **Trajectory**: ${synth.topicTrajectory.join(' → ')}`);
        lines.push(
          `- **Depth**: ${synth.totalHops} hop${synth.totalHops === 1 ? '' : 's'} (${synth.totalNodes} nodes)`,
        );
        lines.push(
          `- **Average Similarity**: ${Math.round(synth.averageSimilarity * 100)}%`,
        );
        if (synth.sharedThemes.length > 0) {
          lines.push(`- **Shared Themes**: ${synth.sharedThemes.join(', ')}`);
        }
        lines.push(`- **Synthesis**: ${synth.narrative}`);
        lines.push('');
      }
    }

    lines.push(`## Sequential Traversal Path`);
    const levelMap = new Map<number, CrawlNode[]>();
    for (const node of survivingNodes) {
      const list = levelMap.get(node.level) ?? [];
      list.push(node);
      levelMap.set(node.level, list);
    }

    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
    for (const level of sortedLevels) {
      const nodesAtLevel = levelMap.get(level) ?? [];
      lines.push(
        `### ${level === 0 ? 'Level 0 · Starting Seed' : `Hop Level ${level}`}`,
      );
      for (const node of nodesAtLevel) {
        const scorePct = Math.round((node.rerankScore ?? node.score) * 100);
        const matchType = node.matchType ?? (node.level === 0 ? 'seed' : 'dig');
        const matchTypeTag =
          matchType === 'seed'
            ? '[Seed]'
            : matchType === 'dig'
              ? '[Dig]'
              : matchType === 'link'
                ? '[Link]'
                : '[Jump]';
        const originTag =
          node.groupOrigin === 'intersection'
            ? ' [Convergence Point]'
            : node.groupOrigin
              ? ` [${activeGroups.find((g) => g.id === node.groupOrigin)?.name || node.groupOrigin}]`
              : '';
        lines.push(
          `#### ${matchTypeTag} [${scorePct}% Match] ${node.nodeTitle}${originTag}`,
        );
        if (node.stepDescription) {
          lines.push(`*${node.stepDescription}*`);
        }
        lines.push(
          `- **Source**: ${node.chunk.sourceName} (p. ${node.chunk.pageNum})`,
        );
        lines.push(`> ${node.chunk.content.replace(/\n+/g, ' ')}`);
        lines.push('');
      }
    }

    const markdown = lines.join('\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = crawlResults.queryText
      .slice(0, 30)
      .replace(/[^a-z0-9]+/gi, '_');
    link.download = `investigation-trail-${safeTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleExportObsidianCanvas(): void {
    const positions = layoutCrawlNodes(survivingNodes, survivingEdges);

    const canvasNodes = survivingNodes.map((node) => {
      const pos = positions.get(node.id) ?? { x: 0, y: node.level * 220 };
      const matchType = node.matchType ?? (node.level === 0 ? 'seed' : 'dig');
      const color =
        matchType === 'seed'
          ? '#3b82f6'
          : matchType === 'dig'
            ? '#10b981'
            : matchType === 'link'
              ? '#f59e0b'
              : '#8b5cf6';
      const scorePct = Math.round((node.rerankScore ?? node.score) * 100);
      const originTag =
        node.groupOrigin === 'intersection'
          ? ' [Convergence]'
          : node.groupOrigin
            ? ` [${activeGroups.find((g) => g.id === node.groupOrigin)?.name || node.groupOrigin}]`
            : '';

      const content = [
        `### [${matchType.toUpperCase()}] ${node.nodeTitle}${originTag}`,
        `**${scorePct}% Match** · Level ${node.level}`,
        `*Source: ${node.chunk.sourceName}${node.chunk.pageNum ? ` (p. ${node.chunk.pageNum})` : ''}*`,
        '',
        node.chunk.content,
      ].join('\n');

      return {
        id: node.id,
        type: 'text' as const,
        text: content,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        width: CRAWL_NODE_WIDTH,
        height: 220,
        color,
      };
    });

    const canvasEdges = survivingEdges.map((edge) => {
      const matchType = edge.matchType ?? 'dig';
      const color =
        matchType === 'seed'
          ? '#3b82f6'
          : matchType === 'link'
            ? '#f59e0b'
            : matchType === 'jump'
              ? '#8b5cf6'
              : '#10b981';

      return {
        id: edge.id,
        fromNode: edge.source,
        fromSide: 'bottom' as const,
        toNode: edge.target,
        toSide: 'top' as const,
        toEnd: 'arrow' as const,
        label: formatCrawlEdgeLabel(edge),
        color,
      };
    });

    const canvasData = {
      nodes: canvasNodes,
      edges: canvasEdges,
    };

    const json = JSON.stringify(canvasData, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = crawlResults.queryText
      .slice(0, 30)
      .replace(/[^a-z0-9]+/gi, '_');
    link.download = `investigation-canvas-${safeTitle}.canvas`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const activeTargetNode = useMemo(() => {
    if (!activePathNodeId) return null;
    return survivingNodes.find((n) => n.id === activePathNodeId) ?? null;
  }, [activePathNodeId, survivingNodes]);

  const activeSynthesis = useMemo<SubtreeSynthesis | null>(() => {
    if (!activeSynthesisNodeId) return null;
    const root = survivingNodes.find((n) => n.id === activeSynthesisNodeId);
    if (!root) return null;

    const sourceToTargets = new Map<
      string,
      Array<{ targetId: string; edge: CrawlEdge }>
    >();
    for (const edge of survivingEdges) {
      const list = sourceToTargets.get(edge.source) ?? [];
      list.push({ targetId: edge.target, edge });
      sourceToTargets.set(edge.source, list);
    }

    const descendantIds = new Set<string>();
    const subtreeEdgeList: CrawlEdge[] = [];
    const queue = [root.id];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const targets = sourceToTargets.get(curr) ?? [];
      for (const { targetId, edge } of targets) {
        subtreeEdgeList.push(edge);
        if (!descendantIds.has(targetId)) {
          descendantIds.add(targetId);
          queue.push(targetId);
        }
      }
    }

    const descendantNodes = survivingNodes.filter((n) =>
      descendantIds.has(n.id),
    );
    return synthesizeSubtree(root, descendantNodes, subtreeEdgeList);
  }, [activeSynthesisNodeId, survivingNodes, survivingEdges]);

  // 1. Initial graph layout & filter adjustment fit (only when no node is focused)
  useEffect(() => {
    if (!activePathNodeId) {
      const timer = window.setTimeout(() => {
        void fitView({ padding: 0.2, duration: 400 });
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [
    fitView,
    activePathNodeId,
    survivingNodes.length,
    survivingEdges.length,
    maxVisibleLevel,
    selectedKeywordFilters.size,
    selectedGroupFilters.size,
    viewMode,
  ]);

  // 2. Focused node selection camera zoom
  useEffect(() => {
    if (activePathNodeId) {
      const timer = window.setTimeout(() => {
        void fitView({
          nodes: [{ id: activePathNodeId }],
          duration: 400,
          padding: 0.8,
          maxZoom: 1.1,
        });
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [activePathNodeId, fitView]);

  // 3. Escape key workflow:
  // - If node/trail is selected: unselect it
  // - If synthesis overlay, info popover, or filter panel is open: close it
  // - If nothing is selected / open: ask user if return to canvas
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (showReturnConfirm) {
        event.preventDefault();
        setShowReturnConfirm(false);
        return;
      }
      if (showExportMenu) {
        event.preventDefault();
        setShowExportMenu(false);
        return;
      }
      if (activeSynthesisNodeId) {
        event.preventDefault();
        setActiveSynthesisNodeId(null);
        return;
      }
      if (showInfoPanel) {
        event.preventDefault();
        setShowInfoPanel(false);
        return;
      }
      if (showFilters) {
        event.preventDefault();
        setShowFilters(false);
        return;
      }
      if (activePathNodeId !== null) {
        event.preventDefault();
        setActivePathNodeId(null);
        return;
      }

      event.preventDefault();
      setShowReturnConfirm(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activePathNodeId,
    activeSynthesisNodeId,
    showInfoPanel,
    showFilters,
    showExportMenu,
    showReturnConfirm,
  ]);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  return (
    <div className="crawl-results-canvas">
      {/* Top Floating Control Toolbar */}
      <header className="crawl-results-header overlay-interactive">
        <div className="crawl-header-main">
          <div className="crawl-header-title-group">
            <div className="crawl-header-query">
              <Compass size={16} className="crawl-icon" aria-hidden="true" />
              <strong>{crawlResults.queryText}</strong>
              <button
                type="button"
                className={`icon-button crawl-info-btn ${showInfoPanel ? 'active' : ''}`}
                onClick={() => setShowInfoPanel(!showInfoPanel)}
                title="Query & traversal details"
                aria-label="Query details"
              >
                <Info size={14} />
              </button>
            </div>
            {isStreaming ? (
              <span
                className="crawl-streaming-pill"
                role="status"
                aria-live="polite"
              >
                <Sparkles
                  size={11}
                  className="streaming-pulse"
                  aria-hidden="true"
                />
                <span>
                  {t('streamingHop', {
                    level:
                      crawlStepProgress?.level ?? crawlResults.maxLevelReached,
                  })}
                </span>
                {crawlStepProgress?.matchesCount !== undefined ? (
                  <span className="stream-count-tag">
                    · {crawlStepProgress.matchesCount} matches
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>

          {/* Comparative Diff View Switcher */}
          {isComparative ? (
            <div
              className="diff-view-switcher"
              role="group"
              aria-label="Comparative View Mode"
            >
              <button
                type="button"
                className={`diff-switch-btn ${viewMode === 'single' ? 'active' : ''}`}
                onClick={() => setViewMode('single')}
              >
                Single Focus
              </button>
              <button
                type="button"
                className={`diff-switch-btn ${viewMode === 'unified' ? 'active' : ''}`}
                onClick={() => setViewMode('unified')}
              >
                {t('unifiedFlowView')}
              </button>
              <button
                type="button"
                className={`diff-switch-btn ${viewMode === 'split' ? 'active' : ''}`}
                onClick={() => setViewMode('split')}
              >
                {t('splitDiffView')}
              </button>
            </div>
          ) : null}

          {/* Exploration Summary Breakdown Pills: Seed, Digs, Links, Jumps */}
          <div
            className="crawl-summary-pills-row"
            role="region"
            aria-label="Crawl summary"
          >
            {crawlResults.stats?.seedTitle ? (
              <span
                className="crawl-summary-pill pill-seed"
                title={`Seed node: ${crawlResults.stats.seedTitle}`}
              >
                <span className="pill-dot is-seed" />
                <span className="pill-label">{t('matchTypeSeed')}:</span>
                <strong className="pill-value">
                  {crawlResults.stats.seedTitle}
                </strong>
              </span>
            ) : null}
            <span
              className="crawl-summary-pill pill-dig"
              title={`${crawlResults.stats?.digsCount ?? crawlResults.nodes.filter((n) => n.matchType === 'dig').length} digs extending topic details`}
            >
              <span className="pill-dot is-dig" />
              <span className="pill-label">{t('crawlDigs')}:</span>
              <strong className="pill-value">
                {crawlResults.stats?.digsCount ??
                  crawlResults.nodes.filter((n) => n.matchType === 'dig')
                    .length}
              </strong>
            </span>
            <span
              className="crawl-summary-pill pill-link"
              title={`${crawlResults.stats?.linksCount ?? crawlResults.nodes.filter((n) => n.matchType === 'link').length} links connecting perspectives`}
            >
              <span className="pill-dot is-link" />
              <span className="pill-label">{t('crawlLinks')}:</span>
              <strong className="pill-value">
                {crawlResults.stats?.linksCount ??
                  crawlResults.nodes.filter((n) => n.matchType === 'link')
                    .length}
              </strong>
            </span>
            <span
              className="crawl-summary-pill pill-jump"
              title={`${crawlResults.stats?.jumpsCount ?? crawlResults.nodes.filter((n) => n.matchType === 'jump').length} jumps transitioning across topics`}
            >
              <span className="pill-dot is-jump" />
              <span className="pill-label">{t('crawlJumps')}:</span>
              <strong className="pill-value">
                {crawlResults.stats?.jumpsCount ??
                  crawlResults.nodes.filter((n) => n.matchType === 'jump')
                    .length}
              </strong>
            </span>
            <span className="crawl-summary-pill pill-total">
              <strong className="pill-value">
                {crawlResults.totalMatches} matches
              </strong>
              <span className="pill-sub">
                · Hop {crawlResults.maxLevelReached}
              </span>
            </span>
          </div>

          {/* Active Trail Spotlight Indicator */}
          {activeTargetNode ? (
            <div
              className="crawl-active-trail-chip"
              title="Active Traversal Path Focus"
            >
              <Sparkles
                size={12}
                className="trail-sparkle-icon"
                aria-hidden="true"
              />
              <span className="trail-focus-text">
                Trail: <strong>{activeTargetNode.nodeTitle}</strong> (
                {associatedPath.nodeIds.size} nodes)
              </span>
              <button
                type="button"
                className="trail-clear-btn"
                onClick={() => setActivePathNodeId(null)}
                title="Clear trail focus"
                aria-label="Clear trail focus"
              >
                <X size={11} />
              </button>
            </div>
          ) : null}

          {/* Active Keyword Filter Indicator */}
          {selectedKeywordFilters.size > 0 ? (
            <div
              className="crawl-active-keyword-chip"
              title={`Filtered by concepts: ${Array.from(selectedKeywordFilters).join(', ')}`}
            >
              <Sparkles
                size={12}
                className="keyword-chip-icon"
                aria-hidden="true"
              />
              <span className="keyword-chip-text">
                Keywords ({selectedKeywordFilters.size}):{' '}
                <strong>
                  {Array.from(selectedKeywordFilters).slice(0, 3).join(', ')}
                  {selectedKeywordFilters.size > 3 ? '...' : ''}
                </strong>
              </span>
              <button
                type="button"
                className="trail-clear-btn"
                onClick={clearKeywordFilters}
                title="Clear keyword filters"
                aria-label="Clear keyword filters"
              >
                <X size={11} />
              </button>
            </div>
          ) : null}

          {/* Interactive Traversal Filter Toggle */}
          <button
            type="button"
            className={`command-button crawl-filter-toggle-btn ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Filter traversal hops & hypotheses"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={13} />
            <span>{t('filterTraversal')}</span>
            {hasActiveFilters ? (
              <span
                className="active-filter-indicator-dot"
                title="Filters currently applied"
              />
            ) : null}
          </button>

          {/* Multi-Format Export Dropdown */}
          <div className="crawl-export-dropdown-wrap" ref={exportMenuRef}>
            <button
              type="button"
              className={`command-button crawl-export-btn ${showExportMenu ? 'active' : ''}`}
              onClick={() => setShowExportMenu(!showExportMenu)}
              title={t('exportCrawlReport')}
              aria-expanded={showExportMenu}
              aria-haspopup="true"
            >
              <Download size={13} />
              <span>Export Trail</span>
            </button>
            {showExportMenu ? (
              <div
                className="crawl-export-menu"
                role="menu"
                aria-label={t('exportTrailFormat')}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="crawl-export-menu-item"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExportTrail();
                  }}
                  title={t('exportMarkdownDesc')}
                >
                  <FileText size={14} className="export-item-icon" />
                  <div className="export-item-content">
                    <span className="export-item-title">
                      {t('exportMarkdown')}
                    </span>
                    <span className="export-item-desc">
                      {t('exportMarkdownDesc')}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="crawl-export-menu-item"
                  onClick={() => {
                    setShowExportMenu(false);
                    handleExportObsidianCanvas();
                  }}
                  title={t('exportObsidianCanvasDesc')}
                >
                  <Layers size={14} className="export-item-icon" />
                  <div className="export-item-content">
                    <span className="export-item-title">
                      {t('exportObsidianCanvas')}
                    </span>
                    <span className="export-item-desc">
                      {t('exportObsidianCanvasDesc')}
                    </span>
                  </div>
                </button>
              </div>
            ) : null}
          </div>

          {isStreaming && onCancel && (
            <button
              type="button"
              className="command-button crawl-cancel-btn"
              onClick={onCancel}
              title="Stop active crawl"
              style={{
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.4)',
              }}
            >
              <X size={13} />
              <span>Stop Crawl</span>
            </button>
          )}

          {/* Simple Cross Button to Exit Crawl View */}
          <button
            type="button"
            className="icon-button crawl-close-btn"
            onClick={() => {
              if (isStreaming) {
                onCancel?.();
              }
              onClose();
            }}
            title={t('exitCrawlView')}
            aria-label={t('exitCrawlView')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Query & Traversal Details Info Popover */}
        {showInfoPanel ? (
          <div
            className="crawl-info-popover"
            role="dialog"
            aria-label="Query Details"
          >
            <div className="crawl-info-header">
              <div className="crawl-info-title">
                <Info
                  size={14}
                  className="crawl-info-icon"
                  aria-hidden="true"
                />
                <strong>Query & Crawl Details</strong>
              </div>
              <button
                type="button"
                className="crawl-info-close"
                onClick={() => setShowInfoPanel(false)}
                aria-label="Close info"
              >
                <X size={13} />
              </button>
            </div>
            <div className="crawl-info-body">
              <div className="crawl-info-row">
                <span className="crawl-info-label">Query:</span>
                <span className="crawl-info-val" title={crawlResults.queryText}>
                  {crawlResults.queryText}
                </span>
              </div>
              <div className="crawl-info-row">
                <span className="crawl-info-label">Direction:</span>
                <span className="crawl-info-val">{crawlResults.direction}</span>
              </div>
              <div className="crawl-info-row">
                <span className="crawl-info-label">Depth:</span>
                <span className="crawl-info-val">
                  {crawlResults.crawlDepth}
                </span>
              </div>
              <div className="crawl-info-row">
                <span className="crawl-info-label">Levels:</span>
                <span className="crawl-info-val">
                  {crawlResults.maxLevelReached + 1}
                </span>
              </div>
              <div className="crawl-info-row">
                <span className="crawl-info-label">Matches:</span>
                <span className="crawl-info-val">
                  {survivingNodes.length}
                  {hasActiveFilters ? ` / ${crawlResults.totalMatches}` : ''}
                </span>
              </div>
              {isStreaming ? (
                <div className="crawl-info-row">
                  <span className="crawl-info-label">Status:</span>
                  <span className="crawl-info-val streaming">
                    Live Streaming (Hop {crawlResults.maxLevelReached})
                  </span>
                </div>
              ) : null}
              {crawlResults.stats?.seedTitle ? (
                <div className="crawl-info-row">
                  <span className="crawl-info-label">Seed Topic:</span>
                  <span className="crawl-info-val">
                    {crawlResults.stats.seedTitle}
                  </span>
                </div>
              ) : null}
              <div className="crawl-info-row">
                <span className="crawl-info-label">Digs:</span>
                <span className="crawl-info-val">
                  {crawlResults.stats?.digsCount ??
                    crawlResults.nodes.filter((n) => n.matchType === 'dig')
                      .length}{' '}
                  detail matches
                </span>
              </div>
              <div className="crawl-info-row">
                <span className="crawl-info-label">Links:</span>
                <span className="crawl-info-val">
                  {crawlResults.stats?.linksCount ??
                    crawlResults.nodes.filter((n) => n.matchType === 'link')
                      .length}{' '}
                  perspective connections
                </span>
              </div>
              <div className="crawl-info-row">
                <span className="crawl-info-label">Jumps:</span>
                <span className="crawl-info-val">
                  {crawlResults.stats?.jumpsCount ??
                    crawlResults.nodes.filter((n) => n.matchType === 'jump')
                      .length}{' '}
                  topic transitions
                </span>
              </div>
              {isComparative ? (
                <div className="crawl-info-row">
                  <span className="crawl-info-label">Comparative:</span>
                  <span className="crawl-info-val">
                    {activeGroups.length > 0 ? activeGroups.length : 2}{' '}
                    hypotheses,{' '}
                    {
                      survivingNodes.filter(
                        (n) => n.groupOrigin === 'intersection',
                      ).length
                    }{' '}
                    convergence points
                  </span>
                </div>
              ) : null}
              {collapsedSubtreeNodeIds.size > 0 ? (
                <div className="crawl-info-row">
                  <span className="crawl-info-label">Collapsed:</span>
                  <span className="crawl-info-val">
                    {collapsedSubtreeNodeIds.size} branch
                    {collapsedSubtreeNodeIds.size > 1 ? 'es' : ''}
                  </span>
                </div>
              ) : null}
              {crawlResults.summary ? (
                <div className="crawl-info-row">
                  <span className="crawl-info-label">Summary:</span>
                  <span className="crawl-info-val">{crawlResults.summary}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Expandable Traversal Filter Drawer */}
        {showFilters ? (
          <div
            className="crawl-filter-panel"
            aria-label="Crawl traversal filters"
          >
            <div className="crawl-filter-header">
              <div className="filter-title-wrap">
                <SlidersHorizontal size={13} className="filter-panel-icon" />
                <span>Interactive Traversal Filtering</span>
                {hasActiveFilters ? (
                  <span className="filter-active-pill">Active Filters</span>
                ) : null}
              </div>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="filter-reset-btn"
                  onClick={handleResetFilters}
                  title="Reset all traversal filters"
                >
                  <RotateCcw size={11} />
                  <span>{t('resetFilters')}</span>
                </button>
              ) : null}
            </div>

            <div className="crawl-filter-controls">
              {/* Frontier Depth Expansion Controls */}
              {crawlResults.maxLevelReached > 0 ? (
                <div className="filter-control-item full-width">
                  <div className="filter-control-label-row">
                    <span className="filter-label">Frontier Depth</span>
                  </div>
                  <div
                    className="crawl-depth-pills-group"
                    role="group"
                    aria-label="Filter crawl frontier depth"
                  >
                    <button
                      type="button"
                      className={`depth-pill-btn ${
                        maxVisibleLevel === crawlResults.maxLevelReached
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        setMaxVisibleLevel(crawlResults.maxLevelReached)
                      }
                      title="Display all crawl levels"
                    >
                      All Hops
                    </button>
                    {Array.from(
                      { length: crawlResults.maxLevelReached + 1 },
                      (_, lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          className={`depth-pill-btn ${
                            maxVisibleLevel === lvl ? 'active' : ''
                          }`}
                          onClick={() => setMaxVisibleLevel(lvl)}
                          title={`Show up to ${lvl === 0 ? 'Seed nodes' : `Hop ${lvl}`}`}
                        >
                          {lvl === 0 ? 'Seeds' : `Hop ${lvl}`}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              {/* Match Classification Filter Pills */}
              <div className="filter-control-item full-width">
                <div className="filter-control-label-row">
                  <span className="filter-label">
                    {t('matchClassification', 'Match Classification')}
                  </span>
                  {selectedMatchTypeFilters.size < ALL_MATCH_TYPES.length ? (
                    <span className="filter-count-badge">
                      ({selectedMatchTypeFilters.size} /{' '}
                      {ALL_MATCH_TYPES.length})
                    </span>
                  ) : null}
                </div>
                <div
                  className="match-type-filter-pills"
                  role="group"
                  aria-label="Filter by crawl match classification"
                >
                  {ALL_MATCH_TYPES.map((type) => {
                    const isSelected = selectedMatchTypeFilters.has(type);
                    const config = MATCH_TYPE_META[type];
                    const count = matchTypeCounts[type];
                    const label = t(config.labelKey, config.defaultLabel);
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-label={`Toggle ${label} (${count})`}
                        className={`match-type-filter-pill ${isSelected ? 'active' : 'inactive'}`}
                        style={{
                          borderColor: isSelected
                            ? config.color
                            : 'var(--line-soft)',
                          backgroundColor: isSelected
                            ? `${config.color}22`
                            : 'transparent',
                          color: isSelected ? config.color : 'var(--muted)',
                        }}
                        onClick={() => toggleMatchTypeFilter(type)}
                        title={`Toggle ${label} visibility`}
                      >
                        <span
                          className="match-type-dot"
                          style={{ backgroundColor: config.color }}
                        />
                        <span>{label}</span>
                        <span className="match-type-count">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minimum Relevance / Rerank Score Slider */}
              <div className="filter-control-item">
                <div className="filter-control-label-row">
                  <span className="filter-label">{t('minScore')}</span>
                  <span className="filter-value-badge">
                    {Math.round(minScore * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={minScore}
                  onChange={(e) => setMinScore(parseFloat(e.target.value))}
                  className="filter-slider"
                  aria-label={t('minScore')}
                />
                <div className="slider-range-labels">
                  <span>0% (All)</span>
                  <span>50%</span>
                  <span>100% (Strict)</span>
                </div>
              </div>

              {/* Maximum Hop Depth Slider */}
              <div className="filter-control-item">
                <div className="filter-control-label-row">
                  <span className="filter-label">{t('maxHopDepth')}</span>
                  <span className="filter-value-badge">
                    {maxVisibleLevel === 0
                      ? 'Level 0 (Seeds only)'
                      : `Level ${maxVisibleLevel}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(crawlResults.maxLevelReached, 1)}
                  step={1}
                  value={maxVisibleLevel}
                  onChange={(e) =>
                    setMaxVisibleLevel(parseInt(e.target.value, 10))
                  }
                  className="filter-slider"
                  aria-label={t('maxHopDepth')}
                />
                <div className="slider-range-labels">
                  <span>Level 0</span>
                  <span>Hop {crawlResults.maxLevelReached}</span>
                </div>
              </div>

              {/* Hypothesis Branch Toggles (if comparative) */}
              {isComparative && activeGroups.length > 0 ? (
                <div className="filter-control-item full-width">
                  <div className="filter-control-label-row">
                    <span className="filter-label">
                      {t('hypothesisBranches')}
                    </span>
                  </div>
                  <div className="hypothesis-filter-pills">
                    {activeGroups.map((group) => {
                      const isSelected = selectedGroupFilters.has(group.id);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          aria-label={`Toggle ${group.name}`}
                          className={`hypothesis-filter-pill ${isSelected ? 'active' : 'inactive'}`}
                          style={{
                            borderColor: isSelected
                              ? group.color
                              : 'var(--line-soft)',
                            backgroundColor: isSelected
                              ? `${group.color}22`
                              : 'transparent',
                            color: isSelected ? group.color : 'var(--muted)',
                          }}
                          onClick={() => toggleGroupFilter(group.id)}
                          title={`Toggle ${group.name} visibility`}
                        >
                          <span
                            className="hypothesis-dot"
                            style={{ backgroundColor: group.color }}
                          />
                          <span>{group.name}</span>
                          <span className="hypothesis-count">
                            {group.count}
                          </span>
                        </button>
                      );
                    })}
                    {/* Convergence Toggle */}
                    <button
                      type="button"
                      aria-label="Toggle Convergence Points"
                      className={`hypothesis-filter-pill ${selectedGroupFilters.has('intersection') ? 'active' : 'inactive'}`}
                      style={{
                        borderColor: selectedGroupFilters.has('intersection')
                          ? '#10b981'
                          : 'var(--line-soft)',
                        backgroundColor: selectedGroupFilters.has(
                          'intersection',
                        )
                          ? '#10b98122'
                          : 'transparent',
                        color: selectedGroupFilters.has('intersection')
                          ? '#10b981'
                          : 'var(--muted)',
                      }}
                      onClick={() => toggleGroupFilter('intersection')}
                      title="Toggle Convergence Points visibility"
                    >
                      <GitCompare size={11} style={{ marginRight: 3 }} />
                      {t('convergencePoints')}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Edge Keyword & Concept Multiselect Filter */}
              {availableSharedKeywords.length > 0 ? (
                <div className="filter-control-item full-width">
                  <div className="filter-control-label-row">
                    <span className="filter-label">
                      {t('edgeKeywords', 'Edge Keywords & Concepts')}
                      {selectedKeywordFilters.size > 0 ? (
                        <span className="filter-count-badge">
                          ({selectedKeywordFilters.size} selected)
                        </span>
                      ) : null}
                    </span>
                    {selectedKeywordFilters.size > 0 ? (
                      <button
                        type="button"
                        className="filter-reset-btn"
                        onClick={clearKeywordFilters}
                        title="Clear all keyword filters"
                      >
                        Clear All
                      </button>
                    ) : null}
                  </div>
                  <div className="keyword-filter-pills">
                    {availableSharedKeywords.map(({ keyword, count }) => {
                      const isSelected = selectedKeywordFilters.has(keyword);
                      return (
                        <button
                          key={keyword}
                          type="button"
                          className={`keyword-filter-pill ${isSelected ? 'active' : ''}`}
                          onClick={() => toggleKeywordFilter(keyword)}
                          title={`Filter branches by keyword "${keyword}" (${count} edge${count > 1 ? 's' : ''})`}
                        >
                          <span>{keyword}</span>
                          <span className="keyword-count-badge">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Filter Results Stats Bar */}
            <div className="crawl-filter-stats-bar">
              <span>
                Showing {survivingNodes.length} of {crawlResults.totalMatches}{' '}
                nodes
                {orphanPrunedCount > 0 ? (
                  <em className="orphan-pruned-note">
                    {' '}
                    ({orphanPrunedCount} disconnected orphan
                    {orphanPrunedCount === 1 ? '' : 's'} pruned)
                  </em>
                ) : null}
              </span>
            </div>
          </div>
        ) : null}

        {/* Return to Canvas Confirmation Modal */}
        {showReturnConfirm ? (
          <div
            className="crawl-confirm-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-canvas-dialog-title"
          >
            <div className="crawl-confirm-card">
              <div className="crawl-confirm-header">
                <Compass size={18} className="crawl-icon" aria-hidden="true" />
                <h3 id="return-canvas-dialog-title">Return to Canvas?</h3>
              </div>
              <p className="crawl-confirm-message">
                Do you want to exit crawl results view and return to the main
                graph canvas?
              </p>
              <div className="crawl-confirm-actions">
                <button
                  type="button"
                  className="command-button"
                  onClick={() => setShowReturnConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="command-button accent"
                  onClick={() => {
                    setShowReturnConfirm(false);
                    onClose();
                  }}
                >
                  Return to Canvas
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* On-Demand Subtree Narrative Synthesis Overlay */}
        {activeSynthesis ? (
          <div
            className="crawl-synthesis-overlay"
            role="dialog"
            aria-label={`Subtree Synthesis for ${activeSynthesis.rootTitle}`}
          >
            <div className="crawl-synthesis-card">
              <div className="synthesis-card-header">
                <div className="synthesis-title-row">
                  <Sparkles
                    size={15}
                    className="synthesis-header-icon"
                    aria-hidden="true"
                  />
                  <h3 className="synthesis-heading">
                    Subtree Synthesis: {activeSynthesis.rootTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  className="synthesis-close-btn"
                  onClick={() => setActiveSynthesisNodeId(null)}
                  title="Close synthesis"
                  aria-label="Close synthesis"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="synthesis-meta-bar">
                <span className="synthesis-meta-pill">
                  {activeSynthesis.totalNodes} node
                  {activeSynthesis.totalNodes === 1 ? '' : 's'}
                </span>
                <span className="synthesis-meta-pill">
                  {activeSynthesis.totalHops} hop
                  {activeSynthesis.totalHops === 1 ? '' : 's'}
                </span>
                <span className="synthesis-meta-pill similarity">
                  {Math.round(activeSynthesis.averageSimilarity * 100)}% Avg Sim
                </span>
              </div>

              {activeSynthesis.topicTrajectory.length > 1 ? (
                <div className="synthesis-trajectory-row">
                  <span className="synthesis-section-label">Trajectory:</span>
                  <div className="synthesis-trajectory-flow">
                    {activeSynthesis.topicTrajectory.map((title, idx) => (
                      <span key={title} className="trajectory-step-wrap">
                        <span className="trajectory-step-pill">{title}</span>
                        {idx < activeSynthesis.topicTrajectory.length - 1 ? (
                          <span className="trajectory-arrow">→</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeSynthesis.sharedThemes.length > 0 ? (
                <div className="synthesis-themes-row">
                  <span className="synthesis-section-label">Themes:</span>
                  <div className="synthesis-theme-tags">
                    {activeSynthesis.sharedThemes.map((kw) => (
                      <span key={kw} className="synthesis-theme-tag">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="synthesis-narrative-section">
                <span className="synthesis-section-label">
                  Narrative Summary:
                </span>
                <p className="synthesis-narrative-text">
                  {activeSynthesis.narrative}
                </p>
              </div>

              <div className="synthesis-evidence-section">
                <span className="synthesis-section-label">
                  Key Evidence ({activeSynthesis.keyTakeaways.length}):
                </span>
                <div className="synthesis-takeaways-list">
                  {activeSynthesis.keyTakeaways.map((takeaway) => (
                    <div
                      key={takeaway.nodeId}
                      className="synthesis-takeaway-item"
                    >
                      <div className="takeaway-header">
                        <strong>{takeaway.title}</strong>
                        <span className="takeaway-source">
                          {takeaway.sourceName}
                          {takeaway.pageNum ? ` (p. ${takeaway.pageNum})` : ''}
                        </span>
                        <span className="takeaway-score">
                          {Math.round(takeaway.score * 100)}%
                        </span>
                      </div>
                      <p className="takeaway-snippet">{takeaway.snippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/* Directed Hierarchical Flow Canvas */}
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={1.8}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        onPaneClick={() => setActivePathNodeId(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="var(--line-soft)"
        />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}

export function CrawlResultsCanvas(props: CrawlResultsCanvasProps) {
  return (
    <ReactFlowProvider>
      <CrawlResultsCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
