import { useEffect, useEffectEvent, useRef } from 'react';

import {
  api,
  createUploadController,
  getActiveUploadController,
  type UploadController,
} from '../lib/api';
import { useGraphStore } from '../store/graph-store';
import type { Graph, LimitsSummary, Source } from '../types/api';

type UseUploadManagerProps = {
  graph?: Graph;
  setSources: (sources: Source[]) => void;
  setLimits: (limits: LimitsSummary) => void;
  onError?: (error: unknown) => void;
};

export function useUploadManager({
  graph,
  setSources,
  setLimits,
  onError,
}: UseUploadManagerProps) {
  const uploadControllersRef = useRef<Map<string, UploadController>>(new Map());

  const reportError = useEffectEvent((err: unknown) => {
    onError?.(err);
  });

  const pollSource = useEffectEvent((sourceId: string): void => {
    window.setTimeout(() => {
      void api
        .source(sourceId)
        .then((source) => {
          const current = useGraphStore.getState().graph;
          if (current) {
            setSources(
              current.sources.map((item) =>
                item.id === source.id ? source : item,
              ),
            );
          }
          if (source.status === 'PENDING' || source.status === 'PROCESSING') {
            pollSource(sourceId);
          }
        })
        .catch(reportError);
    }, 700);
  });

  useEffect(() => {
    function uploadListener(event: Event): void {
      const detail = (event as CustomEvent<{ nodeId: string; file: File }>)
        .detail;
      if (!graph || !detail) return;

      const uploadKey = `${detail.nodeId}_${detail.file.name}_${detail.file.size}`;
      const controller = createUploadController();
      uploadControllersRef.current.set(uploadKey, controller);

      useGraphStore.getState().setUploadProgress({
        uploadKey,
        nodeId: detail.nodeId,
        fileName: detail.file.name,
        fileSize: detail.file.size,
        progress: 0,
        status: 'uploading',
        concurrency: controller.getConcurrency(),
      });

      void api
        .uploadSource(
          graph.id,
          detail.nodeId,
          detail.file,
          (percent, _loaded, _total, meta) => {
            const currentUpload =
              useGraphStore.getState().activeUploads[uploadKey];
            useGraphStore.getState().setUploadProgress({
              uploadKey,
              nodeId: detail.nodeId,
              fileName: detail.file.name,
              fileSize: detail.file.size,
              progress: percent >= 0 ? percent : (currentUpload?.progress ?? 0),
              status:
                meta?.status ??
                (percent >= 100
                  ? 'completing'
                  : (currentUpload?.status ?? 'uploading')),
              concurrency: meta?.concurrency ?? currentUpload?.concurrency,
              speedBps: meta?.speedBps ?? currentUpload?.speedBps,
            });
          },
          controller,
        )
        .then((source) => {
          uploadControllersRef.current.delete(uploadKey);
          setSources([...graph.sources, source]);
          useGraphStore.getState().removeUploadProgress(uploadKey);
          void api.limits().then(setLimits).catch(reportError);
          pollSource(source.id);
        })
        .catch((err) => {
          uploadControllersRef.current.delete(uploadKey);
          useGraphStore.getState().removeUploadProgress(uploadKey);
          if (
            err?.name !== 'AbortError' &&
            !err?.message?.includes('aborted')
          ) {
            reportError(err);
          }
        });
    }

    function pauseListener(event: Event): void {
      const detail = (event as CustomEvent<{ uploadKey: string }>).detail;
      if (!detail?.uploadKey) return;
      const ctrl =
        uploadControllersRef.current.get(detail.uploadKey) ??
        getActiveUploadController(detail.uploadKey);
      if (ctrl) {
        ctrl.pause();
        const current =
          useGraphStore.getState().activeUploads[detail.uploadKey];
        if (current) {
          useGraphStore.getState().setUploadProgress({
            ...current,
            status: 'paused',
          });
        }
      }
    }

    function resumeListener(event: Event): void {
      const detail = (event as CustomEvent<{ uploadKey: string }>).detail;
      if (!detail?.uploadKey) return;
      const ctrl =
        uploadControllersRef.current.get(detail.uploadKey) ??
        getActiveUploadController(detail.uploadKey);
      if (ctrl) {
        ctrl.resume();
        const current =
          useGraphStore.getState().activeUploads[detail.uploadKey];
        if (current) {
          useGraphStore.getState().setUploadProgress({
            ...current,
            status: 'uploading',
          });
        }
      }
    }

    function cancelListener(event: Event): void {
      const detail = (event as CustomEvent<{ uploadKey: string }>).detail;
      if (!detail?.uploadKey) return;
      const ctrl =
        uploadControllersRef.current.get(detail.uploadKey) ??
        getActiveUploadController(detail.uploadKey);
      if (ctrl) {
        ctrl.cancel();
      }
      uploadControllersRef.current.delete(detail.uploadKey);
      useGraphStore.getState().removeUploadProgress(detail.uploadKey);
    }

    function deleteListener(event: Event): void {
      const detail = (event as CustomEvent<{ sourceId: string }>).detail;
      if (!detail) return;
      void api
        .deleteSource(detail.sourceId)
        .then(() => {
          const current = useGraphStore.getState().graph;
          if (current) {
            setSources(
              current.sources.filter((source) => source.id !== detail.sourceId),
            );
          }
        })
        .catch(reportError);
    }

    function createNoteListener(event: Event): void {
      const detail = (
        event as CustomEvent<{
          nodeId: string;
          title: string;
          content: string;
          onSuccess?: (source: Source) => void;
        }>
      ).detail;
      if (!graph || !detail) return;
      void api
        .createNote(graph.id, detail.nodeId, detail.title, detail.content)
        .then((source) => {
          setSources([...graph.sources, source]);
          detail.onSuccess?.(source);
          pollSource(source.id);
        })
        .catch(reportError);
    }

    function updateSourceListener(event: Event): void {
      const detail = (
        event as CustomEvent<{
          sourceId: string;
          name?: string;
          content?: string;
          onSuccess?: (source: Source) => void;
        }>
      ).detail;
      if (!detail?.sourceId) return;
      void api
        .updateSource(detail.sourceId, {
          name: detail.name,
          content: detail.content,
        })
        .then((source) => {
          const current = useGraphStore.getState().graph;
          if (current) {
            setSources(
              current.sources.map((item) =>
                item.id === source.id ? source : item,
              ),
            );
          }
          detail.onSuccess?.(source);
          pollSource(source.id);
        })
        .catch(reportError);
    }

    window.addEventListener('via-upload-source', uploadListener);
    window.addEventListener('via-pause-upload', pauseListener);
    window.addEventListener('via-resume-upload', resumeListener);
    window.addEventListener('via-cancel-upload', cancelListener);
    window.addEventListener('via-delete-source', deleteListener);
    window.addEventListener('via-create-note', createNoteListener);
    window.addEventListener('via-update-source', updateSourceListener);

    return () => {
      window.removeEventListener('via-upload-source', uploadListener);
      window.removeEventListener('via-pause-upload', pauseListener);
      window.removeEventListener('via-resume-upload', resumeListener);
      window.removeEventListener('via-cancel-upload', cancelListener);
      window.removeEventListener('via-delete-source', deleteListener);
      window.removeEventListener('via-create-note', createNoteListener);
      window.removeEventListener('via-update-source', updateSourceListener);
    };
  }, [graph, setSources]);
}
