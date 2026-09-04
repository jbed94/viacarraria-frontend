export type SubscriptionTier = 'ANONYMOUS' | 'FREE' | 'PRO';

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
  isAttached?: boolean;
  viewerCount?: number;
  ownerName?: string;
  canQuery?: boolean;
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
