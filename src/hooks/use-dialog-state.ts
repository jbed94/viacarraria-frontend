import { useCallback, useState } from 'react';

export type DialogName =
  | 'auth'
  | 'create'
  | 'profile'
  | 'copy'
  | 'browser'
  | 'settings'
  | 'retention'
  | 'privacy';

export function useDialogState() {
  const [activeDialogs, setActiveDialogs] = useState<
    Record<DialogName, boolean>
  >({
    auth: false,
    create: false,
    profile: false,
    copy: false,
    browser: false,
    settings: false,
    retention: false,
    privacy: false,
  });

  const open = useCallback((name: DialogName) => {
    setActiveDialogs((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  }, []);

  const close = useCallback((name: DialogName) => {
    setActiveDialogs((prev) =>
      !prev[name] ? prev : { ...prev, [name]: false },
    );
  }, []);

  const set = useCallback((name: DialogName, isOpen: boolean) => {
    setActiveDialogs((prev) =>
      prev[name] === isOpen ? prev : { ...prev, [name]: isOpen },
    );
  }, []);

  const closeAll = useCallback(() => {
    setActiveDialogs({
      auth: false,
      create: false,
      profile: false,
      copy: false,
      browser: false,
      settings: false,
      retention: false,
      privacy: false,
    });
  }, []);

  return {
    isOpen: (name: DialogName) => activeDialogs[name],
    open,
    close,
    set,
    closeAll,
    activeDialogs,
  };
}
