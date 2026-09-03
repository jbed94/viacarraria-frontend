import { AlertTriangle } from 'lucide-react';

import { DialogFrame } from './dialog-frame';

type ConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <DialogFrame open={open} onOpenChange={onOpenChange} title={title}>
      <div className="confirmation-content">
        <AlertTriangle size={28} />
        <p>{message}</p>
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
          type="button"
          className="command-button destructive"
          onClick={onConfirm}
        >
          Delete
        </button>
      </div>
    </DialogFrame>
  );
}
