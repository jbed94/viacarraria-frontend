import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../i18n';
import { QueryModesGuideDialog } from './query-modes-guide-dialog';

describe('QueryModesGuideDialog', () => {
  afterEach(cleanup);

  it('renders nothing when closed', () => {
    const onOpenChange = vi.fn();
    render(<QueryModesGuideDialog open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByText('Query Modes Guide')).not.toBeInTheDocument();
  });

  it('renders guide with overview showing Direct Search, Graph Crawl, and Comparative modes', () => {
    const onOpenChange = vi.fn();
    render(<QueryModesGuideDialog open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByText('Query Modes Guide')).toBeInTheDocument();
    expect(screen.getByText('Direct Search Mode')).toBeInTheDocument();
    expect(screen.getByText('Graph Crawl Mode')).toBeInTheDocument();
    expect(
      screen.getByText('Comparative Hypothesis Crawl'),
    ).toBeInTheDocument();

    // Key explanations rendered
    expect(
      screen.getByText(/hybrid vector embeddings and BM25/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/starts from selected seed nodes/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/assign seeds to distinct hypothesis groups/i),
    ).toBeInTheDocument();
  });

  it('allows filtering by tab', () => {
    const onOpenChange = vi.fn();
    render(<QueryModesGuideDialog open={true} onOpenChange={onOpenChange} />);

    // Click Search tab
    fireEvent.click(screen.getByRole('tab', { name: /Search/i }));
    expect(screen.getByText('Direct Search Mode')).toBeInTheDocument();
    expect(screen.queryByText('Graph Crawl Mode')).not.toBeInTheDocument();

    // Click Crawl tab
    fireEvent.click(screen.getByRole('tab', { name: /Crawl/i }));
    expect(screen.getByText('Graph Crawl Mode')).toBeInTheDocument();
    expect(screen.queryByText('Direct Search Mode')).not.toBeInTheDocument();

    // Click Comparative tab
    fireEvent.click(screen.getByRole('tab', { name: /Comparative/i }));
    expect(
      screen.getByText('Comparative Hypothesis Crawl'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Direct Search Mode')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when close button is clicked', () => {
    const onOpenChange = vi.fn();
    render(<QueryModesGuideDialog open={true} onOpenChange={onOpenChange} />);

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
