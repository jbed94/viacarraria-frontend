import { Globe, Lock } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { DialogFrame } from './dialog-frame';

type GraphDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (
    title: string,
    description: string,
    isPublic: boolean,
  ) => Promise<void>;
};

export function GraphDialog({
  open,
  onOpenChange,
  onCreate,
}: GraphDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onCreate(title, description, isPublic);
      setTitle('');
      setDescription('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="New knowledge graph"
    >
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
                name="new-graph-visibility"
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
                name="new-graph-visibility"
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

        <button
          type="submit"
          className="command-button accent"
          disabled={isSubmitting}
        >
          {isSubmitting ? '...' : 'Create graph'}
        </button>
      </form>
    </DialogFrame>
  );
}
