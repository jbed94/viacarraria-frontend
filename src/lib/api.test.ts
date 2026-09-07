import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  api,
  ApiError,
  buildUploadSessionKey,
  CHUNK_SIZE,
  clearUploadSession,
  computeSha256,
  computeSha256ViaWorker,
  createUploadController,
  activeUploadRegistry,
  getActiveUploadController,
  pauseActiveUpload,
  resumeActiveUpload,
  cancelActiveUpload,
  getOptimalChunkSize,
  getStoredUploadSession,
  saveUploadSession,
  subscribeMaintenanceMode,
  terminateHashWorker,
  uploadPartsConcurrently,
} from './api';

describe('Frontend API Client - Resumable & Presigned S3 Uploads', () => {
  const originalFetch = globalThis.fetch;
  const originalWorker = globalThis.Worker;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.Worker = originalWorker;
    terminateHashWorker();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('computes accurate SHA-256 checksum using Web Crypto API fallback', async () => {
    const textContent = 'Hello, Via Carraria S3 Upload!';
    const blob = new Blob([textContent], { type: 'text/plain' });

    const hash = await computeSha256(blob);
    expect(hash).toHaveLength(64);
    expect(typeof hash).toBe('string');
  });

  it('computes SHA-256 hash using background Web Worker when available', async () => {
    class MockWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      postMessage = vi.fn((msg: { id: string; buffer: ArrayBuffer }) => {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              id: msg.id,
              hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            },
          } as MessageEvent);
        }, 5);
      });
      terminate = vi.fn();
    }
    // @ts-expect-error Mocking Worker in test
    globalThis.Worker = MockWorker;

    const buffer = new TextEncoder().encode('worker test content').buffer;
    const hash = await computeSha256ViaWorker(buffer);
    expect(hash).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );

    // Also verify computeSha256 integrates with worker
    const fullHash = await computeSha256(buffer);
    expect(fullHash).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('falls back cleanly to Web Crypto if worker emits an error', async () => {
    class ErrorWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      postMessage = vi.fn((msg: { id: string }) => {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              id: msg.id,
              error: 'Worker calculation failed',
            },
          } as MessageEvent);
        }, 5);
      });
      terminate = vi.fn();
    }
    // @ts-expect-error Mocking Worker in test
    globalThis.Worker = ErrorWorker;

    const buffer = new TextEncoder().encode('fallback content').buffer;
    // computeSha256 should catch worker failure and fall back to crypto.subtle
    const hash = await computeSha256(buffer);
    expect(hash).toHaveLength(64);
  });

  it('executes direct-to-S3 presigned upload workflow and completes upload', async () => {
    const mockFile = new File(['Dummy PDF document content'], 'paper.pdf', {
      type: 'application/pdf',
    });

    const presignedMockResponse = {
      sourceId: 'src-direct-1',
      jobId: 'job-direct-1',
      storageKey: 'sources/graph-1/src-direct-1/paper.pdf',
      storageDriver: 's3' as const,
      isMultipart: false,
      uploadUrl: 'https://s3.amazonaws.com/bucket/upload?sig=abc',
      headers: { 'Content-Type': 'application/pdf' },
    };

    const completeMockResponse = {
      id: 'src-direct-1',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'paper.pdf',
      fileType: 'application/pdf',
      fileUrl: 's3://bucket/sources/graph-1/src-direct-1/paper.pdf',
      status: 'PENDING' as const,
      sizeBytes: mockFile.size,
      jobId: 'job-direct-1',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const fetchMock = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url.includes('/sources/presigned-upload')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(presignedMockResponse),
        });
      }
      if (url.includes('s3.amazonaws.com')) {
        expect(init?.method).toBe('PUT');
        return Promise.resolve({
          ok: true,
          status: 200,
        });
      }
      if (url.includes('/sources/complete-upload')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(completeMockResponse),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    });

    globalThis.fetch = fetchMock as any;

    const result = await api.uploadSource('graph-1', 'node-1', mockFile);

    expect(result.id).toBe('src-direct-1');
    expect(result.status).toBe('PENDING');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('falls back seamlessly to standard multipart /sources/upload if presigned fails', async () => {
    const mockFile = new File(['Fallback content'], 'notes.txt', {
      type: 'text/plain',
    });

    const fallbackMockResponse = {
      id: 'src-fallback-1',
      nodeId: 'node-1',
      graphId: 'graph-1',
      name: 'notes.txt',
      fileType: 'text/plain',
      fileUrl: 'local://uploads/notes.txt',
      status: 'PENDING' as const,
      sizeBytes: mockFile.size,
      jobId: 'job-fallback-1',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const fetchMock = vi.fn().mockImplementation((url: string, init?: any) => {
      if (url.includes('/sources/presigned-upload')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal error'),
        });
      }
      if (url.includes('/sources/upload')) {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBeInstanceOf(FormData);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(fallbackMockResponse),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
    });

    globalThis.fetch = fetchMock as any;

    const result = await api.uploadSource('graph-1', 'node-1', mockFile);

    expect(result.id).toBe('src-fallback-1');
    expect(result.status).toBe('PENDING');
  });

  describe('uploadPartsConcurrently & Multipart S3 Uploads', () => {
    it('uploads parts concurrently with worker pool and exponential backoff retry on transient 500 error', async () => {
      const buffer = new Uint8Array(12 * 1024 * 1024); // 12MB -> 3 parts (5MB, 5MB, 2MB)
      const largeFile = new File([buffer], 'large-dataset.pdf', {
        type: 'application/pdf',
      });

      const parts = [
        { uploadUrl: 'https://s3.amazonaws.com/part-1', partNumber: 1 },
        { uploadUrl: 'https://s3.amazonaws.com/part-2', partNumber: 2 },
        { uploadUrl: 'https://s3.amazonaws.com/part-3', partNumber: 3 },
      ];

      let part2Attempts = 0;
      let activeConcurrency = 0;
      let maxObservedConcurrency = 0;

      const fetchMock = vi
        .fn()
        .mockImplementation(async (url: string, _init?: any) => {
          activeConcurrency++;
          maxObservedConcurrency = Math.max(
            maxObservedConcurrency,
            activeConcurrency,
          );

          try {
            if (url.includes('part-1')) {
              await new Promise((r) => setTimeout(r, 20));
              return {
                ok: true,
                status: 200,
                headers: {
                  get: (name: string) =>
                    name.toLowerCase() === 'etag' ? '"etag-part-1"' : null,
                },
              };
            }

            if (url.includes('part-2')) {
              part2Attempts++;
              if (part2Attempts === 1) {
                // Transient 500 error on first attempt
                return {
                  ok: false,
                  status: 500,
                  headers: { get: () => null },
                };
              }
              // Success on second attempt
              return {
                ok: true,
                status: 200,
                headers: {
                  get: (name: string) =>
                    name.toLowerCase() === 'etag' ? '"etag-part-2"' : null,
                },
              };
            }

            if (url.includes('part-3')) {
              await new Promise((r) => setTimeout(r, 10));
              return {
                ok: true,
                status: 200,
                headers: {
                  get: (name: string) =>
                    name.toLowerCase() === 'etag' ? '"etag-part-3"' : null,
                },
              };
            }

            return { ok: false, status: 404 };
          } finally {
            activeConcurrency--;
          }
        });

      globalThis.fetch = fetchMock as any;

      const completed = await uploadPartsConcurrently(
        parts,
        largeFile,
        2, // bounded concurrency of 2 workers
        3, // maxRetries
      );

      expect(part2Attempts).toBe(2);
      expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
      expect(completed).toHaveLength(3);
      expect(completed).toEqual([
        { partNumber: 1, eTag: 'etag-part-1' },
        { partNumber: 2, eTag: 'etag-part-2' },
        { partNumber: 3, eTag: 'etag-part-3' },
      ]);
    });

    it('throws when chunk retries exceed maxRetries', async () => {
      const buffer = new Uint8Array(6 * 1024 * 1024);
      const file = new File([buffer], 'fail.pdf', { type: 'application/pdf' });
      const parts = [
        { uploadUrl: 'https://s3.amazonaws.com/fail-part-1', partNumber: 1 },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: { get: () => null },
      }) as any;

      await expect(
        uploadPartsConcurrently(parts, file, 1, 2),
      ).rejects.toThrowError(/failed with status 503/);
    });

    it('executes multipart presigned upload and completeUpload for files exceeding 5MB', async () => {
      const buffer = new Uint8Array(11 * 1024 * 1024); // 11MB > 5MB CHUNK_SIZE
      const largeFile = new File([buffer], 'huge-manual.pdf', {
        type: 'application/pdf',
      });

      const presignedMock = {
        sourceId: 'src-multipart-1',
        jobId: 'job-multipart-1',
        storageKey: 'sources/graph-1/src-multipart-1/huge-manual.pdf',
        storageDriver: 's3' as const,
        isMultipart: true,
        uploadId: 'upload-id-xyz',
        parts: [
          {
            uploadUrl: 'https://s3.amazonaws.com/part-1',
            partNumber: 1,
            headers: {},
          },
          {
            uploadUrl: 'https://s3.amazonaws.com/part-2',
            partNumber: 2,
            headers: {},
          },
          {
            uploadUrl: 'https://s3.amazonaws.com/part-3',
            partNumber: 3,
            headers: {},
          },
        ],
      };

      const completeMock = {
        id: 'src-multipart-1',
        nodeId: 'node-1',
        graphId: 'graph-1',
        name: 'huge-manual.pdf',
        fileType: 'application/pdf',
        fileUrl: 's3://bucket/sources/graph-1/src-multipart-1/huge-manual.pdf',
        status: 'PENDING' as const,
        sizeBytes: largeFile.size,
        jobId: 'job-multipart-1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      const completedPartsSent: any[] = [];

      const fetchMock = vi
        .fn()
        .mockImplementation(async (url: string, init?: any) => {
          if (url.includes('/sources/presigned-upload')) {
            const body = JSON.parse(init.body);
            expect(body.isMultipart).toBe(true);
            expect(body.partCount).toBe(Math.ceil(largeFile.size / CHUNK_SIZE));
            return {
              ok: true,
              status: 200,
              json: () => Promise.resolve(presignedMock),
            };
          }

          if (url.includes('s3.amazonaws.com/part-')) {
            const partNum = url.split('part-')[1];
            return {
              ok: true,
              status: 200,
              headers: {
                get: (name: string) =>
                  name.toLowerCase() === 'etag' ? `"etag-${partNum}"` : null,
              },
            };
          }

          if (url.includes('/sources/complete-upload')) {
            const body = JSON.parse(init.body);
            completedPartsSent.push(...body.parts);
            expect(body.uploadId).toBe('upload-id-xyz');
            return {
              ok: true,
              status: 200,
              json: () => Promise.resolve(completeMock),
            };
          }

          return { ok: false, status: 404 };
        });

      globalThis.fetch = fetchMock as any;

      const result = await api.uploadSource('graph-1', 'node-1', largeFile);

      expect(result.id).toBe('src-multipart-1');
      expect(completedPartsSent).toHaveLength(3);
      expect(completedPartsSent[0]).toEqual({
        partNumber: 1,
        eTag: 'etag-1',
      });
    });

    it('triggers abort-upload cleanup and falls back to /sources/upload if multipart part upload fails fatally', async () => {
      const buffer = new Uint8Array(11 * 1024 * 1024);
      const largeFile = new File([buffer], 'corrupted.pdf', {
        type: 'application/pdf',
      });

      const presignedMock = {
        sourceId: 'src-abort-1',
        jobId: 'job-abort-1',
        storageKey: 'sources/graph-1/src-abort-1/corrupted.pdf',
        storageDriver: 's3' as const,
        isMultipart: true,
        uploadId: 'upload-id-abort',
        parts: [
          {
            uploadUrl: 'https://s3.amazonaws.com/part-1',
            partNumber: 1,
            headers: {},
          },
        ],
      };

      const fallbackMock = {
        id: 'src-fallback-aborted',
        nodeId: 'node-1',
        graphId: 'graph-1',
        name: 'corrupted.pdf',
        fileType: 'application/pdf',
        fileUrl: 'local://uploads/corrupted.pdf',
        status: 'PENDING' as const,
        sizeBytes: largeFile.size,
        jobId: 'job-fallback-2',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      let aborted = false;

      const fetchMock = vi
        .fn()
        .mockImplementation(async (url: string, init?: any) => {
          if (url.includes('/sources/presigned-upload')) {
            return {
              ok: true,
              status: 200,
              json: () => Promise.resolve(presignedMock),
            };
          }

          if (url.includes('s3.amazonaws.com/part-1')) {
            // Fatal S3 failure
            return {
              ok: false,
              status: 500,
              headers: { get: () => null },
            };
          }

          if (url.includes('/sources/abort-upload')) {
            aborted = true;
            const body = JSON.parse(init.body);
            expect(body.uploadId).toBe('upload-id-abort');
            return {
              ok: true,
              status: 204,
              text: () => Promise.resolve(''),
            };
          }

          if (url.includes('/sources/upload')) {
            return {
              ok: true,
              status: 200,
              json: () => Promise.resolve(fallbackMock),
            };
          }

          return { ok: false, status: 404 };
        });

      globalThis.fetch = fetchMock as any;

      const result = await api.uploadSource('graph-1', 'node-1', largeFile);

      expect(aborted).toBe(true);
      expect(result.id).toBe('src-fallback-aborted');
    });

    it('reports granular upload progress percentages via onProgress callback', async () => {
      const buffer = new Uint8Array(10 * 1024 * 1024); // 10MB -> 2 parts
      const file = new File([buffer], 'dataset.bin', {
        type: 'application/octet-stream',
      });

      const parts = [
        { uploadUrl: 'https://s3.amazonaws.com/p1', partNumber: 1 },
        { uploadUrl: 'https://s3.amazonaws.com/p2', partNumber: 2 },
      ];

      const progressSnapshots: number[] = [];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => '"etag-123"',
        },
      }) as any;

      await uploadPartsConcurrently(parts, file, 1, 3, (percent) => {
        progressSnapshots.push(percent);
      });

      expect(progressSnapshots.length).toBeGreaterThanOrEqual(2);
      expect(progressSnapshots[0]).toBe(0);
      expect(progressSnapshots[progressSnapshots.length - 1]).toBe(100);
    });

    it('persists and retrieves resumable upload sessions, expiring sessions older than 24 hours', () => {
      const mockFile = new File(['data'], 'test.txt', { type: 'text/plain' });
      const sessionKey = buildUploadSessionKey('g-1', 'n-1', mockFile);

      const session = {
        sessionKey,
        graphId: 'g-1',
        nodeId: 'n-1',
        sourceId: 's-1',
        jobId: 'j-1',
        storageKey: 'sources/g-1/s-1/test.txt',
        uploadId: 'up-123',
        fileName: 'test.txt',
        fileSize: mockFile.size,
        fileType: 'text/plain',
        parts: [{ partNumber: 1, uploadUrl: 'http://upload/1' }],
        completedParts: [{ partNumber: 1, eTag: 'etag-1' }],
        createdAt: Date.now(),
      };

      saveUploadSession(session);
      const retrieved = getStoredUploadSession(sessionKey);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.uploadId).toBe('up-123');

      // Test expiration
      const expiredSession = {
        ...session,
        sessionKey: 'expired-session',
        createdAt: Date.now() - 25 * 60 * 60 * 1000,
      };
      saveUploadSession(expiredSession);
      expect(getStoredUploadSession('expired-session')).toBeNull();

      // Test clear
      clearUploadSession(sessionKey);
      expect(getStoredUploadSession(sessionKey)).toBeNull();
    });

    it('resumes multipart upload from stored session and skips already completed chunks', async () => {
      const buffer = new Uint8Array(12 * 1024 * 1024); // 12MB -> 3 parts
      const file = new File([buffer], 'resumable.pdf', {
        type: 'application/pdf',
      });
      const sessionKey = buildUploadSessionKey('g-resume', 'n-resume', file);

      // Pre-seed session with part 1 already uploaded
      const existingSession = {
        sessionKey,
        graphId: 'g-resume',
        nodeId: 'n-resume',
        sourceId: 'src-resume-100',
        jobId: 'job-resume-100',
        storageKey: 'sources/g-resume/src-resume-100/resumable.pdf',
        uploadId: 'upload-id-resume',
        fileName: 'resumable.pdf',
        fileSize: file.size,
        fileType: 'application/pdf',
        parts: [
          { uploadUrl: 'https://s3.amazonaws.com/chunk-1', partNumber: 1 },
          { uploadUrl: 'https://s3.amazonaws.com/chunk-2', partNumber: 2 },
          { uploadUrl: 'https://s3.amazonaws.com/chunk-3', partNumber: 3 },
        ],
        completedParts: [{ partNumber: 1, eTag: 'existing-etag-1' }],
        createdAt: Date.now(),
      };

      saveUploadSession(existingSession);

      const uploadedUrls: string[] = [];

      const fetchMock = vi
        .fn()
        .mockImplementation(async (url: string, init?: any) => {
          uploadedUrls.push(url);

          if (url.includes('chunk-2')) {
            return {
              ok: true,
              status: 200,
              headers: { get: () => '"etag-2"' },
            };
          }

          if (url.includes('chunk-3')) {
            return {
              ok: true,
              status: 200,
              headers: { get: () => '"etag-3"' },
            };
          }

          if (url.includes('/sources/complete-upload')) {
            const body = JSON.parse(init.body);
            expect(body.parts).toEqual([
              { partNumber: 1, eTag: 'existing-etag-1' },
              { partNumber: 2, eTag: 'etag-2' },
              { partNumber: 3, eTag: 'etag-3' },
            ]);
            return {
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  id: 'src-resume-100',
                  status: 'PENDING',
                }),
            };
          }

          return { ok: false, status: 404 };
        });

      globalThis.fetch = fetchMock as any;

      const result = await api.uploadSource('g-resume', 'n-resume', file);

      // Verify chunk-1 was NOT re-uploaded!
      expect(uploadedUrls).not.toContain('https://s3.amazonaws.com/chunk-1');
      expect(uploadedUrls).toContain('https://s3.amazonaws.com/chunk-2');
      expect(uploadedUrls).toContain('https://s3.amazonaws.com/chunk-3');
      expect(result.id).toBe('src-resume-100');

      // Verify session was cleared on completion
      expect(getStoredUploadSession(sessionKey)).toBeNull();
    });

    it('calculates optimal chunk sizes scaling from 5MB up to 50MB based on file size', () => {
      expect(getOptimalChunkSize(10 * 1024 * 1024)).toBe(5 * 1024 * 1024); // 10MB -> 5MB
      expect(getOptimalChunkSize(50 * 1024 * 1024)).toBe(5 * 1024 * 1024); // 50MB -> 5MB
      expect(getOptimalChunkSize(120 * 1024 * 1024)).toBe(10 * 1024 * 1024); // 120MB -> 10MB
      expect(getOptimalChunkSize(200 * 1024 * 1024)).toBe(10 * 1024 * 1024); // 200MB -> 10MB
      expect(getOptimalChunkSize(500 * 1024 * 1024)).toBe(20 * 1024 * 1024); // 500MB -> 20MB
      expect(getOptimalChunkSize(2 * 1024 * 1024 * 1024)).toBe(
        50 * 1024 * 1024,
      ); // 2GB -> 50MB
    });

    it('handles large file (>100MB) multipart upload with dynamic chunk sizing directly to S3 proxy', async () => {
      // 120MB file
      const fileSize = 120 * 1024 * 1024;
      const optimalChunk = getOptimalChunkSize(fileSize); // 10MB
      const expectedPartCount = Math.ceil(fileSize / optimalChunk); // 12 parts
      const mockBlob = new Blob(['sample-data']);
      const largeFile = new File([mockBlob], 'large-dataset.bin', {
        type: 'application/octet-stream',
      });
      Object.defineProperty(largeFile, 'size', { value: fileSize });

      const mockParts = Array.from({ length: expectedPartCount }, (_, i) => ({
        uploadUrl: `https://s3.proxy.local/part-${i + 1}`,
        partNumber: i + 1,
        headers: {},
      }));

      const presignedMock = {
        sourceId: 'src-large-100',
        jobId: 'job-large-100',
        storageKey: 'sources/graph-1/src-large-100/large-dataset.bin',
        storageDriver: 's3' as const,
        isMultipart: true,
        uploadId: 'upload-id-large-100',
        parts: mockParts,
      };

      const completeMock = {
        id: 'src-large-100',
        nodeId: 'node-1',
        graphId: 'graph-1',
        name: 'large-dataset.bin',
        fileType: 'application/octet-stream',
        fileUrl: 's3://bucket/sources/graph-1/src-large-100/large-dataset.bin',
        status: 'PENDING' as const,
        sizeBytes: fileSize,
        jobId: 'job-large-100',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      const partsUploaded: number[] = [];

      const fetchMock = vi
        .fn()
        .mockImplementation(async (url: string, init?: any) => {
          if (url.includes('/sources/presigned-upload')) {
            const body = JSON.parse(init.body);
            expect(body.isMultipart).toBe(true);
            expect(body.partCount).toBe(expectedPartCount);
            return {
              ok: true,
              status: 200,
              json: () => Promise.resolve(presignedMock),
            };
          }

          if (url.includes('s3.proxy.local/part-')) {
            const partNum = Number.parseInt(url.split('part-')[1] ?? '0', 10);
            partsUploaded.push(partNum);
            return {
              ok: true,
              status: 200,
              headers: { get: () => `"etag-${partNum}"` },
            };
          }

          if (url.includes('/sources/complete-upload')) {
            const body = JSON.parse(init.body);
            expect(body.uploadId).toBe('upload-id-large-100');
            expect(body.parts).toHaveLength(expectedPartCount);
            return {
              ok: true,
              status: 200,
              json: () => Promise.resolve(completeMock),
            };
          }

          return { ok: false, status: 404 };
        });

      globalThis.fetch = fetchMock as any;

      const result = await api.uploadSource('graph-1', 'node-1', largeFile);

      expect(result.id).toBe('src-large-100');
      expect(partsUploaded).toHaveLength(expectedPartCount);
    });

    it('throws directly on large file (>25MB) multipart failure without attempting memory-buffered /sources/upload fallback', async () => {
      const fileSize = 100 * 1024 * 1024; // 100MB
      const mockBlob = new Blob(['error-test']);
      const file = new File([mockBlob], 'failing-large.bin', {
        type: 'application/octet-stream',
      });
      Object.defineProperty(file, 'size', { value: fileSize });

      const presignedMock = {
        sourceId: 'src-err-1',
        jobId: 'job-err-1',
        storageKey: 'sources/graph-1/src-err-1/failing-large.bin',
        storageDriver: 's3' as const,
        isMultipart: true,
        uploadId: 'upload-err-id',
        parts: [
          {
            uploadUrl: 'https://s3.proxy.local/part-1',
            partNumber: 1,
            headers: {},
          },
        ],
      };

      let aborted = false;
      let uploadFallbackAttempted = false;

      const fetchMock = vi
        .fn()
        .mockImplementation(async (url: string, _init?: any) => {
          if (url.includes('/sources/presigned-upload')) {
            return {
              ok: true,
              status: 200,
              json: () => Promise.resolve(presignedMock),
            };
          }

          if (url.includes('s3.proxy.local/part-1')) {
            // Fatal S3 error
            return { ok: false, status: 500, headers: { get: () => null } };
          }

          if (url.includes('/sources/abort-upload')) {
            aborted = true;
            return { ok: true, status: 204, text: () => Promise.resolve('') };
          }

          if (url.includes('/sources/upload')) {
            uploadFallbackAttempted = true;
            return { ok: true, status: 200, json: () => Promise.resolve({}) };
          }

          return { ok: false, status: 404 };
        });

      globalThis.fetch = fetchMock as any;

      await expect(
        api.uploadSource('graph-1', 'node-1', file),
      ).rejects.toThrow();

      expect(aborted).toBe(true);
      // Verify that the memory-buffering /sources/upload fallback was NEVER attempted for large file
      expect(uploadFallbackAttempted).toBe(false);
    });

    describe('UploadController, Adaptive Bandwidth & Auto-Resume on Reconnect', () => {
      it('initializes UploadController with default concurrency and active signal', () => {
        const ctrl = createUploadController(3);
        expect(ctrl.isPaused()).toBe(false);
        expect(ctrl.isCancelled()).toBe(false);
        expect(ctrl.signal.aborted).toBe(false);
        expect(ctrl.getConcurrency()).toBe(3);

        ctrl.setConcurrency(10);
        expect(ctrl.getConcurrency()).toBe(6); // clamped to max 6

        ctrl.setConcurrency(1);
        expect(ctrl.getConcurrency()).toBe(2); // clamped to min 2
      });

      it('pauses and resumes deferred promise via waitIfPaused', async () => {
        const ctrl = createUploadController();
        let unblocked = false;

        ctrl.pause();
        expect(ctrl.isPaused()).toBe(true);

        const waitPromise = ctrl.waitIfPaused().then(() => {
          unblocked = true;
        });

        // Verify it is currently blocked
        await new Promise((r) => setTimeout(r, 10));
        expect(unblocked).toBe(false);

        // Resume unblocks waitIfPaused
        ctrl.resume();
        expect(ctrl.isPaused()).toBe(false);
        await waitPromise;
        expect(unblocked).toBe(true);
      });

      it('cancels UploadController, aborts signal, and rejects waitIfPaused', async () => {
        const ctrl = createUploadController();
        ctrl.pause();

        const waitPromise = ctrl.waitIfPaused();
        ctrl.cancel();

        expect(ctrl.isCancelled()).toBe(true);
        expect(ctrl.signal.aborted).toBe(true);
        await expect(waitPromise).rejects.toThrow(/Upload aborted/);
      });

      it('cancels active multipart chunk upload immediately via UploadController', async () => {
        const ctrl = createUploadController();
        const parts = [
          { uploadUrl: 'https://s3.proxy.local/part-1', partNumber: 1 },
          { uploadUrl: 'https://s3.proxy.local/part-2', partNumber: 2 },
        ];
        const file = new File(['A'.repeat(1024 * 1024 * 10)], 'large.bin');

        const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
          if (init?.signal?.aborted) {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            throw err;
          }
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 80);
            init?.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          });
          return {
            ok: true,
            status: 200,
            headers: {
              get: (name: string) =>
                name.toLowerCase() === 'etag' ? '"etag-chunk"' : null,
            },
          };
        });
        globalThis.fetch = fetchMock as any;

        const uploadPromise = uploadPartsConcurrently(
          parts,
          file,
          2,
          1,
          undefined,
          [],
          undefined,
          5 * 1024 * 1024,
          ctrl,
        );

        // Cancel after 10ms
        setTimeout(() => {
          ctrl.cancel();
        }, 10);

        await expect(uploadPromise).rejects.toThrow();
      });

      it('registers in activeUploadRegistry and handles online/offline auto-pause and auto-resume', async () => {
        const file = new File(['Small upload content'], 'doc.pdf', {
          type: 'application/pdf',
        });
        const uploadKey = `node-reg_${file.name}_${file.size}`;
        const ctrl = createUploadController();

        let progressMetaStatus: string | undefined;

        const presignedMock = {
          sourceId: 'src-reg',
          jobId: 'job-reg',
          storageKey: 'graphs/g1/reg.pdf',
          uploadUrl: 'https://s3.proxy.local/reg.pdf',
          storageDriver: 's3',
          isMultipart: false,
        };

        const fetchMock = vi.fn().mockImplementation(async (url: string) => {
          if (url.includes('/sources/presigned-upload')) {
            return {
              ok: true,
              status: 200,
              json: () => Promise.resolve(presignedMock),
            };
          }
          if (url.includes('s3.proxy.local/reg.pdf')) {
            // Keep request pending long enough to test registry & offline event
            await new Promise((r) => setTimeout(r, 60));
            return { ok: true, status: 200, headers: { get: () => null } };
          }
          if (url.includes('/sources/complete-upload')) {
            return {
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  id: 'src-reg',
                  name: file.name,
                  status: 'READY',
                }),
            };
          }
          return { ok: false, status: 404 };
        });

        globalThis.fetch = fetchMock as any;

        const uploadPromise = api.uploadSource(
          'graph-reg',
          'node-reg',
          file,
          (_p, _l, _t, meta) => {
            if (meta?.status) progressMetaStatus = meta.status;
          },
          ctrl,
        );

        // Verify registered in activeUploadRegistry
        await new Promise((r) => setTimeout(r, 10));
        expect(activeUploadRegistry.has(uploadKey)).toBe(true);
        expect(getActiveUploadController(uploadKey)).toBe(ctrl);

        // Trigger offline event
        window.dispatchEvent(new Event('offline'));
        expect(ctrl.isPaused()).toBe(true);
        expect(progressMetaStatus).toBe('paused');

        // Trigger online event -> auto-resumes
        window.dispatchEvent(new Event('online'));
        expect(ctrl.isPaused()).toBe(false);
        expect(progressMetaStatus).toBe('resuming');

        // Helper functions pauseActiveUpload and resumeActiveUpload
        pauseActiveUpload(uploadKey);
        expect(ctrl.isPaused()).toBe(true);
        resumeActiveUpload(uploadKey);
        expect(ctrl.isPaused()).toBe(false);

        await uploadPromise;
        // Verify cleaned up from registry upon completion
        expect(activeUploadRegistry.has(uploadKey)).toBe(false);

        // Verify cancelActiveUpload returns false for non-existent upload
        expect(cancelActiveUpload('non-existent')).toBe(false);
      });

      it('dynamically adapts concurrency and reports speedBps and concurrency metadata in onProgress', async () => {
        const parts = [
          { uploadUrl: 'https://s3.proxy.local/part-1', partNumber: 1 },
          { uploadUrl: 'https://s3.proxy.local/part-2', partNumber: 2 },
          { uploadUrl: 'https://s3.proxy.local/part-3', partNumber: 3 },
          { uploadUrl: 'https://s3.proxy.local/part-4', partNumber: 4 },
        ];
        const file = new File(['B'.repeat(1024 * 1024 * 20)], 'chunks.bin');

        const fetchMock = vi.fn().mockImplementation(async () => {
          return {
            ok: true,
            status: 200,
            headers: {
              get: (name: string) =>
                name.toLowerCase() === 'etag' ? '"etag-fast"' : null,
            },
          };
        });
        globalThis.fetch = fetchMock as any;

        const reportedMetas: any[] = [];
        const result = await uploadPartsConcurrently(
          parts,
          file,
          2, // initial concurrency 2
          1,
          (_percent, _loaded, _total, meta) => {
            if (meta) reportedMetas.push(meta);
          },
          [],
          undefined,
          5 * 1024 * 1024,
        );

        expect(result).toHaveLength(4);
        expect(reportedMetas.length).toBeGreaterThan(0);
        // Verify concurrency was reported and scaled up on fast responses
        const lastMeta = reportedMetas[reportedMetas.length - 1];
        expect(lastMeta.concurrency).toBeGreaterThanOrEqual(2);
        expect(lastMeta.status).toBe('completing');
      });
    });
  });

  describe('Admin Export & Batch Operations', () => {
    it('exportUsers downloads blob with query parameters', async () => {
      const mockBlob = new Blob(['mock csv content'], { type: 'text/csv' });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => mockBlob,
      });
      globalThis.fetch = fetchMock as any;

      const blob = await api.admin.exportUsers({
        format: 'csv',
        search: 'bob',
        tier: 'PRO',
      });
      expect(blob).toBe(mockBlob);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          '/admin/users/export?format=csv&search=bob&tier=PRO',
        ),
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('exportSubscriptionEvents downloads blob', async () => {
      const mockBlob = new Blob(['{"events":[]}'], {
        type: 'application/json',
      });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => mockBlob,
      });
      globalThis.fetch = fetchMock as any;

      const blob = await api.admin.exportSubscriptionEvents({ format: 'json' });
      expect(blob).toBe(mockBlob);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          '/admin/subscriptions/events/export?format=json',
        ),
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('batchUsers posts batch payload to /admin/users/batch', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, count: 2, action: 'set_tier' }),
      });
      globalThis.fetch = fetchMock as any;

      const res = await api.admin.batchUsers({
        userIds: ['u-1', 'u-2'],
        action: 'set_tier',
        tier: 'PRO',
      });
      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/users/batch'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            userIds: ['u-1', 'u-2'],
            action: 'set_tier',
            tier: 'PRO',
          }),
        }),
      );
    });

    it('batchGraphs posts batch payload to /admin/graphs/batch', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          count: 1,
          action: 'set_retention_exempt',
        }),
      });
      globalThis.fetch = fetchMock as any;

      const res = await api.admin.batchGraphs({
        graphIds: ['g-1'],
        action: 'set_retention_exempt',
        exempt: true,
      });
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/graphs/batch'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            graphIds: ['g-1'],
            action: 'set_retention_exempt',
            exempt: true,
          }),
        }),
      );
    });

    it('getSettings fetches system configuration from /admin/settings', async () => {
      const mockSettings = {
        retentionDays: 90,
        retentionGraceDays: 7,
        freeTierLimits: {
          maxNodes: 100,
          maxSourcesPerGraph: 5,
          maxSourceSizeBytes: 26214400,
        },
        proTierLimits: {
          maxNodes: 5000,
          maxSourcesPerGraph: 50,
          maxSourceSizeBytes: 104857600,
        },
        rateLimits: {
          anonymousPerMinute: 30,
          authenticatedPerMinute: 120,
          burstMultiplier: 2,
        },
        maintenanceMode: false,
        updatedAt: '2026-09-01T00:00:00.000Z',
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSettings,
      });
      globalThis.fetch = fetchMock as any;

      const res = await api.admin.getSettings();
      expect(res).toEqual(mockSettings);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/settings'),
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('updateSettings sends patch payload to /admin/settings', async () => {
      const patch = {
        retentionDays: 120,
        maintenanceMode: true,
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...patch, updatedAt: '2026-09-06T22:00:00.000Z' }),
      });
      globalThis.fetch = fetchMock as any;

      const res = await api.admin.updateSettings(patch);
      expect(res.retentionDays).toBe(120);
      expect(res.maintenanceMode).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/admin/settings'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(patch),
        }),
      );
    });
  });

  describe('Maintenance Mode and System Status API', () => {
    it('notifies subscribers and flags isMaintenance=true when 503 is returned', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribeMaintenanceMode(listener);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          statusCode: 503,
          message: 'System undergoing scheduled maintenance',
          maintenance: true,
        }),
      });
      globalThis.fetch = fetchMock as any;

      await expect(api.graphs()).rejects.toThrow(ApiError);
      expect(listener).toHaveBeenCalledWith(
        true,
        'System undergoing scheduled maintenance',
      );

      unsubscribe();
    });

    it('api.system.checkStatus returns status and notifies when maintenance is disabled', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribeMaintenanceMode(listener);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          maintenanceMode: false,
          timestamp: '2026-09-06T22:00:00.000Z',
        }),
      });
      globalThis.fetch = fetchMock as any;

      const res = await api.system.checkStatus();
      expect(res.status).toBe('ok');
      expect(res.maintenanceMode).toBe(false);
      expect(listener).toHaveBeenCalledWith(false, undefined);

      unsubscribe();
    });

    it('api.system.checkStatus handles 503 maintenance response cleanly', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribeMaintenanceMode(listener);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });
      globalThis.fetch = fetchMock as any;

      const res = await api.system.checkStatus();
      expect(res.maintenanceMode).toBe(true);
      expect(listener).toHaveBeenCalledWith(true, undefined);

      unsubscribe();
    });

    it('api.system.checkStatus catches network errors and returns unreachable', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      globalThis.fetch = fetchMock as any;

      const res = await api.system.checkStatus();
      expect(res.status).toBe('unreachable');
      expect(res.maintenanceMode).toBe(false);
    });
  });
});
