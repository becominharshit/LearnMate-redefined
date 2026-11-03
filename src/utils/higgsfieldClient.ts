/**
 * Minimal server-side client for the Higgsfield generation API (https://docs.higgsfield.ai):
 * submit a job, poll its status, and upload local images for use as video inputs.
 */
import { randomUUID } from 'node:crypto';

export const HIGGSFIELD_BASE_URL = 'https://api.higgsfield.ai';

export type HiggsfieldStatusValue =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'nsfw'
  | 'canceled';

export interface HiggsfieldSubmitResponse {
  request_id: string;
  status: string;
  status_url?: string;
  cancel_url?: string;
}

export interface HiggsfieldStatusResponse {
  status: HiggsfieldStatusValue;
  images?: Array<{ url: string }>;
  video?: { url: string };
  error?: string | null;
}

export class HiggsfieldApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'HiggsfieldApiError';
    this.status = status;
  }
}

/**
 * Higgsfield authenticates with `Authorization: Key <KEY_ID>:<KEY_SECRET>` (not Bearer).
 * The console usually hands out the combined "id:secret" string; a separate secret is also accepted.
 */
export function buildHiggsfieldAuthHeader(key: string, secret?: string): string {
  const trimmedKey = key.trim();
  const credential =
    secret && secret.trim() && !trimmedKey.includes(':') ? `${trimmedKey}:${secret.trim()}` : trimmedKey;
  return `Key ${credential}`;
}

export function isHiggsfieldTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'nsfw' || status === 'canceled';
}

async function readJsonBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { raw: text };
  }
}

function describeHiggsfieldError(body: Record<string, unknown>, status: number): string {
  const detail = body.detail ?? body.error ?? body.message ?? body.raw;
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail ?? body);
  return `Higgsfield API error ${status}: ${String(text).slice(0, 300)}`;
}

function baseUrlOf(baseUrl?: string): string {
  return (baseUrl || HIGGSFIELD_BASE_URL).replace(/\/+$/, '');
}

export async function submitHiggsfieldJob(opts: {
  authHeader: string;
  endpoint: string;
  input: Record<string, unknown>;
  baseUrl?: string;
  idempotencyKey?: string;
}): Promise<HiggsfieldSubmitResponse> {
  const res = await fetch(`${baseUrlOf(opts.baseUrl)}/${opts.endpoint.replace(/^\/+/, '')}`, {
    method: 'POST',
    headers: {
      Authorization: opts.authHeader,
      'Content-Type': 'application/json',
      // Retrying with the same key never creates a second paid job.
      'Idempotency-Key': opts.idempotencyKey || randomUUID(),
    },
    body: JSON.stringify(opts.input),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await readJsonBody(res);
  if (!res.ok) throw new HiggsfieldApiError(describeHiggsfieldError(body, res.status), res.status);
  if (typeof body.request_id !== 'string' || !body.request_id) {
    throw new HiggsfieldApiError('Higgsfield did not return a request id.');
  }
  return body as unknown as HiggsfieldSubmitResponse;
}

export async function getHiggsfieldStatus(opts: {
  authHeader: string;
  requestId: string;
  statusUrl?: string;
  baseUrl?: string;
}): Promise<HiggsfieldStatusResponse> {
  const url =
    opts.statusUrl ||
    `${baseUrlOf(opts.baseUrl)}/requests/${encodeURIComponent(opts.requestId)}/status`;
  const res = await fetch(url, {
    headers: { Authorization: opts.authHeader },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJsonBody(res);
  if (!res.ok) throw new HiggsfieldApiError(describeHiggsfieldError(body, res.status), res.status);
  return body as unknown as HiggsfieldStatusResponse;
}

/** Polls with backoff (2 s growing to 10 s) until the job finishes, fails, or the timeout passes. */
export async function waitForHiggsfieldResult(opts: {
  authHeader: string;
  requestId: string;
  statusUrl?: string;
  baseUrl?: string;
  timeoutMs: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<HiggsfieldStatusResponse> {
  const sleep = opts.sleep || ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = Date.now() + opts.timeoutMs;
  let delay = 2000;

  while (Date.now() < deadline) {
    await sleep(Math.min(delay, Math.max(0, deadline - Date.now())));
    delay = Math.min(Math.round(delay * 1.5), 10_000);

    let status: HiggsfieldStatusResponse;
    try {
      status = await getHiggsfieldStatus(opts);
    } catch (err) {
      const code = err instanceof HiggsfieldApiError ? err.status : undefined;
      if (code === 401 || code === 403 || code === 404) throw err;
      continue; // 5xx or network hiccup: keep polling
    }

    if (!isHiggsfieldTerminalStatus(status.status)) continue;
    if (status.status === 'completed') return status;
    if (status.status === 'nsfw') {
      throw new HiggsfieldApiError('The request was blocked by the content filter. Try rephrasing it.');
    }
    throw new HiggsfieldApiError(
      `Generation ${status.status}${status.error ? `: ${status.error}` : ''}`
    );
  }
  throw new HiggsfieldApiError(
    `HIGGSFIELD_TIMEOUT: generation is taking longer than expected (request ${opts.requestId}).`
  );
}

/** Uploads a base64 data-URL image and returns the public URL Higgsfield models accept as input. */
export async function uploadDataUrlToHiggsfield(opts: {
  authHeader: string;
  dataUrl: string;
  baseUrl?: string;
}): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(opts.dataUrl);
  if (!match) throw new HiggsfieldApiError('The image must be a base64 data URL.');
  const contentType = match[1];
  const bytes = Buffer.from(match[2], 'base64');

  const res = await fetch(`${baseUrlOf(opts.baseUrl)}/files/generate-upload-url`, {
    method: 'POST',
    headers: { Authorization: opts.authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: contentType }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await readJsonBody(res);
  if (!res.ok) throw new HiggsfieldApiError(describeHiggsfieldError(body, res.status), res.status);

  const uploadUrl = typeof body.upload_url === 'string' ? body.upload_url : '';
  const publicUrl = typeof body.public_url === 'string' ? body.public_url : '';
  const uploadHeaders =
    body.upload_headers && typeof body.upload_headers === 'object'
      ? (body.upload_headers as Record<string, string>)
      : {};
  if (!uploadUrl || !publicUrl) {
    throw new HiggsfieldApiError('Higgsfield did not return an upload URL.');
  }

  // The pre-signed upload URL must not receive the API key.
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, ...uploadHeaders },
    body: bytes,
    signal: AbortSignal.timeout(60_000),
  });
  if (!put.ok) throw new HiggsfieldApiError(`Image upload failed (HTTP ${put.status}).`, put.status);
  return publicUrl;
}
