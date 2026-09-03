import { LogOut, MonitorX, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type { Identity } from '../../types/api';
import { DialogFrame } from './dialog-frame';

type ProfileDialogProps = {
  identity?: Identity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIdentityChange: (identity: Identity) => void;
  onLogout: () => Promise<void>;
};

export function ProfileDialog({
  identity,
  open,
  onOpenChange,
  onIdentityChange,
  onLogout,
}: ProfileDialogProps) {
  const [username, setUsername] = useState(identity?.username ?? '');
  const [language, setLanguage] = useState('en');
  const [sessions, setSessions] = useState<
    Array<{ id: string; expiresAt: string; lastUsedAt: string }>
  >([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!open || !identity || identity.isGuest) return;
    setUsername(identity.username ?? '');
    void api.profile().then((profile) => {
      setLanguage(profile.preferredLanguage);
      onIdentityChange(profile);
    });
    void api.sessions().then(setSessions);
  }, [identity, onIdentityChange, open]);

  if (!identity || identity.isGuest) return null;

  async function saveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    onIdentityChange(await api.updateProfile(username, language));
  }

  async function changePassword(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await api.changePassword(currentPassword, newPassword);
    setCurrentPassword('');
    setNewPassword('');
  }

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Your account"
      className="profile-dialog"
    >
      <div className="profile-tier">{identity.tier}</div>
      <form
        className="dialog-form"
        onSubmit={(event) => void saveProfile(event)}
      >
        <label>
          Name
          <input
            required
            minLength={2}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          Email
          <input value={identity.email ?? ''} disabled />
        </label>
        <label>
          Language
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Espanol</option>
          </select>
        </label>
        <button type="submit" className="command-button">
          Save profile
        </button>
      </form>
      <form
        className="dialog-form compact"
        onSubmit={(event) => void changePassword(event)}
      >
        <label>
          Current password
          <input
            required
            type="password"
            minLength={8}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          New password
          <input
            required
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <button type="submit" className="command-button">
          Update password
        </button>
      </form>
      <section className="session-list">
        <strong>Active sessions</strong>
        {sessions.map((session) => (
          <div key={session.id}>
            <span>{new Date(session.lastUsedAt).toLocaleString()}</span>
            <button
              type="button"
              title="End session"
              onClick={() =>
                void api
                  .revokeSession(session.id)
                  .then(() =>
                    setSessions((items) =>
                      items.filter((item) => item.id !== session.id),
                    ),
                  )
              }
            >
              <MonitorX size={15} />
            </button>
          </div>
        ))}
      </section>
      <div className="dialog-actions">
        <button
          type="button"
          className="command-button"
          onClick={() => void onLogout()}
        >
          <LogOut size={15} />
          Log out
        </button>
        <button
          type="button"
          className="command-button destructive"
          onClick={() => void api.deleteProfile().then(onLogout)}
        >
          <Trash2 size={15} />
          Delete account
        </button>
      </div>
    </DialogFrame>
  );
}
