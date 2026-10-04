import type { GraphVocabularyItem } from '../types/api';

export interface ConceptCluster {
  id: string;
  name: string;
  summaryTerm: string;
  terms: GraphVocabularyItem[];
  nodeIds: string[];
  totalWeight: number;
  suggestedQueries: string[];
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
]);

/**
 * Extracts significant tokens (length >= 3, non-stopwords) from a vocabulary term.
 */
export function extractSignificantTokens(term: string): Set<string> {
  const words = term
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Checks whether two vocabulary items belong to the same semantic concept cluster.
 */
function areRelated(
  a: GraphVocabularyItem,
  b: GraphVocabularyItem,
  tokensA: Set<string>,
  tokensB: Set<string>,
): boolean {
  // Check token intersection
  let sharedTokensCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      sharedTokensCount++;
    }
  }

  // Check node intersection
  let sharedNodesCount = 0;
  const nodesB = new Set(b.nodeIds || []);
  for (const nid of a.nodeIds || []) {
    if (nodesB.has(nid)) {
      sharedNodesCount++;
    }
  }

  // Strong token overlap: 2 or more shared significant tokens
  if (sharedTokensCount >= 2) {
    return true;
  }

  // Hybrid match: shared 1 token AND co-occurring on at least 1 node
  if (sharedTokensCount >= 1 && sharedNodesCount >= 1) {
    return true;
  }

  // Shared acronym or exact prefix match
  if (
    tokensA.size > 0 &&
    tokensB.size > 0 &&
    [...tokensA][0] === [...tokensB][0] &&
    sharedNodesCount >= 1
  ) {
    return true;
  }

  return false;
}

/**
 * Clusters a list of vocabulary items into thematic concept groups.
 */
export function buildConceptClusters(
  items: GraphVocabularyItem[],
  maxClusters = 12,
): ConceptCluster[] {
  if (!items || items.length === 0) {
    return [];
  }

  // Pre-extract tokens
  const tokenMap = new Map<GraphVocabularyItem, Set<string>>();
  for (const item of items) {
    tokenMap.set(item, extractSignificantTokens(item.term));
  }

  // Disjoint set / component union
  const parent = new Map<number, number>();
  function find(i: number): number {
    let root = i;
    while ((parent.get(root) ?? root) !== root) {
      root = parent.get(root)!;
    }
    let curr = i;
    while (curr !== root) {
      const next = parent.get(curr) ?? curr;
      parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  function union(i: number, j: number): void {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent.set(rootJ, rootI);
    }
  }

  for (let i = 0; i < items.length; i++) {
    parent.set(i, i);
  }

  for (let i = 0; i < items.length; i++) {
    const itemA = items[i]!;
    const tokensA = tokenMap.get(itemA)!;
    for (let j = i + 1; j < items.length; j++) {
      const itemB = items[j]!;
      const tokensB = tokenMap.get(itemB)!;
      if (areRelated(itemA, itemB, tokensA, tokensB)) {
        union(i, j);
      }
    }
  }

  // Group by root index
  const groupMap = new Map<number, GraphVocabularyItem[]>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    const list = groupMap.get(root) ?? [];
    list.push(items[i]!);
    groupMap.set(root, list);
  }

  const clusters: ConceptCluster[] = [];
  let clusterIndex = 0;

  for (const groupItems of groupMap.values()) {
    // Sort terms within cluster by weight descending
    groupItems.sort((a, b) => b.weight - a.weight);

    const summaryTerm = groupItems[0]!.term;
    const nodeIdsSet = new Set<string>();
    let totalWeight = 0;

    for (const term of groupItems) {
      totalWeight += term.weight;
      for (const nid of term.nodeIds || []) {
        nodeIdsSet.add(nid);
      }
    }

    const nodeIds = [...nodeIdsSet];

    // Generate suggested query jumps for this cluster
    const suggestedQueries: string[] = [];
    if (groupItems.length >= 2) {
      suggestedQueries.push(
        `${groupItems[0]!.term} and ${groupItems[1]!.term}`,
      );
      suggestedQueries.push(
        `Compare ${groupItems[0]!.term} with ${groupItems[1]!.term}`,
      );
    } else {
      suggestedQueries.push(`Overview of ${summaryTerm}`);
      suggestedQueries.push(`${summaryTerm} architecture`);
    }

    clusters.push({
      id: `cluster-${++clusterIndex}`,
      name: summaryTerm,
      summaryTerm,
      terms: groupItems,
      nodeIds,
      totalWeight,
      suggestedQueries,
    });
  }

  // Sort clusters by total weight descending
  clusters.sort((a, b) => b.totalWeight - a.totalWeight);

  return clusters.slice(0, maxClusters);
}

/**
 * Filters vocabulary items by query string and optional sourceType category.
 */
export function filterVocabulary(
  items: GraphVocabularyItem[],
  params: {
    query?: string;
    sourceType?: string;
    nodeIds?: string[];
  },
): GraphVocabularyItem[] {
  const { query, sourceType, nodeIds } = params;
  const normalizedQuery = query?.trim().toLowerCase() || '';
  const nodeSet = nodeIds && nodeIds.length > 0 ? new Set(nodeIds) : null;

  return items.filter((item) => {
    if (
      normalizedQuery &&
      !item.normalized.includes(normalizedQuery) &&
      !item.term.toLowerCase().includes(normalizedQuery)
    ) {
      return false;
    }

    if (sourceType && sourceType !== 'all' && item.sourceType !== sourceType) {
      return false;
    }

    if (nodeSet && !item.nodeIds.some((nid) => nodeSet.has(nid))) {
      return false;
    }

    return true;
  });
}

/**
 * Calculates a relative pill font size scale based on item weight in the set.
 */
export function calculateCloudWeightScale(
  weight: number,
  minWeight: number,
  maxWeight: number,
): 'xs' | 'sm' | 'md' | 'lg' | 'xl' {
  if (maxWeight <= minWeight) {
    return 'md';
  }
  const ratio = (weight - minWeight) / (maxWeight - minWeight);
  if (ratio > 0.8) return 'xl';
  if (ratio > 0.6) return 'lg';
  if (ratio > 0.4) return 'md';
  if (ratio > 0.2) return 'sm';
  return 'xs';
}
