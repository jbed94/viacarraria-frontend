import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

import { api } from '../../lib/api';

export interface MaintenanceOverlayProps {
  message?: string;
  onDismiss?: () => void;
}

export const MaintenanceOverlay: React.FC<MaintenanceOverlayProps> = ({
  message = 'System undergoing scheduled maintenance. Public access is temporarily suspended while infrastructure updates are applied.',
  onDismiss,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const checkAvailability = async () => {
    setIsChecking(true);
    setStatusNote(null);
    try {
      const status = await api.system.checkStatus();
      if (status.maintenanceMode === false) {
        setStatusNote('Maintenance concluded! Restoring access...');
        setTimeout(() => {
          if (onDismiss) {
            onDismiss();
          } else if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }, 1000);
      } else {
        setStatusNote(
          'Maintenance is still in progress. Please check back shortly.',
        );
      }
    } catch {
      setStatusNote('Unable to reach server. Retrying...');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Automatically poll every 15 seconds to auto-dismiss when maintenance ends
    const interval = setInterval(() => {
      api.system
        .checkStatus()
        .then((res) => {
          if (res.maintenanceMode === false) {
            if (onDismiss) {
              onDismiss();
            } else if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }
        })
        .catch(() => {
          // ignore background poll error
        });
    }, 15000);

    return () => clearInterval(interval);
  }, [onDismiss]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
      aria-describedby="maintenance-description"
      className="maintenance-overlay-backdrop"
    >
      <div className="maintenance-overlay-modal">
        <div className="maintenance-header-icon">
          <ShieldAlert className="maintenance-icon" size={48} />
        </div>

        <div className="maintenance-status-badge">
          <span className="maintenance-pulse-dot" />
          <span>System Maintenance Active</span>
        </div>

        <h1 id="maintenance-title" className="maintenance-title">
          Scheduled Maintenance in Progress
        </h1>

        <p id="maintenance-description" className="maintenance-description">
          {message}
        </p>

        {statusNote && (
          <div className="maintenance-status-note">
            <AlertTriangle size={16} />
            <span>{statusNote}</span>
          </div>
        )}

        <div className="maintenance-actions">
          <button
            type="button"
            className="maintenance-btn-retry"
            onClick={checkAvailability}
            disabled={isChecking}
          >
            <RefreshCw
              size={16}
              className={isChecking ? 'maintenance-spin' : ''}
            />
            <span>
              {isChecking ? 'Checking System...' : 'Check Status / Retry'}
            </span>
          </button>
        </div>

        <div className="maintenance-footer-hint">
          <span>Automatic reconnect active &bull; Polling every 15s</span>
        </div>
      </div>
    </div>
  );
};
