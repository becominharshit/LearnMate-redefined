import crypto from 'crypto';
import {
  COMMERCIAL_TIERS,
  type CommercialSubscriptionTierId,
  type SupportedBillingCurrency,
} from '../../utils/commercialScaleEngine.ts';
import { DurableCollectionStore, getDurableStore } from '../persistence/durableStore.ts';

export type SubscriptionStatus =
  | 'free_active'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'refunded';

export type BillingProvider = 'free' | 'razorpay' | 'stripe' | 'admin_grant';

export interface UserEntitlementRecord {
  uid: string;
  tierId: CommercialSubscriptionTierId;
  status: SubscriptionStatus;
  provider: BillingProvider;
  subscriptionId?: string;
  orderId?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  updatedAt: string;
  grantedByAdmin?: string;
  grantReason?: string;
}

export interface CheckoutSessionRecord {
  sessionId: string;
  uid: string;
  tierId: CommercialSubscriptionTierId;
  provider: 'razorpay' | 'stripe';
  providerCheckoutId?: string;
  checkoutUrl?: string;
  amount: number;
  amountInr: number;
  currency: SupportedBillingCurrency;
  status: 'created' | 'completed' | 'expired';
  createdAt: string;
}

export interface ProcessedWebhookEventRecord {
  eventId: string;
  provider: 'razorpay' | 'stripe';
  eventType: string;
  uid: string;
  processedAt: string;
}

export interface BillingInvoiceRecord {
  invoiceId: string;
  uid: string;
  provider: BillingProvider;
  eventId: string;
  tierId: CommercialSubscriptionTierId;
  amount: number;
  currency: SupportedBillingCurrency;
  status: 'paid' | 'refunded' | 'failed';
  issuedAt: string;
}

const ENTITLEMENTS_COLLECTION = 'entitlements';
const CHECKOUT_COLLECTION = 'billing_checkout_sessions';
const WEBHOOK_EVENTS_COLLECTION = 'billing_webhook_events';
const INVOICES_COLLECTION = 'billing_invoices';

export function verifyWebhookHmac(
  rawBody: string,
  providedSignature: string,
  secret: string
): boolean {
  if (!secret || !providedSignature) return false;
  const normalized = providedSignature.replace(/^sha256=/i, '').trim();
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(normalized, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verifies Stripe `Stripe-Signature` header (`t=<unix_sec>,v1=<hex_hmac>`)
 * over `${t}.${rawBody}` with replay-window protection (default <= 300s).
 */
export function verifyStripeSignatureHeader(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  maxAgeSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000)
): { valid: boolean; reason?: string } {
  if (!secret || !signatureHeader) {
    return { valid: false, reason: 'missing_stripe_signature_or_secret' };
  }
  const parts = String(signatureHeader)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  let timestampStr = '';
  const v1Sigs: string[] = [];
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = part.slice(eqIdx + 1).trim();
    if (k === 't') timestampStr = v;
    if (k === 'v1') v1Sigs.push(v);
  }
  const ts = Number(timestampStr);
  if (!timestampStr || !Number.isFinite(ts) || v1Sigs.length === 0) {
    return { valid: false, reason: 'malformed_stripe_signature_header' };
  }
  if (Math.abs(nowSeconds - ts) > maxAgeSeconds) {
    return { valid: false, reason: 'stripe_webhook_timestamp_expired' };
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestampStr}.${rawBody}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  for (const sig of v1Sigs) {
    const sigBuf = Buffer.from(sig, 'utf8');
    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: true };
    }
  }
  return { valid: false, reason: 'stripe_signature_mismatch' };
}

export class EntitlementService {
  private readonly store: DurableCollectionStore;

  constructor(store?: DurableCollectionStore) {
    this.store = store || getDurableStore();
  }

