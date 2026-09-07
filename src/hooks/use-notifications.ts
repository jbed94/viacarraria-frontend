import { useCallback, useEffectEvent, useState } from 'react';

import { api } from '../lib/api';
import type { Identity, NotificationItem } from '../types/api';

type UseNotificationsProps = {
  identity?: Identity;
  onNavigateGraph?: (graphId: string) => Promise<void>;
  onError?: (error: unknown) => void;
};

export function useNotifications({
  identity,
  onNavigateGraph,
  onError,
}: UseNotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refresh = useEffectEvent(async (): Promise<void> => {
    if (!identity || identity.isGuest) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api.notifications();
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
    } catch {
      // Best-effort background notification fetch
    }
  });

  const markRead = useEffectEvent(async (id: string): Promise<void> => {
    try {
      const updated = await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      onError?.(err);
    }
  });

  const markAllRead = useEffectEvent(async (): Promise<void> => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, isRead: true })),
      );
      setUnreadCount(0);
    } catch (err) {
      onError?.(err);
    }
  });

  const remove = useEffectEvent(async (id: string): Promise<void> => {
    try {
      await api.deleteNotification(id);
      setNotifications((prev) => {
        const item = prev.find((n) => n.id === id);
        if (item && !item.isRead) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (err) {
      onError?.(err);
    }
  });

  const handleClick = useEffectEvent(
    async (notification: NotificationItem): Promise<void> => {
      if (!notification.isRead) {
        void markRead(notification.id);
      }
      if (notification.data?.graphId && onNavigateGraph) {
        try {
          await onNavigateGraph(notification.data.graphId);
          void refresh();
        } catch (err) {
          onError?.(err);
        }
      }
    },
  );

  const pushLiveNotification = useCallback((item: NotificationItem) => {
    setNotifications((prev) => [item, ...prev.filter((n) => n.id !== item.id)]);
    setUnreadCount((prev) => prev + 1);
  }, []);

  return {
    notifications,
    unreadCount,
    refresh,
    markRead,
    markAllRead,
    remove,
    handleClick,
    pushLiveNotification,
  };
}
