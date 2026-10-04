import type {
  ComparativeGroupSummary,
  CrawlEdge,
  CrawlNode,
  CrawlResponse,
  SearchChunk,
  SearchResponse,
} from '../types/api';

/**
 * Extracts and deduplicates search chunks for a specific source ID
 * to be highlighted within the source viewer dialog, supporting both
 * simple search responses and topological crawl responses.
 */
export function getSourceMatches(
  results?: SearchResponse,
  activeSourceId?: string,
  crawlResults?: CrawlResponse,
): SearchChunk[] {
  if (!activeSourceId) return [];

  const chunks: SearchChunk[] = [];

  if (crawlResults?.nodes?.length) {
    for (const node of crawlResults.nodes) {
      if (node?.chunk && node.chunk.sourceId === activeSourceId) {
        chunks.push(node.chunk);
      }
    }
  }

  if (results?.results?.length) {
    for (const res of results.results) {
      if (Array.isArray(res?.chunks)) {
        for (const chunk of res.chunks) {
          if (chunk && chunk.sourceId === activeSourceId) {
            chunks.push(chunk);
          }
        }
      }
    }
  }

  const unique = new Map<string, SearchChunk>();
  for (const chunk of chunks) {
    const key = `${chunk.sourceId}:${chunk.startChar ?? 0}:${chunk.endChar ?? 0}:${chunk.chunkId ?? ''}`;
    if (!unique.has(key)) {
      unique.set(key, chunk);
    }
  }
  return [...unique.values()];
}

/**
 * Calculates search space multiplier dynamically:
 * Multiplier = log10(max(selectedNodeCount, 1)) / divisor + 1.0
 */
export function calculateSearchSpaceMultiplier(
  selectedNodeCount: number,
  divisor = 10.0,
): number {
  const x = Math.max(selectedNodeCount, 1);
  const div = divisor > 0 ? divisor : 10.0;
  const raw = Math.log10(x) / div + 1.0;
  return Number(Math.max(1.0, raw).toFixed(2));
}

export interface ScoreHistogramBin {
  binIndex: number;
  min: number;
  max: number;
  count: number;
}

/**
 * Computes a histogram of relevance confidence scores across [0, 1].
 * Defaults to 10 equal-width bins (0.0-0.1, 0.1-0.2, ..., 0.9-1.0).
 */
export function computeScoreHistogram(
  scores: number[],
  binCount = 10,
): ScoreHistogramBin[] {
  const safeBinCount = Math.max(1, binCount);
  const bins: ScoreHistogramBin[] = Array.from(
    { length: safeBinCount },
    (_, i) => ({
      binIndex: i,
      min: Number((i / safeBinCount).toFixed(3)),
      max: Number(((i + 1) / safeBinCount).toFixed(3)),
      count: 0,
    }),
  );

  for (const rawScore of scores) {
    if (typeof rawScore !== 'number' || Number.isNaN(rawScore)) continue;
    const clamped = Math.max(0, Math.min(1, rawScore));
    const index = Math.min(
      Math.floor(clamped * safeBinCount),
      safeBinCount - 1,
    );
    const targetBin = bins[index];
    if (targetBin) {
      targetBin.count += 1;
    }
  }

  return bins;
}

/**
 * Computes information-theoretic Graph Entropy H_G in [0, 1] for a set of crawl nodes and edges.
 * Modeled after Shannon Entropy in decision tree induction (information purity):
 * - H_node: Normalized Shannon entropy over the node relevance/similarity probability distribution.
 * - H_edge: Normalized Shannon entropy over the edge transition similarity weights.
 * Lower entropy indicates high cohesion and sharp semantic focus (fewer ambiguous/dispersed branches).
 */
