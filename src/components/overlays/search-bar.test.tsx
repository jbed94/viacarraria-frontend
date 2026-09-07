import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../i18n';
import { SearchBar } from './search-bar';

describe('SearchBar', () => {
  afterEach(cleanup);

  it('fills the query text supplied by recent-query editing', async () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = render(<SearchBar onSearch={onSearch} />);
    const input = screen.getByRole('textbox');

    expect(input).toHaveValue('');

    rerender(
      <SearchBar
        onSearch={onSearch}
        queryForEdit="Where are relational databases explained?"
      />,
    );

    await waitFor(() =>
      expect(input).toHaveValue('Where are relational databases explained?'),
    );
    unmount();
  });

  it('sends the extended search flag for registered accounts', async () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);
    render(<SearchBar onSearch={onSearch} tier="FREE" />);

    // Open options drawer
    fireEvent.click(screen.getByRole('button', { name: 'Search options' }));

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'adjacent context' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith(
      'adjacent context',
      true,
      'medium',
      'normal',
    );
  });

  it('shows disabled extended search with sign-in prompt for anonymous users and triggers auth prompt', () => {
    const onRequireAuth = vi.fn();
    render(
      <SearchBar
        onSearch={vi.fn()}
        tier="ANONYMOUS"
        onRequireAuth={onRequireAuth}
      />,
    );

    // Open options drawer
    fireEvent.click(screen.getByRole('button', { name: 'Search options' }));

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeDisabled();
    expect(screen.getByText('Sign in')).toBeInTheDocument();

    // Clicking the toggle invokes onRequireAuth
    const toggleLabel = checkbox.closest('label');
    expect(toggleLabel).toBeInTheDocument();
    fireEvent.click(toggleLabel!);
    expect(onRequireAuth).toHaveBeenCalledTimes(1);
  });

  it('associates the Extended description with the checkbox', () => {
    render(<SearchBar onSearch={vi.fn()} tier="FREE" />);

    // Open options drawer
    fireEvent.click(screen.getByRole('button', { name: 'Search options' }));

    const checkbox = screen.getByRole('checkbox');
    const description = screen.getByRole('tooltip');
    expect(checkbox).toHaveAttribute(
      'aria-describedby',
      description.getAttribute('id'),
    );
    expect(description).toHaveTextContent(
      'Search adjacent topics for up to 3 related contexts',
    );
  });

  it('allows customizing sensitivity and scope via options drawer', async () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);
    render(<SearchBar onSearch={onSearch} tier="PRO" />);

    // Open options drawer
    fireEvent.click(screen.getByRole('button', { name: 'Search options' }));

    // Sensitivity options: Low, Medium, High
    const highSensitivityBtn = screen.getByRole('radio', { name: 'High' });
    fireEvent.click(highSensitivityBtn);
    expect(highSensitivityBtn).toHaveAttribute('aria-checked', 'true');

    // Scope options: Narrow, Normal, Wide
    const wideScopeBtn = screen.getByRole('radio', { name: 'Wide' });
    fireEvent.click(wideScopeBtn);
    expect(wideScopeBtn).toHaveAttribute('aria-checked', 'true');

    // Type query and submit
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'distributed consensus' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith(
      'distributed consensus',
      false,
      'high',
      'wide',
    );
  });

  it('displays a circular progress bar and disables button while search is pending', async () => {
    let resolveSearch: () => void = () => {};
    const pendingSearchPromise = new Promise<void>((resolve) => {
      resolveSearch = resolve;
    });
    const onSearch = vi.fn().mockReturnValue(pendingSearchPromise);

    render(<SearchBar onSearch={onSearch} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'quantum computing' },
    });

    const searchButton = screen.getByRole('button', { name: 'Search' });
    expect(searchButton).not.toBeDisabled();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    fireEvent.click(searchButton);

    // During pending search:
    expect(searchButton).toBeDisabled();
    expect(searchButton).toHaveAttribute('aria-busy', 'true');
    const progressBar = screen.getByRole('progressbar', { name: 'Search' });
    expect(progressBar).toBeInTheDocument();

    // Resolve search
    resolveSearch();
    await waitFor(() => {
      expect(searchButton).not.toBeDisabled();
      expect(searchButton).toHaveAttribute('aria-busy', 'false');
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});