  public getEntitlement(uid: string): UserEntitlementRecord {
    const existing = this.store.get<UserEntitlementRecord>(ENTITLEMENTS_COLLECTION, uid);
    if (!existing) {
      return {
        uid,
        tierId: 'free_explorer',
        status: 'free_active',
        provider: 'free',
        updatedAt: new Date().toISOString(),
      };
    }

    if (
      existing.tierId !== 'free_explorer' &&
      (existing.status === 'refunded' || existing.status === 'expired')
    ) {
      return {
        ...existing,
        tierId: 'free_explorer',
      };
    }

    if (
      existing.tierId !== 'free_explorer' &&
      existing.currentPeriodEnd &&
      Date.parse(existing.currentPeriodEnd) < Date.now() &&
      existing.status === 'cancelled'
    ) {
      return {
        ...existing,
        tierId: 'free_explorer',
        status: 'expired',
      };
    }

    return existing;
  }

  public getEffectiveTierSpec(uid: string) {
    const ent = this.getEntitlement(uid);
    const tier =
      ent.status === 'past_due'
        ? COMMERCIAL_TIERS.free_explorer
        : COMMERCIAL_TIERS[ent.tierId] || COMMERCIAL_TIERS.free_explorer;
    return { entitlement: ent, tier };
  }

