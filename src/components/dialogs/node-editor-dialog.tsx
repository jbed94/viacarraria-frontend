import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import type { GraphNode } from '../../types/api';
import { DialogFrame } from './dialog-frame';

type NodeEditorDialogProps = {
  node?: GraphNode;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: GraphNode['data']) => void;
};

export function NodeEditorDialog({
  node,
  onOpenChange,
  onSave,
}: NodeEditorDialogProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setTitle(node?.data.title ?? '');
    setCategory(node?.data.category ?? '');
    setDescription(node?.data.description ?? '');
  }, [node]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!node) return;
    onSave(node.id, { title, category, description });
    onOpenChange(false);
  }

  return (
    <DialogFrame
      open={Boolean(node)}
      onOpenChange={onOpenChange}
      title="Edit topic"
    >
      <form className="dialog-form" onSubmit={submit}>
        <label>
          Topic name
          <input
            required
            minLength={1}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Category
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <button type="submit" className="command-button accent">
          Save topic
        </button>
      </form>
    </DialogFrame>
  );
}
