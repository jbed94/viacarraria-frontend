export type SubscriptionTier = 'ANONYMOUS' | 'REGISTERED';

export type StorageStatus = {
  usedBytes: number;
  limitBytes: number;
  limitMb: number;
  usedPercentage: number;
  exceeded: boolean;
};

export type QueueOccupation = 'low' | 'mid' | 'high';

export type CrawlEntitlements = {
  allowedDepths: string[];
  maxStartingPoints: number | null;
  allowComparative: boolean;
};

export type PublicSystemStatus = {
  status: string;
  maintenanceMode: boolean;
  timestamp?: string;
};

export type LimitStatus = {
  used: number;
  limit: number | null;
  exceeded: boolean;
};

export type CreditLimitInfo = {
  balance: number;
  renewableCredits: number;
  renewablePeriodDays: number;
  nextRenewalAt: string | null;
  userMultiplier: number;
  planMultiplier: number;
  planVersion: number;
  activeTermsName: string;
  adsEnabled: boolean;
};

export type PlanLimits = {
  maxNodes: number;
  maxSourcesPerGraph: number;
  maxSourceSizeBytes: number;
  allowPrivateGraphs: boolean;
  extendedContext: boolean;
  maxConcurrentUploads?: number;
};

export type PlanCostConfig = {
  queryBaseCost: number;
  crawlBaseCost: number;
  crawlStepCost: number;
  sourceBaseCost: number;
  sourceChunkMultiplier: number;
};

export type PlanGrandfatheringPolicy =
  | 'GRANDFATHER_EXISTING'
  | 'FAVORABLE_UPGRADE'
  | 'RENEWAL_MIGRATION';

export type PlanDefinition = {
  tier: SubscriptionTier;
  version: number;
  name: string;
  description?: string | null;
  renewableCredits: number;
  renewalPeriodDays: number;
  priceUsd: number;
  adsEnabled: boolean;
  planMultiplier: number;
  limits: PlanLimits;
  costConfig: PlanCostConfig;
  grandfatheringPolicy: PlanGrandfatheringPolicy;
  effectiveAt: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UpdatePlanDto = {
  name?: string;
  description?: string;
  renewableCredits?: number;
  renewalPeriodDays?: number;
  priceUsd?: number;
  adsEnabled?: boolean;
  planMultiplier?: number;
  limits?: Partial<PlanLimits>;
  costConfig?: Partial<PlanCostConfig>;
  grandfatheringPolicy?: PlanGrandfatheringPolicy;
};

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  description?: string;
  popular?: boolean;
};

