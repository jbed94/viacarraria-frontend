import { ExternalLink, Info } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAdConsent } from '../../lib/ad-consent';
import { loadGoogleAdSense } from '../../lib/adsense-loader';
import { api } from '../../lib/api';

export type AdFormat = 'rectangle' | 'horizontal' | 'vertical' | 'fluid';

export type AdContextTagInfo = {
  id?: string;
  name: string;
  slug: string;
  weight?: number;
};

type GoogleAdCardProps = {
  format?: AdFormat;
  slotId?: string;
  graphId?: string;
  className?: string;
  creativeIndex?: number;
  testHeadline?: string;
  testSponsor?: string;
  testDescription?: string;
  testUrl?: string;
  isCulled?: boolean; // When culled by occlusion observer, render lightweight placeholder
  contextTags?: AdContextTagInfo[];
};

export const SAMPLE_ADS = [
  {
    sponsor: 'VectorCloud Platform',
    headline: 'Scale Weaviate Vector Graphs to Billions of Embeddings',
    description:
      'Ultra-low latency hybrid search with TEI rerankers & distributed KEDA autoscaling.',
    url: 'https://example.com/vectorcloud',
    action: 'Try Cloud Free',
  },
  {
    sponsor: 'Docling Ingestion Engine',
    headline: 'High-Throughput PDF, DOCX & Table OCR for AI Pipelines',
    description:
      'Extract multi-column research documents with bounding-box coordinate accuracy.',
    url: 'https://example.com/docling',
    action: 'Learn More',
  },
  {
    sponsor: 'SpatialGraph AI',
    headline: 'Visual Knowledge Graph Synthesis for Enterprise Research',
    description:
      'Transform complex unstructured knowledge into interactive spatial knowledge graphs.',
    url: 'https://example.com/spatialgraph',
    action: 'Start Exploring',
  },
];

