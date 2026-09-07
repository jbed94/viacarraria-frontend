import { useEffect } from 'react';

import { useGraphStore } from '../store/graph-store';

type UseEscapeKeyProps = {
  hasResults: boolean;
  onEscapeResults: () => void;
};

export function useEscapeKey({
  hasResults,
  onEscapeResults,
}: UseEscapeKeyProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      // Do not intercept if a modal dialog is currently open
      if (document.querySelector('[role="dialog"]')) return;

      if (hasResults) {
        event.preventDefault();
        onEscapeResults();
        return;
      }

      const { expandedNodeIds, collapseAllNodes } = useGraphStore.getState();
      if (expandedNodeIds.length > 0) {
        event.preventDefault();
        collapseAllNodes();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasResults, onEscapeResults]);
}
