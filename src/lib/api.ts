import type {
  Graph,
  GraphEdge,
  GraphSummary,
  Identity,
  QueryHistory,
  SearchResponse,
  SearchScope,
  SearchSensitivity,
  Source,
  SubscriptionTier,
  LimitsSummary,
} from '../types/api';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type AuthUser = {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  isAnonymous?: boolean | null;
  subscriptionTier?: string | null;
};

type AuthResponse = {
  user: AuthUser;
  token?: string;
};

function identityFromUser(user: AuthUser): Identity {
  const isGuest = user.isAnonymous === true;
  const tier = isGuest
    ? 'ANONYMOUS'
    : user.subscriptionTier === 'PRO'
      ? 'PRO'
      : 'FREE';
  return {
    userId: user.id,
    email: user.email,
    username: user.username ?? user.name,
    isGuest,
    tier,
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData
        ? {}
        : { 'content-type': 'application/json' }),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new ApiError(body?.message ?? 'Request failed.', response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  session: async () => {
    const current = await request<AuthResponse | null>('/auth/get-session');
    if (current) return identityFromUser(current.user);
    const anonymous = await request<AuthResponse>('/auth/sign-in/anonymous', {
      method: 'POST',
      body: '{}',
    });
    return identityFromUser(anonymous.user);
  },
  register: async (email: string, password: string, username: string) => {
    const result = await request<AuthResponse>('/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({
        name: username,
        username,
        email,
        password,
      }),
    });
    return {
      identity: identityFromUser(result.user),
      token: result.token ?? '',
    };
  },
  login: async (email: string, password: string) => {
    const result = await request<AuthResponse>('/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe: true }),
    });
    return {
      identity: identityFromUser(result.user),
      token: result.token ?? '',
    };
  },
  logout: () => request<void>('/auth/sign-out', { method: 'POST', body: '{}' }),
  googleSignIn: async () => {
    const result = await request<{ url?: string }>('/auth/sign-in/social', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'google',
        callbackURL: window.location.origin,
      }),
    });
    if (!result.url) {
      throw new ApiError('Google sign-in is not configured.', 503);
    }
    window.location.assign(result.url);
  },
  graphs: () => request<GraphSummary[]>('/graphs'),
  graph: (id: string) => request<Graph>(`/graphs/${id}`),
  createGraph: (title: string, description: string) =>
    request<Graph>('/graphs', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    }),
  updateGraph: (id: string, nodes: Graph['nodes'], edges: GraphEdge[]) =>
    request<Graph>(`/graphs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ nodes, edges }),
    }),
  finalizeGraph: (id: string) =>
    request<Graph>(`/graphs/${id}/finalize`, { method: 'POST' }),
  deleteGraph: (id: string) =>
    request<void>(`/graphs/${id}`, { method: 'DELETE' }),
  copyGraph: (id: string, title: string) =>
    request<Graph>(`/graphs/${id}/copy`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  search: (
    graphId: string,
    query: string,
    selectedNodeIds: string[],
    extendedSearch = false,
    sensitivity?: SearchSensitivity,
    scope?: SearchScope,
  ) =>
    request<SearchResponse>('/search', {
      method: 'POST',
      body: JSON.stringify({
        graphId,
        query,
        selectedNodeIds,
        extendedSearch,
        ...(sensitivity ? { sensitivity } : {}),
        ...(scope ? { scope } : {}),
      }),
    }),
  history: () => request<QueryHistory[]>('/queries'),
  updateQuery: (id: string, values: { title?: string; isPinned?: boolean }) =>
    request<QueryHistory>(`/queries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    }),
  source: (id: string) => request<Source>(`/sources/${id}`),
  sourceDownloadUrl: (id: string) => `${apiUrl}/sources/${id}/download`,
  sourceFileUrl: (id: string) =>
    request<{ url: string; direct: boolean; fileName: string }>(
      `/sources/${id}/file-url`,
    ),
  uploadSource: (graphId: string, nodeId: string, file: File) => {
    const body = new FormData();
    body.set('graphId', graphId);
    body.set('nodeId', nodeId);
    body.set('file', file);
    return request<Source>('/sources/upload', { method: 'POST', body });
  },
  deleteSource: (id: string) =>
    request<void>(`/sources/${id}`, { method: 'DELETE' }),
  subscription: () =>
    request<{ tier: SubscriptionTier; expiresAt: string | null }>(
      '/billing/subscription',
    ),
  checkout: () =>
    request<{
      checkoutUrl: string | null;
      subscription: { tier: SubscriptionTier };
    }>('/billing/checkout', { method: 'POST', body: '{}' }),
  profile: () => request<Identity & { preferredLanguage: string }>('/profile'),
  updateProfile: (username: string, preferredLanguage: string) =>
    request<Identity & { preferredLanguage: string }>('/profile', {
      method: 'PATCH',
      body: JSON.stringify({ username, preferredLanguage }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  sessions: () =>
    request<
      Array<{
        id: string;
        expiresAt: string;
        lastUsedAt: string;
        createdAt: string;
      }>
    >('/sessions'),
  revokeSession: (id: string) =>
    request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  deleteProfile: () => request<void>('/profile', { method: 'DELETE' }),
  limits: () => request<LimitsSummary>('/limits'),
};

export { ApiError };
