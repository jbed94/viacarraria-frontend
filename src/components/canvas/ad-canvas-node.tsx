import type { NodeProps } from '@xyflow/react';
import { Eye } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { useAdViewability } from '../../hooks/use-ad-viewability';
import { api } from '../../lib/api';
import {
  type AdContextTagInfo,
  type AdFormat,
  GoogleAdCard,
} from '../ads/google-ad-card';

export type AdNodeData = {
  format: AdFormat;
  side: 'left' | 'right' | 'top' | 'bottom';
  slotId?: string;
  graphId?: string;
  width: number;
  height: number;
  contextTags?: AdContextTagInfo[];
};

export const AdCanvasNode = memo(function AdCanvasNode({ data }: NodeProps) {
  const adData = data as unknown as AdNodeData;
  const format =
    adData.format ||
    (adData.side === 'left' || adData.side === 'right'
      ? 'vertical'
      : 'horizontal');

  const [creativeIndex, setCreativeIndex] = useState(0);

  // Hook handles viewport occlusion culling and compliant 30s viewable dynamic refresh
  const {
    targetRef,
    isIntersecting,
    isViewable,
    viewableSeconds,
    refreshCount,
  } = useAdViewability<HTMLDivElement>({
    minViewableRatio: 0.5,
    refreshIntervalMs: 30000,
    onRefresh: () => {
      setCreativeIndex((prev) => prev + 1);
      void api.ads
        .sendTelemetry({
          eventType: 'refresh',
          format: format === 'fluid' ? 'canvas_node' : (format as any),
          slotId: adData.slotId || 'canvas-graph-ad-slot',
          graphId: adData.graphId,
          durationSeconds: 30,
        })
        .catch(() => {});
    },
  });

  // Emit viewable telemetry pulse periodically while in view
  useEffect(() => {
    if (
      isIntersecting &&
      isViewable &&
      viewableSeconds > 0 &&
      viewableSeconds % 10 === 0
    ) {
      void api.ads
        .sendTelemetry({
          eventType: 'viewable_pulse',
          format: format === 'fluid' ? 'canvas_node' : (format as any),
          slotId: adData.slotId || 'canvas-graph-ad-slot',
          graphId: adData.graphId,
          durationSeconds: 10,
        })
        .catch(() => {});
    }
  }, [
    isIntersecting,
    isViewable,
    viewableSeconds,
    format,
    adData.slotId,
    adData.graphId,
  ]);

  const nodeWidth = adData.width || (format === 'vertical' ? 160 : 728);
  const nodeHeight = adData.height || (format === 'vertical' ? 600 : 90);

  return (
    <div
      ref={targetRef}
      className={`ad-canvas-node-card side-${adData.side || 'right'} format-${format} ${!isIntersecting ? 'culled' : ''}`}
      style={{
        width: nodeWidth,
        height: nodeHeight,
      }}
      data-testid="ad-canvas-node"
      data-intersecting={isIntersecting}
      data-viewable={isViewable}
    >
      <GoogleAdCard
        format={format}
        slotId={adData.slotId || 'canvas-graph-ad-slot'}
        graphId={adData.graphId}
        className="canvas-embedded-ad"
        creativeIndex={creativeIndex}
        isCulled={!isIntersecting}
        contextTags={adData.contextTags}
      />

      {/* Subtle viewability status pill for user transparency */}
      {isIntersecting && isViewable && (
        <div
          className="ad-viewability-indicator"
          title={`Active Viewability: ${viewableSeconds}s / 30s (Cycles: ${refreshCount})`}
          data-testid="ad-viewability-indicator"
        >
          <Eye size={10} className="text-emerald-400" />
          <span className="viewability-time">{30 - viewableSeconds}s</span>
        </div>
      )}
    </div>
  );
});
