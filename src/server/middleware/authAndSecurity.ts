import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { computeRequestFingerprint } from '../../utils/stabilityEngine.ts';
import {
  authenticateStudent,
  readBearerToken,
  type VerifiedStudent as AuthenticatedStudent,
  type IdTokenVerifier as TokenVerifier,
} from '../studentAuth.ts';
import { isAllowedOrigin, isPublicApiPath } from '../requestGuards.ts';

export function hashForLogs(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export { computeRequestFingerprint, authenticateStudent, readBearerToken, isAllowedOrigin, isPublicApiPath };
export type { AuthenticatedStudent, TokenVerifier };

export type StudentRequest = Request & { student?: AuthenticatedStudent };

export function readFirebaseConfigProjectId(workspaceRoot: string): string {
  for (const filename of ['firebase-applet-config.json', 'firebase-config.json']) {
    try {
      const fullPath = path.join(workspaceRoot, filename);
      if (fs.existsSync(fullPath)) {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as { projectId?: string };
        if (parsed.projectId && parsed.projectId.trim()) {
          return parsed.projectId.trim();
        }
      }
    } catch {
      // ignore missing/corrupt local config file
    }
  }
  return '';
}

export function createFirebaseTokenVerifier(projectId: string, useEmulator = false): TokenVerifier {
  if (useEmulator && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  }
  if (projectId && getAdminApps().length === 0) {
    initializeAdminApp({ projectId });
  }
  return async (token: string) => {
    if (!projectId) {
      throw new Error('Firebase is not configured (VITE_FIREBASE_PROJECT_ID is missing).');
    }
    const decoded = await getAdminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      email_verified: decoded.email_verified,
      firebase: decoded.firebase,
    };
  };
}

export function createHelmetMiddleware(isProduction: boolean) {
  return helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: isProduction
      ? {
          reportOnly: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://apis.google.com', 'https://www.gstatic.com'],
            connectSrc: [
              "'self'",
              'wss:',
              'https://*.googleapis.com',
              'https://*.firebaseio.com',
              'https://*.firebaseapp.com',
            ],
            frameSrc: [
              "'self'",
              'https://*.firebaseapp.com',
              'https://accounts.google.com',
              'https://www.youtube-nocookie.com',
              'https://www.youtube.com',
            ],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            mediaSrc: ["'self'", 'blob:', 'https:'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            workerSrc: ["'self'", 'blob:'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
  });
}

export function createOriginGuardMiddleware(extraAllowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isAllowedOrigin(req.get('origin'), req.get('host'), extraAllowedOrigins)) {
      res.status(403).json({
        error: 'Requests from other websites are not allowed.',
        code: 'origin_not_allowed',
      });
      return;
    }
    next();
  };
}

export function createAdminTokenGuardMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }
    const expected = process.env.ADMIN_TOKEN || '';
    const provided = req.get('x-admin-token') || '';
    const allowed =
      expected.length > 0 &&
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!allowed) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    next();
  };
}
