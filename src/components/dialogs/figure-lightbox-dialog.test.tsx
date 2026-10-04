import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FigureLightboxDialog } from './figure-lightbox-dialog';

describe('FigureLightboxDialog', () => {
  const sampleFigure = {
    url: '/api/sources/src-123/assets/diagram.png',
    title: 'Distributed Architecture Flow',
    sourceName: 'Architecture_Spec.pdf',
    pageNum: 4,
    coordinates: [100, 200, 400, 300],
  };

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when figure is null', () => {
    const { container } = render(
      <FigureLightboxDialog figure={null} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog with title, metadata, image, and initial 100% zoom badge', () => {
    render(<FigureLightboxDialog figure={sampleFigure} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('Distributed Architecture Flow'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Architecture_Spec.pdf • Page 4'),
    ).toBeInTheDocument();

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute(
      'src',
      '/api/sources/src-123/assets/diagram.png',
    );
    expect(img).toHaveAttribute('alt', 'Distributed Architecture Flow');

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('zooms in and zooms out using toolbar buttons', () => {
    render(<FigureLightboxDialog figure={sampleFigure} onClose={vi.fn()} />);

    const zoomInBtn = screen.getByRole('button', { name: 'Zoom In' });
    const zoomOutBtn = screen.getByRole('button', { name: 'Zoom Out' });

    // Click Zoom In
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('125%')).toBeInTheDocument();

    fireEvent.click(zoomInBtn);
    expect(screen.getByText('150%')).toBeInTheDocument();

    // Click Zoom Out
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('125%')).toBeInTheDocument();
  });

  it('resets zoom to 100% when clicking reset button', () => {
    render(<FigureLightboxDialog figure={sampleFigure} onClose={vi.fn()} />);

    const zoomInBtn = screen.getByRole('button', { name: 'Zoom In' });
    const resetBtn = screen.getByRole('button', { name: 'Reset Zoom' });

    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('150%')).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('fits to view when clicking fit to view button', () => {
    render(<FigureLightboxDialog figure={sampleFigure} onClose={vi.fn()} />);

    const zoomInBtn = screen.getByRole('button', { name: 'Zoom In' });
    const fitBtn = screen.getByRole('button', { name: 'Fit to View' });

    fireEvent.click(zoomInBtn);
    expect(screen.getByText('125%')).toBeInTheDocument();

    fireEvent.click(fitBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('responds to keyboard shortcuts (+, -, 0, r)', () => {
    render(<FigureLightboxDialog figure={sampleFigure} onClose={vi.fn()} />);

    // Press '+'
    fireEvent.keyDown(window, { key: '+' });
    expect(screen.getByText('125%')).toBeInTheDocument();

    // Press '-'
    fireEvent.keyDown(window, { key: '-' });
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Zoom in and press 'r' to reset
    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '+' });
    expect(screen.getByText('150%')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'r' });
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('toggles 2x zoom on double-click', () => {
    render(<FigureLightboxDialog figure={sampleFigure} onClose={vi.fn()} />);

    const viewport = screen.getByRole('region', {
      name: 'Interactive Pan and Zoom Canvas',
    });

    // Double click to zoom in to 200%
    fireEvent.doubleClick(viewport);
    expect(screen.getByText('200%')).toBeInTheDocument();

    // Double click again to reset to 100%
    fireEvent.doubleClick(viewport);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('handles wheel zoom event', () => {
    render(<FigureLightboxDialog figure={sampleFigure} onClose={vi.fn()} />);

    const viewport = screen.getByRole('region', {
      name: 'Interactive Pan and Zoom Canvas',
    });

    // Wheel zoom in (deltaY < 0)
    fireEvent.wheel(viewport, { deltaY: -100 });
    expect(screen.getByText('115%')).toBeInTheDocument();
  });

  it('handles mouse drag for 2D panning', () => {
    render(<FigureLightboxDialog figure={sampleFigure} onClose={vi.fn()} />);

    const viewport = screen.getByRole('region', {
      name: 'Interactive Pan and Zoom Canvas',
    });
    const canvas = viewport.querySelector('.figure-lightbox-canvas')!;

    // Mouse down, move, up
    fireEvent.mouseDown(viewport, { button: 0, clientX: 200, clientY: 200 });
    expect(viewport).toHaveClass('is-dragging');

    fireEvent.mouseMove(viewport, { clientX: 250, clientY: 230 });
    expect(canvas).toHaveStyle({
      transform: 'translate(50px, 30px) scale(1)',
    });

    fireEvent.mouseUp(viewport);
    expect(viewport).not.toHaveClass('is-dragging');
  });

  it('calls onClose when clicking close button', () => {
    const onClose = vi.fn();
    render(<FigureLightboxDialog figure={sampleFigure} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', {
      name: 'Close figure lightbox',
    });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it('toggles between Pan mode and Crop mode via buttons and keyboard shortcuts', () => {
    render(<FigureLightboxDialog figure={sampleFigure} onClose={vi.fn()} />);

    const panBtn = screen.getByRole('button', { name: 'Pan Mode' });
    const cropBtn = screen.getByRole('button', { name: 'Crop ROI Mode' });

    expect(panBtn).toHaveAttribute('aria-pressed', 'true');
    expect(cropBtn).toHaveAttribute('aria-pressed', 'false');

    // Click crop button
    fireEvent.click(cropBtn);
    expect(cropBtn).toHaveAttribute('aria-pressed', 'true');
    expect(panBtn).toHaveAttribute('aria-pressed', 'false');

    // Switch back to pan via 'h' key
    fireEvent.keyDown(window, { key: 'h' });
    expect(panBtn).toHaveAttribute('aria-pressed', 'true');

    // Switch to crop via 'c' key
    fireEvent.keyDown(window, { key: 'c' });
    expect(cropBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('draws a crop bounding box in crop mode and displays crop action bar', () => {
    render(<FigureLightboxDialog figure={sampleFigure} onClose={vi.fn()} />);

    const cropBtn = screen.getByRole('button', { name: 'Crop ROI Mode' });
    fireEvent.click(cropBtn);

    const viewport = screen.getByRole('region', {
      name: 'Interactive Pan and Zoom Canvas',
    });
    expect(viewport).toHaveClass('is-crop-mode');

    // Drag to draw crop rectangle
    fireEvent.mouseDown(viewport, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(viewport, { clientX: 300, clientY: 250 });
    fireEvent.mouseUp(viewport);

    // Crop box and action bar should appear
    expect(
      screen.getByRole('region', { name: 'Crop Bounding Box' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('toolbar', { name: 'Crop Actions' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create Node' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear Crop' }),
    ).toBeInTheDocument();
  });

  it('triggers onCreateNodeFromCrop and closes dialog when clicking Create Node', () => {
    const onCreateNodeFromCrop = vi.fn();
    const onClose = vi.fn();
    render(
      <FigureLightboxDialog
        figure={sampleFigure}
        onClose={onClose}
        onCreateNodeFromCrop={onCreateNodeFromCrop}
      />,
    );

    // Switch to crop mode and draw selection
    fireEvent.click(screen.getByRole('button', { name: 'Crop ROI Mode' }));
    const viewport = screen.getByRole('region', {
      name: 'Interactive Pan and Zoom Canvas',
    });
    fireEvent.mouseDown(viewport, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(viewport, { clientX: 300, clientY: 250 });
    fireEvent.mouseUp(viewport);

    // Click Create Node
    const createNodeBtn = screen.getByRole('button', { name: 'Create Node' });
    fireEvent.click(createNodeBtn);

    expect(onCreateNodeFromCrop).toHaveBeenCalledWith(
      expect.stringContaining('data:image/png;base64,'),
      'Distributed Architecture Flow',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('clears crop box when clicking Clear or pressing Escape', () => {
    const onClose = vi.fn();
    render(<FigureLightboxDialog figure={sampleFigure} onClose={onClose} />);

    // Switch to crop mode and draw selection
    fireEvent.click(screen.getByRole('button', { name: 'Crop ROI Mode' }));
    const viewport = screen.getByRole('region', {
      name: 'Interactive Pan and Zoom Canvas',
    });
    fireEvent.mouseDown(viewport, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(viewport, { clientX: 300, clientY: 250 });
    fireEvent.mouseUp(viewport);

    expect(
      screen.getByRole('region', { name: 'Crop Bounding Box' }),
    ).toBeInTheDocument();

    // Click Clear
    fireEvent.click(screen.getByRole('button', { name: 'Clear Crop' }));
    expect(
      screen.queryByRole('region', { name: 'Crop Bounding Box' }),
    ).not.toBeInTheDocument();

    // Draw again and press Escape
    fireEvent.mouseDown(viewport, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(viewport, { clientX: 300, clientY: 250 });
    fireEvent.mouseUp(viewport);
    expect(
      screen.getByRole('region', { name: 'Crop Bounding Box' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('region', { name: 'Crop Bounding Box' }),
    ).not.toBeInTheDocument();
    // Escape should only clear the crop box, not close the dialog
    expect(onClose).not.toHaveBeenCalled();
  });
});
