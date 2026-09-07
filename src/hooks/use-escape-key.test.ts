import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEscapeKey } from './use-escape-key';
import { useGraphStore } from '../store/graph-store';

describe('useEscapeKey', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('calls onEscapeResults when Escape is pressed and results are present', () => {
    const onEscapeResults = vi.fn();
    renderHook(() => useEscapeKey({ hasResults: true, onEscapeResults }));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onEscapeResults).toHaveBeenCalledTimes(1);
  });

  it('does not call onEscapeResults if an active input is focused', () => {
    const onEscapeResults = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useEscapeKey({ hasResults: true, onEscapeResults }));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onEscapeResults).not.toHaveBeenCalled();
  });

  it('does not call onEscapeResults if a modal dialog with role="dialog" is open', () => {
    const onEscapeResults = vi.fn();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);

    renderHook(() => useEscapeKey({ hasResults: true, onEscapeResults }));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onEscapeResults).not.toHaveBeenCalled();
  });

  it('collapses expanded nodes if no results are present', () => {
    const onEscapeResults = vi.fn();
    useGraphStore.setState({
      graph: {
        id: 'g1',
        title: 'G1',
        description: null,
        userId: 'u1',
        isPublic: true,
        isPrepared: true,
        isOwned: true,
        nodes: [],
        edges: [],
        sources: [],
        permission: 'OWNER',
        canEdit: true,
        accessCount: 1,
      },
      expandedNodeIds: ['node-1'],
    });

    renderHook(() => useEscapeKey({ hasResults: false, onEscapeResults }));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onEscapeResults).not.toHaveBeenCalled();
    expect(useGraphStore.getState().expandedNodeIds).toEqual([]);
  });
});
