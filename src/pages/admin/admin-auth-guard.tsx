import { KeyRound, ShieldAlert } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { api, getAdminKey, setAdminKey } from '../../lib/api';

type AdminAuthGuardProps = {
  children: ReactNode;
  onBackToCanvas?: () => void;
};

export function AdminAuthGuard({
  children,
  onBackToCanvas,
}: AdminAuthGuardProps) {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const verifyAccess = async () => {
    setChecking(true);
    setErrorMsg(null);
    try {
      const res = await api.admin.verify();
      if (res.authorized) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    } catch (err: any) {
      setAuthorized(false);
      if (getAdminKey()) {
        setErrorMsg(
          err?.message ?? 'Invalid Admin Key or insufficient privileges.',
        );
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void verifyAccess();
  }, []);

  const handleApplyKey = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = adminKeyInput.trim();
    if (!trimmed) return;
    setAdminKey(trimmed);
    void verifyAccess();
  };

  const handleClearKey = () => {
    setAdminKey(null);
    setAdminKeyInput('');
    setAuthorized(false);
    void verifyAccess();
  };

  if (checking) {
    return (
      <div className="admin-loading-container">
        <div className="admin-loading-spinner" />
        <p>Verifying administrative privileges...</p>
      </div>
    );
  }

  if (authorized) {
    return <>{children}</>;
  }

  return (
    <div className="admin-auth-screen">
      <div className="admin-auth-card">
        <div className="admin-auth-header">
          <div className="admin-auth-icon">
            <ShieldAlert size={28} />
          </div>
          <h2>Administrative Access Required</h2>
          <p>
            This portal is restricted to system administrators. Please
            authenticate with an authorized account or provide an administrator
            key.
          </p>
        </div>

        {errorMsg ? <div className="admin-auth-error">{errorMsg}</div> : null}

        <form onSubmit={handleApplyKey} className="admin-key-form">
          <label htmlFor="admin-key-input">
            <KeyRound size={15} />
            <span>Administrator Secret Key</span>
          </label>
          <div className="admin-input-row">
            <input
              id="admin-key-input"
              type="password"
              placeholder="Enter ADMIN_KEY..."
              value={adminKeyInput}
              onChange={(e) => setAdminKeyInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="admin-btn primary">
              Elevate
            </button>
          </div>
        </form>

        <div className="admin-auth-divider">
          <span>OR</span>
        </div>

        <div className="admin-auth-actions">
          {getAdminKey() ? (
            <button
              type="button"
              className="admin-btn secondary"
              onClick={handleClearKey}
            >
              Clear Stored Admin Key
            </button>
          ) : null}
          {onBackToCanvas ? (
            <button
              type="button"
              className="admin-btn secondary"
              onClick={onBackToCanvas}
            >
              Return to Knowledge Canvas
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
