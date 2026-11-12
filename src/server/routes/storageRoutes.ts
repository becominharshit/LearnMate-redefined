import crypto from 'crypto';
import { Router } from 'express';
import type { StudentRequest } from '../middleware/authAndSecurity.ts';

interface StoredBinaryAsset {
  blobId: string;
  ownerUid: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  base64Data?: string;
  createdAt: string;
  expiresAt: string;
}

const memoryBlobStore = new Map<string, StoredBinaryAsset>();

/**
 * Cloud Storage Signed URL & Content-Addressed Offload Router (`/api/storage`)
 * Generates signed upload/download descriptors so user PDFs and handwritten notes
 * never bloat browser `localStorage` or Firestore document payloads.
 */
export function createStorageRouter(): Router {
  const router = Router();

  // POST /api/storage/signed-upload — Creates a signed upload URL & content-addressed object key
  router.post('/signed-upload', (req, res) => {
    try {
      const studentReq = req as StudentRequest;
      const uid = studentReq.student?.uid || 'dev-student-local';
      const {
        fileName = 'study-material.pdf',
        mimeType = 'application/pdf',
        sizeBytes = 0,
        contentHash = '',
      } = (req.body || {}) as {
        fileName?: string;
        mimeType?: string;
        sizeBytes?: number;
        contentHash?: string;
      };

      const safeName = String(fileName)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 120);
      const hashToken =
        contentHash && /^[a-f0-9]{16,64}$/i.test(contentHash)
          ? contentHash.slice(0, 32)
          : crypto.randomBytes(12).toString('hex');
      const blobId = `lm-blob-${hashToken}`;
      const objectPath = `users/${uid}/materials/${blobId}/${safeName}`;
      const now = Date.now();
      const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();
      const signature = crypto
        .createHmac('sha256', process.env.STORAGE_SIGNING_SECRET || 'learnmate-local-storage-key')
        .update(`${blobId}:${uid}:${expiresAt}`)
        .digest('hex');

      const asset: StoredBinaryAsset = {
        blobId,
        ownerUid: uid,
        fileName: safeName,
        mimeType,
        sizeBytes: Number(sizeBytes) || 0,
        sha256: hashToken,
        createdAt: new Date(now).toISOString(),
        expiresAt,
      };
      memoryBlobStore.set(blobId, asset);

      res.json({
        blobId,
        objectPath,
        uploadUrl: `/api/storage/blob/${blobId}?sig=${signature}&exp=${encodeURIComponent(expiresAt)}`,
        downloadUrl: `/api/storage/blob/${blobId}`,
        expiresAt,
        storageProvider: process.env.FIREBASE_STORAGE_BUCKET
          ? 'firebase_cloud_storage'
          : 'server_content_addressed_store',
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate signed upload URL.',
      });
    }
  });

  // PUT or POST /api/storage/blob/:blobId — Uploads binary/base64 payload to content-addressed store
  router.post('/blob/:blobId', (req, res) => {
    try {
      const { blobId } = req.params;
      const existing = memoryBlobStore.get(blobId);
      const { base64Data = '', fileName = 'material.pdf', mimeType = 'application/pdf' } = (req.body ||
        {}) as {
        base64Data?: string;
        fileName?: string;
        mimeType?: string;
      };

      const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '');
      const sha256 = crypto.createHash('sha256').update(cleanBase64).digest('hex');
      const sizeBytes = Math.floor((cleanBase64.length * 3) / 4);

      const record: StoredBinaryAsset = {
        blobId,
        ownerUid: existing?.ownerUid || 'dev-student-local',
        fileName: existing?.fileName || fileName,
        mimeType: existing?.mimeType || mimeType,
        sizeBytes,
        sha256,
        base64Data: cleanBase64,
        createdAt: existing?.createdAt || new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      memoryBlobStore.set(blobId, record);

      res.json({
        stored: true,
        blobId,
        sha256,
        sizeBytes,
        downloadUrl: `/api/storage/blob/${blobId}`,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to store binary asset.',
      });
    }
  });

  // GET /api/storage/blob/:blobId — Downloads or inspects stored binary metadata
  router.get('/blob/:blobId', (req, res) => {
    const { blobId } = req.params;
    const record = memoryBlobStore.get(blobId);
    if (!record) {
      res.status(404).json({ error: 'Stored asset not found or expired.', blobId });
      return;
    }
    res.json({
      blobId: record.blobId,
      fileName: record.fileName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      createdAt: record.createdAt,
      hasPayload: Boolean(record.base64Data),
      base64Data: req.query.includeData === '1' ? record.base64Data : undefined,
    });
  });

  return router;
}
