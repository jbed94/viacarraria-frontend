import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react';
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

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="auth-google-icon"
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.57.38-2.27V6.58H1.25A11.96 11.96 0 0 0 0 12c0 1.92.45 3.74 1.25 5.42l4.03-3.15Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15C6.23 6.9 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function AuthDialog({
  open,
  onOpenChange,
  onAuthenticated,
}: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      title={mode === 'login' ? 'Welcome Back' : 'Create Account'}
      className="auth-dialog-frame"
    >
      <div className="auth-dialog-body">
        <div className="auth-intro-lockup">
          <div className="auth-brand-badge" aria-hidden="true">
            <span className="auth-brand-mark">VC</span>
          </div>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Sign in to access your private workspaces, custom notes, and saved graphs.'
              : 'Join Via Carraria to map complex domains with AI-powered semantic retrieval.'}
          </p>
        </div>

        <div
          className="auth-segmented-tabs"
          role="tablist"
          aria-label="Authentication mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab-btn ${mode === 'register' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('register');
              setError(undefined);
            }}
          >
            <UserPlus size={15} aria-hidden="true" />
            <span>Sign up</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab-btn ${mode === 'login' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(undefined);
            }}
          >
            <LogIn size={15} aria-hidden="true" />
            <span>Log in</span>
          </button>
        </div>

        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {mode === 'register' ? (
            <div className="auth-field-group">
              <label htmlFor="auth-name-input">Full Name</label>
              <div className="auth-input-wrapper">
                <User
                  size={15}
                  className="auth-field-icon"
                  aria-hidden="true"
                />
                <input
                  id="auth-name-input"
                  required
                  minLength={2}
                  placeholder="e.g. Marie Curie"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>
          ) : null}

          <div className="auth-field-group">
            <label htmlFor="auth-email-input">Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={15} className="auth-field-icon" aria-hidden="true" />
              <input
                id="auth-email-input"
                required
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-field-group">
            <label htmlFor="auth-password-input">Password</label>
            <div className="auth-input-wrapper">
              <Lock size={15} className="auth-field-icon" aria-hidden="true" />
              <input
                id="auth-password-input"
                required
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                placeholder={
                  mode === 'register'
                    ? 'At least 8 characters'
                    : 'Enter your password'
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
              />
              <button
                type="button"
                className="auth-password-toggle-btn"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error ? (
            <div className="auth-error-banner" role="alert">
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            className="command-button accent auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="spin" aria-hidden="true" />
                <span>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              </>
            ) : mode === 'login' ? (
              <>
                <span>Log in to Workspace</span>
                <ArrowRight size={15} aria-hidden="true" />
              </>
            ) : (
              <>
                <span>Get Started Free</span>
                <Sparkles size={15} aria-hidden="true" />
              </>
            )}
          </button>

          <div className="auth-divider" aria-hidden="true">
            <span className="auth-divider-label">or continue with</span>
          </div>

          <button
            type="button"
            className="command-button auth-google-btn"
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
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          <div className="auth-trust-footer">
            <ShieldCheck size={13} aria-hidden="true" />
            <span>End-to-end encrypted session · Privacy-first storage</span>
          </div>
        </form>
      </div>
    </DialogFrame>
  );
}
