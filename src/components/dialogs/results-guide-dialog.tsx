import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  GitBranch,
  Layers,
  ListOrdered,
  Search,
  Sparkles,
  Table,
  Target,
} from 'lucide-react';
import { useState } from 'react';

import { DialogFrame } from './dialog-frame';

type ResultsGuideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type GuideTab = 'legend' | 'reading' | 'search';

export function ResultsGuideDialog({
  open,
  onOpenChange,
}: ResultsGuideDialogProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>('legend');

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Search & Query Answering Guide"
      className="results-guide-dialog"
    >
      <div className="guide-dialog-container">
        <div className="guide-tabs" role="tablist" aria-label="Guide Sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'legend'}
            className={`guide-tab-btn ${activeTab === 'legend' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('legend')}
          >
            <Layers size={14} aria-hidden="true" />
            <span>Indicators & Legend</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reading'}
            className={`guide-tab-btn ${activeTab === 'reading' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('reading')}
          >
            <BookOpen size={14} aria-hidden="true" />
            <span>Reading Results</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'search'}
            className={`guide-tab-btn ${activeTab === 'search' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={14} aria-hidden="true" />
            <span>How Search Works</span>
          </button>
        </div>

        <div className="guide-tab-content">
          {activeTab === 'legend' ? (
            <div className="guide-legend-section">
              <p className="guide-intro-text">
                Every result snippet, badge, and tag provides deterministic
                context about relevance, origin, and graph relationships:
              </p>

              <div className="legend-category">
                <h4 className="legend-category-title">Confidence & Salience</h4>
                <div className="legend-grid">
                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="lead-score-badge">95% Salience</span>
                    </div>
                    <p className="legend-card-desc">
                      <strong>Semantic Salience Score:</strong> Evaluated via a
                      deep neural cross-encoder. Reflects semantic alignment and
                      relevance between your exact inquiry and the retrieved
                      passage.
                    </p>
                  </div>

                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="result-kind-badge is-salience">88%</span>
                    </div>
                    <p className="legend-card-desc">
                      <strong>Chunk Salience:</strong> Relevance confidence
                      score for individual matching chunks within document
                      groups.
                    </p>
                  </div>
                </div>
              </div>

              <div className="legend-category">
                <h4 className="legend-category-title">
                  Lead Answer Classifications
                </h4>
                <div className="legend-grid">
                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="lead-type-chip">
                        <Target size={11} aria-hidden="true" />
                        <span>Direct Match</span>
                      </span>
                    </div>
                    <p className="legend-card-desc">
                      High-salience passage containing the exact answer or core
                      statement addressing the query.
                    </p>
                  </div>

                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="lead-type-chip">
                        <ListOrdered size={11} aria-hidden="true" />
                        <span>Procedure</span>
                      </span>
                    </div>
                    <p className="legend-card-desc">
                      Actionable, ordered step-by-step instructions or
                      operational workflow responding to a "how to" inquiry.
                    </p>
                  </div>

                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="lead-type-chip">
                        <BookOpen size={11} aria-hidden="true" />
                        <span>Definition</span>
                      </span>
                    </div>
                    <p className="legend-card-desc">
                      Conceptual term definition, glossary entry, or theoretical
                      description answering "what is" questions.
                    </p>
                  </div>

                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="lead-type-chip">
                        <Table size={11} aria-hidden="true" />
                        <span>Table Matrix</span>
                      </span>
                    </div>
                    <p className="legend-card-desc">
                      Structured tabular data or comparison matrix extracted
                      from document table elements.
                    </p>
                  </div>
                </div>
              </div>

              <div className="legend-category">
                <h4 className="legend-category-title">
                  Match Types & Context Expansion
                </h4>
                <div className="legend-grid">
                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="result-kind-badge is-match">Match</span>
                    </div>
                    <p className="legend-card-desc">
                      <strong>Direct Hit:</strong> Text segment that directly
                      matched your query keywords and semantic vector space.
                    </p>
                  </div>

                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="result-kind-badge is-context">
                        <Sparkles size={9} aria-hidden="true" />
                        Context
                      </span>
                    </div>
                    <p className="legend-card-desc">
                      <strong>Expanded Context:</strong> Preceding or following
                      passage automatically pulled from the source document to
                      provide complete context.
                    </p>
                  </div>

                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="result-kind-badge is-same-source">
                        This Document
                      </span>
                    </div>
                    <p className="legend-card-desc">
                      Context window chunk from the same source file immediately
                      surrounding the direct hit.
                    </p>
                  </div>

                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="result-kind-badge is-adjacent-node">
                        Adjacent Node
                      </span>
                    </div>
                    <p className="legend-card-desc">
                      Context chunk from a directly connected concept node in
                      the knowledge graph DAG.
                    </p>
                  </div>
                </div>
              </div>

              <div className="legend-category">
                <h4 className="legend-category-title">
                  Document Citations & Graph Dependencies
                </h4>
                <div className="legend-grid">
                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="lead-page-tag">p.4</span>
                      <span className="source-format-badge">
                        <FileText size={10} aria-hidden="true" />
                        PDF
                      </span>
                    </div>
                    <p className="legend-card-desc">
                      <strong>Exact Page Locator:</strong> Pinpoints the precise
                      page number in PDF documents for instant verification.
                    </p>
                  </div>

                  <div className="legend-card">
                    <div className="legend-card-header">
                      <span className="relation-chip is-prereq">
                        Prerequisite
                      </span>
                      <span className="relation-chip is-ext">Next Step</span>
                    </div>
                    <p className="legend-card-desc">
                      <strong>Topological Graph Relationships:</strong>{' '}
                      Foundational concepts to understand before this topic, or
                      subsequent topics that build upon it.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'reading' ? (
            <div className="guide-reading-section">
              <div className="guide-step-card">
                <div className="guide-step-num">1</div>
                <div className="guide-step-body">
                  <h4>Lead Direct Answer</h4>
                  <p>
                    When your query is phrased as a question (or matches
                    high-confidence factual passages), the system isolates the
                    single highest-scoring paragraph as the{' '}
                    <strong>Lead Answer</strong>.
                  </p>
                  <ul>
                    <li>
                      Click the <strong>source citation chip</strong> or the{' '}
                      <strong>excerpt card</strong> to open the full document
                      and highlight the match.
                    </li>
                    <li>
                      Inspect the <strong>Salience percentage</strong> to verify
                      how closely the excerpt answers your exact phrasing.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="guide-step-card">
                <div className="guide-step-num">2</div>
                <div className="guide-step-body">
                  <h4>Topological Concept Navigation</h4>
                  <p>
                    Directly under the Lead Answer, the system inspects the
                    Knowledge Graph Directed Acyclic Graph (DAG) for:
                  </p>
                  <ul>
                    <li>
                      <strong>Prerequisites:</strong> Concepts upstream that
                      explain background theory or fundamental definitions.
                    </li>
                    <li>
                      <strong>Next Steps:</strong> Downstream topics that build
                      on the current concept.
                    </li>
                    <li>
                      Click any relationship chip to highlight and focus that
                      topic node on the canvas.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="guide-step-card">
                <div className="guide-step-num">3</div>
                <div className="guide-step-body">
                  <h4>Context Scope Filtering</h4>
                  <p>
                    When extended context expansion is active, use the segmented
                    pill filter above the document list:
                  </p>
                  <ul>
                    <li>
                      <strong>All:</strong> Displays direct hits alongside all
                      adjacent context passages.
                    </li>
                    <li>
                      <strong>This Document:</strong> Limits context snippets to
                      the same source document.
                    </li>
                    <li>
                      <strong>Adjacent Nodes:</strong> Shows surrounding context
                      originating from linked knowledge nodes.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="guide-step-card">
                <div className="guide-step-num">4</div>
                <div className="guide-step-body">
                  <h4>Document Groups & In-Depth Verification</h4>
                  <p>
                    All matching fragments are organized by document file. Click
                    any group header to open the entire source file in the
                    resizable source viewer, or click individual snippets to
                    scroll directly to that paragraph.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'search' ? (
            <div className="guide-search-section">
              <div className="pipeline-card">
                <h4>Hybrid Semantic & Lexical Retrieval</h4>
                <p>
                  Every source document (PDF, Markdown, text) is chunked with
                  structural awareness and indexed simultaneously across{' '}
                  <strong>dense neural vector spaces</strong> (deep semantic
                  embeddings) and <strong>lexical inverted indices</strong>{' '}
                  (keyword and exact-term matching).
                </p>
                <div className="pipeline-flow">
                  <div className="pipeline-step">
                    <Search size={14} />
                    <span>Your Query</span>
                  </div>
                  <ArrowRight size={14} className="flow-arrow" />
                  <div className="pipeline-step">
                    <Layers size={14} />
                    <span>Hybrid Search</span>
                  </div>
                  <ArrowRight size={14} className="flow-arrow" />
                  <div className="pipeline-step">
                    <Sparkles size={14} />
                    <span>Neural Rerank</span>
                  </div>
                  <ArrowRight size={14} className="flow-arrow" />
                  <div className="pipeline-step">
                    <GitBranch size={14} />
                    <span>DAG Context</span>
                  </div>
                </div>
              </div>

              <div className="pipeline-features">
                <div className="pipeline-feature-item">
                  <CheckCircle2 size={16} className="feature-check" />
                  <div>
                    <strong>No Generative Hallucinations:</strong> All results
                    are exact extracted quotes from verified source documents
                    with citations and page numbers.
                  </div>
                </div>

                <div className="pipeline-feature-item">
                  <CheckCircle2 size={16} className="feature-check" />
                  <div>
                    <strong>Neural Cross-Encoder Reranking:</strong> Unlike
                    approximate vector similarity which only compares static
                    embeddings, our neural cross-encoder re-evaluates candidate
                    passages with deep query-document cross-attention.
                  </div>
                </div>

                <div className="pipeline-feature-item">
                  <CheckCircle2 size={16} className="feature-check" />
                  <div>
                    <strong>Graph-Augmented Retrieval:</strong> The retrieval
                    engine walks topological dependencies in your graph to
                    provide structural prerequisites alongside the raw document
                    text.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </DialogFrame>
  );
}
