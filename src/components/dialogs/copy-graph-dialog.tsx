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
};

export function CopyGraphDialog({
  graph,
  open,
  onOpenChange,
  onCopy,
}: CopyGraphDialogProps) {
  const [title, setTitle] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (open && graph) {
      setTitle(`${graph.title} (Copy)`);
      setIsPublic(false);
    }
  }, [graph, open]);

  if (!graph) return null;

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
              className={`visibility-option-card ${!isPublic ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="copy-graph-visibility"
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
        </div>

        <div className="dialog-actions copy-dialog-actions">
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
            {isSubmitting ? '...' : 'Copy graph'}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
