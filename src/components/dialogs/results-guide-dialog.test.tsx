import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ResultsGuideDialog } from './results-guide-dialog';

describe('ResultsGuideDialog', () => {
  afterEach(cleanup);

  it('renders nothing when closed', () => {
    const onOpenChange = vi.fn();
    render(<ResultsGuideDialog open={false} onOpenChange={onOpenChange} />);
    expect(
      screen.queryByText('Search & Query Answering Guide'),
    ).not.toBeInTheDocument();
  });

  it('renders guide with default Indicators & Legend tab when open', () => {
    const onOpenChange = vi.fn();
    render(<ResultsGuideDialog open={true} onOpenChange={onOpenChange} />);

    expect(
      screen.getByText('Search & Query Answering Guide'),
    ).toBeInTheDocument();
    expect(screen.getByText('Indicators & Legend')).toBeInTheDocument();
    expect(screen.getByText('Reading Results')).toBeInTheDocument();
    expect(screen.getByText('How Search Works')).toBeInTheDocument();

    // Default tab is legend
    expect(screen.getByText('Confidence & Salience')).toBeInTheDocument();
    expect(screen.getByText('Lead Answer Classifications')).toBeInTheDocument();
    expect(screen.getByText('Semantic Salience Score:')).toBeInTheDocument();
  });

  it('switches to Reading Results tab and How Search Works tab', () => {
    const onOpenChange = vi.fn();
    render(<ResultsGuideDialog open={true} onOpenChange={onOpenChange} />);

    // Click Reading Results tab
    fireEvent.click(screen.getByRole('tab', { name: /Reading Results/i }));
    expect(
      screen.getByRole('heading', { level: 4, name: 'Lead Direct Answer' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Topological Concept Navigation'),
    ).toBeInTheDocument();

    // Click How Search Works tab
    fireEvent.click(screen.getByRole('tab', { name: /How Search Works/i }));
    expect(
      screen.getByText('Hybrid Semantic & Lexical Retrieval'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No Generative Hallucinations:'),
    ).toBeInTheDocument();
  });

  it('calls onOpenChange when close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(<ResultsGuideDialog open={true} onOpenChange={onOpenChange} />);

    const closeBtn = screen.getByTitle('Close dialog');
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
