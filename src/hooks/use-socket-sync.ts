import { useEffect, useEffectEvent } from 'react';
import { io } from 'socket.io-client';

import type { NotificationItem } from '../types/api';

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
};

export function useSocketSync({
  graphId,
  onProgressUpdate,
  onNewNotification,
}: UseSocketSyncProps) {
  const handleProgress = useEffectEvent((update: SocketProgressUpdate) => {
    onProgressUpdate?.(update);
  });

  const handleNotification = useEffectEvent(
    (notification: NotificationItem) => {
      onNewNotification?.(notification);
    },
  );

  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws', {
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

    return () => {
      if (graphId && socket.connected) {
        socket.emit('leave:graph', { graphId });
      }
      socket.close();
    };
  }, [graphId]);
}
