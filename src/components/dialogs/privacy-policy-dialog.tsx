import {
  CheckCircle2,
  Clock,
  Cookie,
  FileText,
  Lock,
  RotateCcw,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';

import {
  type AdConsentStatus,
  CURRENT_CONSENT_VERSION,
  useAdConsent,
} from '../../lib/ad-consent';
import { DialogFrame } from './dialog-frame';

type PrivacyPolicyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type PrivacyTab = 'overview' | 'cookies' | 'preferences';

export function PrivacyPolicyDialog({
  open,
  onOpenChange,
}: PrivacyPolicyDialogProps) {
  const [activeTab, setActiveTab] = useState<PrivacyTab>('overview');
  const { status, record, setConsent, resetConsent } = useAdConsent();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleUpdateConsent = (newStatus: AdConsentStatus) => {
    setConsent(newStatus);
    const label =
      newStatus === 'granted'
        ? 'Personalized Ads Allowed'
        : newStatus === 'essential_only'
          ? 'Contextual & Essential Only Selected'
          : 'Tracking Declined (Demo Ads Only)';
    setFeedbackMessage(`Preferences updated: ${label}`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleReset = () => {
    resetConsent();
    setFeedbackMessage(
      'Consent choices reset to pending. You will be prompted on next refresh.',
    );
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const formattedDate = record?.timestamp
    ? new Date(record.timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Privacy & Cookie Policy"
      className="privacy-policy-dialog"
    >
      <div
        className="privacy-dialog-container"
        data-testid="privacy-policy-dialog"
      >
        {/* Navigation Tabs */}
        <div
          className="privacy-dialog-tabs"
          role="tablist"
          aria-label="Privacy sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            className={`privacy-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('overview')}
            data-testid="privacy-tab-overview"
          >
            <Shield size={14} />
            <span>Overview & Rights</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cookies'}
            className={`privacy-tab-btn ${activeTab === 'cookies' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('cookies')}
            data-testid="privacy-tab-cookies"
          >
            <Cookie size={14} />
            <span>Cookie Guide</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preferences'}
            className={`privacy-tab-btn ${activeTab === 'preferences' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('preferences')}
            data-testid="privacy-tab-preferences"
          >
            <ShieldCheck size={14} />
            <span>Consent Preferences</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="privacy-tab-content">
          {activeTab === 'overview' && (
            <div className="privacy-overview-panel">
              <div className="privacy-hero-banner">
                <div className="privacy-hero-icon">
                  <Lock size={20} className="text-emerald-400" />
                </div>
                <div className="privacy-hero-text">
                  <h4>Your Privacy & Data Ownership</h4>
                  <p>
                    Via Carraria is built to protect your work and personal
                    space. Your research graphs, notes, and uploaded documents
                    belong strictly to you. We never sell, broker, or rent your
                    personal data.
                  </p>
                </div>
              </div>

              <div className="privacy-section">
                <h5>Your Rights & Control</h5>
                <ul className="privacy-rights-list">
                  <li>
                    <strong>Download Your Data:</strong> Export your spatial
                    graphs, connections, and search histories as structured
                    files anytime.
                  </li>
                  <li>
                    <strong>Delete Anything Anytime:</strong> Permanently delete
                    your account, uploaded documents, and saved data directly
                    from your Profile Settings.
                  </li>
                  <li>
                    <strong>Change Preferences Anytime:</strong> Update or
                    withdraw your advertising and cookie choices at any moment
                    with immediate effect.
                  </li>
                </ul>
              </div>

              <div className="privacy-section">
                <h5>Safe Contextual Ad Matching & Taxonomy</h5>
                <p className="privacy-note-text">
                  To keep the platform free while safeguarding your
                  confidentiality, our internal engine matches broad topics
                  against a predefined, safe taxonomy (such as Computer Science
                  or Cloud Computing).
                  <strong>
                    {' '}
                    Your raw document text, private notes, and personal data are
                    never shared with ad networks or Google.
                  </strong>{' '}
                  Only high-level category slugs are used to show relevant
                  context.
                </p>
              </div>

              <div className="privacy-section">
                <h5>Automatic Storage Maintenance</h5>
                <p className="privacy-note-text">
                  Temporary unattached graphs inactive for over 90 days are
                  archived and safely cleaned up. Diagnostic and advertising
                  activity logs are automatically cleared after 90 days.
                </p>
              </div>

              <div className="privacy-meta-row">
                <span className="privacy-version-tag">
                  Policy Version {CURRENT_CONSENT_VERSION}
                </span>
                <span className="privacy-contact-tag">
                  Questions? privacy@viacarraria.internal
                </span>
              </div>
            </div>
          )}

          {activeTab === 'cookies' && (
            <div className="privacy-cookies-panel">
              <p className="privacy-intro-text">
                We believe in plain, transparent communication. Here is a clear
                guide to the few cookies and browser storage tools used to keep
                your experience secure, reliable, and fast.
              </p>

              <div className="cookie-category-card essential">
                <div className="cookie-card-header">
                  <div className="cookie-card-title-group">
                    <span className="cookie-badge essential">
                      Strictly Necessary
                    </span>
                    <h6>Essential Sign-In & Security</h6>
                  </div>
                  <span className="cookie-status-tag always-active">
                    Always Active
                  </span>
                </div>
                <p className="cookie-card-desc">
                  Required for you to sign in, keep your session safe against
                  tampering, and ensure the platform stays secure and reliable.
                </p>
                <div className="cookie-item-list">
                  <div className="cookie-item">
                    <div className="cookie-item-name-group">
                      <code>better-auth.session_token</code>
                      <span className="cookie-item-badge">Sign-In Token</span>
                    </div>
                    <span className="cookie-item-detail">
                      Secure login cookie · Keeps you securely signed in for 90
                      days so you don't have to re-enter your password every
                      time.
                    </span>
                  </div>
                  <div className="cookie-item">
                    <div className="cookie-item-name-group">
                      <code>vc_ad_consent_status / record</code>
                      <span className="cookie-item-badge">Privacy Memory</span>
                    </div>
                    <span className="cookie-item-detail">
                      Local browser storage · Remembers your privacy choices so
                      we do not prompt you repeatedly.
                    </span>
                  </div>
                </div>
              </div>

              <div className="cookie-category-card advertising">
                <div className="cookie-card-header">
                  <div className="cookie-card-title-group">
                    <span className="cookie-badge advertising">
                      Advertising & Measurement
                    </span>
                    <h6>Google AdSense & Partner Ads</h6>
                  </div>
                  <span className="cookie-status-tag consent-required">
                    Your Choice
                  </span>
                </div>
                <p className="cookie-card-desc">
                  Helps keep Via Carraria completely free for researchers and
                  creators. Ad revenue funds cloud compute, fast AI vector
                  search, and storage.
                </p>
                <div className="cookie-item-list">
                  <div className="cookie-item">
                    <div className="cookie-item-name-group">
                      <code>adsbygoogle (__gads, __gpi)</code>
                      <span className="cookie-item-badge">Ad Partner</span>
                    </div>
                    <span className="cookie-item-detail">
                      Optional · Used to deliver relevant advertisements or
                      non-personalized contextual ads, based on your preference
                      below.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="privacy-preferences-panel">
              <div className="consent-status-summary-card">
                <div className="status-summary-row">
                  <span className="status-label">Your Current Choice:</span>
                  <span
                    className={`status-pill status-${status}`}
                    data-testid="current-consent-status"
                  >
                    {status === 'granted'
                      ? 'Personalized (Granted)'
                      : status === 'essential_only'
                        ? 'Contextual & Essential Only'
                        : status === 'denied'
                          ? 'Declined (Demo Mode)'
                          : 'Pending (Not Yet Selected)'}
                  </span>
                </div>
                {formattedDate && (
                  <div className="status-timestamp-row">
                    <Clock size={12} className="text-muted" />
                    <span>
                      Registered on: {formattedDate} (Policy v
                      {record?.version ?? CURRENT_CONSENT_VERSION})
                    </span>
                  </div>
                )}
              </div>

              {feedbackMessage && (
                <div className="privacy-feedback-alert" role="status">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>{feedbackMessage}</span>
                </div>
              )}

              <div className="consent-controls-section">
                <h6>Choose How Ads Work For You</h6>
                <div className="consent-options-grid">
                  <button
                    type="button"
                    className={`consent-option-card ${status === 'granted' ? 'is-selected' : ''}`}
                    onClick={() => handleUpdateConsent('granted')}
                    data-testid="pref-opt-granted"
                  >
                    <div className="option-card-header">
                      <strong>Personalized (Recommended)</strong>
                      {status === 'granted' && (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      )}
                    </div>
                    <p>
                      Allows Google AdSense cookies to deliver relevant ads
                      matched to technical queries and keep the platform free.
                    </p>
                  </button>

                  <button
                    type="button"
                    className={`consent-option-card ${status === 'essential_only' ? 'is-selected' : ''}`}
                    onClick={() => handleUpdateConsent('essential_only')}
                    data-testid="pref-opt-essential"
                  >
                    <div className="option-card-header">
                      <strong>Contextual & Essential Only</strong>
                      {status === 'essential_only' && (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      )}
                    </div>
                    <p>
                      Shows non-personalized ads based solely on current page
                      content. No cross-site tracking or profiling cookies.
                    </p>
                  </button>

                  <button
                    type="button"
                    className={`consent-option-card ${status === 'denied' ? 'is-selected' : ''}`}
                    onClick={() => handleUpdateConsent('denied')}
                    data-testid="pref-opt-denied"
                  >
                    <div className="option-card-header">
                      <strong>Decline All Advertising</strong>
                      {status === 'denied' && (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      )}
                    </div>
                    <p>
                      Blocks external ad network scripts completely. Replaces
                      ads with demo preview cards.
                    </p>
                  </button>
                </div>

                <div className="consent-reset-row">
                  <button
                    type="button"
                    className="consent-reset-btn"
                    onClick={handleReset}
                    data-testid="pref-opt-reset"
                  >
                    <RotateCcw size={13} />
                    <span>
                      Clear saved choice (Ask me again on my next visit)
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="privacy-dialog-footer">
          <FileText size={13} className="text-muted" />
          <span>
            For complete legal terms, refer to <code>docs/PRIVACY.md</code> in
            the repository.
          </span>
        </div>
      </div>
    </DialogFrame>
  );
}
