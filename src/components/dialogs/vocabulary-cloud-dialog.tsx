import {
  ExternalLink,
  Layers,
  ListOrdered,
  Network,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import {
  buildConceptClusters,
  calculateCloudWeightScale,
  filterVocabulary,
} from '../../lib/vocabulary-clusters';
import { useGraphStore } from '../../store/graph-store';
import type { GraphVocabularyItem } from '../../types/api';
import { CircularProgress } from '../ui/circular-progress';
import { DialogFrame } from './dialog-frame';

type VocabularyCloudDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectQuery?: (query: string) => void;
};

type VocabTab = 'cloud' | 'clusters' | 'list';

export function VocabularyCloudDialog({
  open,
  onOpenChange,
  onSelectQuery,
}: VocabularyCloudDialogProps) {
  const graph = useGraphStore((state) => state.graph);
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);
  const setSelectedNodeIds = useGraphStore((state) => state.setSelectedNodeIds);
  const setPreviewNodeIds = useGraphStore((state) => state.setPreviewNodeIds);

  const [activeTab, setActiveTab] = useState<VocabTab>('cloud');
  const [vocabulary, setVocabulary] = useState<GraphVocabularyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [onlySelectedNodes, setOnlySelectedNodes] = useState(false);

  // Synchronize scope filter when selectedNodeIds change
  useEffect(() => {
    if (selectedNodeIds.length === 0) {
      setOnlySelectedNodes(false);
    }
  }, [selectedNodeIds]);

  // Fetch vocabulary when dialog opens
  useEffect(() => {
    if (!open || !graph?.id) {
      return;
    }

    let isSubscribed = true;
    const controller = new AbortController();
    setLoading(true);

    api
      .getVocabulary(graph.id, {
        nodeIds:
          onlySelectedNodes && selectedNodeIds.length > 0
            ? selectedNodeIds
            : undefined,
        signal: controller.signal,
      })
      .then((items) => {
        if (isSubscribed) {
          setVocabulary(Array.isArray(items) ? items : []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (isSubscribed) {
          setVocabulary([]);
          setLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [open, graph?.id, onlySelectedNodes, selectedNodeIds]);

  // Clean preview on unmount/close
  useEffect(() => {
    if (!open) {
      setPreviewNodeIds([]);
    }
  }, [open, setPreviewNodeIds]);

  // Filtered vocabulary
  const filteredItems = useMemo(() => {
    return filterVocabulary(vocabulary, {
      query: filterQuery,
      sourceType: categoryFilter,
      nodeIds:
        onlySelectedNodes && selectedNodeIds.length > 0
          ? selectedNodeIds
          : undefined,
    });
  }, [
    vocabulary,
    filterQuery,
    categoryFilter,
    onlySelectedNodes,
    selectedNodeIds,
  ]);

  // Min and max weights for scaling cloud pills
  const { minWeight, maxWeight } = useMemo(() => {
    if (filteredItems.length === 0) return { minWeight: 1, maxWeight: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const item of filteredItems) {
      if (item.weight < min) min = item.weight;
      if (item.weight > max) max = item.weight;
    }
    return { minWeight: min, maxWeight: max };
  }, [filteredItems]);

  // Concept clusters
  const clusters = useMemo(() => {
    return buildConceptClusters(filteredItems);
  }, [filteredItems]);

  function handleTermClick(item: GraphVocabularyItem) {
    setPreviewNodeIds([]);
    if (onSelectQuery) {
      onSelectQuery(item.term);
    }
    onOpenChange(false);
  }

  function handleJumpToNodes(nodeIds: string[]) {
    setPreviewNodeIds([]);
    if (nodeIds.length > 0) {
      setSelectedNodeIds(nodeIds);
    }
    onOpenChange(false);
  }

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Graph Concepts & Vocabulary"
      className="vocabulary-cloud-dialog"
    >
      <div className="vocab-dialog-container">
        {/* Header Description & Controls */}
        <div className="vocab-dialog-header-meta">
          <p className="vocab-dialog-description">
            Explore key concepts, terminology, and semantic clusters extracted
            from documents and notes across your knowledge graph.
          </p>

          <div className="vocab-controls-row">
            {/* Search Input */}
            <div className="vocab-search-field">
              <Search size={14} className="vocab-search-icon" />
              <input
                type="text"
                placeholder="Filter concepts..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="vocab-search-input"
                aria-label="Filter concepts"
              />
              {filterQuery ? (
                <button
                  type="button"
                  className="vocab-clear-btn"
                  onClick={() => setFilterQuery('')}
                  title="Clear filter"
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="vocab-category-select"
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              <option value="node_title">Node Titles</option>
              <option value="heading">Headings</option>
              <option value="bold">Emphasized Concepts</option>
              <option value="acronym">Acronyms</option>
              <option value="keyphrase">Keyphrases</option>
            </select>

            {/* Selected Nodes Toggle */}
            {selectedNodeIds.length > 0 ? (
              <button
                type="button"
                className={`vocab-scope-toggle ${onlySelectedNodes ? 'is-active' : ''}`}
                onClick={() => setOnlySelectedNodes(!onlySelectedNodes)}
                title="Toggle between all graph concepts and selected nodes"
              >
                <Tag size={13} />
                <span>Selected Nodes ({selectedNodeIds.length})</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* View Tabs */}
        <div
          className="guide-tabs vocab-tabs"
          role="tablist"
          aria-label="Vocabulary View Tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cloud'}
            className={`guide-tab-btn ${activeTab === 'cloud' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('cloud')}
          >
            <Sparkles size={14} aria-hidden="true" />
            <span>Concept Cloud</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'clusters'}
            className={`guide-tab-btn ${activeTab === 'clusters' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('clusters')}
          >
            <Network size={14} aria-hidden="true" />
            <span>Thematic Clusters ({clusters.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'list'}
            className={`guide-tab-btn ${activeTab === 'list' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <ListOrdered size={14} aria-hidden="true" />
            <span>Terms List ({filteredItems.length})</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="vocab-tab-content">
          {loading ? (
            <div className="vocab-loading-state">
              <CircularProgress size={28} strokeWidth={2.5} />
              <p>Aggregating graph vocabulary...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="vocab-empty-state">
              <Sparkles size={24} className="vocab-empty-icon" />
              <p className="vocab-empty-title">No vocabulary concepts found</p>
              <p className="vocab-empty-desc">
                {filterQuery
                  ? 'No concepts match your filter criteria.'
                  : 'Ingest sources or add notes to this graph to generate vocabulary concepts.'}
              </p>
            </div>
          ) : activeTab === 'cloud' ? (
            /* Concept Cloud View */
            <div
              className="vocab-cloud-container"
              role="region"
              aria-label="Concept Cloud"
            >
              <div className="vocab-cloud-pills-wrap">
                {filteredItems.map((item) => {
                  const scale = calculateCloudWeightScale(
                    item.weight,
                    minWeight,
                    maxWeight,
                  );
                  return (
                    <button
                      key={item.term}
                      type="button"
                      className={`vocab-cloud-pill scale-${scale} type-${item.sourceType}`}
                      onMouseEnter={() => {
                        if (item.nodeIds?.length > 0) {
                          setPreviewNodeIds(item.nodeIds);
                        }
                      }}
                      onMouseLeave={() => setPreviewNodeIds([])}
                      onClick={() => handleTermClick(item)}
                      title={`Search concept: "${item.term}" (Weight: ${Math.round(item.weight)})`}
                    >
                      <span className="vocab-pill-text">{item.term}</span>
                      {item.sourceType === 'acronym' ? (
                        <span className="vocab-pill-badge">ACR</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'clusters' ? (
            /* Thematic Clusters View */
            <div
              className="vocab-clusters-container"
              role="region"
              aria-label="Thematic Clusters"
            >
              <div className="vocab-clusters-grid">
                {clusters.map((cluster) => (
                  <div key={cluster.id} className="vocab-cluster-card">
                    <div className="vocab-cluster-header">
                      <div className="vocab-cluster-title-wrap">
                        <Layers size={14} className="vocab-cluster-icon" />
                        <h4 className="vocab-cluster-title">{cluster.name}</h4>
                      </div>
                      <span className="vocab-cluster-count-badge">
                        {cluster.terms.length}{' '}
                        {cluster.terms.length === 1 ? 'term' : 'terms'}
                      </span>
                    </div>

                    {/* Cluster Terms Chips */}
                    <div className="vocab-cluster-terms-row">
                      {cluster.terms.slice(0, 5).map((t) => (
                        <span
                          key={t.term}
                          className="vocab-cluster-term-chip"
                          onMouseEnter={() => {
                            if (t.nodeIds?.length > 0)
                              setPreviewNodeIds(t.nodeIds);
                          }}
                          onMouseLeave={() => setPreviewNodeIds([])}
                          onClick={() => handleTermClick(t)}
                          title={`Click to query: "${t.term}"`}
                        >
                          {t.term}
                        </span>
                      ))}
                      {cluster.terms.length > 5 ? (
                        <span className="vocab-cluster-more-chip">
                          +{cluster.terms.length - 5} more
                        </span>
                      ) : null}
                    </div>

                    {/* Suggested Multi-Term Jump & Node Jump */}
                    <div className="vocab-cluster-actions">
                      {cluster.suggestedQueries.length > 0 ? (
                        <button
                          type="button"
                          className="vocab-cluster-query-btn"
                          onClick={() => {
                            if (onSelectQuery && cluster.suggestedQueries[0]) {
                              onSelectQuery(cluster.suggestedQueries[0]);
                            }
                            onOpenChange(false);
                          }}
                          title={`Run suggested query: "${cluster.suggestedQueries[0]}"`}
                        >
                          <Search size={12} />
                          <span>Query: {cluster.suggestedQueries[0]}</span>
                        </button>
                      ) : null}

                      {cluster.nodeIds.length > 0 ? (
                        <button
                          type="button"
                          className="vocab-cluster-jump-btn"
                          onClick={() => handleJumpToNodes(cluster.nodeIds)}
                          title="Focus and select related nodes on the canvas"
                        >
                          <ExternalLink size={12} />
                          <span>
                            Select {cluster.nodeIds.length}{' '}
                            {cluster.nodeIds.length === 1 ? 'Node' : 'Nodes'}
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Structured Terms List View */
            <div
              className="vocab-list-container"
              role="region"
              aria-label="Vocabulary Terms List"
            >
              <div className="vocab-list-table">
                <div className="vocab-list-row is-header">
                  <span className="col-term">Term / Concept</span>
                  <span className="col-type">Category</span>
                  <span className="col-weight">Weight</span>
                  <span className="col-nodes">Attached Nodes</span>
                  <span className="col-action">Action</span>
                </div>
                {filteredItems.map((item) => (
                  <div
                    key={item.term}
                    className="vocab-list-row"
                    onMouseEnter={() => {
                      if (item.nodeIds?.length > 0)
                        setPreviewNodeIds(item.nodeIds);
                    }}
                    onMouseLeave={() => setPreviewNodeIds([])}
                  >
                    <span className="col-term font-medium">{item.term}</span>
                    <span className="col-type">
                      <span
                        className={`vocab-category-badge is-${item.sourceType}`}
                      >
                        {item.sourceType}
                      </span>
                    </span>
                    <span className="col-weight">
                      {Math.round(item.weight)}
                    </span>
                    <span className="col-nodes">
                      {item.nodeIds?.length > 0 ? (
                        <button
                          type="button"
                          className="vocab-node-link"
                          onClick={() => handleJumpToNodes(item.nodeIds)}
                        >
                          {item.nodeIds.length}{' '}
                          {item.nodeIds.length === 1 ? 'node' : 'nodes'}
                        </button>
                      ) : (
                        '-'
                      )}
                    </span>
                    <span className="col-action">
                      <button
                        type="button"
                        className="vocab-table-action-btn"
                        onClick={() => handleTermClick(item)}
                        title="Query this concept"
                      >
                        <Search size={12} />
                        <span>Search</span>
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DialogFrame>
  );
}