export function computeGraphEntropy(
  nodes: CrawlNode[],
  edges: CrawlEdge[] = [],
): number {
  if (!nodes || nodes.length <= 1) {
    return 0;
  }

  // 1. Node relevance / similarity distribution
  const nodeScores = nodes.map((n) =>
    Math.max(n.rerankScore ?? n.score ?? 0.1, 0.001),
  );
  const sumScores = nodeScores.reduce((acc, s) => acc + s, 0);

  let nodeEntropy = 0;
  if (sumScores > 0) {
    for (const s of nodeScores) {
      const p = s / sumScores;
      if (p > 0) {
        nodeEntropy -= p * Math.log2(p);
      }
    }
  }

  const maxNodeEntropy = Math.log2(nodes.length);
  const normalizedNodeEntropy =
    maxNodeEntropy > 0 ? nodeEntropy / maxNodeEntropy : 0;

  // 2. Edge transition similarity distribution
  let normalizedEdgeEntropy = 0;
  if (edges && edges.length > 1) {
    const edgeWeights = edges.map((e) =>
      Math.max(e.similarityScore ?? 0.5, 0.001),
    );
    const sumWeights = edgeWeights.reduce((acc, w) => acc + w, 0);
    let edgeEntropy = 0;
    if (sumWeights > 0) {
      for (const w of edgeWeights) {
        const q = w / sumWeights;
        if (q > 0) {
          edgeEntropy -= q * Math.log2(q);
        }
      }
    }
    const maxEdgeEntropy = Math.log2(edges.length);
    normalizedEdgeEntropy =
      maxEdgeEntropy > 0 ? edgeEntropy / maxEdgeEntropy : 0;
  }

  const combined =
    edges && edges.length > 1
      ? 0.6 * normalizedNodeEntropy + 0.4 * normalizedEdgeEntropy
      : normalizedNodeEntropy;

  return Math.round(combined * 1000) / 1000;
}

/**
 * Computes the branch entropy H_branch in [0, 1] along an exploratory crawl path
 * from seed node v_0 to candidate leaf v_k.
 *
 * Models cumulative Markov transition cohesion and topic dissipation:
 * - C_trans: Weighted edge similarity along the branch path (70% mean, 30% bottleneck minimum).
 * - s_candidate: Relevance score of the latest frontier candidate.
 * - delta_s: Semantic decay relative to seed node match.
 */
export function computeBranchEntropy(
  pathNodes: CrawlNode[],
  pathEdges: CrawlEdge[] = [],
): number {
  if (!pathNodes || pathNodes.length <= 1) {
    return 0;
  }

  const latestNode = pathNodes[pathNodes.length - 1]!;
  const seedNode = pathNodes[0]!;

  const candidateScore = Math.max(
    0.01,
    Math.min(1.0, latestNode.rerankScore ?? latestNode.score ?? 0.5),
  );
  const seedScore = Math.max(
    0.01,
    Math.min(1.0, seedNode.rerankScore ?? seedNode.score ?? 0.8),
  );

  let transitionCohesion = 1.0;
  if (pathEdges && pathEdges.length > 0) {
    const edgeSims = pathEdges.map((e) =>
      Math.max(0.01, Math.min(1.0, e.similarityScore ?? 0.5)),
    );
    const avgSim = edgeSims.reduce((sum, s) => sum + s, 0) / edgeSims.length;
    const minSim = Math.min(...edgeSims);
    transitionCohesion = 0.7 * avgSim + 0.3 * minSim;
  }

  const scoreDecay = Math.max(0, seedScore - candidateScore);
  const retainedTopicProbability = transitionCohesion * candidateScore;
  const rawEntropy = 1.0 - retainedTopicProbability + 0.15 * scoreDecay;

  const clamped = Math.max(0.0, Math.min(1.0, rawEntropy));
  return Math.round(clamped * 1000) / 1000;
}

