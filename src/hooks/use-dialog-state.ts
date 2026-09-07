import { useCallback, useState } from 'react';

export type DialogName =
  | 'auth'
  | 'create'
  | 'pricing'
  | 'profile'
  | 'copy'
  | 'browser'
  | 'settings'
  | 'retention';

export function useDialogState() {
  const [activeDialogs, setActiveDialogs] = useState<
    Record<DialogName, boolean>
  >({
    auth: false,
    create: false,
    pricing: false,
    profile: false,
    copy: false,
    browser: false,
    settings: false,
    retention: false,
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
      pricing: false,
      profile: false,
      copy: false,
      browser: false,
      settings: false,
      retention: false,
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
