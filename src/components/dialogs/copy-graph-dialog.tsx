import { Globe, Lock } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { Graph, LimitsSummary } from '../../types/api';
import { DialogFrame } from './dialog-frame';

type CopyGraphDialogProps = {
  graph?: Graph;
  limits?: LimitsSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: (title: string, isPublic: boolean) => Promise<boolean>;
  onOpenPricing: () => void;
};

export function CopyGraphDialog({
  graph,
  limits,
  open,
  onOpenChange,
  onCopy,
  onOpenPricing,
}: CopyGraphDialogProps) {
  const [title, setTitle] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  const isFree = limits?.tier === 'FREE';
  const privateLimitReached = Boolean(
    isFree &&
      limits?.privateGraphs?.limit != null &&
      limits.privateGraphs.used >= limits.privateGraphs.limit,
  );
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (open && graph) {
      setTitle(`${graph.title} (Copy)`);
      setIsPublic(privateLimitReached);
    }
  }, [graph, open, privateLimitReached]);

  if (!graph) return null;
  const graphLimitReached = Boolean(
    limits?.graphs.limit !== null &&
      limits?.graphs.limit !== undefined &&
      limits.graphs.used >= limits.graphs.limit,
  );
  const nodeLimitExceeded = Boolean(
    limits?.nodesPerGraph.limit !== null &&
      limits?.nodesPerGraph.limit !== undefined &&
      graph.nodes.length > limits.nodesPerGraph.limit,
  );
  const copyBlocked = graphLimitReached || nodeLimitExceeded;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (await onCopy(title.trim(), isPublic)) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Copy knowledge graph"
    >
      <p className="dialog-intro">
        Create a copy that you own. Its canvas and source documents will be
        duplicated.
      </p>
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <label>
          New graph name
          <input
            required
            minLength={2}
            maxLength={100}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <div className="visibility-selector">
          <span className="field-label">Visibility</span>
          <div className="visibility-options">
            <label
              className={`visibility-option-card ${!isPublic ? 'selected' : ''} ${privateLimitReached ? 'disabled' : ''}`}
            >
              <input
                type="radio"
                name="copy-graph-visibility"
                checked={!isPublic}
                disabled={privateLimitReached}
                onChange={() => setIsPublic(false)}
              />
              <div className="visibility-card-content">
                <div className="visibility-title">
                  <Lock size={13} aria-hidden="true" />
                  <strong>Private</strong>
                  {isFree ? (
                    <span className="visibility-quota-tag">
                      {limits?.privateGraphs.used ?? 0} /{' '}
                      {limits?.privateGraphs.limit ?? 2}
                    </span>
                  ) : null}
                </div>
                <span className="visibility-desc">Visible only to you.</span>
              </div>
            </label>

            <label
              className={`visibility-option-card ${isPublic ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="copy-graph-visibility"
                checked={isPublic}
                onChange={() => setIsPublic(true)}
              />
              <div className="visibility-card-content">
                <div className="visibility-title">
                  <Globe size={13} aria-hidden="true" />
                  <strong>Public</strong>
                </div>
                <span className="visibility-desc">
                  Visible in public browser to all.
                </span>
              </div>
            </label>
          </div>
          {privateLimitReached ? (
            <p className="limit-warning">
              You have used all {limits?.privateGraphs.limit ?? 2} private
              graphs included in Free.{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenPricing();
                }}
              >
                Upgrade to Pro for unlimited private graphs.
              </button>
            </p>
          ) : null}
        </div>

        <div className="copy-limit-summary" aria-label="Current graph limits">
          <div>
            <span>Graphs</span>
            <strong>
              {limits?.graphs.used ?? 0} / {formatLimit(limits?.graphs.limit)}
            </strong>
          </div>
          <div>
            <span>This graph</span>
            <strong>
              {graph.nodes.length} nodes /{' '}
              {formatLimit(limits?.nodesPerGraph.limit)}
            </strong>
          </div>
        </div>
        {graphLimitReached ? (
          <p className="limit-warning">
            Your graph limit has been reached. Copying this graph would exceed
            your current plan.
          </p>
        ) : null}
        {nodeLimitExceeded ? (
          <p className="limit-warning">
            This graph has {graph.nodes.length} nodes, but your plan allows only{' '}
            {limits?.nodesPerGraph.limit} nodes per graph.
          </p>
        ) : null}
        <div className="dialog-actions copy-dialog-actions">
          <button
            type="button"
            className="command-button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          {copyBlocked ? (
            <button
              type="button"
              className="command-button accent"
              onClick={onOpenPricing}
            >
              Upgrade plan
            </button>
          ) : (
            <button
              type="submit"
              className="command-button accent"
              disabled={isSubmitting}
            >
              {isSubmitting ? '...' : 'Copy graph'}
            </button>
          )}
        </div>
      </form>
    </DialogFrame>
  );
}

function formatLimit(limit: number | null | undefined): string {
  return limit === null || limit === undefined ? 'Unlimited' : String(limit);
}
