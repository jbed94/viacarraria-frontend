import { useEffect, useEffectEvent } from 'react';
import { io } from 'socket.io-client';

import type { CrawlProgressPayload, NotificationItem } from '../types/api';

export type SocketProgressUpdate = {
  sourceId: string;
  graphId?: string;
  nodeId?: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';
  progress?: number;
};

type UseSocketSyncProps = {
  graphId?: string;
  onProgressUpdate?: (update: SocketProgressUpdate) => void;
  onNewNotification?: (notification: NotificationItem) => void;
  onCrawlProgress?: (progress: CrawlProgressPayload) => void;
};

export function useSocketSync({
  graphId,
  onProgressUpdate,
  onNewNotification,
  onCrawlProgress,
}: UseSocketSyncProps) {
  const handleProgress = useEffectEvent((update: SocketProgressUpdate) => {
    onProgressUpdate?.(update);
  });

  const handleNotification = useEffectEvent(
    (notification: NotificationItem) => {
      onNewNotification?.(notification);
    },
  );

  const handleCrawl = useEffectEvent((progress: CrawlProgressPayload) => {
    onCrawlProgress?.(progress);
  });

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL;
    const socket = wsUrl
      ? io(wsUrl, {
          transports: ['websocket'],
          withCredentials: true,
        })
      : io('/ws', {
          transports: ['websocket'],
          withCredentials: true,
        });

    if (graphId) {
      if (socket.connected) {
        socket.emit('join:graph', { graphId });
      } else {
        socket.once('connect', () => {
          socket.emit('join:graph', { graphId });
        });
      }
    }

    socket.on('progress:update', handleProgress);
    socket.on('notification:new', handleNotification);
    socket.on('crawl:progress', handleCrawl);

    return () => {
      if (graphId && socket.connected) {
        socket.emit('leave:graph', { graphId });
      }
      socket.close();
    };
  }, [graphId]);
}
