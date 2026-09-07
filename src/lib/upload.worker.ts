/**
 * Web Worker for computing SHA-256 hashes off the main browser thread.
 * Prevents frame drops and UI freezes during large multipart file uploads.
 */

export type HashWorkerRequest = {
  id: string;
  buffer: ArrayBuffer;
};

export type HashWorkerResponse = {
  id: string;
  hash?: string;
  error?: string;
};

self.onmessage = async (event: MessageEvent<HashWorkerRequest>) => {
  const { id, buffer } = event.data;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      self.postMessage({ id, hash } satisfies HashWorkerResponse);
    } else {
      self.postMessage({
        id,
        error: 'Web Crypto API unavailable in worker',
      } satisfies HashWorkerResponse);
    }
  } catch (err: unknown) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies HashWorkerResponse);
  }
};
