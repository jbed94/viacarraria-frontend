import { BookOpen, Compass, Plus, Search, X } from 'lucide-react';
import { ViaCarrariaIcon } from '../brand';

export type CanvasWelcomeHubProps = {
  graphTitle?: string;
  isGuest?: boolean;
  canEdit?: boolean;
  onExploreDemo: () => void;
  onAskQuestion: () => void;
  onAddOrImport: () => void;
  onDismiss?: () => void;
};

export function CanvasWelcomeHub({
  graphTitle,
  onExploreDemo,
  onAskQuestion,
  onAddOrImport,
  onDismiss,
}: CanvasWelcomeHubProps) {
  return (
    <div
      className="canvas-welcome-hub overlay-interactive"
      role="region"
      aria-label="Welcome to Via Carraria"
    >
      <div className="canvas-welcome-header">
        <div className="canvas-welcome-badge">
          <ViaCarrariaIcon size={14} variant="bare" aria-hidden="true" />
          <span>Knowledge Canvas</span>
        </div>
        {onDismiss ? (
          <button
            type="button"
            className="canvas-welcome-dismiss-btn"
            title="Dismiss welcome card"
            aria-label="Dismiss welcome card"
            onClick={onDismiss}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <div className="canvas-welcome-title-group">
        <h2 className="canvas-welcome-title">
          {graphTitle ? graphTitle : 'Welcome to Via Carraria'}
        </h2>
        <p className="canvas-welcome-subtitle">
          {graphTitle
            ? 'This knowledge graph has no topics yet. Choose a starting pathway below or use the search bar.'
            : 'Explore spatial knowledge, query documents with AI, or navigate multi-hop topic connections.'}
        </p>
      </div>

      <div className="canvas-welcome-cards" role="list">
        {/* Pathway 1: Explore Demo */}
        <div
          className="canvas-welcome-card"
          role="listitem"
          onClick={onExploreDemo}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onExploreDemo();
            }
          }}
        >
          <div className="welcome-card-icon-wrapper is-demo">
            <Compass size={20} aria-hidden="true" />
          </div>
          <div className="welcome-card-content">
            <strong className="welcome-card-title">Explore Sample Graph</strong>
            <p className="welcome-card-desc">
              Browse pre-mapped knowledge spaces and sample documents.
            </p>
          </div>
          <button
            type="button"
            className="command-button welcome-card-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onExploreDemo();
            }}
            tabIndex={-1}
          >
            <BookOpen size={13} />
            <span>Explore</span>
          </button>
        </div>

        {/* Pathway 2: Ask a Question */}
        <div
          className="canvas-welcome-card"
          role="listitem"
          onClick={onAskQuestion}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAskQuestion();
            }
          }}
        >
          <div className="welcome-card-icon-wrapper is-search">
            <Search size={20} aria-hidden="true" />
          </div>
          <div className="welcome-card-content">
            <strong className="welcome-card-title">Ask a Question</strong>
            <p className="welcome-card-desc">
              Type a prompt or hypothesis into the query dock below.
            </p>
          </div>
          <button
            type="button"
            className="command-button accent welcome-card-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAskQuestion();
            }}
            tabIndex={-1}
          >
            <Search size={13} />
            <span>Start Query</span>
          </button>
        </div>

        {/* Pathway 3: Add Node / Import */}
        <div
          className="canvas-welcome-card"
          role="listitem"
          onClick={onAddOrImport}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAddOrImport();
            }
          }}
        >
          <div className="welcome-card-icon-wrapper is-add">
            <Plus size={20} aria-hidden="true" />
          </div>
          <div className="welcome-card-content">
            <strong className="welcome-card-title">Add Topic Node</strong>
            <p className="welcome-card-desc">
              Create a new root node, take notes, or upload PDF sources.
            </p>
          </div>
          <button
            type="button"
            className="command-button welcome-card-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAddOrImport();
            }}
            tabIndex={-1}
          >
            <Plus size={13} />
            <span>Add Node</span>
          </button>
        </div>
      </div>
    </div>
  );
}
