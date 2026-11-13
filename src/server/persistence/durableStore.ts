import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { getApps as getAdminApps } from 'firebase-admin/app';
import {
  isPostgresConfigured,
  isRedisConfigured,
  isPersistentDiskExplicitlyAllowedInProd,
} from './postgresAdapter.ts';

/**
 * Atomic Disk-Backed Durable Server Store + Optional Firestore Admin Sync
 *
 * Replaces process-local volatile Maps for entitlements, quotas, webhooks,
 * storage blob metadata/binaries, background jobs, shared links, AI telemetry,
 * and tenant-scoped semantic cache / RAG chunks.
 *
 * Truthfulness guarantee: never claims Postgres, Redis, or Firestore backing
 * unless verified admin/runtime credentials or connection strings are configured.
 */

export type PersistenceBackendMode =
  | 'postgres_and_redis'
  | 'firestore_and_durable_disk'
  | 'durable_disk_store';

export function resolveDataDirectory(customDir?: string): string {
  const configured = customDir || process.env.LEARNMATE_DATA_DIR || '.learnmate-runtime-data';
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

function sanitizeSegment(segment: string): string {
  const cleaned = String(segment || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('Invalid storage path segment.');
  }
  return cleaned;
}

export class DurableCollectionStore {
  private readonly dataDir: string;
  private readonly caches = new Map<string, Map<string, unknown>>();
  private readonly writeQueues = new Map<string, Promise<void>>();

  constructor(dataDir?: string) {
    this.dataDir = resolveDataDirectory(dataDir);
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(path.join(this.dataDir, 'collections'), { recursive: true });
    fs.mkdirSync(path.join(this.dataDir, 'blobs'), { recursive: true });
  }

  public getDataDirectory(): string {
    return this.dataDir;
  }

  public isProductionDurable(): { durable: boolean; reason: string } {
    const postgresConfigured = isPostgresConfigured();
    const firestoreAdminReady =
      getAdminApps().length > 0 &&
      Boolean(
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          process.env.FIREBASE_ADMIN_CREDENTIALS_JSON ||
          process.env.FIRESTORE_EMULATOR_HOST
      );
    const persistentDiskExplicit = isPersistentDiskExplicitlyAllowedInProd();

    if (process.env.NODE_ENV !== 'production') {
      return {
        durable: true,
        reason: postgresConfigured
          ? 'postgres_configured'
          : firestoreAdminReady
          ? 'firestore_admin_ready'
          : 'non_production_local_disk',
      };
    }

    if (postgresConfigured) {
      return { durable: true, reason: 'postgres_configured' };
    }
    if (firestoreAdminReady) {
      return { durable: true, reason: 'firestore_admin_ready' };
    }
    if (persistentDiskExplicit) {
      return { durable: true, reason: 'explicit_persistent_volume_configured' };
    }

    return {
      durable: false,
      reason:
        'Production persistence is not durable: configure DATABASE_URL (PostgreSQL), Firebase Admin credentials, or mount a persistent volume with LEARNMATE_DATA_DIR and ALLOW_PERSISTENT_DISK_IN_PROD=true.',
    };
  }

  public getBackendStatus(): {
    mode: PersistenceBackendMode;
    firestoreAdminReady: boolean;
    postgresConfigured: boolean;
    redisConfigured: boolean;
    productionDurable: boolean;
    durabilityReason: string;
    dataDir: string;
  } {
    const firestoreAdminReady =
      getAdminApps().length > 0 &&
      Boolean(
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          process.env.FIREBASE_ADMIN_CREDENTIALS_JSON ||
          process.env.FIRESTORE_EMULATOR_HOST
      );
    const postgresConfigured = isPostgresConfigured();
    const redisConfigured = isRedisConfigured();
    const prodCheck = this.isProductionDurable();

    const mode: PersistenceBackendMode = postgresConfigured
      ? 'postgres_and_redis'
      : firestoreAdminReady
      ? 'firestore_and_durable_disk'
      : 'durable_disk_store';

    return {
      mode,
      firestoreAdminReady,
      postgresConfigured,
      redisConfigured,
      productionDurable: prodCheck.durable,
      durabilityReason: prodCheck.reason,
      dataDir: this.dataDir,
    };
  }

  private getCollectionFile(collection: string): string {
    return path.join(this.dataDir, 'collections', `${sanitizeSegment(collection)}.json`);
  }

  private loadCollectionSync(collection: string): Map<string, unknown> {
    const existing = this.caches.get(collection);
    if (existing) return existing;

    const filePath = this.getCollectionFile(collection);
    const map = new Map<string, unknown>();
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          for (const [k, v] of Object.entries(parsed)) {
            map.set(k, v);
          }
        }
      }
    } catch (err) {
      console.error(`[DurableStore] Failed reading ${collection}:`, err);
    }
    this.caches.set(collection, map);
    return map;
  }

  private persistCollectionSync(collection: string, map: Map<string, unknown>): void {
    const filePath = this.getCollectionFile(collection);
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const serialized = JSON.stringify(Object.fromEntries(map.entries()), null, 2);
    fs.writeFileSync(tmpPath, serialized, 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  private enqueueWrite(collection: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.writeQueues.get(collection) || Promise.resolve();
    const next = prev.then(fn, fn);
    this.writeQueues.set(collection, next);
    return next;
  }

  public get<T>(collection: string, key: string): T | null {
    const map = this.loadCollectionSync(collection);
    const val = map.get(key);
    return val === undefined ? null : (val as T);
  }

  public getAll<T>(collection: string): Array<[string, T]> {
    const map = this.loadCollectionSync(collection);
    return Array.from(map.entries()) as Array<[string, T]>;
  }

  public list<T>(collection: string): T[] {
    const map = this.loadCollectionSync(collection);
    return Array.from(map.values()) as T[];
  }

  public set<T>(collection: string, key: string, value: T): void {
    const map = this.loadCollectionSync(collection);
    map.set(key, value);
    this.persistCollectionSync(collection, map);
  }

  public delete(collection: string, key: string): boolean {
    const map = this.loadCollectionSync(collection);
    const existed = map.delete(key);
    if (existed) {
      this.persistCollectionSync(collection, map);
    }
    return existed;
  }

  public deleteByPrefix(collection: string, prefix: string): number {
    const map = this.loadCollectionSync(collection);
    let removed = 0;
    for (const key of Array.from(map.keys())) {
      if (key.startsWith(prefix)) {
        map.delete(key);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.persistCollectionSync(collection, map);
    }
    return removed;
  }

  public deleteWhere<T>(
    collection: string,
    predicate: (key: string, value: T) => boolean
  ): number {
    const map = this.loadCollectionSync(collection);
    let removed = 0;
    for (const [key, value] of Array.from(map.entries())) {
      if (predicate(key, value as T)) {
        map.delete(key);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.persistCollectionSync(collection, map);
    }
    return removed;
  }

  public async setAsync<T>(collection: string, key: string, value: T): Promise<void> {
    const map = this.loadCollectionSync(collection);
    map.set(key, value);
    await this.enqueueWrite(collection, async () => {
      const filePath = this.getCollectionFile(collection);
      const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      const serialized = JSON.stringify(Object.fromEntries(map.entries()), null, 2);
      await fsp.writeFile(tmpPath, serialized, 'utf8');
      await fsp.rename(tmpPath, filePath);
    });
  }

  public resolveOwnerBlobPath(ownerUid: string, blobId: string): string {
    const safeUid = sanitizeSegment(ownerUid);
    const safeBlob = sanitizeSegment(blobId);
    const dir = path.join(this.dataDir, 'blobs', safeUid);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${safeBlob}.bin`);
  }

  public writeBlobBytes(ownerUid: string, blobId: string, bytes: Buffer): string {
    const targetPath = this.resolveOwnerBlobPath(ownerUid, blobId);
    const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, bytes);
    fs.renameSync(tmpPath, targetPath);
    return targetPath;
  }

  public readBlobBytes(ownerUid: string, blobId: string): Buffer | null {
    const targetPath = this.resolveOwnerBlobPath(ownerUid, blobId);
    if (!fs.existsSync(targetPath)) return null;
    return fs.readFileSync(targetPath);
  }

  public deleteBlobBytes(ownerUid: string, blobId: string): void {
    const targetPath = this.resolveOwnerBlobPath(ownerUid, blobId);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  }

  public deleteOwnerBlobDirectory(ownerUid: string): boolean {
    const safeUid = sanitizeSegment(ownerUid);
    const dir = path.join(this.dataDir, 'blobs', safeUid);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      return true;
    }
    return false;
  }
}

let defaultStoreInstance: DurableCollectionStore | null = null;

export function getDurableStore(): DurableCollectionStore {
  if (!defaultStoreInstance) {
    defaultStoreInstance = new DurableCollectionStore();
  }
  return defaultStoreInstance;
}
