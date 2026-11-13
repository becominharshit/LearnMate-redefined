import 'dotenv/config';

// Ensure Google Gen AI Developer API key mode is used without enterprise/vertex conflicts from host OS
delete process.env.GOOGLE_GENAI_USE_ENTERPRISE;
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.GOOGLE_CLOUD_LOCATION;
process.env.GOOGLE_GENAI_USE_VERTEXAI = 'false';

import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  createHelmetMiddleware,
  createOriginGuardMiddleware,
  createAdminTokenGuardMiddleware,
  createFirebaseTokenVerifier,
  readFirebaseConfigProjectId,
  type StudentRequest,
} from './src/server/middleware/authAndSecurity.ts';
import {
  DistributedRateLimiterAndTokenBudget,
  createAuthAndQuotaMiddleware,
} from './src/server/middleware/rateLimiterAndQuotas.ts';
import { createAiTutorRouter } from './src/server/routes/aiTutorRoutes.ts';
import { createPyqAndCbtRouter } from './src/server/routes/pyqAndCbtRoutes.ts';
import { createStorageRouter } from './src/server/routes/storageRoutes.ts';
import { createCommercialAndScaleRouter } from './src/server/routes/commercialAndScaleRoutes.ts';
import { attachVoiceLiveWebSocketServer } from './src/server/ws/voiceLiveServer.ts';
import { registerCoreStudyRoutes } from './src/server/coreStudyEngine.ts';
import { getDurableStore } from './src/server/persistence/durableStore.ts';
import { getEntitlementService } from './src/server/services/entitlementService.ts';
import { getAiTelemetryService } from './src/server/services/aiTelemetryService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

const FIREBASE_PROJECT_ID = (
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  readFirebaseConfigProjectId(__dirname) ||
  ''
).trim();
const FIREBASE_USE_EMULATOR = process.env.VITE_FIREBASE_USE_EMULATOR === 'true';

const durableStore = getDurableStore();
const entitlementService = getEntitlementService();
const aiTelemetryService = getAiTelemetryService();

const verifyStudentIdToken = createFirebaseTokenVerifier(
  FIREBASE_PROJECT_ID,
  FIREBASE_USE_EMULATOR
);
const rateLimiter = new DistributedRateLimiterAndTokenBudget({
  dailyTokenCap: 50_000,
  maxRequestsPerMinute: 20,
  store: durableStore,
});

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

function getAnthropicApiKey(): string | null {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  return key || null;
}

async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  app.use(createHelmetMiddleware(isProduction));

  const extraAllowedOrigins = [
    process.env.APP_URL || '',
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ]
    .map((val) => val.trim())
    .filter((val) => /^https?:\/\//.test(val));

  app.use('/api', createOriginGuardMiddleware(extraAllowedOrigins));

  const jsonOptions = {
    limit: '2mb',
    verify: (req: express.Request & { rawBody?: string }, _res: express.Response, buf: Buffer) => {
      if (req.originalUrl?.includes('/api/commercial/webhook/')) {
        req.rawBody = buf.toString('utf8');
      }
    },
  };

  app.use(
    ['/api/study/scan-notes', '/api/study/transcribe-audio', '/api/create/video-lesson', '/api/tutor/ocr-doubt', '/api/storage'],
    express.json({ limit: '20mb' })
  );
  app.use(express.json(jsonOptions));

  // Modular Auth, IP Throttle, Sliding-Window Rate Limiter & Tier-Derived Daily AI Token Budget
  app.use(
    '/api',
    createAuthAndQuotaMiddleware({
      verifyStudentIdToken,
      rateLimiter,
      getTierLimitsForUser: (uid) => {
        const { tier } = entitlementService.getEffectiveTierSpec(uid);
        return { dailyTokenCap: tier.dailyTokenCap, maxRequestsPerMinute: tier.maxRequestsPerMinute };
      },
    })
  );

  app.use(['/api/usage', '/api/capabilities', '/api/vertex'], createAdminTokenGuardMiddleware({ verifyStudentIdToken }));

  app.get('/api/quota/status', (req, res) => {
    const uid = (req as StudentRequest).student?.uid || 'dev-student-local';
    const { tier } = entitlementService.getEffectiveTierSpec(uid);
    res.json(rateLimiter.getTokenBudgetStatus(uid, Date.now(), tier.dailyTokenCap, tier.maxRequestsPerMinute));
  });

  app.use('/api/tutor', createAiTutorRouter());
  app.use('/api/pyq', createPyqAndCbtRouter());
  app.use('/api/cbt', createPyqAndCbtRouter());
  app.use('/api/storage', createStorageRouter({ store: durableStore }));
  app.use(
    '/api',
    createCommercialAndScaleRouter({
      rateLimiter,
      store: durableStore,
      entitlementService,
      verifyStudentIdToken,
      getCostTelemetrySummary: () => aiTelemetryService.getAdminSummary(),
    })
  );

  registerCoreStudyRoutes(app);

  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        res.status(404).json({ error: `Endpoint ${req.path} not found` });
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  attachVoiceLiveWebSocketServer(httpServer, {
    verifyStudentIdToken,
    rateLimiter,
    getGenAIClient,
    getAnthropicApiKey,
    anthropicPreferred: () => false,
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    const durability = durableStore.isProductionDurable();
    console.log(`LearnMate modular server running on http://localhost:${PORT}`);
    if (isProduction && !durability.durable) {
      console.warn(`[DURABILITY WARNING] ${durability.reason} Commercial, storage, and quota endpoints will fail closed (503).`);
    }
  });
}

void startServer();
