import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AdCanvasNode } from './ad-canvas-node';

describe('AdCanvasNode', () => {
  afterEach(cleanup);

  it('renders vertical ad node for left/right flank placement', () => {
    const props = {
      id: 'canvas-ad-node',
      data: {
        format: 'vertical',
        side: 'right',
        width: 160,
        height: 600,
        slotId: 'ad-right-test',
        graphId: 'graph-123',
      },
      type: 'ad',
      selected: false,
      zIndex: -1,
      isConnectable: false,
      positionAbsoluteX: 700,
      positionAbsoluteY: 100,
      dragging: false,
      draggable: false,
      selectable: false,
      deletable: false,
    };
    render(<AdCanvasNode {...(props as any)} />);

    const node = screen.getByTestId('ad-canvas-node');
    expect(node).toBeInTheDocument();
    expect(node).toHaveClass('side-right');
    expect(node).toHaveClass('format-vertical');
    expect(node).toHaveStyle({ width: '160px', height: '600px' });
  });

  it('renders horizontal ad node for top/bottom flank placement', () => {
    const props = {
      id: 'canvas-ad-node',
      data: {
        format: 'horizontal',
        side: 'top',
        width: 728,
        height: 90,
        slotId: 'ad-top-test',
        graphId: 'graph-123',
      },
      type: 'ad',
      selected: false,
      zIndex: -1,
      isConnectable: false,
      positionAbsoluteX: 100,
      positionAbsoluteY: -190,
      dragging: false,
      draggable: false,
      selectable: false,
      deletable: false,
    };
    render(<AdCanvasNode {...(props as any)} />);

    const node = screen.getByTestId('ad-canvas-node');
    expect(node).toBeInTheDocument();
    expect(node).toHaveClass('side-top');
    expect(node).toHaveClass('format-horizontal');
    expect(node).toHaveStyle({ width: '728px', height: '90px' });
  });
});