  public listInvoicesForUser(uid: string): BillingInvoiceRecord[] {
    return this.store
      .list<BillingInvoiceRecord>(INVOICES_COLLECTION)
      .filter((inv) => inv.uid === uid)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  public requestSelfServiceTierChange(
    uid: string,
    tierId: CommercialSubscriptionTierId
  ):
    | { ok: true; entitlement: UserEntitlementRecord }
    | { ok: false; status: 400 | 403; code: string; error: string } {
    if (!tierId || !COMMERCIAL_TIERS[tierId]) {
      return {
        ok: false,
        status: 400,
        code: 'invalid_tier',
        error: 'Invalid subscription tier ID.',
      };
    }

    if (tierId !== 'free_explorer') {
      return {
        ok: false,
        status: 403,
        code: 'payment_required_for_paid_tier',
        error:
          'Paid tier activation requires verified payment checkout or an authorized admin grant. Client-side plan upgrades are not permitted.',
      };
    }

    const record: UserEntitlementRecord = {
      uid,
      tierId: 'free_explorer',
      status: 'free_active',
      provider: 'free',
      updatedAt: new Date().toISOString(),
    };
    this.store.set(ENTITLEMENTS_COLLECTION, uid, record);
    return { ok: true, entitlement: record };
  }

  private isNonProdTestMode(): boolean {
    return process.env.PAYMENT_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
  }

  public isPaymentProviderConfigured(provider: 'razorpay' | 'stripe'): boolean {
    if (this.isNonProdTestMode()) return true;
    if (provider === 'razorpay') {
      return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    }
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  public async createCheckoutSession(
    uid: string,
    tierId: CommercialSubscriptionTierId,
    provider: 'razorpay' | 'stripe' = 'razorpay',
    currency: SupportedBillingCurrency = 'INR',
    returnBaseUrl?: string
  ): Promise<
    | { ok: true; session: CheckoutSessionRecord }
    | { ok: false; status: 400 | 502 | 503; code: string; error: string }
  > {
    if (tierId !== 'pro_scholar' && tierId !== 'institute') {
      return {
        ok: false,
        status: 400,
        code: 'invalid_paid_tier',
        error: 'Checkout sessions are only valid for Pro Scholar or Institute tiers.',
      };
    }

    if (!this.isPaymentProviderConfigured(provider)) {
      return {
        ok: false,
        status: 503,
        code: 'payment_provider_not_configured',
        error: `${provider} billing keys are not configured on this server. Paid upgrades cannot be initiated until live merchant credentials are provisioned.`,
      };
    }

    const tier = COMMERCIAL_TIERS[tierId];
    const safeCurrency: SupportedBillingCurrency = ['INR', 'USD', 'EUR', 'GBP'].includes(currency)
      ? currency
      : 'INR';
    const amount = tier.pricesByCurrency[safeCurrency] ?? tier.priceInrMonthly;
    const amountMinor = Math.round(amount * 100);
    const sessionId = `chk_${provider}_${crypto.randomUUID()}`;
    let providerCheckoutId: string | undefined;
    let checkoutUrl: string | undefined;

    if (!this.isNonProdTestMode()) {
      const origin = (returnBaseUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
      if (provider === 'stripe' && process.env.STRIPE_SECRET_KEY) {
        try {
          const form = new URLSearchParams();
          form.set('mode', 'subscription');
          form.set('success_url', `${origin}/?checkout=success&session=${sessionId}`);
          form.set('cancel_url', `${origin}/?checkout=cancelled`);
          form.set('client_reference_id', uid);
          form.set('metadata[uid]', uid);
          form.set('metadata[tierId]', tierId);
          form.set('line_items[0][quantity]', '1');
          form.set('line_items[0][price_data][currency]', safeCurrency.toLowerCase());
          form.set('line_items[0][price_data][unit_amount]', String(amountMinor));
          form.set('line_items[0][price_data][recurring][interval]', 'month');
          form.set('line_items[0][price_data][product_data][name]', `LearnMate ${tier.name}`);

          const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
          });
          const stripeJson = (await stripeRes.json().catch(() => ({}))) as {
            id?: string;
            url?: string;
            error?: { message?: string };
          };
          if (!stripeRes.ok || !stripeJson.id) {
            return {
              ok: false,
              status: 502,
              code: 'stripe_checkout_failed',
              error: stripeJson?.error?.message || 'Stripe rejected Checkout session creation.',
            };
          }
          providerCheckoutId = stripeJson.id;
          checkoutUrl = stripeJson.url;
        } catch (err) {
          return {
            ok: false,
            status: 502,
            code: 'stripe_network_error',
            error: err instanceof Error ? err.message : 'Unable to reach Stripe Checkout API.',
          };
        }
      } else if (provider === 'razorpay' && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        try {
          const auth = Buffer.from(
            `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
          ).toString('base64');
          const rzRes = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: amountMinor,
              currency: safeCurrency,
              receipt: sessionId.slice(0, 40),
              notes: { uid, tierId },
            }),
          });
          const rzJson = (await rzRes.json().catch(() => ({}))) as {
            id?: string;
            error?: { description?: string };
          };
          if (!rzRes.ok || !rzJson.id) {
            return {
              ok: false,
              status: 502,
              code: 'razorpay_order_failed',
              error: rzJson?.error?.description || 'Razorpay rejected order creation.',
            };
          }
          providerCheckoutId = rzJson.id;
        } catch (err) {
          return {
            ok: false,
            status: 502,
            code: 'razorpay_network_error',
            error: err instanceof Error ? err.message : 'Unable to reach Razorpay Orders API.',
          };
        }
      }
    }

    const session: CheckoutSessionRecord = {
      sessionId,
      uid,
      tierId,
      provider,
      providerCheckoutId,
      checkoutUrl,
      amount,
      amountInr: tier.priceInrMonthly,
      currency: safeCurrency,
      status: 'created',
      createdAt: new Date().toISOString(),
    };
    this.store.set(CHECKOUT_COLLECTION, session.sessionId, session);
    return { ok: true, session };
  }

  public processSignedWebhook(params: {
    provider: 'razorpay' | 'stripe';
    rawBody: string;
    signatureHeader: string;
    webhookSecretOverride?: string;
    nowSeconds?: number;
  }):
    | { ok: true; duplicate: boolean; entitlement?: UserEntitlementRecord; eventId: string }
    | { ok: false; status: 400 | 401 | 503; code: string; error: string } {
    const envSecret =
      params.provider === 'razorpay'
        ? process.env.RAZORPAY_WEBHOOK_SECRET || ''
        : process.env.STRIPE_WEBHOOK_SECRET || '';
    const secret =
      params.webhookSecretOverride ||
      envSecret ||
      (this.isNonProdTestMode() ? 'learnmate-test-webhook-secret' : '');

    if (!secret) {
      return {
        ok: false,
        status: 503,
        code: 'webhook_secret_not_configured',
        error: 'Payment webhook signing secret is not configured.',
      };
    }

    if (params.provider === 'stripe') {
      const check = verifyStripeSignatureHeader(
        params.rawBody,
        params.signatureHeader,
        secret,
        300,
        params.nowSeconds
      );
      if (!check.valid) {
        return {
          ok: false,
          status: 401,
          code: check.reason || 'invalid_webhook_signature',
          error: 'Stripe-Signature verification or replay window check failed.',
        };
      }
    } else if (!verifyWebhookHmac(params.rawBody, params.signatureHeader, secret)) {
      return {
        ok: false,
        status: 401,
        code: 'invalid_webhook_signature',
        error: 'Webhook HMAC signature verification failed.',
      };
    }

    let rawParsed: Record<string, unknown>;
    try {
      rawParsed = JSON.parse(params.rawBody) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        status: 400,
        code: 'invalid_json',
        error: 'Malformed webhook payload.',
      };
    }

    // Normalize both Stripe standard event envelope & Razorpay/internal webhook envelope
    const stripeObj = (rawParsed.data as { object?: Record<string, unknown> } | undefined)?.object;
    const stripeMeta = (stripeObj?.metadata as Record<string, unknown> | undefined) || {};
    const rzNotes = (
      rawParsed.payload as { payment?: { entity?: { notes?: Record<string, unknown> } } } | undefined
    )?.payment?.entity?.notes;

    const eventId = String(rawParsed.eventId || rawParsed.id || '').trim();
    const eventType = String(rawParsed.eventType || rawParsed.type || rawParsed.event || '').trim();
    const uid = String(
      rawParsed.uid ||
        stripeObj?.client_reference_id ||
        stripeMeta.uid ||
        rzNotes?.uid ||
        ''
    ).trim();
    const tierId = (rawParsed.tierId || stripeMeta.tierId || rzNotes?.tierId) as
      | CommercialSubscriptionTierId
      | undefined;
    const subscriptionId = String(
      rawParsed.subscriptionId || stripeObj?.subscription || ''
    ).trim() || undefined;
    const currencyRaw = String(rawParsed.currency || stripeObj?.currency || 'INR').toUpperCase();
    const currency: SupportedBillingCurrency = (['INR', 'USD', 'EUR', 'GBP'].includes(currencyRaw)
      ? currencyRaw
      : 'INR') as SupportedBillingCurrency;

    if (!eventId || !uid || !eventType) {
      return {
        ok: false,
        status: 400,
        code: 'missing_webhook_fields',
        error: 'Webhook requires eventId, eventType, and uid.',
      };
    }

    const existingEvent = this.store.get<ProcessedWebhookEventRecord>(
      WEBHOOK_EVENTS_COLLECTION,
      eventId
    );
    if (existingEvent) {
      return {
        ok: true,
        duplicate: true,
        eventId,
        entitlement: this.getEntitlement(uid),
      };
    }

    const prev = this.getEntitlement(uid);
    const now = new Date();
    const periodDays = Math.max(1, Number(rawParsed.periodDays || 30));
    const periodEnd = new Date(now.getTime() + periodDays * 86_400_000).toISOString();

    let next: UserEntitlementRecord = { ...prev, updatedAt: now.toISOString() };
    let invoiceStatus: BillingInvoiceRecord['status'] | null = null;

    if (
      eventType === 'subscription.activated' ||
      eventType === 'payment.captured' ||
      eventType === 'checkout.session.completed' ||
      eventType === 'invoice.paid'
    ) {
      const targetTier =
        tierId && COMMERCIAL_TIERS[tierId] && tierId !== 'free_explorer'
          ? tierId
          : 'pro_scholar';
      next = {
        uid,
        tierId: targetTier,
        status: 'active',
        provider: params.provider,
        subscriptionId: subscriptionId || prev.subscriptionId,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        updatedAt: now.toISOString(),
      };
      invoiceStatus = 'paid';
    } else if (eventType === 'invoice.payment_failed' || eventType === 'subscription.halted') {
      next = {
        ...prev,
        status: 'past_due',
        updatedAt: now.toISOString(),
      };
      invoiceStatus = 'failed';
    } else if (
      eventType === 'subscription.cancelled' ||
      eventType === 'customer.subscription.deleted'
    ) {
      next = {
        ...prev,
        tierId: 'free_explorer',
        status: 'cancelled',
        cancelAtPeriodEnd: true,
        updatedAt: now.toISOString(),
      };
    } else if (eventType === 'charge.refunded' || eventType === 'payment.refunded') {
      next = {
        ...prev,
        tierId: 'free_explorer',
        status: 'refunded',
        updatedAt: now.toISOString(),
      };
      invoiceStatus = 'refunded';
    } else {
      return {
        ok: false,
        status: 400,
        code: 'unsupported_webhook_event',
        error: `Unsupported billing eventType: ${eventType}`,
      };
    }

    this.store.set(ENTITLEMENTS_COLLECTION, uid, next);
    this.store.set(WEBHOOK_EVENTS_COLLECTION, eventId, {
      eventId,
      provider: params.provider,
      eventType,
      uid,
      processedAt: now.toISOString(),
    } satisfies ProcessedWebhookEventRecord);

    if (invoiceStatus) {
      const invoicedTier =
        invoiceStatus === 'paid' ? next.tierId : prev.tierId;
      const tierSpec = COMMERCIAL_TIERS[invoicedTier] || COMMERCIAL_TIERS.pro_scholar;
      const invoiceRecord: BillingInvoiceRecord = {
        invoiceId: `inv_${params.provider}_${eventId}`,
        uid,
        provider: params.provider,
        eventId,
        tierId: invoicedTier,
        amount: tierSpec.pricesByCurrency[currency] ?? tierSpec.priceInrMonthly,
        currency,
        status: invoiceStatus,
        issuedAt: now.toISOString(),
      };
      this.store.set(INVOICES_COLLECTION, invoiceRecord.invoiceId, invoiceRecord);
    }

    return { ok: true, duplicate: false, entitlement: next, eventId };
  }

  public grantTierAsAdmin(params: {
    adminActor: string;
    targetUid: string;
    tierId: CommercialSubscriptionTierId;
    reason: string;
    days?: number;
  }): UserEntitlementRecord {
    if (!COMMERCIAL_TIERS[params.tierId]) {
      throw new Error('Invalid tierId for admin grant.');
    }
    const now = new Date();
    const record: UserEntitlementRecord = {
      uid: params.targetUid,
      tierId: params.tierId,
      status: params.tierId === 'free_explorer' ? 'free_active' : 'active',
      provider: params.tierId === 'free_explorer' ? 'free' : 'admin_grant',
      currentPeriodEnd:
        params.tierId === 'free_explorer'
          ? undefined
          : new Date(now.getTime() + (params.days || 30) * 86_400_000).toISOString(),
      grantedByAdmin: params.adminActor,
      grantReason: params.reason || 'Admin override',
      updatedAt: now.toISOString(),
    };
    this.store.set(ENTITLEMENTS_COLLECTION, params.targetUid, record);
    return record;
  }
}

let defaultEntitlementService: EntitlementService | null = null;

export function getEntitlementService(): EntitlementService {
  if (!defaultEntitlementService) {
    defaultEntitlementService = new EntitlementService();
  }
  return defaultEntitlementService;
}