export function GoogleAdCard({
  format = 'rectangle',
  slotId = '1234567890',
  graphId,
  className = '',
  creativeIndex,
  testHeadline,
  testSponsor,
  testDescription,
  testUrl,
  isCulled = false,
  contextTags,
}: GoogleAdCardProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const [internalTags, setInternalTags] = useState<AdContextTagInfo[]>([]);
  const {
    status: consentStatus,
    resetConsent,
    isAdsAllowed,
    isPersonalized,
  } = useAdConsent();

  // Resolve context tags either from explicit props or fetched graph context
  useEffect(() => {
    if (contextTags && contextTags.length > 0) {
      setInternalTags(contextTags);
      return;
    }
    if (!graphId) return;
    let active = true;
    api.ads
      .getContext(graphId)
      .then((res) => {
        if (active && res?.tags) {
          setInternalTags(res.tags);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [graphId, contextTags]);

  const activeTags =
    contextTags && contextTags.length > 0 ? contextTags : internalTags;

  const adClient =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT
      : undefined;

  const baseHash = Math.abs(
    slotId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0),
  );

  const sampleAdsPool = useMemo(() => {
    if (activeTags.length === 0) return SAMPLE_ADS;
    const slugs = activeTags.map((t) => t.slug.toLowerCase());
    const matched = SAMPLE_ADS.filter((ad) => {
      const text =
        `${ad.headline} ${ad.description} ${ad.sponsor}`.toLowerCase();
      return slugs.some(
        (s) =>
          text.includes(s.replace(/-/g, ' ')) ||
          text.includes(s.split('-')[0]!),
      );
    });
    return matched.length > 0 ? [...matched, ...SAMPLE_ADS] : SAMPLE_ADS;
  }, [activeTags]);

  const activeIndex =
    creativeIndex !== undefined
      ? Math.abs(creativeIndex) % sampleAdsPool.length
      : baseHash % sampleAdsPool.length;

  const sampleAd = sampleAdsPool[activeIndex]!;

  const sponsor = testSponsor || sampleAd.sponsor;
  const headline = testHeadline || sampleAd.headline;
  const description = testDescription || sampleAd.description;
  const url = testUrl || sampleAd.url;

  // Google Publisher Tag (GPT) targeting key-values
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window as any).googletag &&
      activeTags.length > 0
    ) {
      try {
        const googletag = (window as any).googletag;
        googletag.cmd = googletag.cmd || [];
        googletag.cmd.push(() => {
          googletag.pubads().setTargeting(
            'concept_tag',
            activeTags.map((t) => t.slug),
          );
        });
      } catch {
        // Fallback rendered safely
      }
    }
  }, [activeTags]);

  // Load Google AdSense script dynamically if client ID is configured and consent granted
  useEffect(() => {
    if (adClient && isAdsAllowed && typeof window !== 'undefined') {
      void loadGoogleAdSense({
        clientId: adClient,
        npa: !isPersonalized,
      }).then((loaded) => {
        if (loaded) {
          try {
            const adsbygoogle = (window as any).adsbygoogle || [];
            adsbygoogle.push({});
          } catch {
            // Fallback rendered safely
          }
        }
      });
    }
  }, [adClient, isAdsAllowed, isPersonalized]);

  // Telemetry reporting: record impression or culled event with context tags
  useEffect(() => {
    if (isCulled) {
      void api.ads
        .sendTelemetry({
          eventType: 'culled',
          format: format === 'fluid' ? 'card' : format,
          slotId,
          graphId,
        })
        .catch(() => {});
      return;
    }

    void api.ads
      .sendTelemetry({
        eventType: 'impression',
        format: format === 'fluid' ? 'card' : format,
        slotId,
        graphId,
        consent: consentStatus,
        tags: activeTags.map((t) => t.slug),
      })
      .catch(() => {});
  }, [slotId, format, isCulled, consentStatus, graphId, activeTags]);

  const containerClasses = [
    'google-ad-card',
    `format-${format}`,
    isCulled ? 'is-culled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // If culled by canvas occlusion culling, render lightweight placeholder to preserve layout and save GPU
  if (isCulled) {
    return (
      <div
        ref={adRef}
        className={containerClasses}
        data-testid="google-ad-card-culled"
        aria-hidden="true"
      >
        <div className="ad-culled-placeholder">
          <span className="ad-tag">Ad (Paused)</span>
        </div>
      </div>
    );
  }

  return (
    <aside
      ref={adRef}
      className={containerClasses}
      role="complementary"
      aria-label="Sponsored Advertisement"
      data-testid="google-ad-card"
      data-ad-format={format}
      data-consent={consentStatus}
    >
      {/* Google Ad Disclosure Header */}
      <div className="ad-card-header">
        <div className="ad-badge">
          <span className="ad-tag">Ad</span>
          <span className="ad-separator">·</span>
          <span className="ad-sponsor-domain">{sponsor}</span>
        </div>
        <button
          type="button"
          className="ad-choices-button"
          onClick={() => resetConsent()}
          title="AdChoices & Privacy Preferences (Click to change consent)"
          aria-label="AdChoices & Privacy Preferences"
        >
          <Info size={11} className="ad-info-icon" />
          <span className="ad-choices-text">AdChoices</span>
        </button>
      </div>

      {adClient && isAdsAllowed ? (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '100%' }}
          data-ad-client={adClient}
          data-ad-slot={slotId}
          data-ad-format={format === 'fluid' ? 'fluid' : 'auto'}
          data-full-width-responsive="true"
          data-npa={!isPersonalized ? '1' : undefined}
          data-ad-channel={
            activeTags.length > 0
              ? activeTags.map((t) => t.slug).join(',')
              : undefined
          }
        />
      ) : (
        /* Compliant Creative Preview */
        <div className="ad-card-body">
          <div className="ad-content-wrapper">
            <h4 className="ad-headline">
              <a href={url} target="_blank" rel="noopener noreferrer">
                {headline}
              </a>
            </h4>
            {activeTags.length > 0 && (
              <div className="ad-context-tags" data-testid="ad-context-tags">
                {activeTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.slug}
                    className="ad-topic-badge"
                    title={`Contextual topic match: ${tag.name}`}
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}
            {format !== 'horizontal' || description.length < 60 ? (
              <p className="ad-description">{description}</p>
            ) : null}
          </div>

          <div className="ad-footer">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="ad-cta-btn"
            >
              <span>{sampleAd.action}</span>
              <ExternalLink size={11} />
            </a>
            {consentStatus === 'denied' && (
              <span
                className="ad-demo-indicator"
                title="Tracking declined. Demo ads active."
              >
                Demo
              </span>
            )}
            {consentStatus === 'essential_only' && (
              <span
                className="ad-npa-indicator"
                title="Contextual Only (Non-Personalized)"
              >
                Contextual
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
