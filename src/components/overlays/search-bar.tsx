import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGraphStore } from '../../store/graph-store';
import type {
  SearchScope,
  SearchSensitivity,
  SubscriptionTier,
} from '../../types/api';
import { LineSlicer } from '../ui/line-slicer';

type SearchBarProps = {
  onSearch: (
    query: string,
    extendedSearch: boolean,
    sensitivity?: SearchSensitivity,
    scope?: SearchScope,
  ) => Promise<void>;
  queryForEdit?: string;
  tier?: SubscriptionTier;
};

export function SearchBar({ onSearch, queryForEdit, tier }: SearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [extendedSearch, setExtendedSearch] = useState(false);
  const [sensitivity, setSensitivity] = useState<SearchSensitivity>('medium');
  const [scope, setScope] = useState<SearchScope>('normal');
  const [showOptions, setShowOptions] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const mode = useGraphStore((state) => state.mode);
  const setMode = useGraphStore((state) => state.setMode);
  const setResults = useGraphStore((state) => state.setResults);

  const sensitivityOptions = [
    { value: 'low' as const, label: t('sensitivityLow') },
    { value: 'medium' as const, label: t('sensitivityMedium') },
    { value: 'high' as const, label: t('sensitivityHigh') },
  ];

  const scopeOptions = [
    { value: 'narrow' as const, label: t('scopeNarrow') },
    { value: 'normal' as const, label: t('scopeNormal') },
    { value: 'wide' as const, label: t('scopeWide') },
  ];

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
      await onSearch(query.trim(), extendedSearch, sensitivity, scope);
    } finally {
      setSubmitting(false);
    }
  }

  function cancel(): void {
    setMode('IDLE');
    setResults(undefined);
  }

  const sensitivityDesc =
    sensitivity === 'low'
      ? t('sensitivityLowDesc')
      : sensitivity === 'high'
        ? t('sensitivityHighDesc')
        : t('sensitivityMediumDesc');

  const scopeDesc =
    scope === 'narrow'
      ? t('scopeNarrowDesc')
      : scope === 'wide'
        ? t('scopeWideDesc')
        : t('scopeNormalDesc');

  const isCustomOptions = sensitivity !== 'medium' || scope !== 'normal';

  return (
    <form
      className="search-bar overlay-interactive"
      onSubmit={(event) => void submit(event)}
    >
      {showOptions ? (
        <div
          className="search-options-drawer"
          role="region"
          aria-label={t('queryOptions')}
        >
          <div className="search-option-group">
            <div className="search-option-header">
              <span className="search-option-label">{t('sensitivity')}</span>
              <span className="search-option-desc">{sensitivityDesc}</span>
            </div>
            <LineSlicer
              label={t('sensitivity')}
              value={sensitivity}
              options={sensitivityOptions}
              onChange={setSensitivity}
            />
          </div>

          <div className="search-option-group">
            <div className="search-option-header">
              <span className="search-option-label">{t('scope')}</span>
              <span className="search-option-desc">{scopeDesc}</span>
            </div>
            <LineSlicer
              label={t('scope')}
              value={scope}
              options={scopeOptions}
              onChange={setScope}
            />
          </div>
        </div>
      ) : null}

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
      <button
        type="button"
        className={`icon-button search-options-btn ${showOptions ? 'active' : ''} ${isCustomOptions ? 'customized' : ''}`}
        title={t('queryOptions')}
        aria-label={t('queryOptions')}
        aria-expanded={showOptions}
        onClick={() => setShowOptions(!showOptions)}
      >
        <SlidersHorizontal size={16} />
      </button>
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
