import type { FormEvent } from 'react';
import { useState } from 'react';

import { ApiError, api } from '../../lib/api';
import type { Identity } from '../../types/api';
import { DialogFrame } from './dialog-frame';

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: (identity: Identity) => void;
};

export function AuthDialog({
  open,
  onOpenChange,
  onAuthenticated,
}: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      const result =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password, username);
      onAuthenticated(result.identity);
      onOpenChange(false);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Unable to continue.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'login' ? 'Welcome back' : 'Create your account'}
    >
      <div
        className="dialog-tabs"
        role="tablist"
        aria-label="Authentication mode"
      >
        <button
          type="button"
          className={mode === 'register' ? 'is-active' : ''}
          onClick={() => setMode('register')}
        >
          Sign up
        </button>
        <button
          type="button"
          className={mode === 'login' ? 'is-active' : ''}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
      </div>
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        {mode === 'register' ? (
          <label>
            Name
            <input
              required
              minLength={2}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
        ) : null}
        <label>
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button
          type="submit"
          className="command-button accent"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? '...'
            : mode === 'login'
              ? 'Log in'
              : 'Create account'}
        </button>
        <div className="auth-divider" aria-hidden="true">
          <span>or</span>
        </div>
        <button
          type="button"
          className="command-button"
          disabled={isSubmitting}
          onClick={() => {
            setSubmitting(true);
            setError(undefined);
            void api
              .googleSignIn()
              .catch((requestError) => {
                setError(
                  requestError instanceof ApiError
                    ? requestError.message
                    : 'Google sign-in is unavailable.',
                );
              })
              .finally(() => setSubmitting(false));
          }}
        >
          Continue with Google
        </button>
      </form>
    </DialogFrame>
  );
}
