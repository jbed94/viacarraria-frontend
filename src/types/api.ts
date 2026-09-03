export type SubscriptionTier = 'ANONYMOUS' | 'FREE' | 'PRO';

export type LimitStatus = {
  used: number;
  limit: number | null;
  exceeded: boolean;
};

export type LimitsSummary = {
  tier: SubscriptionTier;
  graphs: LimitStatus;
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
};

export type Graph = GraphSummary & { sources: Source[] };

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
  score: number;
  kind?: 'MATCH' | 'EXTENDED';
  extendedContext?: SearchChunk[];
};

export type SearchResponse = {
  queryId: string;
  results: Array<{ nodeId: string; matchCount: number; chunks: SearchChunk[] }>;
  matchedNodeIds: string[];
  remaining: number;
  extendedSearch: boolean;
  extendedContextCount: number;
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