export type CreditTransaction = {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  reason?: string;
  transactionType?: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type LimitsSummary = {
  tier: SubscriptionTier;
  storage: StorageStatus;
  queueOccupation: QueueOccupation;
  canCreateGraphs: boolean;
  crawl: CrawlEntitlements;
  // Deprecated backwards-compatible fields
  graphs?: LimitStatus;
  privateGraphs?: LimitStatus;
  queries?: LimitStatus;
  uploads?: LimitStatus;
  selectedNodes?: LimitStatus;
  nodesPerGraph?: LimitStatus;
  sourcesPerNode?: LimitStatus;
  sourceSizeBytes?: LimitStatus;
  extendedContext?: LimitStatus;
  credits?: CreditLimitInfo;
};

export type Identity = {
  userId: string;
  email: string | null;
  username: string | null;
  isGuest: boolean;
  tier: SubscriptionTier;
  role?: 'admin' | 'user';
  storageLimitMb?: number | null;
  creditsBalance?: number;
  userMultiplier?: number;
  emailVerified?: boolean;
};

export type GraphPermission = 'OWNER' | 'VIEWER';

export type SubjectNodeData = {
  title: string;
  category?: string;
  description?: string;
};

export type GraphNode = {
  id: string;
  position: { x: number; y: number };
  data: SubjectNodeData;
};

export type GraphEdge = { id: string; source: string; target: string };

export type Source = {
  id: string;
  nodeId: string;
  graphId: string;
  name: string;
  fileType: string;
  fileUrl: string;
  sizeBytes: number;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';
  jobId: string | null;
  progress?: number;
  content?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GraphSummary = {
  id: string;
  title: string;
  description: string | null;
  userId: string;
  isPublic: boolean;
  isPrepared: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  isOwned: boolean;
  permission: GraphPermission;
  canEdit: boolean;
  accessCount: number;
  isAttached?: boolean;
  viewerCount?: number;
  ownerName?: string;
  canQuery?: boolean;
  lastAccessedAt?: string;
  scheduledForDeletionAt?: string | null;
  isExemptFromRetention?: boolean;
};

export type PublicGraphItem = {
  id: string;
  title: string;
  description: string | null;
  userId: string;
  ownerName: string;
  isPublic: boolean;
  isPrepared: boolean;
  isOwned: boolean;
  isAttached: boolean;
  canQuery: boolean;
  viewerCount: number;
  nodeCount: number;
  sourceCount: number;
  lastAccessedAt?: string;
  scheduledForDeletionAt?: string | null;
  isExemptFromRetention?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Graph = GraphSummary & { sources: Source[] };

export type LeadAnswerType =
  | 'direct'
  | 'procedural'
  | 'definitional'
  | 'tabular';

export type LeadAnswer = {
  chunk: SearchChunk;
  score: number;
  answerType: LeadAnswerType;
  prerequisiteNodes?: Array<{ id: string; title: string }>;
  extensionNodes?: Array<{ id: string; title: string }>;
  surroundingContext?: SearchChunk[];
};

export type SearchChunk = {
  graphId: string;
  sourceId: string;
  sourceName: string;
  nodeId: string;
  content: string;
  context: string;
  startChar: number;
  endChar: number;
  pageNum: number;
  coordinates?: number[];
  elementType?: string;
  imageAssetUrl?: string;
  lqip?: string;
  score: number;
  rerankScore?: number;
  kind?: 'MATCH' | 'EXTENDED';
  extendedContext?: SearchChunk[];
  chunkId?: string;
};

export type SearchSensitivity = 'low' | 'medium' | 'high';
export type SearchScope = 'narrow' | 'normal' | 'wide';

export type CrawlDirection = 'forward' | 'backward' | 'both' | 'global';
export type CrawlDepth = 'shallow' | 'default' | 'deep' | 'unlimited';
export type CrawlMatchType = 'seed' | 'dig' | 'link' | 'jump';

export type CrawlSummaryStats = {
  digsCount: number;
  linksCount: number;
  jumpsCount: number;
  seedTitle: string;
};

export type CrawlSettings = {
  enableDigs?: boolean;
  maxDigsPerTopic?: number;
  enableLinks?: boolean;
  maxLinks?: number;
  enableJumps?: boolean;
  maxJumps?: number;
  maxCandidatesPerStep?: number;
  minScore?: number;
  maxDepth?: number;
};

export type HypothesisGroupDto = {
  id: string;
  name: string;
  nodeIds: string[];
  color?: string;
};

export type ComparativeGroupSummary = {
  id: string;
  name: string;
  count: number;
  color?: string;
  entropy?: number;
  entropyDelta?: number;
  avgScore?: number;
};

export type CrawlNode = {
  id: string;
  level: number;
  matchType?: CrawlMatchType;
  nodeId: string;
  nodeTitle: string;
  chunk: SearchChunk;
  score: number;
  similarityScore?: number;
  rerankScore?: number;
  parentCrawlNodeId?: string;
  stepDescription?: string;
  groupOrigin?: 'groupA' | 'groupB' | 'intersection' | string;
  reachedGroupIds?: string[];
  branchEntropy?: number;
  isPruned?: boolean;
};

export type CrawlEdge = {
  id: string;
  source: string;
  target: string;
  level: number;
  matchType?: CrawlMatchType;
  direction: CrawlDirection;
  similarityScore?: number;
  sharedKeywords?: string[];
};

export type CrawlProgressPayload = {
  graphId: string;
  level: number;
  status: string;
  message: string;
  matchesCount?: number;
  totalMatches?: number;
  currentNodes?: CrawlNode[];
  currentEdges?: CrawlEdge[];
  stats?: CrawlSummaryStats;
  maxBranchEntropy?: number;
  prunedBranchesCount?: number;
  averageBranchEntropy?: number;
};

export type CrawlResponse = {
  queryId: string;
  jobId?: string;
  queryType: 'crawl';
  queryText: string;
  startingNodeIds: string[];
  crawlDepth: CrawlDepth;
  direction: CrawlDirection;
  sensitivity: SearchSensitivity;
  nodes: CrawlNode[];
  edges: CrawlEdge[];
  maxLevelReached: number;
  totalMatches: number;
  matchedNodeIds: string[];
  remaining: number;
  creditsCost?: number;
  searchSpaceMultiplier?: number;
  summary?: string;
  stats?: CrawlSummaryStats;
  maxBranchEntropy?: number;
  prunedBranchesCount?: number;
  comparative?: {
    isComparative: boolean;
    groupA?: string;
    groupB?: string;
    groupACount: number;
    groupBCount: number;
    intersectionCount: number;
    intersectionNodeTitles: string[];
    groups?: ComparativeGroupSummary[];
  };
};

export type CancelCrawlResponse = {
  jobId: string;
  cancelled: boolean;
  message: string;
};

export type CrawlJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type CrawlJobResponse = {
  jobId: string;
  status: CrawlJobStatus;
  graphId?: string;
  message?: string;
  result?: CrawlResponse;
  error?: string;
  createdAt?: string;
  completedAt?: string;
};

export type ActiveCrawlJob = {
  jobId: string;
  graphId: string;
  queryText: string;
  status: CrawlJobStatus;
  progress?: number;
  level?: number;
  maxLevel?: number;
  matchesCount?: number;
  message?: string;
  createdAt: string;
  error?: string;
  result?: CrawlResponse;
};

export type SearchResponse = {
  queryId: string;
  queryType?: 'simple' | 'crawl';
  query?: string;
  expandedKeywords?: string[];
  leadAnswer?: LeadAnswer;
  results: Array<{ nodeId: string; matchCount: number; chunks: SearchChunk[] }>;
  matchedNodeIds: string[];
  remaining: number;
  creditsCost?: number;
  searchSpaceMultiplier?: number;
  extendedSearch?: boolean;
  extendedContextCount?: number;
  sensitivity?: SearchSensitivity;
  scope?: SearchScope;
};

export type GraphVocabularyItem = {
  term: string;
  normalized: string;
  nodeIds: string[];
  weight: number;
  sourceType:
    | 'node_title'
    | 'heading'
    | 'bold'
    | 'acronym'
    | 'keyphrase'
    | string;
};

export type SearchSuggestionVocabulary = {
  term: string;
  nodeIds: string[];
  sourceType?: string;
};

export type SearchSuggestionSynonym = {
  term: string;
  expansions: string[];
};

export type SearchSuggestionsResponse = {
  querySuggestions: string[];
  vocabularySuggestions: SearchSuggestionVocabulary[];
  synonymSuggestions: SearchSuggestionSynonym[];
};

export type QueryHistory = {
  id: string;
  graphId: string;
  queryText: string;
  selectedNodeIds: string[];
  results:
    | SearchResponse['results']
    | CrawlResponse
    | (SearchResponse & { queryType?: string })
    | null;
  title: string | null;
  isPinned: boolean;
  creditsCost?: number;
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: {
    graphId?: string;
    scheduledForDeletionAt?: string;
    [key: string]: unknown;
  } | null;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  unreadCount: number;
};

export type RetentionAuditStats = {
  inactiveCandidateCount: number;
  scheduledForDeletionCount: number;
  exemptGraphsCount: number;
  activeArchivesCount: number;
  totalActiveGraphs: number;
  estimatedReclaimBytes: number;
};

export type GraphArchiveItem = {
  id: string;
  graphId: string;
  userId: string;
  title: string;
  archiveUrl: string;
  sizeBytes: number;
  sourceCount: number;
  expiresAt: string;
  createdAt: string;
};

export type RetentionRunResponse = {
  dryRun: boolean;
  scheduled: {
    count: number;
    graphIds: string[];
  };
  purged: {
    count: number;
    details: Array<{
      graphId: string;
      title: string;
      sourcesPurged: number;
      storageObjectsPurged: number;
      estimatedSizeBytes?: number;
    }>;
  };
  audit?: {
    exemptGraphsCount: number;
    estimatedReclaimBytes: number;
    archivedGraphsCount?: number;
  };
};

export type StorageProxyStatus = {
  driver: 's3' | 'local';
  proxyEndpoint: string;
  bucket: string;
  isProxy: boolean;
  upstreamProvider: 'none' | 's3' | 'gcs';
  upstreamBucket?: string;
  connected: boolean;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  isAnonymous: boolean;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: string | null;
  storageLimitMb?: number | null;
  usedStorageBytes?: number;
  creditsBalance?: number;
  userMultiplier?: number;
  preferredLanguage: string;
  createdAt: string;
  updatedAt: string;
  graphsCount: number;
  sourcesCount: number;
};

export type AdminUserDetails = {
  user: AdminUser;
  graphs: Array<{
    id: string;
    title: string;
    isPublic: boolean;
    isExemptFromRetention: boolean;
    lastAccessedAt: string;
    createdAt: string;
  }>;
  recentQueries: Array<{
    id: string;
    graphId: string;
    queryText: string;
    createdAt: string;
    creditsCost?: number;
  }>;
  billingEvents?: Array<{
    id: string;
    provider: string;
    eventType: string;
    createdAt: string;
  }>;
  storage: {
    sourcesCount: number;
    totalBytes: number;
  };
};

export type AdminGraph = {
  id: string;
  title: string;
  description: string | null;
  userId: string;
  isPublic: boolean;
  isPrepared: boolean;
  lastAccessedAt: string;
  scheduledForDeletionAt: string | null;
  isExemptFromRetention: boolean;
  createdAt: string;
  updatedAt: string;
  ownerEmail: string | null;
  ownerName: string | null;
  nodeCount: number;
  sourceCount: number;
};

export type AdminGraphDetails = AdminGraph & {
  nodes: GraphNode[];
  edges: GraphEdge[];
  sources: Source[];
};

export type AdminOverviewStats = {
  users: {
    total: number;
    registered: number;
    anonymous: number;
    newLast30Days: number;
    pro?: number;
    free?: number;
  };
  similarityQueue: {
    occupation: QueueOccupation | string;
    anonymousThroughputPerMinute: number;
    registeredThroughputPerMinute: number;
  };
  storageQuota: {
    defaultStorageLimitMb: number;
    totalStorageBytes: number;
    totalSources: number;
  };
  revenue?: {
    monthlyRecurringRevenue: number;
    totalRevenue?: number;
    proPriceUsd: number;
    activeSubscriptions: number;
    recentEvents: Array<{
      id: string;
      userId: string;
      eventType: string;
      provider: string;
      createdAt: string;
    }>;
  };
  requests: {
    totalQueries: number;
    queriesLast24Hours: number;
    currentRequestsPerHour: number;
    avgRequestsPerHour: number;
    hourlyDistribution: Array<{
      hour: string;
      count: number;
    }>;
  };
  graphs: {
    total: number;
    public: number;
    private: number;
    active: number;
    inactive: number;
    scheduledForDeletion: number;
    retentionExempt: number;
  };
  storage: {
    totalSources: number;
    totalStorageBytes: number;
    archivesCount: number;
    archivesBytes: number;
  };
};

export type AdminBillingEvent = {
  id: string;
  userId: string;
  provider: string;
  externalEventId: string | null;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  userEmail: string | null;
  userName: string | null;
};

export type AdminSystemStatus = {
  health: {
    status: 'ok' | 'degraded';
    services: Record<string, boolean>;
  };
  storageProxy: StorageProxyStatus;
  process: {
    uptimeSeconds: number;
    nodeVersion: string;
    memoryMb: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
    env: string;
  };
};

export type AdminPagination<T> = {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type AdminBatchResult = {
  success: boolean;
  action: string;
  count: number;
  [key: string]: unknown;
};

export type MaintenanceExemptions = {
  allowedIps?: string[];
  exemptUserIds?: string[];
  exemptRoles?: string[];
};

export type SimilarityQuotaConfig = {
  anonymousThroughputPerMinute: number;
  registeredThroughputPerMinute: number;
};

export type StorageConfig = {
  defaultStorageLimitMb: number;
};

export type AdConfig = {
  effectiveEcpm: number;
  canvasAdDensity: number;
  maxCanvasAds: number;
};

export type AdminSystemSettings = {
  retentionDays: number;
  retentionGraceDays: number;
  similarityQuota: SimilarityQuotaConfig;
  storageConfig: StorageConfig;
  adConfig?: AdConfig;
  freeTierLimits?: {
    maxNodes: number;
    maxSourcesPerGraph: number;
    maxSourceSizeBytes: number;
  };
  proTierLimits?: {
    maxNodes: number;
    maxSourcesPerGraph: number;
    maxSourceSizeBytes: number;
  };
  rateLimits: {
    anonymousPerMinute: number;
    authenticatedPerMinute: number;
    burstMultiplier: number;
  };
  maintenanceMode: boolean;
  maintenanceExemptions?: MaintenanceExemptions;
  synonymsConfig?: Record<string, string[]>;
  updatedAt: string;
};

export type UpdateAdminSystemSettingsDto = {
  retentionDays?: number;
  retentionGraceDays?: number;
  similarityQuota?: Partial<SimilarityQuotaConfig>;
  storageConfig?: Partial<StorageConfig>;
  adConfig?: Partial<AdConfig>;
  freeTierLimits?: Partial<{
    maxNodes: number;
    maxSourcesPerGraph: number;
    maxSourceSizeBytes: number;
  }>;
  proTierLimits?: Partial<{
    maxNodes: number;
    maxSourcesPerGraph: number;
    maxSourceSizeBytes: number;
  }>;
  rateLimits?: Partial<AdminSystemSettings['rateLimits']>;
  maintenanceMode?: boolean;
  maintenanceExemptions?: Partial<MaintenanceExemptions>;
  synonymsConfig?: Record<string, string[]>;
};

export type AdminAuditEvent = {
  id: string;
  timestamp: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  targetType: 'system' | 'user' | 'graph' | 'subscription' | 'retention';
  targetId?: string;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
};

export type GetAuditLogsResponse = {
  items: AdminAuditEvent[];
  total: number;
  limit: number;
  offset: number;
};

export type AuditLogArchive = {
  id: string;
  key: string;
  filename: string;
  eventCount: number;
  sizeBytes: number;
  firstEventTimestamp?: string;
  lastEventTimestamp?: string;
  createdAt: string;
};

export type GetAuditArchivesResponse = {
  items: AuditLogArchive[];
  total: number;
  limit: number;
  offset: number;
};

export type AuditArchivePreviewResponse = {
  archive: AuditLogArchive;
  items: AdminAuditEvent[];
  total: number;
  limit: number;
  offset: number;
};

export type AutoRefillSettings = {
  enabled: boolean;
  threshold: number;
  packId: string;
  pack?: {
    id: string;
    name: string;
    credits: number;
    priceUsd: number;
  };
  monthlyLimit?: number;
  refillsThisMonth?: number;
  notifyLowBalance?: boolean;
  notifyAutoRefill?: boolean;
  notifyChannel?: 'IN_APP' | 'EMAIL' | 'ALL';
};

export type UpdateAutoRefillDto = {
  enabled: boolean;
  threshold?: number;
  packId?: string;
  monthlyLimit?: number;
  notifyLowBalance?: boolean;
  notifyAutoRefill?: boolean;
  notifyChannel?: 'IN_APP' | 'EMAIL' | 'ALL';
};

export type AdTelemetryPayload = {
  eventType: 'impression' | 'culled' | 'refresh' | 'viewable_pulse' | 'consent';
  format?:
    | 'banner'
    | 'card'
    | 'sidebar'
    | 'canvas_node'
    | 'rectangle'
    | 'horizontal'
    | 'vertical'
    | 'fluid'
    | string;
  durationSeconds?: number;
  consent?: 'granted' | 'essential_only' | 'denied' | 'pending' | string;
  slotId?: string;
  graphId?: string;
  tags?: string[];
};

export type AdGraphRevenueItem = {
  graphId: string;
  graphName: string;
  isPublic: boolean;
  impressions: number;
  activeViewableSeconds: number;
  estimatedRevenueUsd: number;
};

export type AdAnalyticsSummary = {
  totalImpressions: number;
  totalCulled: number;
  totalRefreshes: number;
  averageViewabilitySeconds: number;
  totalActiveViewableSeconds: number;
  consentBreakdown: {
    personalized: number;
    contextual: number;
    declined: number;
  };
  estimatedRevenueUsd: number;
  effectiveEcpm: number;
  gpuSavingsPercentage: number;
  range?: string;
  topGraphs?: AdGraphRevenueItem[];
};

export type PaymentMethodDetails = {
  hasPaymentMethod: boolean;
  customerId: string | null;
  paymentMethodId: string | null;
  brand?: string;
  last4?: string;
};

export type SetupIntentResponse = {
  clientSecret: string;
  customerId: string;
  setupIntentId: string;
};

export type TelemetryDateRange = '7d' | '30d' | '90d' | 'all';

export type AdTelemetryStatus = {
  totalEventsCount: number;
  totalRollupsCount: number;
  oldestEventDate: string | null;
  newestEventDate: string | null;
  lastRollupDate: string | null;
  retentionDays: number;
  autoRollupEnabled: boolean;
  scheduleIntervalHours: number;
};

export type AdContextTag = {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  matchCount: number;
  sendCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdContextTagStats = {
  totalTags: number;
  activeTags: number;
  totalMatches: number;
  totalImpressionsSent: number;
  topMatchedTags: Array<{ slug: string; name: string; matchCount: number }>;
  topImpressionTags: Array<{ slug: string; name: string; sendCount: number }>;
};

export type ResolvedGraphAdContext = {
  graphId: string;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
    weight: number;
  }>;
  cached: boolean;
};

export type CreateAdContextTagDto = {
  name: string;
  slug?: string;
  description: string;
  isActive?: boolean;
};

export type UpdateAdContextTagDto = {
  name?: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
};