export interface HypothesisGraphPartition {
  id: string;
  name: string;
  hypothesisId: string;
  hypothesisName: string;
  color?: string;
  nodes: CrawlNode[];
  edges: CrawlEdge[];
  entropy: number;
  entropyDelta?: number;
  avgScore: number;
  count: number;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Partitions a CrawlResponse into isolated single-hypothesis graph datasets,
 * sorted by ascending Graph Entropy (highest semantic cohesion first).
 */
export function partitionHypothesisGraphs(
  crawlResults: CrawlResponse,
): HypothesisGraphPartition[] {
  if (!crawlResults?.nodes?.length) {
    return [];
  }

  const isComparative = Boolean(crawlResults.comparative?.isComparative);
  const rawGroups: ComparativeGroupSummary[] | null =
    crawlResults.comparative?.groups &&
    crawlResults.comparative.groups.length >= 2
      ? crawlResults.comparative.groups
      : isComparative
        ? [
            {
              id: 'groupA',
              name: crawlResults.comparative?.groupA || 'Hypothesis A',
              count: crawlResults.comparative?.groupACount ?? 0,
              color: '#38bdf8',
            },
            {
              id: 'groupB',
              name: crawlResults.comparative?.groupB || 'Hypothesis B',
              count: crawlResults.comparative?.groupBCount ?? 0,
              color: '#a855f7',
            },
          ]
        : null;

  if (rawGroups && rawGroups.length > 0) {
    const partitions: HypothesisGraphPartition[] = rawGroups.map((g) => {
      // Find all nodes originating in this group
      const baseNodes = crawlResults.nodes.filter(
        (n) => n.groupOrigin === g.id || (!n.groupOrigin && g.id === 'groupA'),
      );
      const baseNodeIdSet = new Set(baseNodes.map((n) => n.id));

      // Also include intersection nodes reached by or connected to this group
      const intersectionNodes = crawlResults.nodes.filter(
        (n) =>
          n.groupOrigin === 'intersection' &&
          (n.reachedGroupIds?.includes(g.id) ||
            crawlResults.edges.some(
              (e) =>
                (e.source === n.id && baseNodeIdSet.has(e.target)) ||
                (e.target === n.id && baseNodeIdSet.has(e.source)),
            )),
      );

      const combinedNodes = [...baseNodes, ...intersectionNodes];
      const combinedNodeIdSet = new Set(combinedNodes.map((n) => n.id));

      // Edges connecting nodes within this hypothesis
      const hypothesisEdges = crawlResults.edges.filter(
        (e) =>
          combinedNodeIdSet.has(e.source) && combinedNodeIdSet.has(e.target),
      );

      const entropy =
        typeof g.entropy === 'number'
          ? g.entropy
          : computeGraphEntropy(combinedNodes, hypothesisEdges);
      const avgScore =
        typeof g.avgScore === 'number'
          ? g.avgScore
          : combinedNodes.length > 0
            ? Math.round(
                (combinedNodes.reduce(
                  (acc, n) => acc + (n.rerankScore ?? n.score ?? 0),
                  0,
                ) /
                  combinedNodes.length) *
                  1000,
              ) / 1000
            : 0;

      return {
        id: g.id,
        name: g.name,
        hypothesisId: g.id,
        hypothesisName: g.name,
        color: g.color || '#38bdf8',
        nodes: combinedNodes,
        edges: hypothesisEdges,
        entropy,
        avgScore,
        count: combinedNodes.length,
        nodeCount: combinedNodes.length,
        edgeCount: hypothesisEdges.length,
      };
    });

    // Sort by ascending Graph Entropy (lowest entropy = highest coherence first)
    // Non-empty hypotheses must always precede empty hypotheses
    partitions.sort((a, b) => {
      if (a.nodes.length > 0 && b.nodes.length === 0) return -1;
      if (a.nodes.length === 0 && b.nodes.length > 0) return 1;
      const diff = a.entropy - b.entropy;
      if (Math.abs(diff) > 0.001) return diff;
      return b.avgScore - a.avgScore;
    });

    // Compute relative entropy delta against baseline top hypothesis (partitions[0])
    const baselineEntropy = partitions[0]?.entropy ?? 0;
    for (const p of partitions) {
      p.entropyDelta = Math.round((p.entropy - baselineEntropy) * 1000) / 1000;
    }

    return partitions;
  }

  // Single / non-comparative crawl
  const entropy = computeGraphEntropy(crawlResults.nodes, crawlResults.edges);
  const avgScore =
    crawlResults.nodes.length > 0
      ? Math.round(
          (crawlResults.nodes.reduce(
            (acc, n) => acc + (n.rerankScore ?? n.score ?? 0),
            0,
          ) /
            crawlResults.nodes.length) *
            1000,
        ) / 1000
      : 0;

  return [
    {
      id: 'primary',
      name: 'Exploratory Trajectory',
      hypothesisId: 'primary',
      hypothesisName: 'Exploratory Trajectory',
      color: '#10b981',
      nodes: crawlResults.nodes,
      edges: crawlResults.edges,
      entropy,
      entropyDelta: 0,
      avgScore,
      count: crawlResults.nodes.length,
      nodeCount: crawlResults.nodes.length,
      edgeCount: crawlResults.edges.length,
    },
  ];
}
