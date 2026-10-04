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
};

export function GraphSettingsDialog({
  graph,
  open,
  onOpenChange,
  onSave,
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

  const switchingToPrivate = !isPublic && graph.isPublic;

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
              className={`visibility-option-card ${!isPublic ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="settings-graph-visibility"
                checked={!isPublic}
                onChange={() => setIsPublic(false)}
              />
              <div className="visibility-card-content">
                <div className="visibility-title">
                  <Lock size={13} aria-hidden="true" />
                  <strong>Private</strong>
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
        </div>

        <div className="retention-settings-block">
          <label
            className={`retention-checkbox-card ${isExemptFromRetention ? 'selected' : ''}`}
          >
            <input
              type="checkbox"
              name="graph-retention-exemption"
              checked={isExemptFromRetention}
              onChange={(event) =>
                setIsExemptFromRetention(event.target.checked)
              }
            />
            <div className="retention-card-content">
              <div className="retention-title">
                <ShieldCheck size={14} aria-hidden="true" />
                <strong>Preserve graph indefinitely</strong>
              </div>
              <span className="retention-desc">
                Never delete due to inactivity. Standard graphs are scheduled
                for removal after prolonged inactivity without access.
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
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
