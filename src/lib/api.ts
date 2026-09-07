import type {
  AdminBatchResult,
  AdminBillingEvent,
  AdminGraph,
  AdminGraphDetails,
  AdminOverviewStats,
  AdminPagination,
  AdminSystemSettings,
  AdminSystemStatus,
  AdminUser,
  AdminUserDetails,
  Graph,
  GraphArchiveItem,
  GraphEdge,
  GraphSummary,
  Identity,
  LimitsSummary,
  NotificationItem,
  NotificationListResponse,
  PublicGraphItem,
  QueryHistory,
  RetentionAuditStats,
  RetentionRunResponse,
  SearchResponse,
  SearchScope,
  SearchSensitivity,
  Source,
  StorageProxyStatus,
  SubscriptionTier,
  PublicSystemStatus,
  UpdateAdminSystemSettingsDto,
  GetAuditLogsResponse,
  AuditLogArchive,
  GetAuditArchivesResponse,
  AuditArchivePreviewResponse,
} from '../types/api';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly isMaintenance: boolean = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type MaintenanceSubscriber = (active: boolean, message?: string) => void;
const maintenanceSubscribers = new Set<MaintenanceSubscriber>();

export function subscribeMaintenanceMode(
  subscriber: MaintenanceSubscriber,
): () => void {
  maintenanceSubscribers.add(subscriber);
  return () => {
    maintenanceSubscribers.delete(subscriber);
  };
}

export function notifyMaintenanceMode(active: boolean, message?: string): void {
  maintenanceSubscribers.forEach((callback) => {
    try {
      callback(active, message);
    } catch {
      // Ignore subscriber errors
    }
  });
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
    role: (user as any).role ?? ((user as any).isAdmin ? 'admin' : undefined),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const adminKey =
    typeof window !== 'undefined' ? localStorage.getItem('vc_admin_key') : null;
  const adminHeaders: Record<string, string> = adminKey
    ? { 'x-admin-key': adminKey }
    : {};

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body instanceof FormData
        ? {}
        : { 'content-type': 'application/json' }),
      ...adminHeaders,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      maintenance?: boolean;
    } | null;

    const isMaintenance =
      response.status === 503 &&
      (body?.maintenance === true ||
        (typeof body?.message === 'string' &&
          body.message.toLowerCase().includes('maintenance')));

    if (isMaintenance) {
      notifyMaintenanceMode(true, body?.message);
    }

    throw new ApiError(
      body?.message ?? 'Request failed.',
      response.status,
      isMaintenance,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function downloadBlob(path: string): Promise<Blob> {
  const adminKey =
    typeof window !== 'undefined' ? localStorage.getItem('vc_admin_key') : null;
  const adminHeaders: Record<string, string> = adminKey
    ? { 'x-admin-key': adminKey }
    : {};

  const response = await fetch(`${apiUrl}${path}`, {
    credentials: 'include',
    headers: {
      ...adminHeaders,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new ApiError(body?.message ?? 'Download failed.', response.status);
  }
  return response.blob();
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 150);
}

import type { HashWorkerRequest, HashWorkerResponse } from './upload.worker';

let sharedHashWorker: Worker | null = null;
const pendingWorkerRequests = new Map<
  string,
  { resolve: (hash: string) => void; reject: (err: Error) => void }
>();

export function getOrCreateHashWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (sharedHashWorker) return sharedHashWorker;
  try {
    sharedHashWorker = new Worker(
      new URL('./upload.worker.ts', import.meta.url),
      { type: 'module' },
    );
    sharedHashWorker.onmessage = (event: MessageEvent<HashWorkerResponse>) => {
      const { id, hash, error } = event.data;
      const handlers = pendingWorkerRequests.get(id);
      if (!handlers) return;
      pendingWorkerRequests.delete(id);
      if (error) {
        handlers.reject(new Error(error));
      } else {
        handlers.resolve(hash ?? '');
      }
    };
    sharedHashWorker.onerror = (err) => {
      for (const handlers of pendingWorkerRequests.values()) {
        handlers.reject(new Error(err.message || 'Hash worker failure'));
      }
      pendingWorkerRequests.clear();
      sharedHashWorker?.terminate();
      sharedHashWorker = null;
    };
    return sharedHashWorker;
  } catch {
    return null;
  }
}

export function terminateHashWorker(): void {
  if (sharedHashWorker) {
    sharedHashWorker.terminate();
    sharedHashWorker = null;
    pendingWorkerRequests.clear();
  }
}

export async function computeSha256ViaWorker(
  buffer: ArrayBuffer,
): Promise<string> {
  const worker = getOrCreateHashWorker();
  if (!worker) {
    throw new Error('Worker not available');
  }
  return new Promise<string>((resolve, reject) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    pendingWorkerRequests.set(id, { resolve, reject });
    worker.postMessage({ id, buffer } satisfies HashWorkerRequest);
  });
}

