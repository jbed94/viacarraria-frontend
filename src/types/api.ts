export type SubscriptionTier = 'ANONYMOUS' | 'FREE' | 'PRO';

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

export type LimitsSummary = {
  tier: SubscriptionTier;
  graphs: LimitStatus;
  privateGraphs: LimitStatus;
  queries: LimitStatus;
  uploads: LimitStatus;
  selectedNodes: LimitStatus;
  nodesPerGraph: LimitStatus;
  sourcesPerNode: LimitStatus;
  sourceSizeBytes: LimitStatus;
  extendedContext: LimitStatus;
};

export type Identity = {
  userId: string;
  email: string | null;
  username: string | null;
  isGuest: boolean;
  tier: SubscriptionTier;
  role?: 'admin' | 'user';
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
  score: number;
  rerankScore?: number;
  kind?: 'MATCH' | 'EXTENDED';
  extendedContext?: SearchChunk[];
};

export type SearchSensitivity = 'low' | 'medium' | 'high';
export type SearchScope = 'narrow' | 'normal' | 'wide';

export type SearchResponse = {
  queryId: string;
  leadAnswer?: LeadAnswer;
  results: Array<{ nodeId: string; matchCount: number; chunks: SearchChunk[] }>;
  matchedNodeIds: string[];
  remaining: number;
  extendedSearch: boolean;
  extendedContextCount: number;
  sensitivity?: SearchSensitivity;
  scope?: SearchScope;
};

export type QueryHistory = {
  id: string;
  graphId: string;
  queryText: string;
  selectedNodeIds: string[];
  results: SearchResponse['results'] | null;
  title: string | null;
  isPinned: boolean;
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
  }>;
  billingEvents: Array<{
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
    pro: number;
    free: number;
    anonymous: number;
    newLast30Days: number;
  };
  revenue: {
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
    monthlyDistribution?: Array<{
      month: string;
      label: string;
      revenue: number;
      eventsCount: number;
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

export type AdminSystemSettings = {
  retentionDays: number;
  retentionGraceDays: number;
  freeTierLimits: {
    maxNodes: number;
    maxSourcesPerGraph: number;
    maxSourceSizeBytes: number;
  };
  proTierLimits: {
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
  updatedAt: string;
};

export type UpdateAdminSystemSettingsDto = {
  retentionDays?: number;
  retentionGraceDays?: number;
  freeTierLimits?: Partial<AdminSystemSettings['freeTierLimits']>;
  proTierLimits?: Partial<AdminSystemSettings['proTierLimits']>;
  rateLimits?: Partial<AdminSystemSettings['rateLimits']>;
  maintenanceMode?: boolean;
  maintenanceExemptions?: Partial<MaintenanceExemptions>;
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
