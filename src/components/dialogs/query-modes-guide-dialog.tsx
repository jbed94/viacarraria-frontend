import {
  ArrowRight,
  Compass,
  GitCompare,
  Layers,
  Search,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DialogFrame } from './dialog-frame';

type QueryModesGuideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type GuideModeTab = 'all' | 'search' | 'crawl' | 'comparative';

export function QueryModesGuideDialog({
  open,
  onOpenChange,
}: QueryModesGuideDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<GuideModeTab>('all');

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('queryModesGuideTitle')}
      className="query-modes-guide-dialog"
    >
      <div className="guide-dialog-container">
        <p className="guide-intro-text">{t('queryModesGuideDesc')}</p>

        <div className="guide-tabs" role="tablist" aria-label="Query Mode Tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`guide-tab-btn ${activeTab === 'all' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <Layers size={14} aria-hidden="true" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'search'}
            className={`guide-tab-btn ${activeTab === 'search' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={14} aria-hidden="true" />
            <span>{t('modeSearch')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'crawl'}
            className={`guide-tab-btn ${activeTab === 'crawl' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('crawl')}
          >
            <Compass size={14} aria-hidden="true" />
            <span>{t('modeCrawl')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'comparative'}
            className={`guide-tab-btn ${activeTab === 'comparative' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('comparative')}
          >
            <GitCompare size={14} aria-hidden="true" />
            <span>Comparative</span>
          </button>
        </div>

        <div className="mode-guide-cards-list">
          {/* Card 1: Direct Search */}
          {(activeTab === 'all' || activeTab === 'search') && (
            <article className="mode-guide-card is-search-card">
              <header className="mode-card-header">
                <div className="mode-card-icon-wrapper search-icon-bg">
                  <Search size={20} className="mode-card-icon" />
                </div>
                <div className="mode-card-title-group">
                  <h3 className="mode-card-title">{t('directSearchTitle')}</h3>
                  <span className="mode-card-subtitle">
                    {t('directSearchSubtitle')}
                  </span>
                </div>
                <span className="mode-card-badge search-badge">
                  {t('modeSearch')}
                </span>
              </header>
              <p className="mode-card-desc">{t('directSearchDesc')}</p>
              <div className="mode-card-callout">
                <span className="callout-label">When to use:</span>
                <p className="callout-text">{t('directSearchWhenToUse')}</p>
              </div>
              <ul className="mode-card-features">
                <li>
                  <Sparkles size={13} className="feature-icon" />
                  Hybrid vector embeddings + BM25 keyword matching
                </li>
                <li>
                  <Sparkles size={13} className="feature-icon" />
                  Cross-encoder neural reranker scoring
                </li>
                <li>
                  <Sparkles size={13} className="feature-icon" />
                  Instant lead answer dossier with prerequisite & extension
                  topics
                </li>
              </ul>
            </article>
          )}

          {/* Card 2: Graph Crawl */}
          {(activeTab === 'all' || activeTab === 'crawl') && (
            <article className="mode-guide-card is-crawl-card">
              <header className="mode-card-header">
                <div className="mode-card-icon-wrapper crawl-icon-bg">
                  <Compass size={20} className="mode-card-icon" />
                </div>
                <div className="mode-card-title-group">
                  <h3 className="mode-card-title">{t('graphCrawlTitle')}</h3>
                  <span className="mode-card-subtitle">
                    {t('graphCrawlSubtitle')}
                  </span>
                </div>
                <span className="mode-card-badge crawl-badge">
                  {t('modeCrawl')}
                </span>
              </header>
              <p className="mode-card-desc">{t('graphCrawlDesc')}</p>
              <div className="mode-card-callout">
                <span className="callout-label">When to use:</span>
                <p className="callout-text">{t('graphCrawlWhenToUse')}</p>
              </div>
              <ul className="mode-card-features">
                <li>
                  <ArrowRight size={13} className="feature-icon" />
                  Explore from 1 or more seed nodes step-by-step
                </li>
                <li>
                  <ArrowRight size={13} className="feature-icon" />
                  Configurable traversal direction (Forward, Backward, Both)
                </li>
                <li>
                  <ArrowRight size={13} className="feature-icon" />
                  Semantic crawl depth levels (Shallow, Default, Deep,
                  Unlimited)
                </li>
                <li>
                  <ArrowRight size={13} className="feature-icon" />
                  Live interactive narrative visualization in Crawl Canvas
                </li>
              </ul>
            </article>
          )}

          {/* Card 3: Comparative Mode */}
          {(activeTab === 'all' || activeTab === 'comparative') && (
            <article className="mode-guide-card is-comparative-card">
              <header className="mode-card-header">
                <div className="mode-card-icon-wrapper comparative-icon-bg">
                  <GitCompare size={20} className="mode-card-icon" />
                </div>
                <div className="mode-card-title-group">
                  <h3 className="mode-card-title">
                    {t('comparativeCrawlTitle')}
                  </h3>
                  <span className="mode-card-subtitle">
                    {t('comparativeCrawlSubtitle')}
                  </span>
                </div>
                <span className="mode-card-badge comparative-badge">
                  Comparative (N &ge; 2)
                </span>
              </header>
              <p className="mode-card-desc">{t('comparativeCrawlDesc')}</p>
              <div className="mode-card-callout">
                <span className="callout-label">When to use:</span>
                <p className="callout-text">{t('comparativeCrawlWhenToUse')}</p>
              </div>
              <ul className="mode-card-features">
                <li>
                  <ArrowRight size={13} className="feature-icon" />
                  Partition seeds into 2 or more hypothesis groups (A, B, C...)
                </li>
                <li>
                  <ArrowRight size={13} className="feature-icon" />
                  Split diff view with dedicated lanes for each hypothesis
                </li>
                <li>
                  <ArrowRight size={13} className="feature-icon" />
                  Multi-way convergence lane showing common consensus nodes
                </li>
                <li>
                  <ArrowRight size={13} className="feature-icon" />
                  Interactive pruning sliders (Relevance % and Hop Depth)
                </li>
              </ul>
            </article>
          )}
        </div>
      </div>
    </DialogFrame>
  );
}
