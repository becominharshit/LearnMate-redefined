import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Cpu,
  Database,
  Layers,
  X,
  RefreshCw,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  COMMERCIAL_TIERS,
  type CommercialSubscriptionTierId,
} from '../utils/commercialScaleEngine';

interface AdminCommercialConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminCommercialConsoleModal: React.FC<AdminCommercialConsoleModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [healthData, setHealthData] = useState<any>(null);
  const [activeTierId, setActiveTierId] = useState<CommercialSubscriptionTierId>('pro_scholar');
  const [loading, setLoading] = useState(false);

  const fetchHealthAndTiers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/health');
      if (res.ok) {
        const json = await res.json();
        setHealthData(json);
        if (json.subscription?.activeTierId) {
          setActiveTierId(json.subscription.activeTierId);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchHealthAndTiers();
    }
  }, [isOpen]);

  const handleSelectTier = async (tierId: CommercialSubscriptionTierId) => {
    setActiveTierId(tierId);
    try {
      const res = await fetch('/api/commercial/select-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId }),
      });
      if (res.ok) {
        await fetchHealthAndTiers();
      }
    } catch {
      // ignore offline
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-950/60 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-testid="admin-commercial-console-modal"
        aria-label="Commercial Tiers, Quota & System Scalability Console"
        className="w-full max-w-5xl rounded-2xl bg-white dark:bg-[#111827] border border-line shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Commercial Plans, AI Token Economics &amp; Corpus Health Console
              </h2>
              <p className="text-xs text-muted">
                Manage Free Explorer, Pro Scholar &amp; Institute tiers · Monitor Semantic Cache, Hybrid RAG &amp; PYQ Corpus
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchHealthAndTiers}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-canvas hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Commercial Console"
              className="p-2 rounded-xl border border-line text-muted hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Section 1: 3 Commercial Subscription Tiers */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-ink">
              01. Commercial Entitlement Tiers (Free Explorer · Pro Scholar · Institute)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.values(COMMERCIAL_TIERS).map((tier) => {
                const isCurrent = activeTierId === tier.id;
                return (
                  <div
                    key={tier.id}
                    className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 ${
                      isCurrent
                        ? 'border-brand bg-brand/5 dark:bg-brand/10'
                        : 'border-line bg-canvas'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-base font-bold text-ink">
                          {tier.name}
                        </span>
                        <span className="font-mono tabular-nums text-xs font-bold text-brand">
                          {tier.priceInrMonthly === 0 ? 'Free' : `₹${tier.priceInrMonthly}/mo`}
                        </span>
                      </div>
                      <p className="text-xs text-muted">{tier.tagline}</p>
                      <ul className="space-y-1.5 pt-2 text-xs text-ink">
                        {tier.features.map((feat) => (
                          <li key={feat} className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectTier(tier.id)}
                      data-testid={`select-tier-btn-${tier.id}`}
                      className={`w-full py-2 px-4 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-brand text-white'
                          : 'bg-white dark:bg-[#1E293B] border border-line text-ink hover:bg-soft'
                      }`}
                    >
                      {isCurrent ? 'Active Plan' : `Switch to ${tier.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: System Scalability, Token Quota & Semantic Cache Telemetry */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-ink">
              02. Multi-Instance Quota Ledger, Semantic Cache &amp; PYQ Corpus Distribution
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <Cpu className="w-4 h-4 text-brand" />
                  <span>Daily AI Token Budget</span>
                </div>
                <div className="font-mono tabular-nums space-y-1 text-muted">
                  <div>
                    Active Cap:{' '}
                    <strong className="text-ink">
                      {(healthData?.subscription?.dailyTokenCap ?? 250000).toLocaleString()} tokens
                    </strong>
                  </div>
                  <div>
                    Used Today:{' '}
                    <strong className="text-ink">
                      {(healthData?.subscription?.tokensUsedToday ?? 0).toLocaleString()} tokens
                    </strong>
                  </div>
                  <div>
                    Rate Window:{' '}
                    <strong className="text-ink">
                      {healthData?.subscription?.maxRequestsPerMinute ?? 60} req/min
                    </strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Semantic AI Response Cache</span>
                </div>
                <div className="font-mono tabular-nums space-y-1 text-muted">
                  <div>
                    Cache Hit Rate:{' '}
                    <strong className="text-ink">
                      {healthData?.semanticCache?.hitRatePercent ?? 0}%
                    </strong>
                  </div>
                  <div>
                    Tokens Saved:{' '}
                    <strong className="text-emerald-600">
                      {(healthData?.semanticCache?.totalTokensSaved ?? 0).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    Indexed Queries:{' '}
                    <strong className="text-ink">
                      {healthData?.semanticCache?.entriesCount ?? 0}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>Multi-Exam PYQ Corpus</span>
                </div>
                <div className="font-mono tabular-nums space-y-1 text-muted">
                  <div>
                    JEE Main: <strong className="text-ink">{healthData?.corpusSummary?.byExam?.jee_main ?? 14}</strong> · JEE Adv:{' '}
                    <strong className="text-ink">{healthData?.corpusSummary?.byExam?.jee_advanced ?? 6}</strong>
                  </div>
                  <div>
                    BITSAT: <strong className="text-ink">{healthData?.corpusSummary?.byExam?.bitsat ?? 3}</strong> · VITEEE:{' '}
                    <strong className="text-ink">{healthData?.corpusSummary?.byExam?.viteee ?? 2}</strong>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 font-sans font-semibold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Hybrid Firestore + Local Corpus Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
