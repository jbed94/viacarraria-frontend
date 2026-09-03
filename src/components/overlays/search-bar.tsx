import { Search, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGraphStore } from '../../store/graph-store';
import type { SubscriptionTier } from '../../types/api';

type SearchBarProps = {
  onSearch: (query: string, extendedSearch: boolean) => Promise<void>;
  queryForEdit?: string;
  tier?: SubscriptionTier;
};

export function SearchBar({ onSearch, queryForEdit, tier }: SearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [extendedSearch, setExtendedSearch] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const mode = useGraphStore((state) => state.mode);
  const setMode = useGraphStore((state) => state.setMode);
  const setResults = useGraphStore((state) => state.setResults);

  useEffect(() => {
    if (queryForEdit !== undefined) setQuery(queryForEdit);
  }, [queryForEdit]);

  useEffect(() => {
    if (tier === 'ANONYMOUS' || !tier) setExtendedSearch(false);
  }, [tier]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!query.trim() || isSubmitting) return;
    setSubmitting(true);
    try {
      await onSearch(query.trim(), extendedSearch);
    } finally {
      setSubmitting(false);
    }
  }

  function cancel(): void {
    setMode('IDLE');
    setResults(undefined);
  }

  return (
    <form
      className="search-bar overlay-interactive"
      onSubmit={(event) => void submit(event)}
    >
      <Search size={19} aria-hidden="true" />
      <input
        value={query}
        onFocus={() => setMode('CONTEXT_SELECTION')}
        onChange={(event) => {
          setQuery(event.target.value);
          if (mode === 'IDLE') setMode('CONTEXT_SELECTION');
        }}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
      />
      {mode !== 'IDLE' ? (
        <button
          type="button"
          className="icon-button"
          title={t('cancel')}
          onClick={cancel}
        >
          <X size={17} />
        </button>
      ) : null}
      {tier && tier !== 'ANONYMOUS' ? (
        <label
          className="extended-search-toggle"
          title={t('extendedSearchQuota', {
            count: tier === 'PRO' ? 15 : 3,
          })}
        >
          <input
            aria-describedby="extended-search-description"
            type="checkbox"
            checked={extendedSearch}
            onChange={(event) => setExtendedSearch(event.target.checked)}
          />
          <span>{t('extendedSearch')}</span>
          <span
            id="extended-search-description"
            className="extended-search-tooltip"
            role="tooltip"
          >
            {t('extendedSearchQuota', {
              count: tier === 'PRO' ? 15 : 3,
            })}
          </span>
        </label>
      ) : null}
      <button type="submit" className="command-button" disabled={isSubmitting}>
        {isSubmitting ? '...' : t('search')}
      </button>
    </form>
  );
}
