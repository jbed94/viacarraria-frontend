import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasWelcomeHub } from './canvas-welcome-hub';

describe('CanvasWelcomeHub', () => {
  afterEach(cleanup);

  it('renders welcome hub with header and all 3 pathways', () => {
    const onExploreDemo = vi.fn();
    const onAskQuestion = vi.fn();
    const onAddOrImport = vi.fn();
    const onDismiss = vi.fn();

    render(
      <CanvasWelcomeHub
        graphTitle="Neural Architectures"
        onExploreDemo={onExploreDemo}
        onAskQuestion={onAskQuestion}
        onAddOrImport={onAddOrImport}
        onDismiss={onDismiss}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Welcome to Via Carraria' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Neural Architectures')).toBeInTheDocument();
    expect(screen.getByText('Explore Sample Graph')).toBeInTheDocument();
    expect(screen.getByText('Ask a Question')).toBeInTheDocument();
    expect(screen.getByText('Add Topic Node')).toBeInTheDocument();
  });

  it('triggers onExploreDemo when clicking explore pathway', () => {
    const onExploreDemo = vi.fn();
    render(
      <CanvasWelcomeHub
        onExploreDemo={onExploreDemo}
        onAskQuestion={vi.fn()}
        onAddOrImport={vi.fn()}
      />,
    );

    const exploreCard = screen
      .getByText('Explore Sample Graph')
      .closest('.canvas-welcome-card')!;
    fireEvent.click(exploreCard);
    expect(onExploreDemo).toHaveBeenCalledTimes(1);
  });

  it('triggers onAskQuestion when clicking ask pathway', () => {
    const onAskQuestion = vi.fn();
    render(
      <CanvasWelcomeHub
        onExploreDemo={vi.fn()}
        onAskQuestion={onAskQuestion}
        onAddOrImport={vi.fn()}
      />,
    );

    const askCard = screen
      .getByText('Ask a Question')
      .closest('.canvas-welcome-card')!;
    fireEvent.click(askCard);
    expect(onAskQuestion).toHaveBeenCalledTimes(1);
  });

  it('triggers onAddOrImport when clicking add topic pathway', () => {
    const onAddOrImport = vi.fn();
    render(
      <CanvasWelcomeHub
        onExploreDemo={vi.fn()}
        onAskQuestion={vi.fn()}
        onAddOrImport={onAddOrImport}
      />,
    );

    const addCard = screen
      .getByText('Add Topic Node')
      .closest('.canvas-welcome-card')!;
    fireEvent.click(addCard);
    expect(onAddOrImport).toHaveBeenCalledTimes(1);
  });

  it('triggers onDismiss when clicking dismiss button', () => {
    const onDismiss = vi.fn();
    render(
      <CanvasWelcomeHub
        onExploreDemo={vi.fn()}
        onAskQuestion={vi.fn()}
        onAddOrImport={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    const dismissBtn = screen.getByRole('button', {
      name: 'Dismiss welcome card',
    });
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
