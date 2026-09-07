import { AlertTriangle, CheckCircle2, RotateCcw, Settings } from 'lucide-react';
import { useState } from 'react';

import { api } from '../../lib/api';
import type { Graph } from '../../types/api';

type RetentionWarningBannerProps = {
  graph?: Graph;
  onGraphUpdated: (updatedGraph: Graph) => void;
  onOpenSettings?: () => void;
};

export function getDaysRemaining(scheduledDateStr: string): number {
  const diff = new Date(scheduledDateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function RetentionWarningBanner({
  graph,
  onGraphUpdated,
  onOpenSettings,
}: RetentionWarningBannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!graph?.scheduledForDeletionAt) {
    return null;
  }

  const daysRemaining = getDaysRemaining(graph.scheduledForDeletionAt);
  const formattedDate = new Date(
    graph.scheduledForDeletionAt,
  ).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  async function handleKeepActive() {
    if (!graph) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.keepGraphActive(graph.id);
      onGraphUpdated(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to keep graph active.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside
      className="retention-warning-banner overlay-interactive"
      role="alert"
      aria-label="Retention Warning"
    >
      <div className="retention-warning-banner-text">
        <AlertTriangle size={18} aria-hidden="true" />
        <div>
          <span>
            <strong>Inactivity Warning:</strong> Scheduled for deletion{' '}
            {daysRemaining === 0
              ? 'today'
              : `in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`}{' '}
            ({formattedDate}) due to prolonged inactivity.
          </span>
          {error ? (
            <span className="banner-inline-error"> — {error}</span>
          ) : null}
        </div>
      </div>
      <div className="retention-warning-banner-actions">
        <button
          type="button"
          className="command-button accent"
          onClick={() => void handleKeepActive()}
          disabled={loading}
          title="Cancel scheduled deletion and mark graph active"
        >
          {loading ? (
            <RotateCcw size={14} className="animate-spin" />
          ) : (
            <CheckCircle2 size={14} />
          )}
          <span>{loading ? 'Keeping Active...' : 'Keep Graph Active'}</span>
        </button>
        {onOpenSettings ? (
          <button
            type="button"
            className="command-button secondary"
            onClick={onOpenSettings}
            title="Open graph retention settings"
          >
            <Settings size={14} />
            <span>Preserve</span>
          </button>
        ) : null}
      </div>
    </aside>
  );
}
