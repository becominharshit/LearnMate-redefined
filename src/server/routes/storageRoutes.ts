import crypto from 'crypto';
import { Router } from 'express';
import type { StudentRequest } from '../middleware/authAndSecurity.ts';
import { DurableCollectionStore, getDurableStore } from '../persistence/durableStore.ts';

export interface StoredBinaryAsset {
  blobId: string;
  ownerUid: string;
  objectPath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  expiresAt: string;
  uploadedAt?: string;
}

const STORAGE_COLLECTION = 'storage_blobs';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MiB hard ceiling
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'text/plain',
  'text/markdown',
]);

const DEV_EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(overrideSecret?: string): { secret: string | null; configured: boolean } {
  const configured = overrideSecret || process.env.STORAGE_SIGNING_SECRET;
  if (configured && configured.trim().length > 0) {
    return { secret: configured.trim(), configured: true };
  }
  if (process.env.NODE_ENV === 'production') {
    return { secret: null, configured: false };
  }
  return { secret: DEV_EPHEMERAL_FALLBACK_SECRET, configured: false };
}

export function normalizeMimeType(raw: string): string {
  const base = String(raw || '').split(';')[0].trim().toLowerCase();
  if (base === 'image/jpg') return 'image/jpeg';
  return base;
}

export function validateMagicBytes(mimeType: string, bytes: Buffer): { valid: boolean; reason?: string } {
  const mime = normalizeMimeType(mimeType);
  if (bytes.length === 0) {
    return { valid: false, reason: 'Uploaded file is empty.' };
  }

  if (mime === 'application/pdf') {
    if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return { valid: false, reason: 'Binary header does not match PDF (%PDF-).' };
    }
    return { valid: true };
  }

  if (mime === 'image/png') {
    const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (bytes.length < 8 || !bytes.subarray(0, 8).equals(pngSig)) {
      return { valid: false, reason: 'Binary header does not match PNG signature.' };
    }
    return { valid: true };
  }

  if (mime === 'image/jpeg') {
    if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      return { valid: false, reason: 'Binary header does not match JPEG signature.' };
    }
    return { valid: true };
  }

  if (mime === 'image/webp') {
    if (
      bytes.length < 12 ||
      bytes.subarray(0, 4).toString('ascii') !== 'RIFF' ||
      bytes.subarray(8, 12).toString('ascii') !== 'WEBP'
    ) {
      return { valid: false, reason: 'Binary header does not match WEBP signature.' };
    }
    return { valid: true };
  }

  if (mime === 'text/plain' || mime === 'text/markdown') {
    if (bytes.includes(0x00)) {
      return { valid: false, reason: 'Binary NUL byte detected in text/markdown upload.' };
    }
    const prefix = bytes.subarray(0, 128).toString('utf8').trimStart();
    if (
      prefix.startsWith('%PDF-') ||
      prefix.startsWith('MZ') ||
      prefix.startsWith('\x7fELF') ||
      /<script\b|<svg\b/i.test(prefix)
    ) {
      return { valid: false, reason: 'Disallowed executable or markup header detected in text upload.' };
    }
    return { valid: true };
  }

  return { valid: false, reason: `Unsupported MIME type: ${mime}` };
}

function signStorageUrl(params: {
  blobId: string;
  ownerUid: string;
  mimeType: string;
  maxBytes: number;
  expiresAt: string;
  secret: string;
}): string {
  return crypto
    .createHmac('sha256', params.secret)
    .update(
      `${params.blobId}:${params.ownerUid}:${params.mimeType}:${params.maxBytes}:${params.expiresAt}`
    )
    .digest('hex');
}

