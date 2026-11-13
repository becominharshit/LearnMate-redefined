/**
 * Production PostgreSQL + Redis Durability Contract & Idempotent SQL Migrations
 *
 * Defines the canonical relational schemas, indexes, Redis key-prefix contracts,
 * and runtime configuration probes for external durable infrastructure in production.
 * Never fabricates active DB connections when DATABASE_URL or REDIS_URL are unset.
 */

export interface PersistenceBackendCapabilities {
  postgresConfigured: boolean;
  redisConfigured: boolean;
  firestoreAdminConfigured: boolean;
  persistentDiskExplicitlyAllowed: boolean;
  productionDurable: boolean;
  durabilityReason: string;
}

export function isPostgresConfigured(): boolean {
  const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
  return /^postgres(?:ql)?:\/\//i.test(url);
}

export function isRedisConfigured(): boolean {
  const redisUrl = (process.env.REDIS_URL || '').trim();
  const upstashUrl = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const upstashToken = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  return /^rediss?:\/\//i.test(redisUrl) || Boolean(upstashUrl && upstashToken);
}

export function isPersistentDiskExplicitlyAllowedInProd(): boolean {
  return (
    process.env.ALLOW_PERSISTENT_DISK_IN_PROD === 'true' &&
    Boolean((process.env.LEARNMATE_DATA_DIR || '').trim())
  );
}

export const POSTGRES_MIGRATION_VERSION = '2026_11_13_001_initial_commercial_core';

export const POSTGRES_MIGRATIONS_SQL = `
-- LearnMate Commercial Core Schema (${POSTGRES_MIGRATION_VERSION})
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entitlements (
  uid TEXT PRIMARY KEY,
  tier_id TEXT NOT NULL CHECK (tier_id IN ('free_explorer', 'pro_scholar', 'institute')),
  status TEXT NOT NULL CHECK (status IN ('free_active', 'active', 'past_due', 'cancelled', 'expired', 'refunded')),
  provider TEXT NOT NULL CHECK (provider IN ('free', 'razorpay', 'stripe', 'admin_grant')),
  subscription_id TEXT,
  order_id TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  granted_by_admin TEXT,
  grant_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_checkout_sessions (
  session_id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  tier_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'stripe')),
  provider_checkout_id TEXT,
  checkout_url TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP')),
  status TEXT NOT NULL CHECK (status IN ('created', 'completed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_checkout_uid ON billing_checkout_sessions (uid, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'stripe')),
  event_type TEXT NOT NULL,
  uid TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_invoices (
  invoice_id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'stripe', 'admin_grant')),
  event_id TEXT NOT NULL,
  tier_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('INR', 'USD', 'EUR', 'GBP')),
  status TEXT NOT NULL CHECK (status IN ('paid', 'refunded', 'failed')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_uid ON billing_invoices (uid, issued_at DESC);

CREATE TABLE IF NOT EXISTS quota_usage (
  quota_key TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  date_key TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quota_usage_uid_date ON quota_usage (uid, date_key);

CREATE TABLE IF NOT EXISTS storage_blobs (
  blob_id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  object_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  uploaded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_storage_blobs_owner ON storage_blobs (owner_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS background_jobs (
  job_id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_pct INTEGER NOT NULL DEFAULT 0,
  step_label TEXT NOT NULL,
  idempotency_key TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_background_jobs_uid ON background_jobs (uid, updated_at DESC);

CREATE TABLE IF NOT EXISTS study_video_jobs (
  job_id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  topic TEXT NOT NULL,
  mode TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  verification_status TEXT,
  fallback_mode TEXT,
  user_facing_notice TEXT,
  scenes_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_study_video_jobs_owner ON study_video_jobs (owner_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS youtube_lecture_jobs (
  job_id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  video_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  chunks_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_youtube_jobs_owner ON youtube_lecture_jobs (owner_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS youtube_lecture_cache (
  cache_key TEXT PRIMARY KEY,
  payload_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_snapshots (
  share_id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  views_count INTEGER NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shared_snapshots_owner ON shared_snapshots (owner_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_telemetry_daily (
  date_key TEXT PRIMARY KEY,
  summary_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_rag_indexes (
  scoped_key TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  document_id TEXT NOT NULL,
  doc_version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  chunks_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenant_rag_owner ON tenant_rag_indexes (owner_uid);
`;

export interface DurableRepositoryAdapter {
  get<T>(collection: string, key: string): T | null;
  list<T>(collection: string): T[];
  set<T>(collection: string, key: string, value: T): void;
  delete(collection: string, key: string): boolean;
  deleteByPrefix(collection: string, prefix: string): number;
  deleteWhere<T>(collection: string, predicate: (key: string, value: T) => boolean): number;
}
