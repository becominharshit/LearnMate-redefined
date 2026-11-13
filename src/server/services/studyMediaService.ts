import type { AnimatedExplanationScene } from '../../utils/educationalSpecsEngine.ts';
import { DurableCollectionStore, getDurableStore } from '../persistence/durableStore.ts';

export interface PersistentVideoGenerationJob {
  jobId: string;
  ownerUid: string;
  topic: string;
  mode: 'text_to_video' | 'image_to_video';
  aspectRatio: '16:9' | '9:16';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  verificationStatus?:
    | 'WORKING_VERIFIED'
    | 'BLOCKED_BY_BILLING'
    | 'WORKING_WITH_NON_AI_FALLBACK';
  fallbackMode?: 'none' | 'animated_explanation';
  userFacingNotice?: string;
  scenes?: AnimatedExplanationScene[];
  createdAt: string;
  updatedAt: string;
}

const VIDEO_JOBS_COLLECTION = 'study_video_jobs';

export class StudyMediaService {
  private readonly store: DurableCollectionStore;

  constructor(store?: DurableCollectionStore) {
    this.store = store || getDurableStore();
  }

  public saveVideoJob(job: PersistentVideoGenerationJob): PersistentVideoGenerationJob {
    this.store.set(VIDEO_JOBS_COLLECTION, job.jobId, job);
    return job;
  }

  public listVideoJobsForOwner(ownerUid: string): PersistentVideoGenerationJob[] {
    return this.store
      .list<PersistentVideoGenerationJob>(VIDEO_JOBS_COLLECTION)
      .filter((job) => job.ownerUid === ownerUid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getVideoJobForOwner(
    jobId: string,
    requesterUid: string
  ):
    | { ok: true; job: PersistentVideoGenerationJob }
    | { ok: false; status: 403 | 404; error: string } {
    const job = this.store.get<PersistentVideoGenerationJob>(VIDEO_JOBS_COLLECTION, jobId);
    if (!job) {
      return { ok: false, status: 404, error: 'Video job not found.' };
    }
    if (job.ownerUid !== requesterUid) {
      return {
        ok: false,
        status: 403,
        error: 'Access denied: you do not own this video job.',
      };
    }
    return { ok: true, job };
  }

  public cancelVideoJobForOwner(
    jobId: string,
    requesterUid: string
  ):
    | { ok: true; job: PersistentVideoGenerationJob }
    | { ok: false; status: 403 | 404; error: string } {
    const lookup = this.getVideoJobForOwner(jobId, requesterUid);
    if (!lookup.ok) return lookup;
    const updated: PersistentVideoGenerationJob = {
      ...lookup.job,
      status: 'cancelled',
      userFacingNotice: 'Video lesson job cancelled by owner.',
      updatedAt: new Date().toISOString(),
    };
    this.store.set(VIDEO_JOBS_COLLECTION, jobId, updated);
    return { ok: true, job: updated };
  }
}

export function validateOcrImageInput(
  imageBase64OrDataUrl: string,
  maxBytes = 10 * 1024 * 1024
): { valid: boolean; mimeType?: string; byteLength?: number; error?: string } {
  const raw = String(imageBase64OrDataUrl || '').trim();
  if (!raw) {
    return { valid: false, error: 'Image payload is required for OCR scanning.' };
  }
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(raw);
  const mimeType = match ? match[1].toLowerCase() : 'image/jpeg';
  const base64Body = match ? match[2] : raw;
  const approxBytes = Math.floor((base64Body.length * 3) / 4);
  if (approxBytes === 0) {
    return { valid: false, error: 'Empty image buffer provided.' };
  }
  if (approxBytes > maxBytes) {
    return {
      valid: false,
      error: `Image payload exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
    };
  }
  return { valid: true, mimeType, byteLength: approxBytes };
}

export function validateAudioTranscriptionInput(
  audioBase64: string,
  maxBytes = 12 * 1024 * 1024
): { valid: boolean; byteLength?: number; error?: string } {
  const raw = String(audioBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
  if (!raw) {
    return { valid: false, error: 'Audio payload is required for transcription.' };
  }
  const approxBytes = Math.floor((raw.length * 3) / 4);
  if (approxBytes > maxBytes) {
    return {
      valid: false,
      error: `Audio recording exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit.`,
    };
  }
  return { valid: true, byteLength: approxBytes };
}

let defaultMediaService: StudyMediaService | null = null;

export function getStudyMediaService(): StudyMediaService {
  if (!defaultMediaService) {
    defaultMediaService = new StudyMediaService();
  }
  return defaultMediaService;
}