export async function computeSha256(
  data: Blob | File | ArrayBuffer,
): Promise<string> {
  // If large Blob/File (> 50MB), avoid browser tab OOM by hashing a composite deterministic sample
  if (
    typeof Blob !== 'undefined' &&
    data instanceof Blob &&
    data.size > 50 * 1024 * 1024
  ) {
    const head = data.slice(0, 2 * 1024 * 1024);
    const midStart = Math.floor(data.size / 2);
    const mid = data.slice(midStart, midStart + 2 * 1024 * 1024);
    const tail = data.slice(data.size - 2 * 1024 * 1024);
    const combined = new Blob([
      head,
      mid,
      tail,
      new TextEncoder().encode(`:${data.size}:${(data as any).name || ''}`),
    ]);
    const reader = new FileReader();
    const sampleBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(combined);
    });
    if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', sampleBuffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  }

  let buffer: ArrayBuffer;
  if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (ArrayBuffer.isView(data)) {
    buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
  } else if (typeof (data as any)?.arrayBuffer === 'function') {
    buffer = await (data as Blob).arrayBuffer();
  } else if (
    typeof Blob !== 'undefined' &&
    data instanceof Blob &&
    typeof FileReader !== 'undefined'
  ) {
    buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(data);
    });
  } else {
    buffer = new ArrayBuffer(0);
  }

  // 1. Attempt offloading to dedicated background Web Worker
  try {
    const workerHash = await computeSha256ViaWorker(buffer);
    if (workerHash) return workerHash;
  } catch {
    // Fall back to main thread crypto.subtle on worker error / unavailability
  }

  // 2. Main thread fallback
  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}

export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB standard chunk size
export const CHUNK_SIZE = DEFAULT_CHUNK_SIZE;
export const MULTIPART_CONCURRENCY = 3;
export const MAX_RETRIES = 3;

export function getOptimalChunkSize(fileSize: number): number {
  if (fileSize <= 50 * 1024 * 1024) {
    return 5 * 1024 * 1024; // 5MB for <= 50MB
  }
  if (fileSize <= 200 * 1024 * 1024) {
    return 10 * 1024 * 1024; // 10MB for 50MB - 200MB
  }
  if (fileSize <= 1024 * 1024 * 1024) {
    return 20 * 1024 * 1024; // 20MB for 200MB - 1GB
  }
  return 50 * 1024 * 1024; // 50MB for > 1GB
}

export interface UploadProgressMetadata {
  status: 'uploading' | 'paused' | 'resuming' | 'completing' | 'error';
  concurrency?: number;
  speedBps?: number;
}

export type UploadProgressCallback = (
  percent: number,
  loadedBytes: number,
  totalBytes: number,
  meta?: UploadProgressMetadata,
) => void;

export interface UploadController {
  readonly abortController: AbortController;
  readonly signal: AbortSignal;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  isPaused: () => boolean;
  isCancelled: () => boolean;
  waitIfPaused: () => Promise<void>;
  setConcurrency: (c: number) => void;
  getConcurrency: () => number;
}

export function createUploadController(
  initialConcurrency = MULTIPART_CONCURRENCY,
): UploadController {
  const abortController = new AbortController();
  let paused = false;
  let cancelled = false;
  let concurrency = Math.min(6, Math.max(2, initialConcurrency));
  let resumeResolve: (() => void) | null = null;
  let pausePromise: Promise<void> | null = null;

  return {
    get abortController() {
      return abortController;
    },
    get signal() {
      return abortController.signal;
    },
    pause: () => {
      if (paused || cancelled) return;
      paused = true;
      pausePromise = new Promise<void>((resolve) => {
        resumeResolve = resolve;
      });
    },
    resume: () => {
      if (!paused) return;
      paused = false;
      const r = resumeResolve;
      resumeResolve = null;
      pausePromise = null;
      r?.();
    },
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      if (paused) {
        paused = false;
        const r = resumeResolve;
        resumeResolve = null;
        pausePromise = null;
        r?.();
      }
      abortController.abort();
    },
    isPaused: () => paused,
    isCancelled: () => cancelled || abortController.signal.aborted,
    waitIfPaused: async () => {
      if (paused && pausePromise) {
        await pausePromise;
      }
      if (abortController.signal.aborted) {
        throw new DOMException('Upload aborted', 'AbortError');
      }
    },
    setConcurrency: (c: number) => {
      concurrency = Math.min(6, Math.max(2, c));
    },
    getConcurrency: () => concurrency,
  };
}

export interface ActiveTransferRecord {
  uploadKey: string;
  sessionKey: string;
  graphId: string;
  nodeId: string;
  file: File;
  controller: UploadController;
  onProgress?: UploadProgressCallback;
}

export const activeUploadRegistry = new Map<string, ActiveTransferRecord>();

