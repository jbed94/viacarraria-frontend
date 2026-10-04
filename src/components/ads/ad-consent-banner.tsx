import { Cookie, FileText, Info, Lock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { useAdConsent } from '../../lib/ad-consent';

type AdConsentBannerProps = {
  className?: string;
  onOpenPrivacy?: () => void;
};

export function AdConsentBanner({
  className = '',
  onOpenPrivacy,
}: AdConsentBannerProps) {
  const { status, setConsent } = useAdConsent();
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // Only display when consent is pending
  if (status !== 'pending') return null;

  return (
    <aside
      className={`ad-consent-banner ${className}`}
      role="region"
      aria-label="Advertising and Privacy Consent"
      data-testid="ad-consent-banner"
    >
      <div className="ad-consent-container">
        <div className="ad-consent-icon-col">
          <Cookie size={24} className="text-amber-400" aria-hidden="true" />
        </div>

        <div className="ad-consent-body">
          <div className="ad-consent-title-row">
            <h3 className="ad-consent-heading">
              Support Via Carraria Free Research with Ads
            </h3>
            <span className="ad-consent-badge">GDPR & IAB Compliant</span>
          </div>

          <p className="ad-consent-text">
            We use Google AdSense to sustain free knowledge graphs and vector
            search. You can choose whether to allow personalized advertisements
            based on your interests, or contextual-only ads without cross-site
            tracking.
          </p>

          {detailsExpanded && (
            <div
              className="ad-consent-details"
              data-testid="ad-consent-details"
            >
              <div className="consent-detail-item">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>
                  <strong>Personalized (Recommended):</strong> Google and its
                  certified partners use cookies to serve ads tailored to your
                  technical queries and interests.
                </span>
              </div>
              <div className="consent-detail-item">
                <Info size={14} className="text-sky-400" />
                <span>
                  <strong>Contextual Only:</strong> Ads are served strictly
                  based on the current graph subject matter without profiling
                  (NPA).
                </span>
              </div>
              <div className="consent-detail-item">
                <Lock size={14} className="text-amber-400" />
                <span>
                  <strong>Strictly Necessary:</strong> Essential HTTP-only
                  session cookies (<code>better-auth.session_token</code>) are
                  always active for authentication and rate-limiting.
                </span>
              </div>
              {onOpenPrivacy && (
                <div className="consent-policy-link-row">
                  <button
                    type="button"
                    className="consent-policy-link-btn"
                    onClick={onOpenPrivacy}
                    data-testid="consent-open-policy"
                  >
                    <FileText size={12} />
                    <span>View Full Privacy & Cookie Policy</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="ad-consent-actions">
            <button
              type="button"
              className="consent-btn primary"
              onClick={() => setConsent('granted')}
              data-testid="consent-accept-all"
            >
              Accept All (Personalized)
            </button>
            <button
              type="button"
              className="consent-btn secondary"
              onClick={() => setConsent('essential_only')}
              data-testid="consent-essential-only"
            >
              Contextual & Essential Only
            </button>
            <button
              type="button"
              className="consent-btn ghost"
              onClick={() => setConsent('denied')}
              data-testid="consent-decline"
            >
              Decline (Demo Mode)
            </button>
            <button
              type="button"
              className="consent-btn text"
              onClick={() => setDetailsExpanded((prev) => !prev)}
            >
              {detailsExpanded ? 'Hide Details' : 'Learn More'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
