import type { SearchChunk, SearchResponse } from '../types/api';

/**
 * Extracts and deduplicates search chunks (both direct matches and extended context)
 * for a specific source ID to be highlighted within the source viewer dialog.
 */
export function getSourceMatches(
  results?: SearchResponse,
  activeSourceId?: string,
): SearchChunk[] {
  if (!activeSourceId || !results?.results?.length) return [];

  const allQueryChunks = results.results
    .flatMap((result) => result.chunks)
    .flatMap((chunk) => [chunk, ...(chunk.extendedContext ?? [])])
    .filter((chunk) => chunk.sourceId === activeSourceId);

  const unique = new Map<string, SearchChunk>();
  for (const chunk of allQueryChunks) {
    const key = `${chunk.sourceId}:${chunk.startChar}:${chunk.endChar}`;
    // Direct matches take precedence over contextual chunks if boundaries overlap
    if (!unique.has(key) || chunk.kind === 'MATCH') {
      unique.set(key, chunk);
    }
  }
  return [...unique.values()];
}
