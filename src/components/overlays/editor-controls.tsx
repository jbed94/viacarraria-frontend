import { FolderCheck, LayoutTemplate, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type EditorControlsProps = {
  onAddRoot: () => void;
  onLayout: () => void;
  onFinalize: () => void;
  isFinalizing: boolean;
};

export function EditorControls({
  onAddRoot,
  onLayout,
  onFinalize,
  isFinalizing,
}: EditorControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="editor-controls overlay-interactive">
      <button
        type="button"
        title="Add independent root node"
        onClick={onAddRoot}
      >
        <Plus size={17} />
      </button>
      <button
        type="button"
        title="Arrange graph left to right"
        onClick={onLayout}
      >
        <LayoutTemplate size={17} />
      </button>
      <button
        type="button"
        className="command-button"
        onClick={onFinalize}
        disabled={isFinalizing}
      >
        <FolderCheck size={16} />
        {isFinalizing ? '...' : t('finalize')}
      </button>
    </div>
  );
}
