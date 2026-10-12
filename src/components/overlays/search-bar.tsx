import {
  ChevronDown,
  Compass,
  GitCompare,
  HelpCircle,
  Layers,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { buildConceptClusters } from '../../lib/vocabulary-clusters';
import { useGraphStore } from '../../store/graph-store';
import type {
  CrawlDepth,
  CrawlDirection,
  CrawlSettings,
  GraphVocabularyItem,
  HypothesisGroupDto,
  SearchScope,
  SearchSensitivity,
  SearchSuggestionsResponse,
  SubscriptionTier,
} from '../../types/api';
import { QueryModesGuideDialog } from '../dialogs/query-modes-guide-dialog';
import { VocabularyCloudDialog } from '../dialogs/vocabulary-cloud-dialog';
import { CircularProgress } from '../ui/circular-progress';
import { LineSlicer } from '../ui/line-slicer';

type FlatSuggestion = {
  id: string;
  category: 'query' | 'vocabulary' | 'synonym';
  text: string;
  badge: string;
  secondary?: string;
  action: 'execute' | 'fill';
  nodeIds?: string[];
};

export const HYPOTHESIS_PALETTE = [
  { id: 'groupA', name: 'Hypothesis A', color: '#38bdf8' },
  { id: 'groupB', name: 'Hypothesis B', color: '#a855f7' },
  { id: 'groupC', name: 'Hypothesis C', color: '#f59e0b' },
  { id: 'groupD', name: 'Hypothesis D', color: '#ec4899' },
  { id: 'groupE', name: 'Hypothesis E', color: '#10b981' },
  { id: 'groupF', name: 'Hypothesis F', color: '#6366f1' },
];

type SearchBarProps = {
  onSearch: (
    query: string,
    sensitivity?: SearchSensitivity,
    scope?: SearchScope,
  ) => Promise<void>;
  onCrawl?: (
    query: string,
    direction: CrawlDirection,
    crawlDepth: CrawlDepth,
    sensitivity: SearchSensitivity,
    comparativeMode?: boolean,
    groupBStartingNodeIds?: string[],
    hypothesisGroups?: HypothesisGroupDto[],
    crawlSettings?: CrawlSettings,
  ) => Promise<void>;
  queryForEdit?: string;
  tier?: SubscriptionTier;
  onRequireAuth?: () => void;
};

export function SearchBar({
  onSearch,
  onCrawl,
  queryForEdit,
  tier,
  onRequireAuth,
}: SearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<CrawlDirection>('forward');
  const sensitivity: SearchSensitivity = 'medium';
  const [scope, setScope] = useState<SearchScope>('normal');
  const [showOptions, setShowOptions] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  // Crawl exploration settings
  const [enableDigs, setEnableDigs] = useState(true);
  const [maxDigsPerTopic, setMaxDigsPerTopic] = useState(3);
  const [enableLinks, setEnableLinks] = useState(true);
  const [maxLinks, setMaxLinks] = useState(2);
  const [enableJumps, setEnableJumps] = useState(true);
  const [maxJumps, setMaxJumps] = useState(2);
  const [maxMatchesPerStep, setMaxMatchesPerStep] = useState(3);

  const crawlMatchLimitOptions = useMemo(
    () => [
      { value: 0, label: t('disabled') },
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
      { value: 4, label: '4' },
      { value: 5, label: '5' },
    ],
    [t],
  );

  const matchesPerStepOptions = useMemo(
    () => [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
      { value: 4, label: '4' },
      { value: 5, label: '5' },
    ],
    [],
  );

  const [comparativeMode, setComparativeMode] = useState(false);
  const [hypothesisGroups, setHypothesisGroups] = useState<
    Array<{ id: string; name: string; color: string }>
  >([HYPOTHESIS_PALETTE[0]!, HYPOTHESIS_PALETTE[1]!]);
  const [nodeGroupMap, setNodeGroupMap] = useState<Record<string, string>>({});
  const [showModeGuide, setShowModeGuide] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showVocabCloud, setShowVocabCloud] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const modeTriggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const activeFetchControllerRef = useRef<AbortController | null>(null);

  const [suggestions, setSuggestions] =
    useState<SearchSuggestionsResponse | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const userDismissedSuggestionsRef = useRef(false);

  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  useEffect(() => {
    if (!showModeMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        modeMenuRef.current &&
        !modeMenuRef.current.contains(e.target as Node) &&
        modeTriggerRef.current &&
        !modeTriggerRef.current.contains(e.target as Node)
      ) {
        setShowModeMenu(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowModeMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModeMenu]);

  useEffect(() => {
    if (!showOptions) return;
    function handleOptionsKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowOptions(false);
      }
    }
    window.addEventListener('keydown', handleOptionsKeyDown, true);
    return () =>
      window.removeEventListener('keydown', handleOptionsKeyDown, true);
  }, [showOptions]);

  const graph = useGraphStore((state) => state.graph);
  const mode = useGraphStore((state) => state.mode);
  const queryType = useGraphStore((state) => state.queryType);
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);
  const setSelectedNodeIds = useGraphStore((state) => state.setSelectedNodeIds);
  const crawlStartingNodeIds = useGraphStore(
    (state) => state.crawlStartingNodeIds,
  );
  const setMode = useGraphStore((state) => state.setMode);
  const setQueryType = useGraphStore((state) => state.setQueryType);
  const setCrawlStartingNodeIds = useGraphStore(
    (state) => state.setCrawlStartingNodeIds,
  );
  const setPreviewNodeIds = useGraphStore((state) => state.setPreviewNodeIds);
  const clearResults = useGraphStore((state) => state.clearResults);

  const dismissSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setPreviewNodeIds([]);
    setActiveSuggestionIndex(-1);
    userDismissedSuggestionsRef.current = true;
  }, [setPreviewNodeIds]);

  const isAnonymous = tier === 'ANONYMOUS';

  useEffect(() => {
    if (crawlStartingNodeIds.length < 2 && comparativeMode) {
      setComparativeMode(false);
    }
    setNodeGroupMap((prev) => {
      const next = { ...prev };
      const firstGroupId = hypothesisGroups[0]?.id ?? 'groupA';
      const secondGroupId = hypothesisGroups[1]?.id ?? 'groupB';

      crawlStartingNodeIds.forEach((id, index) => {
        if (!next[id]) {
          next[id] =
            index > 0 && index === crawlStartingNodeIds.length - 1
              ? secondGroupId
              : firstGroupId;
        }
      });
      return next;
    });
  }, [crawlStartingNodeIds, hypothesisGroups, comparativeMode]);

  const groupBNodeIds = useMemo(() => {
    const secondGroupId = hypothesisGroups[1]?.id ?? 'groupB';
    return crawlStartingNodeIds.filter(
      (id) => (nodeGroupMap[id] || hypothesisGroups[0]?.id) === secondGroupId,
    );
  }, [crawlStartingNodeIds, nodeGroupMap, hypothesisGroups]);

  const directionOptions = [
    { value: 'forward' as const, label: t('directionForward') },
    { value: 'backward' as const, label: t('directionBackward') },
    { value: 'both' as const, label: t('directionBoth') },
    { value: 'global' as const, label: t('directionGlobal') },
  ];

  const scopeOptions = [
    { value: 'narrow' as const, label: t('scopeNarrow') },
    { value: 'normal' as const, label: t('scopeNormal') },
    { value: 'wide' as const, label: t('scopeWide') },
  ];

  useEffect(() => {
    if (queryForEdit !== undefined) setQuery(queryForEdit);
  }, [queryForEdit]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setShowSuggestions(false);
    setPreviewNodeIds([]);
    await executeSearch(query);
  }

  useEffect(() => {
    if (!graph?.id) {
      setSuggestions(null);
      return;
    }

    const trimmed = query.trim();
    if (!trimmed && selectedNodeIds.length === 0) {
      setSuggestions(null);
      return;
    }

    activeFetchControllerRef.current?.abort();
    const controller = new AbortController();
    activeFetchControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await api.getSuggestions(graph.id, {
          nodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined,
          query: trimmed || undefined,
          limit: 8,
          signal: controller.signal,
        });
        setSuggestions(res);
        setActiveSuggestionIndex(-1);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [graph?.id, query, selectedNodeIds]);

  useEffect(() => {
    if (
      suggestions &&
      (suggestions.querySuggestions.length > 0 ||
        suggestions.vocabularySuggestions.length > 0 ||
        suggestions.synonymSuggestions.length > 0) &&
      (isInputFocused || document.activeElement === inputRef.current) &&
      !userDismissedSuggestionsRef.current
    ) {
      setShowSuggestions(true);
    }
  }, [suggestions, isInputFocused]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        suggestionsPopoverRef.current &&
        !suggestionsPopoverRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        dismissSuggestions();
        setIsInputFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dismissSuggestions]);

  const flattenedSuggestions = useMemo<FlatSuggestion[]>(() => {
    if (!suggestions) return [];
    const items: FlatSuggestion[] = [];

    if (suggestions.querySuggestions?.length) {
      suggestions.querySuggestions.slice(0, 4).forEach((q, idx) => {
        items.push({
          id: `suggestion-query-${idx}`,
          category: 'query',
          text: q,
          badge: selectedNodeIds.length > 0 ? 'Selected Nodes' : 'Query Idea',
          action: 'execute',
          nodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : undefined,
        });
      });
    }

    if (suggestions.vocabularySuggestions?.length) {
      suggestions.vocabularySuggestions.slice(0, 6).forEach((v, idx) => {
        const badgeLabel =
          v.sourceType === 'node_title' || v.sourceType === 'node'
            ? 'Node'
            : v.sourceType === 'heading'
              ? 'Header'
              : v.sourceType === 'acronym'
                ? 'Acronym'
                : 'Concept';
        items.push({
          id: `suggestion-vocab-${idx}`,
          category: 'vocabulary',
          text: v.term,
          badge: badgeLabel,
          action: 'fill',
          nodeIds: v.nodeIds,
        });
      });
    }

    if (suggestions.synonymSuggestions?.length) {
      suggestions.synonymSuggestions.slice(0, 3).forEach((s, idx) => {
        items.push({
          id: `suggestion-syn-${idx}`,
          category: 'synonym',
          text: s.term,
          badge: 'Synonym',
          secondary: s.expansions.slice(0, 3).join(', '),
          action: 'fill',
        });
      });
    }

    return items;
  }, [suggestions, selectedNodeIds]);

  const conceptClusters = useMemo(() => {
    if (
      !suggestions?.vocabularySuggestions ||
      suggestions.vocabularySuggestions.length === 0
    ) {
      return [];
    }
    const items: GraphVocabularyItem[] = suggestions.vocabularySuggestions.map(
      (v) => ({
        term: v.term,
        normalized: v.term.toLowerCase(),
        nodeIds: v.nodeIds,
        weight: 10,
        sourceType: (v.sourceType as any) || 'keyphrase',
      }),
    );
    return buildConceptClusters(items, 3).filter((c) => c.terms.length >= 2);
  }, [suggestions]);

  const isSuggestionsVisible = Boolean(
    !showOptions &&
      showSuggestions &&
      (flattenedSuggestions.length > 0 || conceptClusters.length > 0),
  );

  useEffect(() => {
    if (!isSuggestionsVisible) return;
    function handleSuggestionsKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismissSuggestions();
      }
    }
    window.addEventListener('keydown', handleSuggestionsKeyDown, true);
    return () =>
      window.removeEventListener('keydown', handleSuggestionsKeyDown, true);
  }, [isSuggestionsVisible, dismissSuggestions]);

  useEffect(() => {
    if (!showSuggestions || activeSuggestionIndex < 0) {
      setPreviewNodeIds([]);
      return;
    }
    const activeItem = flattenedSuggestions[activeSuggestionIndex];
    if (activeItem?.nodeIds && activeItem.nodeIds.length > 0) {
      setPreviewNodeIds(activeItem.nodeIds);
    } else {
      setPreviewNodeIds([]);
    }
  }, [
    showSuggestions,
    activeSuggestionIndex,
    flattenedSuggestions,
    setPreviewNodeIds,
  ]);

  useEffect(() => {
    return () => {
      setPreviewNodeIds([]);
    };
  }, [setPreviewNodeIds]);

  function applySuggestion(item: FlatSuggestion): void {
    setQuery(item.text);
    dismissSuggestions();
    setSuggestions(null);
    if (item.action === 'execute') {
      void executeSearch(item.text);
    } else {
      inputRef.current?.focus();
    }
  }

  async function executeSearch(rawQuery: string): Promise<void> {
    const effectiveQuery = rawQuery.trim();
    if (!effectiveQuery || isSubmitting) return;

    if (queryType === 'crawl') {
      if (crawlStartingNodeIds.length === 0) return;
      if (isAnonymous && crawlStartingNodeIds.length > 1) {
        onRequireAuth?.();
        return;
      }
      setSubmitting(true);
      try {
        if (onCrawl) {
          const effectiveComparative =
            comparativeMode && crawlStartingNodeIds.length >= 2;
          let effectiveHypothesisGroups: HypothesisGroupDto[] | undefined;
          let effectiveGroupB: string[] | undefined;

          if (effectiveComparative) {
            effectiveHypothesisGroups = hypothesisGroups
              .map((g) => ({
                id: g.id,
                name: g.name,
                color: g.color,
                nodeIds: crawlStartingNodeIds.filter(
                  (id) =>
                    (nodeGroupMap[id] || hypothesisGroups[0]?.id) === g.id,
                ),
              }))
              .filter((g) => g.nodeIds.length > 0);

            if (effectiveHypothesisGroups.length >= 2) {
              const bGroup =
                effectiveHypothesisGroups.find((g) => g.id === 'groupB') ||
                effectiveHypothesisGroups[1];
              effectiveGroupB = bGroup ? bGroup.nodeIds : undefined;
            }
          }

          const fallbackGroupB =
            groupBNodeIds.length > 0
              ? groupBNodeIds
              : [crawlStartingNodeIds[crawlStartingNodeIds.length - 1]!];

          const crawlSettings: CrawlSettings = {
            enableDigs,
            maxDigsPerTopic,
            enableLinks,
            maxLinks,
            enableJumps,
            maxJumps,
            maxCandidatesPerStep: maxMatchesPerStep,
          };

          if (effectiveComparative) {
            await onCrawl(
              effectiveQuery,
              direction,
              isAnonymous ? 'shallow' : 'default',
              sensitivity,
              true,
              effectiveGroupB ?? fallbackGroupB,
              effectiveHypothesisGroups,
              crawlSettings,
            );
          } else {
            await onCrawl(
              effectiveQuery,
              direction,
              isAnonymous ? 'shallow' : 'default',
              sensitivity,
              false,
              undefined,
              undefined,
              crawlSettings,
            );
          }
          setQuery('');
          if (inputRef.current) {
            inputRef.current.value = '';
          }
          dismissSuggestions();
          setSuggestions(null);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (isAnonymous && selectedNodeIds.length > 2) {
      onRequireAuth?.();
      return;
    }

    setSubmitting(true);
    try {
      await onSearch(effectiveQuery, sensitivity, scope);
    } finally {
      setSubmitting(false);
    }
  }

  function cancel(): void {
    setQuery('');
    clearResults();
    dismissSuggestions();
    setSuggestions(null);
    setIsInputFocused(false);
    if (queryType === 'crawl') {
      setMode('CRAWL_SELECTION');
    } else {
      setMode(selectedNodeIds.length > 0 ? 'CONTEXT_SELECTION' : 'IDLE');
    }
  }

  function selectMode(target: 'simple' | 'crawl'): void {
    if (target === queryType) return;
    if (target === 'crawl') {
      setQueryType('crawl');
      setMode('CRAWL_SELECTION');
      if (crawlStartingNodeIds.length === 0 && graph) {
        setCrawlStartingNodeIds(
          graph.nodes
            .slice(0, isAnonymous ? 1 : undefined)
            .map((node) => node.id),
        );
      }
    } else {
      setQueryType('simple');
      setMode(selectedNodeIds.length > 0 ? 'CONTEXT_SELECTION' : 'IDLE');
    }
  }

  function addHypothesisGroup(): void {
    if (isAnonymous) {
      onRequireAuth?.();
      return;
    }
    if (hypothesisGroups.length >= HYPOTHESIS_PALETTE.length) return;
    const nextGroup = HYPOTHESIS_PALETTE[hypothesisGroups.length];
    if (nextGroup) {
      setHypothesisGroups((prev) => [...prev, nextGroup]);
    }
  }

  function removeHypothesisGroup(groupId: string): void {
    if (hypothesisGroups.length <= 2) return;
    const fallbackId = hypothesisGroups[0]?.id ?? 'groupA';
    setNodeGroupMap((prev) => {
      const updated = { ...prev };
      for (const [nodeId, gId] of Object.entries(updated)) {
        if (gId === groupId) {
          updated[nodeId] = fallbackId;
        }
      }
      return updated;
    });
    setHypothesisGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  function cycleNodeGroup(nodeId: string): void {
    const currentGroupId =
      nodeGroupMap[nodeId] || hypothesisGroups[0]?.id || 'groupA';
    const currentIndex = hypothesisGroups.findIndex(
      (g) => g.id === currentGroupId,
    );
    const nextIndex =
      currentIndex >= 0 ? (currentIndex + 1) % hypothesisGroups.length : 0;
    const nextGroupId = hypothesisGroups[nextIndex]?.id ?? 'groupA';
    setNodeGroupMap((prev) => ({
      ...prev,
      [nodeId]: nextGroupId,
    }));
  }

  const scopeDesc =
    scope === 'narrow'
      ? t('scopeNarrowDesc')
      : scope === 'wide'
        ? t('scopeWideDesc')
        : t('scopeNormalDesc');

  const isCustomOptions =
    queryType === 'simple'
      ? scope !== 'normal'
      : direction !== 'forward' ||
        !enableDigs ||
        maxDigsPerTopic !== 3 ||
        !enableLinks ||
        maxLinks !== 2 ||
        !enableJumps ||
        maxJumps !== 2 ||
        maxMatchesPerStep !== 3 ||
        comparativeMode;

  const placeholderText =
    queryType === 'crawl' ? t('crawlPlaceholder') : t('searchPlaceholder');

  const submitLabel = queryType === 'crawl' ? t('run') : t('search');

  const totalGraphNodes = useMemo(() => graph?.nodes ?? [], [graph?.nodes]);
  const totalNodeCount = totalGraphNodes.length;

  const isAllSelected = useMemo(() => {
    if (totalNodeCount === 0) return false;
    const maxAllowed =
      queryType === 'crawl'
        ? isAnonymous
          ? 1
          : totalNodeCount
        : isAnonymous
          ? 2
          : totalNodeCount;
    const targetCount = Math.min(totalNodeCount, maxAllowed);
    if (queryType === 'crawl') {
      return crawlStartingNodeIds.length >= targetCount;
    }
    return selectedNodeIds.length >= targetCount;
  }, [
    totalNodeCount,
    queryType,
    isAnonymous,
    crawlStartingNodeIds.length,
    selectedNodeIds.length,
  ]);

  const isPartiallySelected = useMemo(() => {
    if (totalNodeCount === 0) return false;
    const currentCount =
      queryType === 'crawl'
        ? crawlStartingNodeIds.length
        : selectedNodeIds.length;
    return currentCount > 0 && !isAllSelected;
  }, [
    totalNodeCount,
    queryType,
    isAllSelected,
    crawlStartingNodeIds.length,
    selectedNodeIds.length,
  ]);

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isPartiallySelected;
    }
  }, [isPartiallySelected]);

  const handleToggleSelectAll = useCallback(() => {
    if (totalNodeCount === 0) return;
    const allNodeIds = totalGraphNodes.map((n) => n.id);
    const limit =
      queryType === 'crawl'
        ? isAnonymous
          ? 1
          : allNodeIds.length
        : isAnonymous
          ? 2
          : allNodeIds.length;
    const cappedNodeIds = allNodeIds.slice(0, limit);

    if (queryType === 'crawl') {
      if (isAllSelected) {
        setCrawlStartingNodeIds([]);
      } else {
        setCrawlStartingNodeIds(cappedNodeIds);
        setMode('CRAWL_SELECTION');
      }
    } else {
      if (isAllSelected) {
        setSelectedNodeIds([]);
      } else {
        setSelectedNodeIds(cappedNodeIds);
        setMode('CONTEXT_SELECTION');
      }
    }
  }, [
    totalNodeCount,
    totalGraphNodes,
    queryType,
    isAllSelected,
    tier,
    setCrawlStartingNodeIds,
    setSelectedNodeIds,
    setMode,
  ]);

  const isCrawlBlocked =
    queryType === 'crawl' && crawlStartingNodeIds.length === 0;

  return (
    <div
      className={`search-bar-dock overlay-interactive ${queryType === 'crawl' ? 'is-crawl-mode' : ''}`}
    >
      {/* Floating Query Hints Row Above Query Panel */}
      {queryType === 'crawl' ? (
        <div className="search-bar-hints-row" aria-live="polite">
          {crawlStartingNodeIds.length === 0 ? (
            <span
              className="crawl-seed-chip warning"
              title={t('crawlSelectStartingNodes')}
            >
              {t('crawlSelectStartingNodes')}
            </span>
          ) : isAnonymous && crawlStartingNodeIds.length > 1 ? (
            <span
              className="crawl-seed-chip warning"
              title="Guest crawl limited to 1 starting point. Sign in for multi-node crawl."
            >
              Guest crawl limited to 1 starting point (shallow)
            </span>
          ) : comparativeMode && crawlStartingNodeIds.length >= 2 ? (
            <span
              className="crawl-seed-chip comparative"
              title="Comparative Crawl Active"
            >
              <GitCompare
                size={12}
                style={{
                  marginRight: 4,
                  verticalAlign: 'middle',
                  display: 'inline-block',
                }}
              />
              {hypothesisGroups.length > 2
                ? `${hypothesisGroups.filter((g) => crawlStartingNodeIds.some((id) => (nodeGroupMap[id] || hypothesisGroups[0]?.id) === g.id)).length} hypotheses (${crawlStartingNodeIds.length} seeds)`
                : `${crawlStartingNodeIds.length - (groupBNodeIds.length || 1)} vs ${groupBNodeIds.length || 1} seeds`}
            </span>
          ) : (
            <span className="crawl-seed-chip active">
              {crawlStartingNodeIds.length}{' '}
              {crawlStartingNodeIds.length === 1 ? 'seed' : 'seeds'}
            </span>
          )}
        </div>
      ) : null}

      {/* Main Controls Row: Switch Button Left, Centered Query Panel, Info Button Right */}
      <div className="search-bar-main-row">
        {/* Switch Button Column on the Left with Mode Menu Trigger and Popover */}
        <div
          ref={modeMenuRef}
          className={`mode-switcher-column ${showModeMenu ? 'is-open' : ''}`}
          onMouseEnter={() => setShowModeMenu(true)}
          onMouseLeave={() => setShowModeMenu(false)}
        >
          <button
            ref={modeTriggerRef}
            type="button"
            className={`mode-menu-trigger-btn ${queryType === 'crawl' ? 'is-crawl' : 'is-search'} ${showModeMenu ? 'is-open' : ''}`}
            aria-haspopup="true"
            aria-expanded={showModeMenu}
            title={`${queryType === 'crawl' ? t('modeCrawl') : t('modeSearch')} (Mode & selection menu)`}
            aria-label={`${queryType === 'crawl' ? t('modeCrawl') : t('modeSearch')} menu`}
          >
            {queryType === 'crawl' ? (
              <Compass size={14} className="mode-trigger-icon" />
            ) : (
              <Search size={14} className="mode-trigger-icon" />
            )}
            <span className="mode-trigger-label">
              {queryType === 'crawl' ? t('modeCrawl') : t('modeSearch')}
            </span>
            {queryType === 'crawl' && crawlStartingNodeIds.length > 0 ? (
              <span className="mode-trigger-count-badge">
                {crawlStartingNodeIds.length}
              </span>
            ) : null}
            <ChevronDown size={13} className="mode-trigger-chevron" />
          </button>

          <div
            className={`mode-switcher-dropdown ${showModeMenu ? 'is-open' : ''}`}
            role="region"
            aria-label="Mode and node selection"
          >
            <div className="mode-dropdown-header">
              <span className="mode-dropdown-title">Query Mode & Scope</span>
            </div>

            <div
              className="mode-switcher-segmented"
              role="radiogroup"
              aria-label="Query mode selection"
            >
              <button
                type="button"
                role="radio"
                aria-checked={queryType === 'simple'}
                className={`mode-segment-btn is-search ${queryType === 'simple' ? 'is-active' : ''}`}
                onClick={() => {
                  selectMode('simple');
                  setShowModeMenu(false);
                }}
                title={t('modeSearchTooltip')}
                aria-label={t('modeSearch')}
              >
                <Search size={14} className="mode-segment-icon" />
                <span className="mode-segment-text">{t('modeSearch')}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={queryType === 'crawl'}
                className={`mode-segment-btn is-crawl ${queryType === 'crawl' ? 'is-active' : ''}`}
                onClick={() => {
                  selectMode('crawl');
                  setShowModeMenu(false);
                }}
                title={
                  isAnonymous
                    ? 'Guest crawl (1 starting point, shallow)'
                    : t('modeCrawlTooltip')
                }
                aria-label={t('modeCrawl')}
              >
                <Compass size={14} className="mode-segment-icon" />
                <span className="mode-segment-text">{t('modeCrawl')}</span>
              </button>
            </div>

            <label className="mode-select-all-checkbox-row">
              <input
                ref={selectAllCheckboxRef}
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="mode-select-all-checkbox"
                aria-label={
                  queryType === 'crawl'
                    ? t('selectAllStartingNodes')
                    : t('selectAllNodes')
                }
              />
              <span className="mode-select-all-text">
                {queryType === 'crawl'
                  ? t('selectAllStartingNodes')
                  : t('selectAllNodes')}
              </span>
              {totalNodeCount > 0 ? (
                <span className="mode-select-all-count-tag">
                  {queryType === 'crawl'
                    ? `${crawlStartingNodeIds.length}/${Math.min(totalNodeCount, isAnonymous ? 1 : totalNodeCount)}`
                    : `${selectedNodeIds.length}/${Math.min(totalNodeCount, isAnonymous ? 2 : totalNodeCount)}`}
                </span>
              ) : null}
            </label>
          </div>
        </div>

        <form
          className={`search-bar ${queryType === 'crawl' ? 'is-crawl-mode' : ''}`}
          onSubmit={(event) => void submit(event)}
        >
          {/* Slide-out Options Drawer (Scope, Direction, Crawl Depth) */}
          {showOptions ? (
            <section
              className="search-options-drawer"
              aria-label={t('queryOptions')}
            >
              {queryType === 'simple' ? (
                <div className="search-option-group">
                  <div className="search-option-header">
                    <span className="search-option-label">{t('scope')}</span>
                    <span className="search-option-desc">{scopeDesc}</span>
                  </div>
                  <LineSlicer
                    label={t('scope')}
                    value={scope}
                    options={scopeOptions}
                    onChange={setScope}
                  />
                </div>
              ) : (
                <>
                  <div className="search-option-group">
                    <div className="search-option-header">
                      <span className="search-option-label">
                        {t('crawlDirection')}
                      </span>
                    </div>
                    <LineSlicer
                      label={t('crawlDirection')}
                      value={direction}
                      options={directionOptions}
                      onChange={setDirection}
                    />
                  </div>

                  {/* Crawl Match Types & Exploration Settings */}
                  <div className="search-option-group crawl-settings-group">
                    <div className="search-option-header">
                      <span className="search-option-label">
                        <Compass
                          size={13}
                          style={{
                            marginRight: 5,
                            verticalAlign: 'middle',
                            display: 'inline-block',
                          }}
                        />
                        {t('crawlSettings')}
                      </span>
                    </div>

                    {/* Digs Setting */}
                    <div className="crawl-setting-row">
                      <div className="crawl-setting-info">
                        <div className="crawl-setting-title-row">
                          <span className="crawl-type-dot is-dig" />
                          <strong className="crawl-setting-name">
                            {t('crawlDigs')}
                          </strong>
                          <span className="crawl-setting-desc">
                            {t('crawlDigsDesc')}
                          </span>
                        </div>
                      </div>
                      <div className="crawl-setting-slicer">
                        <LineSlicer
                          label={t('crawlDigs')}
                          value={enableDigs ? maxDigsPerTopic : 0}
                          options={crawlMatchLimitOptions}
                          onChange={(val) => {
                            if (val === 0) {
                              setEnableDigs(false);
                              setMaxDigsPerTopic(0);
                            } else {
                              setEnableDigs(true);
                              setMaxDigsPerTopic(val);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Links Setting */}
                    <div className="crawl-setting-row">
                      <div className="crawl-setting-info">
                        <div className="crawl-setting-title-row">
                          <span className="crawl-type-dot is-link" />
                          <strong className="crawl-setting-name">
                            {t('crawlLinks')}
                          </strong>
                          <span className="crawl-setting-desc">
                            {t('crawlLinksDesc')}
                          </span>
                        </div>
                      </div>
                      <div className="crawl-setting-slicer">
                        <LineSlicer
                          label={t('crawlLinks')}
                          value={enableLinks ? maxLinks : 0}
                          options={crawlMatchLimitOptions}
                          onChange={(val) => {
                            if (val === 0) {
                              setEnableLinks(false);
                              setMaxLinks(0);
                            } else {
                              setEnableLinks(true);
                              setMaxLinks(val);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Jumps Setting */}
                    <div className="crawl-setting-row">
                      <div className="crawl-setting-info">
                        <div className="crawl-setting-title-row">
                          <span className="crawl-type-dot is-jump" />
                          <strong className="crawl-setting-name">
                            {t('crawlJumps')}
                          </strong>
                          <span className="crawl-setting-desc">
                            {t('crawlJumpsDesc')}
                          </span>
                        </div>
                      </div>
                      <div className="crawl-setting-slicer">
                        <LineSlicer
                          label={t('crawlJumps')}
                          value={enableJumps ? maxJumps : 0}
                          options={crawlMatchLimitOptions}
                          onChange={(val) => {
                            if (val === 0) {
                              setEnableJumps(false);
                              setMaxJumps(0);
                            } else {
                              setEnableJumps(true);
                              setMaxJumps(val);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Matches per Step Setting */}
                    <div className="crawl-setting-row">
                      <div className="crawl-setting-info">
                        <div className="crawl-setting-title-row">
                          <strong className="crawl-setting-name">
                            {t('crawlMatchesPerStep')}
                          </strong>
                          <span className="crawl-setting-desc">
                            {t('crawlMatchesPerStepDesc')}
                          </span>
                        </div>
                      </div>
                      <div className="crawl-setting-slicer">
                        <LineSlicer
                          label={t('crawlMatchesPerStep')}
                          value={maxMatchesPerStep}
                          options={matchesPerStepOptions}
                          onChange={setMaxMatchesPerStep}
                        />
                      </div>
                    </div>
                  </div>

                  {crawlStartingNodeIds.length >= 2 ? (
                    <div className="search-option-group comparative-option-group">
                      <div className="search-option-header">
                        <span className="search-option-label">
                          <GitCompare
                            size={13}
                            style={{
                              marginRight: 5,
                              verticalAlign: 'middle',
                              display: 'inline-block',
                            }}
                          />
                          Comparative Mode (
                          {hypothesisGroups.length > 2
                            ? `${hypothesisGroups.length} Hypotheses`
                            : 'A vs B'}
                          )
                        </span>
                        <button
                          type="button"
                          className={`comparative-toggle-btn ${comparativeMode ? 'active' : ''}`}
                          onClick={() => {
                            if (isAnonymous) {
                              onRequireAuth?.();
                              return;
                            }
                            setComparativeMode(!comparativeMode);
                          }}
                        >
                          {comparativeMode ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                      {comparativeMode ? (
                        <div className="comparative-seed-partitioner">
                          <div className="comparative-group-header-row">
                            <span className="comparative-hint-text">
                              Active hypotheses:
                            </span>
                            {hypothesisGroups.length <
                            HYPOTHESIS_PALETTE.length ? (
                              <button
                                type="button"
                                className="add-hypothesis-btn"
                                onClick={addHypothesisGroup}
                                title="Add another hypothesis branch"
                              >
                                <Plus
                                  size={12}
                                  style={{
                                    marginRight: 3,
                                    verticalAlign: 'middle',
                                  }}
                                />
                                Add Hypothesis
                              </button>
                            ) : null}
                          </div>

                          {/* Active hypothesis summary bar */}
                          <div className="comparative-groups-summary-bar">
                            {hypothesisGroups.map((group) => {
                              const count = crawlStartingNodeIds.filter(
                                (id) =>
                                  (nodeGroupMap[id] ||
                                    hypothesisGroups[0]?.id) === group.id,
                              ).length;
                              return (
                                <span
                                  key={group.id}
                                  className="hypothesis-summary-pill"
                                  style={{ borderLeftColor: group.color }}
                                >
                                  <span
                                    className="hypothesis-dot"
                                    style={{ backgroundColor: group.color }}
                                  />
                                  {group.name} ({count})
                                  {hypothesisGroups.length > 2 ? (
                                    <button
                                      type="button"
                                      className="remove-hypothesis-btn"
                                      onClick={() =>
                                        removeHypothesisGroup(group.id)
                                      }
                                      title={`Remove ${group.name}`}
                                      aria-label={`Remove ${group.name}`}
                                    >
                                      <X size={10} />
                                    </button>
                                  ) : null}
                                </span>
                              );
                            })}
                          </div>

                          <span
                            className="comparative-hint-text"
                            style={{ marginTop: 6, display: 'block' }}
                          >
                            Assign seeds (click chip to cycle hypothesis):
                          </span>
                          <div className="comparative-seed-chips">
                            {crawlStartingNodeIds.map((nodeId) => {
                              const node = graph?.nodes.find(
                                (n) => n.id === nodeId,
                              );
                              const title =
                                node?.data.title || nodeId.slice(0, 8);
                              const currentGroupId =
                                nodeGroupMap[nodeId] ||
                                hypothesisGroups[0]?.id ||
                                'groupA';
                              const currentGroup =
                                hypothesisGroups.find(
                                  (g) => g.id === currentGroupId,
                                ) || hypothesisGroups[0]!;
                              const isGroupB = currentGroupId === 'groupB';
                              return (
                                <button
                                  key={nodeId}
                                  type="button"
                                  className={`comparative-seed-pill ${isGroupB ? 'is-group-b' : 'is-group-a'} is-group-${currentGroupId}`}
                                  onClick={() => cycleNodeGroup(nodeId)}
                                  title={`Click to cycle hypothesis for "${title}" (currently ${currentGroup.name})`}
                                >
                                  <span
                                    className="pill-badge"
                                    style={{
                                      backgroundColor: `${currentGroup.color}33`,
                                      color: currentGroup.color,
                                    }}
                                  >
                                    {currentGroup.name}
                                  </span>
                                  <span className="pill-title">{title}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}

              <div className="search-options-drawer-footer">
                <button
                  type="button"
                  className="search-options-guide-link-btn"
                  onClick={() => setShowModeGuide(true)}
                  aria-label={t('queryModesGuideTitle')}
                >
                  <HelpCircle size={13} />
                  <span>{t('queryModesGuideTitle')}</span>
                </button>
              </div>
            </section>
          ) : null}

          {/* Autocomplete Suggestions Popover */}
          {isSuggestionsVisible ? (
            <div
              ref={suggestionsPopoverRef}
              id="search-suggestions-popover"
              className="search-suggestions-popover"
              role="listbox"
              aria-label="Search suggestions"
              onMouseLeave={() => {
                setActiveSuggestionIndex(-1);
                setPreviewNodeIds([]);
              }}
            >
              {selectedNodeIds.length > 0 &&
              suggestions?.querySuggestions &&
              suggestions.querySuggestions.length > 0 ? (
                <div className="search-suggestions-section search-suggestions-chips-section">
                  <div className="search-suggestions-section-title">
                    <Sparkles size={12} className="suggestions-section-icon" />
                    <span>Suggested for Selected Nodes</span>
                  </div>
                  <div className="search-suggestions-chips-row">
                    {suggestions.querySuggestions
                      .slice(0, 3)
                      .map((queryText) => (
                        <button
                          key={queryText}
                          type="button"
                          className="search-suggestion-chip"
                          onMouseEnter={() => {
                            if (selectedNodeIds.length > 0) {
                              setPreviewNodeIds(selectedNodeIds);
                            }
                          }}
                          onMouseLeave={() => {
                            setPreviewNodeIds([]);
                          }}
                          onClick={() => {
                            setQuery(queryText);
                            setShowSuggestions(false);
                            setSuggestions(null);
                            setPreviewNodeIds([]);
                            void executeSearch(queryText);
                          }}
                          title={`Execute query: "${queryText}"`}
                        >
                          <Sparkles size={11} />
                          <span>{queryText}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}

              {selectedNodeIds.length > 0 &&
              suggestions?.vocabularySuggestions &&
              suggestions.vocabularySuggestions.length > 0 ? (
                <div className="search-suggestions-section search-suggestions-chips-section">
                  <div className="search-suggestions-section-title">
                    <Tag size={12} className="suggestions-section-icon" />
                    <span>Node Concepts</span>
                  </div>
                  <div className="search-suggestions-chips-row">
                    {suggestions.vocabularySuggestions
                      .slice(0, 4)
                      .map((vocabItem) => (
                        <button
                          key={vocabItem.term}
                          type="button"
                          className="search-suggestion-chip is-vocab"
                          onMouseEnter={() => {
                            if (
                              vocabItem.nodeIds &&
                              vocabItem.nodeIds.length > 0
                            ) {
                              setPreviewNodeIds(vocabItem.nodeIds);
                            }
                          }}
                          onMouseLeave={() => {
                            setPreviewNodeIds([]);
                          }}
                          onClick={() => {
                            setQuery(vocabItem.term);
                            setShowSuggestions(false);
                            setSuggestions(null);
                            setPreviewNodeIds([]);
                            inputRef.current?.focus();
                          }}
                          title={`Insert concept: "${vocabItem.term}"`}
                        >
                          <Tag size={11} />
                          <span>{vocabItem.term}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}

              {selectedNodeIds.length > 0 && conceptClusters.length > 0 ? (
                <div className="search-suggestions-section search-suggestions-chips-section">
                  <div className="search-suggestions-section-title">
                    <Layers size={12} className="suggestions-section-icon" />
                    <span>Thematic Clusters</span>
                  </div>
                  <div className="search-suggestions-chips-row">
                    {conceptClusters.map((cluster) => (
                      <button
                        key={cluster.id}
                        type="button"
                        className="search-suggestion-chip is-cluster"
                        onMouseEnter={() => {
                          if (cluster.nodeIds && cluster.nodeIds.length > 0) {
                            setPreviewNodeIds(cluster.nodeIds);
                          }
                        }}
                        onMouseLeave={() => {
                          setPreviewNodeIds([]);
                        }}
                        onClick={() => {
                          const queryText =
                            cluster.suggestedQueries[0] || cluster.name;
                          setQuery(queryText);
                          setShowSuggestions(false);
                          setSuggestions(null);
                          setPreviewNodeIds([]);
                          void executeSearch(queryText);
                        }}
                        title={`Cluster query: "${cluster.suggestedQueries[0] || cluster.name}"`}
                      >
                        <Layers size={11} />
                        <span>{cluster.name}</span>
                        {cluster.terms.length > 1 ? (
                          <span className="search-suggestion-chip-count">
                            ({cluster.terms.length})
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="search-suggestions-list">
                {flattenedSuggestions.map((item, index) => {
                  const isActive = index === activeSuggestionIndex;
                  return (
                    <div
                      key={item.id}
                      id={item.id}
                      role="option"
                      aria-selected={isActive}
                      className={`search-suggestion-item is-${item.category} ${isActive ? 'is-active' : ''}`}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      onClick={() => applySuggestion(item)}
                    >
                      <div className="search-suggestion-item-main">
                        {item.category === 'query' ? (
                          <Sparkles
                            size={13}
                            className="suggestion-type-icon is-query"
                          />
                        ) : item.category === 'vocabulary' ? (
                          <Tag
                            size={13}
                            className="suggestion-type-icon is-vocab"
                          />
                        ) : (
                          <Search
                            size={13}
                            className="suggestion-type-icon is-synonym"
                          />
                        )}
                        <span className="search-suggestion-text">
                          {item.text}
                        </span>
                        {item.secondary ? (
                          <span className="search-suggestion-secondary">
                            ({item.secondary})
                          </span>
                        ) : null}
                      </div>
                      <div className="search-suggestion-item-meta">
                        <span
                          className={`search-suggestion-badge is-${item.category}`}
                        >
                          {item.badge}
                        </span>
                        {item.action === 'execute' ? (
                          <span className="search-suggestion-action-hint">
                            ↵ Search
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="search-suggestions-footer">
                <button
                  type="button"
                  className="search-suggestions-explore-btn"
                  onClick={() => {
                    setShowSuggestions(false);
                    setShowVocabCloud(true);
                  }}
                  title="Explore full graph vocabulary and concept cloud"
                >
                  <Tag size={12} />
                  <span>Explore all concepts & clusters ↗</span>
                </button>
              </div>
            </div>
          ) : null}

          <input
            ref={inputRef}
            id="main-search-input"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && flattenedSuggestions.length > 0}
            aria-controls={
              showSuggestions && flattenedSuggestions.length > 0
                ? 'search-suggestions-popover'
                : undefined
            }
            aria-activedescendant={
              activeSuggestionIndex >= 0 &&
              flattenedSuggestions[activeSuggestionIndex]
                ? flattenedSuggestions[activeSuggestionIndex]?.id
                : undefined
            }
            value={query}
            onFocus={() => {
              setIsInputFocused(true);
              userDismissedSuggestionsRef.current = false;
              if (queryType === 'simple') {
                setMode('CONTEXT_SELECTION');
              } else {
                setMode('CRAWL_SELECTION');
              }
              if (flattenedSuggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                userDismissedSuggestionsRef.current = false;
                if (flattenedSuggestions.length > 0) {
                  event.preventDefault();
                  if (!showSuggestions) {
                    setShowSuggestions(true);
                    setActiveSuggestionIndex(0);
                  } else {
                    setActiveSuggestionIndex(
                      (prev) => (prev + 1) % flattenedSuggestions.length,
                    );
                  }
                }
              } else if (event.key === 'ArrowUp') {
                if (flattenedSuggestions.length > 0 && showSuggestions) {
                  event.preventDefault();
                  setActiveSuggestionIndex((prev) =>
                    prev <= 0 ? flattenedSuggestions.length - 1 : prev - 1,
                  );
                }
              } else if (event.key === 'Enter') {
                if (
                  showSuggestions &&
                  activeSuggestionIndex >= 0 &&
                  flattenedSuggestions[activeSuggestionIndex]
                ) {
                  event.preventDefault();
                  const chosen = flattenedSuggestions[activeSuggestionIndex]!;
                  applySuggestion(chosen);
                }
              } else if (event.key === 'Escape') {
                if (showOptions) {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowOptions(false);
                } else if (isSuggestionsVisible) {
                  event.preventDefault();
                  event.stopPropagation();
                  dismissSuggestions();
                } else if (showModeMenu) {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowModeMenu(false);
                } else if (query.trim().length > 0) {
                  event.preventDefault();
                  event.stopPropagation();
                  cancel();
                } else {
                  event.preventDefault();
                  event.stopPropagation();
                  (event.target as HTMLElement).blur();
                }
              }
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              userDismissedSuggestionsRef.current = false;
              setShowSuggestions(true);
              if (mode === 'IDLE') {
                setMode(
                  queryType === 'crawl'
                    ? 'CRAWL_SELECTION'
                    : 'CONTEXT_SELECTION',
                );
              }
            }}
            placeholder={placeholderText}
            aria-label={placeholderText}
          />

          {mode !== 'IDLE' ? (
            <button
              type="button"
              className="icon-button"
              title={t('cancel')}
              aria-label={t('cancel')}
              onClick={cancel}
            >
              <X size={17} />
            </button>
          ) : null}

          <button
            type="button"
            className={`icon-button search-options-btn ${showOptions ? 'active' : ''} ${isCustomOptions ? 'customized' : ''}`}
            title={t('queryOptions')}
            aria-label={t('queryOptions')}
            aria-expanded={showOptions}
            onClick={() => {
              setShowOptions(!showOptions);
              setShowSuggestions(false);
            }}
          >
            <SlidersHorizontal size={16} />
          </button>

          <button
            type="submit"
            className="command-button"
            disabled={isSubmitting || isCrawlBlocked || !query.trim()}
            title={isCrawlBlocked ? t('crawlSelectStartingNodes') : submitLabel}
            aria-label={submitLabel}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <CircularProgress
                size={16}
                strokeWidth={2.5}
                aria-label={submitLabel}
              />
            ) : (
              submitLabel
            )}
          </button>
        </form>

        {/* Mode Guide Info Button on the Right */}
        <button
          type="button"
          className="mode-info-icon-btn"
          onClick={() => setShowModeGuide(true)}
          title={t('queryModesGuideTitle')}
          aria-label={t('queryModesGuideTitle')}
        >
          <HelpCircle size={18} />
        </button>

        {/* Vocabulary Cloud Button on the Right */}
        <button
          type="button"
          className="mode-info-icon-btn vocab-cloud-trigger-btn"
          onClick={() => setShowVocabCloud(true)}
          title="Explore Graph Concepts & Vocabulary Cloud"
          aria-label="Explore Graph Concepts & Vocabulary Cloud"
        >
          <Tag size={18} />
        </button>
      </div>

      <QueryModesGuideDialog
        open={showModeGuide}
        onOpenChange={setShowModeGuide}
      />

      <VocabularyCloudDialog
        open={showVocabCloud}
        onOpenChange={setShowVocabCloud}
        onSelectQuery={(term) => {
          setQuery(term);
          setShowVocabCloud(false);
          setShowSuggestions(false);
          setSuggestions(null);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        }}
      />
    </div>
  );
}