export function getActiveUploadController(
  uploadKey: string,
): UploadController | undefined {
  return activeUploadRegistry.get(uploadKey)?.controller;
}

export function pauseActiveUpload(uploadKey: string): boolean {
  const record = activeUploadRegistry.get(uploadKey);
  if (
    record &&
    !record.controller.isPaused() &&
    !record.controller.isCancelled()
  ) {
    record.controller.pause();
    record.onProgress?.(-1, -1, -1, {
      status: 'paused',
      concurrency: record.controller.getConcurrency(),
    });
    return true;
  }
  return false;
}

export function resumeActiveUpload(uploadKey: string): boolean {
  const record = activeUploadRegistry.get(uploadKey);
  if (
    record &&
    record.controller.isPaused() &&
    !record.controller.isCancelled()
  ) {
    record.controller.resume();
    record.onProgress?.(-1, -1, -1, {
      status: 'resuming',
      concurrency: record.controller.getConcurrency(),
    });
    return true;
  }
  return false;
}

export function cancelActiveUpload(uploadKey: string): boolean {
  const record = activeUploadRegistry.get(uploadKey);
  if (record) {
    record.controller.cancel();
    activeUploadRegistry.delete(uploadKey);
    return true;
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    for (const record of activeUploadRegistry.values()) {
      if (!record.controller.isPaused() && !record.controller.isCancelled()) {
        record.controller.pause();
        record.onProgress?.(-1, -1, -1, {
          status: 'paused',
          concurrency: record.controller.getConcurrency(),
        });
      }
    }
  });

  window.addEventListener('online', () => {
    for (const record of activeUploadRegistry.values()) {
      if (record.controller.isPaused() && !record.controller.isCancelled()) {
        record.controller.resume();
        record.onProgress?.(-1, -1, -1, {
          status: 'resuming',
          concurrency: record.controller.getConcurrency(),
        });
      }
    }
  });
}

export interface ResumableUploadSession {
  sessionKey: string;
  graphId: string;
  nodeId: string;
  sourceId: string;
  jobId: string;
  storageKey: string;
  uploadId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  chunkSize?: number;
  checksumSha256?: string;
  parts: Array<{
    partNumber: number;
    uploadUrl: string;
    headers?: Record<string, string>;
  }>;
  completedParts: Array<{ partNumber: number; eTag: string }>;
  createdAt: number;
}

export function buildUploadSessionKey(
  graphId: string,
  nodeId: string,
  file: File,
): string {
  return `via_upload_${graphId}_${nodeId}_${file.name}_${file.size}_${file.lastModified}`;
}

