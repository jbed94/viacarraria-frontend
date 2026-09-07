import { AlertTriangle, Globe, Lock, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { Graph, LimitsSummary } from '../../types/api';
import { DialogFrame } from './dialog-frame';

type GraphSettingsDialogProps = {
  graph?: Graph;
  limits?: LimitsSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: {
    title: string;
    description: string;
    isPublic: boolean;
    isExemptFromRetention?: boolean;
  }) => Promise<void>;
  onOpenPricing: () => void;
};

export function GraphSettingsDialog({
  graph,
  limits,
  open,
  onOpenChange,
  onSave,
  onOpenPricing,
}: GraphSettingsDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isExemptFromRetention, setIsExemptFromRetention] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && graph) {
      setTitle(graph.title);
      setDescription(graph.description ?? '');
      setIsPublic(graph.isPublic);
      setIsExemptFromRetention(graph.isExemptFromRetention ?? false);
    }
  }, [graph, open]);

  if (!graph) return null;

  const isFree = limits?.tier === 'FREE';
  const switchingToPrivate = !isPublic && graph.isPublic;
  // If switching from public to private, user needs private quota
  const privateLimitReached = Boolean(
    isFree &&
      switchingToPrivate &&
      limits?.privateGraphs?.limit != null &&
      limits.privateGraphs.used >= limits.privateGraphs.limit,
  );

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        isPublic,
        isExemptFromRetention,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogFrame open={open} onOpenChange={onOpenChange} title="Graph settings">
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <label>
          Title
          <input
            required
            minLength={2}
            maxLength={100}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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
                name="settings-graph-visibility"
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
                name="settings-graph-visibility"
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

          {switchingToPrivate ? (
            <div className="visibility-warning-banner" role="alert">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                Making this graph private will immediately disconnect all{' '}
                {graph.viewerCount ?? 0} attached viewers. They will lose
                access.
              </span>
            </div>
          ) : null}

          {privateLimitReached ? (
            <p className="limit-warning">
              You have reached your limit of {limits?.privateGraphs.limit ?? 2}{' '}
              private graphs.{' '}
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

        <div className="retention-settings-block">
          <label
            className={`retention-checkbox-card ${isExemptFromRetention ? 'selected' : ''}`}
          >
            <input
              type="checkbox"
              name="graph-retention-exemption"
              checked={isExemptFromRetention}
              onClick={(event) => {
                if (limits?.tier !== 'PRO') {
                  event.preventDefault();
                  onOpenChange(false);
                  onOpenPricing();
                }
              }}
              onChange={(event) => {
                if (limits?.tier !== 'PRO') {
                  event.preventDefault();
                  return;
                }
                setIsExemptFromRetention(event.target.checked);
              }}
            />
            <div className="retention-card-content">
              <div className="retention-title">
                <ShieldCheck size={14} aria-hidden="true" />
                <strong>Preserve graph indefinitely</strong>
                <span className="pro-tier-badge">PRO</span>
              </div>
              <span className="retention-desc">
                Never delete due to inactivity. Standard graphs are scheduled
                for removal after prolonged inactivity without access.
                {limits?.tier !== 'PRO' ? (
                  <span className="pro-hint">
                    {' '}
                    Upgrade to PRO to exempt this graph.
                  </span>
                ) : (
                  <span>
                    {' '}
                    Active exemption protects this graph and its sources
                    permanently.
                  </span>
                )}
              </span>
            </div>
          </label>
        </div>

        <div className="dialog-actions">
          <button
            type="button"
            className="command-button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="command-button accent"
            disabled={isSubmitting || privateLimitReached}
          >
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
