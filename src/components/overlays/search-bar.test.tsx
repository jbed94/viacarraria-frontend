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

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'adjacent context' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith('adjacent context', true);
  });

  it('hides extended search for anonymous users', () => {
    render(<SearchBar onSearch={vi.fn()} tier="ANONYMOUS" />);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('associates the Extended description with the checkbox', () => {
    render(<SearchBar onSearch={vi.fn()} tier="FREE" />);

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
});