export function getStoredUploadSession(
  sessionKey: string,
): ResumableUploadSession | null {
  try {
    const raw = localStorage.getItem(sessionKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as ResumableUploadSession;
    // Expire sessions older than 24 hours
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(sessionKey);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveUploadSession(session: ResumableUploadSession): void {
  try {
    localStorage.setItem(session.sessionKey, JSON.stringify(session));
  } catch {
    // Gracefully handle storage quota or privacy mode errors
  }
}

export function clearUploadSession(sessionKey: string): void {
  try {
    localStorage.removeItem(sessionKey);
  } catch {
    // Ignore errors
  }
}

export async function uploadPartsConcurrently(
  parts: Array<{
    uploadUrl: string;
    partNumber: number;
    headers?: Record<string, string>;
  }>,
  file: File,
  concurrency = MULTIPART_CONCURRENCY,
  maxRetries = MAX_RETRIES,
  onProgress?: UploadProgressCallback,
  existingCompletedParts: Array<{ partNumber: number; eTag: string }> = [],
  onPartCompleted?: (part: { partNumber: number; eTag: string }) => void,
  chunkSize?: number,
  controller?: UploadController,
): Promise<Array<{ partNumber: number; eTag: string }>> {
  const effectiveChunkSize = chunkSize ?? getOptimalChunkSize(file.size);
  const completedPartsMap = new Map<number, string>();
  for (const cp of existingCompletedParts) {
    completedPartsMap.set(cp.partNumber, cp.eTag);
  }

  // Filter out parts that are already completed
  const pendingParts = parts.filter(
    (p) => !completedPartsMap.has(p.partNumber),
  );

  // Compute initially completed bytes from previously saved parts
  let completedBytes = existingCompletedParts.reduce((acc, cp) => {
    const start = (cp.partNumber - 1) * effectiveChunkSize;
    const end = Math.min(start + effectiveChunkSize, file.size);
    return acc + (end - start);
  }, 0);

  let targetConcurrency = controller
    ? controller.getConcurrency()
    : Math.min(6, Math.max(2, concurrency));

  let lastSpeedCheckTime = Date.now();
  let lastSpeedCheckBytes = completedBytes;
  let currentSpeedBps = 0;

  function updateSpeed(newBytes: number) {
    const now = Date.now();
    const elapsed = (now - lastSpeedCheckTime) / 1000;
    if (elapsed >= 0.5) {
      const bytesDiff = newBytes - lastSpeedCheckBytes;
      currentSpeedBps = Math.max(0, Math.round(bytesDiff / elapsed));
      lastSpeedCheckTime = now;
      lastSpeedCheckBytes = newBytes;
    }
  }

  function emitProgress(
    status: UploadProgressMetadata['status'] = 'uploading',
  ) {
    if (onProgress) {
      const currentPercent = Math.min(
        100,
        Math.round((completedBytes / file.size) * 100),
      );
      onProgress(currentPercent, completedBytes, file.size, {
        status: currentPercent >= 100 ? 'completing' : status,
        concurrency: targetConcurrency,
        speedBps: currentSpeedBps,
      });
    }
  }

  emitProgress('uploading');

  let currentIndex = 0;
  let activeWorkers = 0;
  let hasError = false;
  let firstError: any = null;

  async function uploadWorker(): Promise<void> {
    while (currentIndex < pendingParts.length && !hasError) {
      if (activeWorkers > targetConcurrency) {
        // Gracefully shed excess workers when concurrency was adapted downward
        break;
      }

      if (controller) {
        await controller.waitIfPaused();
        if (controller.isCancelled()) {
          hasError = true;
          firstError = new DOMException('Upload aborted', 'AbortError');
          break;
        }
      }

      const index = currentIndex++;
      const part = pendingParts[index];
      if (!part) break;

      const start = (part.partNumber - 1) * effectiveChunkSize;
      const end = Math.min(start + effectiveChunkSize, file.size);
      const chunk = file.slice(start, end);
      const partBytes = end - start;

      let attempts = 0;
      let uploaded = false;

      while (attempts < maxRetries && !uploaded && !hasError) {
        if (controller?.isCancelled()) {
          hasError = true;
          firstError = new DOMException('Upload aborted', 'AbortError');
          break;
        }

        // Handle offline before attempt
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          if (controller && !controller.isPaused()) {
            controller.pause();
            emitProgress('paused');
          }
          await controller?.waitIfPaused();
        }

        attempts++;
        const startTime = Date.now();

        try {
          const uploadTarget = part.uploadUrl.startsWith('http')
            ? part.uploadUrl
            : `${apiUrl}${part.uploadUrl.replace(/^\/api/, '')}`;

          const res = await fetch(uploadTarget, {
            method: 'PUT',
            headers: part.headers ?? {
              'Content-Type': 'application/octet-stream',
            },
            body: chunk,
            signal: controller?.signal,
          });

          if (res.status === 429 || res.status === 503) {
            targetConcurrency = Math.max(2, targetConcurrency - 1);
            controller?.setConcurrency(targetConcurrency);
            throw new Error(
              `Part ${part.partNumber} upload failed with status ${res.status}`,
            );
          }

          if (!res.ok) {
            throw new Error(
              `Part ${part.partNumber} upload failed with status ${res.status}`,
            );
          }

          if (controller?.isCancelled()) {
            hasError = true;
            firstError = new DOMException('Upload aborted', 'AbortError');
            break;
          }

          const rtt = Date.now() - startTime;
          if (rtt < 1200 && targetConcurrency < 6) {
            targetConcurrency = Math.min(6, targetConcurrency + 1);
            controller?.setConcurrency(targetConcurrency);
          } else if (rtt > 4500 && targetConcurrency > 2) {
            targetConcurrency = Math.max(2, targetConcurrency - 1);
            controller?.setConcurrency(targetConcurrency);
          }

          let eTag = res.headers.get('ETag') || res.headers.get('etag');
          if (eTag) {
            eTag = eTag.replace(/"/g, '');
          } else {
            try {
              const body = await res.json();
              eTag = body?.eTag;
            } catch {
              eTag = `part-${part.partNumber}`;
            }
          }

          const completedPart = {
            partNumber: part.partNumber,
            eTag: eTag || `part-${part.partNumber}`,
          };
          completedPartsMap.set(part.partNumber, completedPart.eTag);
          completedBytes += partBytes;
          updateSpeed(completedBytes);
          emitProgress('uploading');

          if (onPartCompleted) {
            onPartCompleted(completedPart);
          }

          uploaded = true;
        } catch (err: any) {
          if (controller?.isCancelled() || err?.name === 'AbortError') {
            hasError = true;
            firstError = err;
            break;
          }

          // Check if browser just went offline during fetch
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            if (controller && !controller.isPaused()) {
              controller.pause();
              emitProgress('paused');
            }
            await controller?.waitIfPaused();
            attempts = Math.max(0, attempts - 1);
            continue;
          }

          if (attempts >= maxRetries) {
            hasError = true;
            firstError = err;
            break;
          }

          await new Promise((r) =>
            setTimeout(r, Math.min(4000, 100 * 2 ** (attempts - 1))),
          );
        }
      }
    }
  }

  return new Promise<Array<{ partNumber: number; eTag: string }>>(
    (resolve, reject) => {
      function checkDone() {
        if (activeWorkers === 0) {
          if (
            hasError ||
            completedPartsMap.size !== parts.length ||
            controller?.isCancelled()
          ) {
            reject(
              firstError ||
                (controller?.isCancelled()
                  ? new DOMException('Upload aborted', 'AbortError')
                  : new Error(
                      'One or more multipart chunks failed to upload.',
                    )),
            );
          } else {
            resolve(
              Array.from(completedPartsMap.entries())
                .map(([partNumber, eTag]) => ({ partNumber, eTag }))
                .sort((a, b) => a.partNumber - b.partNumber),
            );
          }
        }
      }

      function spawnWorker() {
        activeWorkers++;
        uploadWorker()
          .catch((err) => {
            hasError = true;
            if (!firstError) firstError = err;
          })
          .finally(() => {
            activeWorkers--;
            maybeSpawnWorkers();
            checkDone();
          });
      }

      function maybeSpawnWorkers() {
        if (hasError) return;
        while (
          activeWorkers < targetConcurrency &&
          currentIndex < pendingParts.length
        ) {
          spawnWorker();
        }
      }

      maybeSpawnWorkers();
      checkDone();
    },
  );
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
  publicGraphs: (search?: string) =>
    request<PublicGraphItem[]>(
      search?.trim()
        ? `/graphs/public?search=${encodeURIComponent(search.trim())}`
        : '/graphs/public',
    ),
  graph: (id: string) => request<Graph>(`/graphs/${id}`),
  attachGraph: (id: string) =>
    request<Graph>(`/graphs/${id}/attach`, { method: 'POST' }),
  detachGraph: (id: string) =>
    request<void>(`/graphs/${id}/attach`, { method: 'DELETE' }),
  updateVisibility: (id: string, isPublic: boolean) =>
    request<Graph>(`/graphs/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublic }),
    }),
  updateSettings: (
    id: string,
    values: {
      title?: string;
      description?: string;
      isPublic?: boolean;
      isExemptFromRetention?: boolean;
    },
  ) =>
    request<Graph>(`/graphs/${id}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    }),
  createGraph: (title: string, description: string, isPublic = false) =>
    request<Graph>('/graphs', {
      method: 'POST',
      body: JSON.stringify({ title, description, isPublic }),
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
  copyGraph: (id: string, title: string, isPublic = false) =>
    request<Graph>(`/graphs/${id}/copy`, {
      method: 'POST',
      body: JSON.stringify({ title, isPublic }),
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
  notifications: () => request<NotificationListResponse>('/notifications'),
  markNotificationAsRead: (id: string) =>
    request<NotificationItem>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),
  markAllNotificationsAsRead: () =>
    request<{ count: number }>('/notifications/read-all', {
      method: 'PATCH',
    }),
  deleteNotification: (id: string) =>
    request<void>(`/notifications/${id}`, { method: 'DELETE' }),
  source: (id: string) => request<Source>(`/sources/${id}`),
  sourceDownloadUrl: (id: string) => `${apiUrl}/sources/${id}/download`,
  sourceFileUrl: (id: string) =>
    request<{ url: string; direct: boolean; fileName: string }>(
      `/sources/${id}/file-url`,
    ),
  presignedUpload: (dto: {
    graphId: string;
    nodeId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    checksumSha256?: string;
    isMultipart?: boolean;
    partCount?: number;
  }) =>
    request<{
      sourceId: string;
      jobId: string;
      storageKey: string;
      storageDriver: 's3' | 'local';
      isMultipart: boolean;
      uploadUrl?: string;
      headers?: Record<string, string>;
      uploadId?: string;
      parts?: Array<{
        uploadUrl: string;
        partNumber: number;
        headers: Record<string, string>;
      }>;
    }>('/sources/presigned-upload', {
      method: 'POST',
      body: JSON.stringify(dto),
      headers: { 'Content-Type': 'application/json' },
    }),
  completeUpload: (dto: {
    sourceId: string;
    jobId: string;
    graphId: string;
    nodeId: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    storageKey: string;
    checksumSha256?: string;
    uploadId?: string;
    parts?: Array<{ partNumber: number; eTag: string }>;
  }) =>
    request<Source>('/sources/complete-upload', {
      method: 'POST',
      body: JSON.stringify(dto),
      headers: { 'Content-Type': 'application/json' },
    }),
  abortUpload: (dto: { storageKey: string; uploadId?: string }) =>
    request<void>('/sources/abort-upload', {
      method: 'POST',
      body: JSON.stringify(dto),
      headers: { 'Content-Type': 'application/json' },
    }),
  uploadSource: async (
    graphId: string,
    nodeId: string,
    file: File,
    onProgress?: UploadProgressCallback,
    controller?: UploadController,
  ): Promise<Source> => {
    const ctrl = controller ?? createUploadController();
    const sessionKey = buildUploadSessionKey(graphId, nodeId, file);
    const uploadKey = `${nodeId}_${file.name}_${file.size}`;
    let session = getStoredUploadSession(sessionKey);
    let presignedInfo: { storageKey: string; uploadId?: string } | null = null;

    activeUploadRegistry.set(uploadKey, {
      uploadKey,
      sessionKey,
      graphId,
      nodeId,
      file,
      controller: ctrl,
      onProgress,
    });

    try {
      if (ctrl.isCancelled()) {
        throw new DOMException('Upload aborted', 'AbortError');
      }
      const checksumSha256 =
        session?.checksumSha256 ?? (await computeSha256(file));
      if (ctrl.isCancelled()) {
        throw new DOMException('Upload aborted', 'AbortError');
      }
      const chunkSize = session?.chunkSize ?? getOptimalChunkSize(file.size);
      const isMultipart = file.size > DEFAULT_CHUNK_SIZE;
      const partCount = isMultipart
        ? Math.ceil(file.size / chunkSize)
        : undefined;

      if (!session && isMultipart) {
        const presigned = await api.presignedUpload({
          graphId,
          nodeId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          checksumSha256: checksumSha256 || undefined,
          isMultipart,
          partCount,
        });

        if (
          presigned.isMultipart &&
          presigned.parts &&
          presigned.parts.length > 0 &&
          presigned.uploadId
        ) {
          session = {
            sessionKey,
            graphId,
            nodeId,
            sourceId: presigned.sourceId,
            jobId: presigned.jobId,
            storageKey: presigned.storageKey,
            uploadId: presigned.uploadId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || 'application/octet-stream',
            chunkSize,
            checksumSha256: checksumSha256 || undefined,
            parts: presigned.parts,
            completedParts: [],
            createdAt: Date.now(),
          };
          saveUploadSession(session);
        } else if (presigned.uploadUrl) {
          presignedInfo = {
            storageKey: presigned.storageKey,
          };
        }
      }

      if (session) {
        presignedInfo = {
          storageKey: session.storageKey,
          uploadId: session.uploadId,
        };

        const completedParts = await uploadPartsConcurrently(
          session.parts,
          file,
          ctrl.getConcurrency(),
          MAX_RETRIES,
          onProgress,
          session.completedParts,
          (newPart) => {
            if (session) {
              session.completedParts.push(newPart);
              saveUploadSession(session);
            }
          },
          session.chunkSize ?? chunkSize,
          ctrl,
        );

        if (ctrl.isCancelled()) {
          throw new DOMException('Upload aborted', 'AbortError');
        }

        const source = await api.completeUpload({
          sourceId: session.sourceId,
          jobId: session.jobId,
          graphId,
          nodeId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          storageKey: session.storageKey,
          checksumSha256: checksumSha256 || undefined,
          uploadId: session.uploadId,
          parts: completedParts,
        });

        clearUploadSession(sessionKey);
        if (onProgress) {
          onProgress(100, file.size, file.size, {
            status: 'completing',
            concurrency: ctrl.getConcurrency(),
          });
        }
        return source;
      }

      // Single-part presigned upload
      const presigned = await api.presignedUpload({
        graphId,
        nodeId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        checksumSha256: checksumSha256 || undefined,
        isMultipart: false,
      });

      presignedInfo = {
        storageKey: presigned.storageKey,
        uploadId: presigned.uploadId,
      };

      if (presigned.uploadUrl) {
        const uploadTarget = presigned.uploadUrl.startsWith('http')
          ? presigned.uploadUrl
          : `${apiUrl}${presigned.uploadUrl.replace(/^\/api/, '')}`;

        if (onProgress) {
          onProgress(10, Math.round(file.size * 0.1), file.size, {
            status: 'uploading',
            concurrency: 1,
          });
        }

        const uploadRes = await fetch(uploadTarget, {
          method: 'PUT',
          headers: presigned.headers ?? {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
          signal: ctrl.signal,
        });

        if (uploadRes.ok) {
          if (onProgress) {
            onProgress(90, Math.round(file.size * 0.9), file.size, {
              status: 'completing',
              concurrency: 1,
            });
          }
          const completed = await api.completeUpload({
            sourceId: presigned.sourceId,
            jobId: presigned.jobId,
            graphId,
            nodeId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || 'application/octet-stream',
            storageKey: presigned.storageKey,
            checksumSha256: checksumSha256 || undefined,
          });
          if (onProgress) {
            onProgress(100, file.size, file.size, {
              status: 'completing',
              concurrency: 1,
            });
          }
          return completed;
        }
      }
    } catch (err: unknown) {
      if (presignedInfo?.uploadId) {
        clearUploadSession(sessionKey);
        try {
          await api.abortUpload({
            storageKey: presignedInfo.storageKey,
            uploadId: presignedInfo.uploadId,
          });
        } catch {
          // Best-effort abort on failure
        }
      }
      if (ctrl.isCancelled()) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      // Never fall back to 25MB memory-buffered endpoint for large files (>25MB)
      if (file.size > 25 * 1024 * 1024) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      // Fallback to standard server-proxied multipart upload
    } finally {
      activeUploadRegistry.delete(uploadKey);
    }

    if (onProgress) {
      onProgress(20, Math.round(file.size * 0.2), file.size, {
        status: 'uploading',
        concurrency: 1,
      });
    }
    const body = new FormData();
    body.set('graphId', graphId);
    body.set('nodeId', nodeId);
    body.set('file', file);
    const result = await request<Source>('/sources/upload', {
      method: 'POST',
      body,
      signal: ctrl.signal,
    });
    if (onProgress) {
      onProgress(100, file.size, file.size, {
        status: 'completing',
        concurrency: 1,
      });
    }
    return result;
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
  retentionAudit: () => request<RetentionAuditStats>('/admin/retention/audit'),
  retentionArchives: () =>
    request<GraphArchiveItem[]>('/admin/retention/archives'),
  runRetentionSweep: (dryRun = false) =>
    request<RetentionRunResponse>(`/admin/retention/run?dryRun=${dryRun}`, {
      method: 'POST',
    }),
  restoreGraphArchive: (id: string) =>
    request<{
      id: string;
      title: string;
      userId: string;
      sourceCount: number;
      restored: boolean;
    }>(`/graphs/archives/${id}/restore`, { method: 'POST' }),
  keepGraphActive: (graphId: string) =>
    request<Graph>(`/graphs/${graphId}/keep-active`, { method: 'POST' }),
  storageProxyStatus: () =>
    request<StorageProxyStatus>('/admin/storage/proxy-status'),
  downloadArchiveUrl: (graphId: string, isAdmin = false) =>
    `${apiUrl}/${isAdmin ? 'admin' : 'graphs'}/${graphId}/archive`,

  admin: {
    verify: () =>
      request<{ authorized: boolean; identity: any }>('/admin/auth/verify'),
    overview: () => request<AdminOverviewStats>('/admin/overview'),
    systemStatus: () => request<AdminSystemStatus>('/admin/system/status'),
    storageProxyStatus: () =>
      request<StorageProxyStatus>('/admin/storage/proxy-status'),
    users: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      tier?: string;
    }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', params.page.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      if (params?.search) query.set('search', params.search);
      if (params?.tier) query.set('tier', params.tier);
      const qs = query.toString();
      return request<{
        users: AdminUser[];
        pagination: AdminPagination<any>['pagination'];
      }>(`/admin/users${qs ? `?${qs}` : ''}`);
    },
    user: (id: string) => request<AdminUserDetails>(`/admin/users/${id}`),
    updateUser: (
      id: string,
      data: {
        name?: string;
        username?: string;
        subscriptionTier?: string;
        subscriptionExpiresAt?: string | null;
      },
    ) =>
      request<AdminUserDetails>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteUser: (id: string) =>
      request<{ deleted: boolean; userId: string }>(`/admin/users/${id}`, {
        method: 'DELETE',
      }),
    graphs: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      visibility?: string;
      retention?: string;
    }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', params.page.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      if (params?.search) query.set('search', params.search);
      if (params?.visibility) query.set('visibility', params.visibility);
      if (params?.retention) query.set('retention', params.retention);
      const qs = query.toString();
      return request<{
        graphs: AdminGraph[];
        pagination: AdminPagination<any>['pagination'];
      }>(`/admin/graphs${qs ? `?${qs}` : ''}`);
    },
    graph: (id: string) => request<AdminGraphDetails>(`/admin/graphs/${id}`),
    updateGraph: (
      id: string,
      data: {
        title?: string;
        description?: string | null;
        isPublic?: boolean;
        isExemptFromRetention?: boolean;
        resetRetention?: boolean;
      },
    ) =>
      request<AdminGraphDetails>(`/admin/graphs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    updateGraphContent: (id: string, data: { nodes: any[]; edges: any[] }) =>
      request<AdminGraphDetails>(`/admin/graphs/${id}/content`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteGraph: (id: string) =>
      request<{ deleted: boolean; graphId: string }>(`/admin/graphs/${id}`, {
        method: 'DELETE',
      }),
    retentionAudit: () =>
      request<RetentionAuditStats>('/admin/retention/audit'),
    retentionArchives: () =>
      request<GraphArchiveItem[]>('/admin/retention/archives'),
    runRetentionSweep: (dryRun = false) =>
      request<RetentionRunResponse>(`/admin/retention/run?dryRun=${dryRun}`, {
        method: 'POST',
      }),
    restoreArchive: (graphId: string) =>
      request<{ id: string; restored: boolean }>(
        `/admin/graphs/${graphId}/restore`,
        { method: 'POST' },
      ),
    deleteArchive: (graphId: string) =>
      request<{ deleted: boolean; graphId: string }>(
        `/admin/retention/archives/${graphId}`,
        { method: 'DELETE' },
      ),
    subscriptionEvents: (params?: { page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', params.page.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      const qs = query.toString();
      return request<{
        events: AdminBillingEvent[];
        pagination: AdminPagination<any>['pagination'];
      }>(`/admin/subscriptions/events${qs ? `?${qs}` : ''}`);
    },
    grantSubscription: (
      userId: string,
      tier: 'PRO' = 'PRO',
      durationDays = 30,
    ) =>
      request<AdminUserDetails>('/admin/subscriptions/grant', {
        method: 'POST',
        body: JSON.stringify({ userId, tier, durationDays }),
      }),
    revokeSubscription: (userId: string) =>
      request<AdminUserDetails>('/admin/subscriptions/revoke', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
    exportUsers: (params?: {
      format?: 'csv' | 'json';
      search?: string;
      tier?: string;
    }) => {
      const query = new URLSearchParams();
      if (params?.format) query.set('format', params.format);
      if (params?.search) query.set('search', params.search);
      if (params?.tier) query.set('tier', params.tier);
      const qs = query.toString();
      return downloadBlob(`/admin/users/export${qs ? `?${qs}` : ''}`);
    },
    exportSubscriptionEvents: (params?: { format?: 'csv' | 'json' }) => {
      const query = new URLSearchParams();
      if (params?.format) query.set('format', params.format);
      const qs = query.toString();
      return downloadBlob(
        `/admin/subscriptions/events/export${qs ? `?${qs}` : ''}`,
      );
    },
    batchUsers: (data: {
      userIds: string[];
      action: 'set_tier' | 'delete';
      tier?: string;
      durationDays?: number;
    }) =>
      request<AdminBatchResult>('/admin/users/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    batchGraphs: (data: {
      graphIds: string[];
      action: 'set_retention_exempt' | 'set_visibility' | 'delete';
      exempt?: boolean;
      isPublic?: boolean;
    }) =>
      request<AdminBatchResult>('/admin/graphs/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getSettings: () => request<AdminSystemSettings>('/admin/settings'),
    updateSettings: (data: UpdateAdminSystemSettingsDto) =>
      request<AdminSystemSettings>('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getAuditLogs: (params?: {
      page?: number;
      limit?: number;
      action?: string;
      targetType?: string;
    }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', params.page.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      if (params?.action) query.set('action', params.action);
      if (params?.targetType) query.set('targetType', params.targetType);
      const qs = query.toString();
      return request<GetAuditLogsResponse>(
        `/admin/audit-logs${qs ? `?${qs}` : ''}`,
      );
    },
    archiveAuditLogs: (params?: {
      olderThanDays?: number;
      retainCount?: number;
    }) =>
      request<AuditLogArchive>('/admin/audit-logs/archive', {
        method: 'POST',
        body: JSON.stringify(params ?? {}),
      }),
    getAuditArchives: (params?: { page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', params.page.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      const qs = query.toString();
      return request<GetAuditArchivesResponse>(
        `/admin/audit-logs/archives${qs ? `?${qs}` : ''}`,
      );
    },
    getAuditArchiveDownloadUrl: (id: string) =>
      `${apiUrl}/admin/audit-logs/archives/${id}/download`,
    previewAuditArchive: (
      id: string,
      params?: { search?: string; page?: number; limit?: number },
    ) => {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.page) query.set('page', params.page.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      const qs = query.toString();
      return request<AuditArchivePreviewResponse>(
        `/admin/audit-logs/archives/${id}/preview${qs ? `?${qs}` : ''}`,
      );
    },
  },
  system: {
    checkStatus: async (): Promise<PublicSystemStatus> => {
      try {
        const res = await fetch(`${apiUrl}/admin/status`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as PublicSystemStatus;
          if (data.maintenanceMode === false) {
            notifyMaintenanceMode(false);
          } else {
            notifyMaintenanceMode(true);
          }
          return data;
        }
        if (res.status === 503) {
          notifyMaintenanceMode(true);
          return { status: 'maintenance', maintenanceMode: true };
        }
        return { status: 'error', maintenanceMode: false };
      } catch {
        return { status: 'unreachable', maintenanceMode: false };
      }
    },
  },
};

export function setAdminKey(key: string | null): void {
  if (typeof window === 'undefined') return;
  if (key) {
    localStorage.setItem('vc_admin_key', key);
  } else {
    localStorage.removeItem('vc_admin_key');
  }
}

export function getAdminKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vc_admin_key');
}

export { ApiError };
