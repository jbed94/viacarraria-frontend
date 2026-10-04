import { describe, expect, it } from 'vitest';
import type { GraphVocabularyItem } from '../types/api';
import {
  buildConceptClusters,
  calculateCloudWeightScale,
  extractSignificantTokens,
  filterVocabulary,
} from './vocabulary-clusters';

describe('vocabulary-clusters utilities', () => {
  describe('extractSignificantTokens', () => {
    it('strips stopwords and short words while keeping significant tokens', () => {
      const tokens = extractSignificantTokens(
        'The quick and resilient Consensus Protocol for Distributed Nodes',
      );
      expect(tokens.has('the')).toBe(false);
      expect(tokens.has('and')).toBe(false);
      expect(tokens.has('for')).toBe(false);
      expect(tokens.has('quick')).toBe(true);
      expect(tokens.has('resilient')).toBe(true);
      expect(tokens.has('consensus')).toBe(true);
      expect(tokens.has('protocol')).toBe(true);
      expect(tokens.has('distributed')).toBe(true);
      expect(tokens.has('nodes')).toBe(true);
    });

    it('handles punctuation and hyphenated phrases', () => {
      const tokens = extractSignificantTokens(
        'PostgreSQL-based high-availability!',
      );
      expect(tokens.has('postgresql')).toBe(true);
      expect(tokens.has('based')).toBe(true);
      expect(tokens.has('high')).toBe(true);
      expect(tokens.has('availability')).toBe(true);
    });
  });

  describe('buildConceptClusters', () => {
    it('returns empty array when input is empty', () => {
      expect(buildConceptClusters([])).toEqual([]);
    });

    it('groups terms with multiple shared significant tokens', () => {
      const items: GraphVocabularyItem[] = [
        {
          term: 'Kubernetes Cluster Architecture',
          normalized: 'kubernetes cluster architecture',
          nodeIds: ['node-1'],
          weight: 12,
          sourceType: 'heading',
        },
        {
          term: 'Kubernetes Cluster Nodes',
          normalized: 'kubernetes cluster nodes',
          nodeIds: ['node-2'],
          weight: 10,
          sourceType: 'bold',
        },
        {
          term: 'PostgreSQL Database Sharding',
          normalized: 'postgresql database sharding',
          nodeIds: ['node-3'],
          weight: 8,
          sourceType: 'heading',
        },
      ];

      const clusters = buildConceptClusters(items);
      expect(clusters.length).toBe(2);

      const k8sCluster = clusters.find((c) =>
        c.terms.some((t) => t.term === 'Kubernetes Cluster Architecture'),
      );
      expect(k8sCluster).toBeDefined();
      expect(k8sCluster!.terms.length).toBe(2);
      expect(k8sCluster!.nodeIds).toContain('node-1');
      expect(k8sCluster!.nodeIds).toContain('node-2');
      expect(k8sCluster!.suggestedQueries[0]).toBe(
        'Kubernetes Cluster Architecture and Kubernetes Cluster Nodes',
      );

      const dbCluster = clusters.find((c) =>
        c.terms.some((t) => t.term === 'PostgreSQL Database Sharding'),
      );
      expect(dbCluster).toBeDefined();
      expect(dbCluster!.terms.length).toBe(1);
      expect(dbCluster!.suggestedQueries).toContain(
        'Overview of PostgreSQL Database Sharding',
      );
    });

    it('groups terms with 1 shared token that co-occur on the same node', () => {
      const items: GraphVocabularyItem[] = [
        {
          term: 'Leader Election',
          normalized: 'leader election',
          nodeIds: ['raft-node'],
          weight: 15,
          sourceType: 'node_title',
        },
        {
          term: 'Election Timeout',
          normalized: 'election timeout',
          nodeIds: ['raft-node'],
          weight: 9,
          sourceType: 'heading',
        },
      ];

      const clusters = buildConceptClusters(items);
      expect(clusters.length).toBe(1);
      expect(clusters[0]!.terms.length).toBe(2);
      expect(clusters[0]!.nodeIds).toEqual(['raft-node']);
      expect(clusters[0]!.totalWeight).toBe(24);
    });
  });

  describe('filterVocabulary', () => {
    const sampleItems: GraphVocabularyItem[] = [
      {
        term: 'Raft Consensus',
        normalized: 'raft consensus',
        nodeIds: ['n1'],
        weight: 10,
        sourceType: 'heading',
      },
      {
        term: 'Paxos Algorithm',
        normalized: 'paxos algorithm',
        nodeIds: ['n2'],
        weight: 8,
        sourceType: 'bold',
      },
      {
        term: 'Vector Index',
        normalized: 'vector index',
        nodeIds: ['n1', 'n3'],
        weight: 14,
        sourceType: 'node_title',
      },
    ];

    it('filters by search query', () => {
      const results = filterVocabulary(sampleItems, { query: 'raft' });
      expect(results.length).toBe(1);
      expect(results[0]!.term).toBe('Raft Consensus');
    });

    it('filters by sourceType', () => {
      const results = filterVocabulary(sampleItems, {
        sourceType: 'node_title',
      });
      expect(results.length).toBe(1);
      expect(results[0]!.term).toBe('Vector Index');
    });

    it('filters by selected nodeIds', () => {
      const results = filterVocabulary(sampleItems, { nodeIds: ['n2'] });
      expect(results.length).toBe(1);
      expect(results[0]!.term).toBe('Paxos Algorithm');
    });

    it('combines multiple filters', () => {
      const results = filterVocabulary(sampleItems, {
        query: 'index',
        sourceType: 'node_title',
        nodeIds: ['n3'],
      });
      expect(results.length).toBe(1);
      expect(results[0]!.term).toBe('Vector Index');
    });
  });

  describe('calculateCloudWeightScale', () => {
    it('returns md if maxWeight equals minWeight', () => {
      expect(calculateCloudWeightScale(10, 10, 10)).toBe('md');
    });

    it('scales proportionally from xs to xl', () => {
      expect(calculateCloudWeightScale(10, 10, 100)).toBe('xs');
      expect(calculateCloudWeightScale(30, 10, 100)).toBe('sm');
      expect(calculateCloudWeightScale(50, 10, 100)).toBe('md');
      expect(calculateCloudWeightScale(75, 10, 100)).toBe('lg');
      expect(calculateCloudWeightScale(95, 10, 100)).toBe('xl');
    });
  });
});