function verifyStorageUrlSignature(params: {
  blobId: string;
  ownerUid: string;
  mimeType: string;
  maxBytes: number;
  expiresAt: string;
  providedSig: string;
  secret: string;
}): boolean {
  if (!params.providedSig || !params.expiresAt) return false;
  const expiresMs = Date.parse(params.expiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs < Date.now()) {
    return false;
  }
  const expected = signStorageUrl(params);
  const a = Buffer.from(String(params.providedSig).trim(), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Owner-Isolated Durable Storage Router (`/api/storage`)
 * Enforces signed HMAC upload URLs, MIME allowlist, magic-byte inspection,
 * cryptographic blob IDs, and strict tenant isolation on read/write/delete.
 */
export function createStorageRouter(options?: {
  store?: DurableCollectionStore;
  signingSecret?: string;
}): Router {
  const router = Router();
  const store = options?.store || getDurableStore();

  // Fail closed in production when STORAGE_SIGNING_SECRET or durable storage is missing
  router.use((_req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
      const durability = store.isProductionDurable();
      if (!durability.durable) {
        res.status(503).json({
          error: durability.reason,
          code: 'persistence_not_durable',
          errorCode: 'persistence_not_durable',
        });
        return;
      }
      const { secret } = getSigningSecret(options?.signingSecret);
      if (!secret) {
        res.status(503).json({
          error: 'STORAGE_SIGNING_SECRET must be configured in production.',
          code: 'storage_signing_not_configured',
          errorCode: 'storage_signing_not_configured',
        });
        return;
      }
    }
    next();
  });

  // GET /api/storage/assets — List metadata ONLY for the authenticated owner
  router.get('/assets', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const items = store
      .list<StoredBinaryAsset>(STORAGE_COLLECTION)
      .filter((item) => item.ownerUid === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ assets: items, storageProvider: store.getBackendStatus().mode });
  });

  // POST /api/storage/signed-upload — Creates a cryptographic signed upload URL scoped to ownerUid
  router.post('/signed-upload', (req, res) => {
    try {
      const studentReq = req as StudentRequest;
      const uid = studentReq.student?.uid || 'dev-student-local';
      const {
        fileName = 'study-material.pdf',
        mimeType = 'application/pdf',
        sizeBytes = 0,
      } = (req.body || {}) as {
        fileName?: string;
        mimeType?: string;
        sizeBytes?: number;
      };

      const normalizedMime = normalizeMimeType(mimeType);
      if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
        res.status(415).json({
          error: `Unsupported file type '${normalizedMime}'. Allowed: PDF, PNG, JPEG, WEBP, TXT, MD.`,
          code: 'unsupported_media_type',
        });
        return;
      }

      const requestedSize = Number(sizeBytes) || 0;
      if (requestedSize > MAX_UPLOAD_BYTES) {
        res.status(413).json({
          error: `File exceeds maximum allowed size of ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
          code: 'payload_too_large',
        });
        return;
      }

      const safeName =
        String(fileName)
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/^\.+/, '')
          .slice(0, 120) || 'study-material.pdf';

      const blobId = `lm-blob-${crypto.randomUUID()}`;
      const objectPath = `users/${uid}/materials/${blobId}/${safeName}`;
      const now = Date.now();
      const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();
      const maxBytes = MAX_UPLOAD_BYTES;
      const { secret } = getSigningSecret(options?.signingSecret);
      if (!secret) {
        res.status(503).json({
          error: 'STORAGE_SIGNING_SECRET is required in production.',
          code: 'storage_signing_not_configured',
        });
        return;
      }
      const signature = signStorageUrl({
        blobId,
        ownerUid: uid,
        mimeType: normalizedMime,
        maxBytes,
        expiresAt,
        secret,
      });

      const asset: StoredBinaryAsset = {
        blobId,
        ownerUid: uid,
        objectPath,
        fileName: safeName,
        mimeType: normalizedMime,
        sizeBytes: requestedSize,
        sha256: '',
        createdAt: new Date(now).toISOString(),
        expiresAt,
      };
      store.set(STORAGE_COLLECTION, blobId, asset);

      res.json({
        blobId,
        objectPath,
        uploadUrl: `/api/storage/blob/${blobId}?sig=${signature}&exp=${encodeURIComponent(expiresAt)}`,
        downloadUrl: `/api/storage/blob/${blobId}`,
        expiresAt,
        maxBytes,
        storageProvider: 'server_durable_disk_store',
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate signed upload URL.',
      });
    }
  });

  // POST /api/storage/blob/:blobId — Uploads binary/base64 payload after verifying owner, HMAC sig, expiry, MIME & magic bytes
  router.post('/blob/:blobId', (req, res) => {
    try {
      const studentReq = req as StudentRequest;
      const uid = studentReq.student?.uid || 'dev-student-local';
      const { blobId } = req.params;
      const existing = store.get<StoredBinaryAsset>(STORAGE_COLLECTION, blobId);

      if (!existing) {
        res.status(404).json({
          error: 'Upload reservation not found. Request a signed upload URL first.',
          code: 'upload_reservation_missing',
        });
        return;
      }

      if (existing.ownerUid !== uid) {
        res.status(403).json({
          error: 'Cross-tenant upload forbidden: you do not own this asset slot.',
          code: 'forbidden_cross_tenant_asset',
        });
        return;
      }

      const providedSig = String(req.query.sig || req.body?.sig || '');
      const providedExp = String(req.query.exp || req.body?.exp || existing.expiresAt);

      const { secret } = getSigningSecret(options?.signingSecret);
      if (!secret) {
        res.status(503).json({
          error: 'STORAGE_SIGNING_SECRET is required in production.',
          code: 'storage_signing_not_configured',
        });
        return;
      }

      const sigValid = verifyStorageUrlSignature({
        blobId,
        ownerUid: uid,
        mimeType: existing.mimeType,
        maxBytes: MAX_UPLOAD_BYTES,
        expiresAt: providedExp,
        providedSig,
        secret,
      });

      if (!sigValid) {
        res.status(403).json({
          error: 'Invalid or expired signed upload signature.',
          code: 'invalid_storage_signature',
        });
        return;
      }

      const { base64Data = '', mimeType } = (req.body || {}) as {
        base64Data?: string;
        mimeType?: string;
      };

      const declaredMime = normalizeMimeType(mimeType || existing.mimeType);
      if (!ALLOWED_MIME_TYPES.has(declaredMime) || declaredMime !== existing.mimeType) {
        res.status(415).json({
          error: `MIME mismatch: reserved ${existing.mimeType}, received ${declaredMime}.`,
          code: 'mime_mismatch',
        });
        return;
      }

      const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '').trim();
      const binaryBuffer = Buffer.from(cleanBase64, 'base64');

      if (binaryBuffer.length > MAX_UPLOAD_BYTES) {
        res.status(413).json({
          error: `Decoded asset exceeds ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit.`,
          code: 'payload_too_large',
        });
        return;
      }

      const magic = validateMagicBytes(existing.mimeType, binaryBuffer);
      if (!magic.valid) {
        res.status(415).json({
          error: magic.reason || 'File magic-byte verification failed.',
          code: 'magic_byte_mismatch',
        });
        return;
      }

      const sha256 = crypto.createHash('sha256').update(binaryBuffer).digest('hex');
      store.writeBlobBytes(uid, blobId, binaryBuffer);

      const updated: StoredBinaryAsset = {
        ...existing,
        sizeBytes: binaryBuffer.length,
        sha256,
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      store.set(STORAGE_COLLECTION, blobId, updated);

      res.json({
        stored: true,
        blobId,
        sha256,
        sizeBytes: binaryBuffer.length,
        downloadUrl: `/api/storage/blob/${blobId}`,
        storageProvider: 'server_durable_disk_store',
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to store binary asset.',
      });
    }
  });

  // GET /api/storage/blob/:blobId — Strictly enforces ownerUid === uid
  router.get('/blob/:blobId', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const { blobId } = req.params;
    const record = store.get<StoredBinaryAsset>(STORAGE_COLLECTION, blobId);
    if (!record) {
      res.status(404).json({ error: 'Stored asset not found or expired.', blobId });
      return;
    }
    if (record.ownerUid !== uid) {
      res.status(403).json({
        error: 'Access denied: you do not own this stored asset.',
        code: 'forbidden_cross_tenant_asset',
      });
      return;
    }

    const bytes = store.readBlobBytes(record.ownerUid, record.blobId);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.query.download === '1') {
      if (!bytes) {
        res.status(404).json({ error: 'Stored binary payload not found.' });
        return;
      }
      const safeDownloadName = record.fileName.replace(/["\r\n]/g, '_');
      res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName}"`);
      res.send(bytes);
      return;
    }

    res.json({
      blobId: record.blobId,
      objectPath: record.objectPath,
      fileName: record.fileName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      createdAt: record.createdAt,
      uploadedAt: record.uploadedAt,
      storageProvider: 'server_durable_disk_store',
      hasPayload: Boolean(bytes && bytes.length > 0),
      base64Data:
        req.query.includeData === '1' && bytes ? bytes.toString('base64') : undefined,
    });
  });

  // DELETE /api/storage/blob/:blobId — Owner-only erasure
  router.delete('/blob/:blobId', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const { blobId } = req.params;
    const record = store.get<StoredBinaryAsset>(STORAGE_COLLECTION, blobId);
    if (!record) {
      res.status(404).json({ error: 'Stored asset not found.', blobId });
      return;
    }
    if (record.ownerUid !== uid) {
      res.status(403).json({
        error: 'Access denied: you do not own this stored asset.',
        code: 'forbidden_cross_tenant_asset',
      });
      return;
    }

    store.deleteBlobBytes(record.ownerUid, record.blobId);
    store.delete(STORAGE_COLLECTION, blobId);
    res.json({ deleted: true, blobId });
  });

  return router;
}
