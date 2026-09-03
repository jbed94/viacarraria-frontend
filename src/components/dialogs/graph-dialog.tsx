import type { FormEvent } from 'react';
import { useState } from 'react';

import { DialogFrame } from './dialog-frame';

type GraphDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string, description: string) => Promise<void>;
};

export function GraphDialog({
  open,
  onOpenChange,
  onCreate,
}: GraphDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onCreate(title, description);
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
