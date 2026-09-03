import { Check, Crown } from 'lucide-react';
import { useState } from 'react';

import { api } from '../../lib/api';
import type { Identity } from '../../types/api';
import { DialogFrame } from './dialog-frame';

type PricingDialogProps = {
  identity?: Identity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgraded: () => Promise<void>;
};

export function PricingDialog({
  identity,
  open,
  onOpenChange,
  onUpgraded,
}: PricingDialogProps) {
  const [isUpgrading, setUpgrading] = useState(false);
  async function upgrade(): Promise<void> {
    setUpgrading(true);
    try {
      const checkout = await api.checkout();
      if (checkout.checkoutUrl) {
        window.location.assign(checkout.checkoutUrl);
        return;
      }
      await onUpgraded();
      onOpenChange(false);
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Choose your path"
      className="pricing-dialog"
    >
      <div className="pricing-grid">
        <section>
          <span className="plan-label">Free</span>
          <strong>$0</strong>
          <p>For exploring and building small maps.</p>
          <ul>
            <li>
              <Check size={14} />
              20 searches daily
            </li>
            <li>
              <Check size={14} />3 custom graphs
            </li>
          </ul>
        </section>
        <section className="plan-pro">
          <span className="plan-label">
            <Crown size={14} />
            Pro
          </span>
          <strong>
            $9<span>/mo</span>
          </strong>
          <p>For deep research and unlimited maps.</p>
          <ul>
            <li>
              <Check size={14} />
              Priority ingestion
            </li>
            <li>
              <Check size={14} />
              PDF sources
            </li>
          </ul>
          <button
            type="button"
            className="command-button accent"
            disabled={identity?.tier === 'PRO' || isUpgrading}
            onClick={() => void upgrade()}
          >
            {identity?.tier === 'PRO'
              ? 'Current plan'
              : isUpgrading
                ? '...'
                : 'Upgrade to Pro'}
          </button>
        </section>
      </div>
    </DialogFrame>
  );
}
