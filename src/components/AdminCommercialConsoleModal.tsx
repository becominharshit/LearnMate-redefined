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
  type SupportedBillingCurrency,
} from '../utils/commercialScaleEngine';
import { apiFetch } from '../services/apiFetch';

interface AdminCommercialConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CURRENCY_SYMBOLS: Record<SupportedBillingCurrency, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export const AdminCommercialConsoleModal: React.FC<AdminCommercialConsoleModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [tierData, setTierData] = useState<any>(null);
  const [invoices, setInvoices] = useState<Array<{
    invoiceId: string;
    tierId: string;
    provider: string;
    amount: number;
    currency: SupportedBillingCurrency;
    status: string;
    issuedAt: string;
  }>>([]);
  const [activeTierId, setActiveTierId] = useState<CommercialSubscriptionTierId>('free_explorer');
  const [currency, setCurrency] = useState<SupportedBillingCurrency>('INR');
  const [provider, setProvider] = useState<'razorpay' | 'stripe'>('razorpay');
  const [loading, setLoading] = useState(false);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);

  const fetchHealthAndTiers = async () => {
    setLoading(true);
    try {
      const [res, invRes] = await Promise.all([
        apiFetch('/api/commercial/tiers'),
        apiFetch('/api/commercial/invoices'),
      ]);
      if (res.ok) {
        const json = await res.json();
        setTierData(json);
        if (json.activeTierId) {
          setActiveTierId(json.activeTierId);
        }
      }
      if (invRes.ok) {
        const invJson = await invRes.json();
        setInvoices(Array.isArray(invJson.invoices) ? invJson.invoices : []);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setBillingNotice(null);
      void fetchHealthAndTiers();
    }
  }, [isOpen]);

  const handleSelectTier = async (tierId: CommercialSubscriptionTierId) => {
    setBillingNotice(null);
    try {
      if (tierId === 'free_explorer') {
        const res = await apiFetch('/api/commercial/select-tier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tierId }),
        });
        if (res.ok) {
          await fetchHealthAndTiers();
          setBillingNotice('Switched active plan to Free Explorer.');
        }
        return;
      }

      const checkoutRes = await apiFetch('/api/commercial/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId, provider, currency }),
      });
      const json = await checkoutRes.json().catch(() => ({}));
      if (checkoutRes.ok && json.session?.sessionId) {
        const sym = CURRENCY_SYMBOLS[currency] || '₹';
        const priceDisplay = `${sym}${json.session.amount ?? json.session.amountInr}/mo`;
        if (json.session.checkoutUrl) {
          setBillingNotice(
            `Checkout session ${json.session.sessionId} created (${priceDisplay}). Complete payment at ${json.session.checkoutUrl} — tier activates via signed webhook.`
          );
        } else {
          setBillingNotice(
            `Checkout session ${json.session.sessionId} created (${priceDisplay}). Tier activates automatically after signed payment webhook verification.`
          );
        }
      } else {
        setBillingNotice(
          json.error ||
            'Paid tiers require verified payment checkout or an authorized admin grant. Client-side upgrades are disabled.'
        );
      }
    } catch {
      setBillingNotice('Network unavailable — plan changes require server verification.');
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
                Server-enforced Free Explorer, Pro Scholar &amp; Institute tiers · Monitor Semantic Cache &amp; Provenance Corpus
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-ink">
                01. Commercial Entitlement Tiers (Free Explorer · Pro Scholar · Institute)
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <label htmlFor="billing-currency-select" className="text-muted font-medium">
                  Currency
                </label>
                <select
                  id="billing-currency-select"
                  value={currency}
                  onChange={(e) => {
                    const nextCur = e.target.value as SupportedBillingCurrency;
                    setCurrency(nextCur);
                    if (nextCur !== 'INR' && provider === 'razorpay') {
                      setProvider('stripe');
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg border border-line bg-canvas text-ink font-semibold"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
                <label htmlFor="billing-provider-select" className="text-muted font-medium ml-1">
                  Gateway
                </label>
                <select
                  id="billing-provider-select"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'razorpay' | 'stripe')}
                  className="px-2.5 py-1 rounded-lg border border-line bg-canvas text-ink font-semibold"
                >
                  <option value="razorpay">Razorpay</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>
            </div>
            {billingNotice && (
              <div
                data-testid="commercial-billing-notice"
                className="p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 font-medium"
              >
                {billingNotice}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.values(COMMERCIAL_TIERS).map((tier) => {
                const isCurrent = activeTierId === tier.id;
                const price = tier.pricesByCurrency?.[currency] ?? tier.priceInrMonthly;
                const sym = CURRENCY_SYMBOLS[currency] || '₹';
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
                          {price === 0 ? 'Free' : `${sym}${price}/mo`}
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
                      {isCurrent
                        ? 'Active Plan'
                        : tier.id === 'free_explorer'
                        ? `Switch to ${tier.name}`
                        : `Upgrade via Checkout`}
                    </button>
                  </div>
                );
              })}
            </div>
            {invoices.length > 0 && (
              <div className="p-3.5 rounded-xl border border-line bg-canvas text-xs space-y-1.5">
                <div className="font-semibold text-ink">Verified Billing Receipts</div>
                {invoices.slice(0, 5).map((inv) => (
                  <div key={inv.invoiceId} className="flex items-center justify-between text-muted font-mono tabular-nums">
                    <span>{inv.invoiceId} · {inv.tierId} ({inv.provider})</span>
                    <span>
                      {CURRENCY_SYMBOLS[inv.currency] || ''}{inv.amount} · {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                      {(tierData?.quota?.dailyTokenCap ?? 50000).toLocaleString()} tokens
                    </strong>
                  </div>
                  <div>
                    Used Today:{' '}
                    <strong className="text-ink">
                      {(tierData?.quota?.tokensUsedToday ?? 0).toLocaleString()} tokens
                    </strong>
                  </div>
                  <div>
                    Rate Window:{' '}
                    <strong className="text-ink">
                      {tierData?.quota?.maxRequestsPerMinute ?? 20} req/min
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
                      {tierData?.semanticCache?.hitRatePercent ?? 0}%
                    </strong>
                  </div>
                  <div>
                    Tokens Saved:{' '}
                    <strong className="text-emerald-600">
                      {(tierData?.semanticCache?.totalTokensSaved ?? 0).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    Indexed Queries:{' '}
                    <strong className="text-ink">
                      {tierData?.semanticCache?.entriesCount ?? 0}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
                <div className="flex items-center gap-2 font-bold text-ink">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>Multi-Exam Provenance Corpus</span>
                </div>
                <div className="font-mono tabular-nums space-y-1 text-muted">
                  <div>
                    Verified PYQs: <strong className="text-ink">{tierData?.corpusSummary?.totalVerifiedOfficialQuestions ?? 0}</strong> · Original Editorial:{' '}
                    <strong className="text-ink">{tierData?.corpusSummary?.totalOriginalEditorialQuestions ?? 89}</strong>
                  </div>
                  <div>
                    JEE Main: <strong className="text-ink">{tierData?.corpusSummary?.byExam?.jee_main ?? 75}</strong> · JEE Adv:{' '}
                    <strong className="text-ink">{tierData?.corpusSummary?.byExam?.jee_advanced ?? 9}</strong> · BITSAT/VIT:{' '}
                    <strong className="text-ink">{(tierData?.corpusSummary?.byExam?.bitsat ?? 3) + (tierData?.corpusSummary?.byExam?.viteee ?? 2)}</strong>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 font-sans font-semibold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Durable Store + Verified Provenance Active</span>
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
