import crypto from 'crypto';
import type { LongLectureProcessingJob } from '../../utils/phase6Engine.ts';
import {
  MAX_YOUTUBE_LECTURE_DURATION_SECONDS,
  validateAndNormalizeYouTubeLectureUrl,
} from '../../utils/phase6Engine.ts';
import { DurableCollectionStore, getDurableStore } from '../persistence/durableStore.ts';

export interface OwnerScopedYoutubeJob extends LongLectureProcessingJob {
  ownerUid: string;
}

const YOUTUBE_JOBS_COLLECTION = 'youtube_lecture_jobs';

export class YoutubeLectureJobStore {
  private readonly store: DurableCollectionStore;

  constructor(store?: DurableCollectionStore) {
    this.store = store || getDurableStore();
  }

  public findActiveJobForOwner(ownerUid: string, videoId: string): OwnerScopedYoutubeJob | null {
    for (const job of this.store.list<OwnerScopedYoutubeJob>(YOUTUBE_JOBS_COLLECTION)) {
      if (
        job.ownerUid === ownerUid &&
        job.videoId === videoId &&
        !['COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED_BY_CONTENT_ACCESS'].includes(job.status)
      ) {
        return job;
      }
    }
    return null;
  }

  public createJob(
    ownerUid: string,
    videoId: string,
    canonicalUrl: string,
    title: string
  ): OwnerScopedYoutubeJob {
    const now = new Date().toISOString();
    const job: OwnerScopedYoutubeJob = {
      jobId: `yt-job-${videoId}-${crypto.randomUUID().slice(0, 8)}`,
      ownerUid,
      videoId,
      canonicalUrl,
      title,
      durationSeconds: 0,
      status: 'FETCHING_METADATA',
      progressPercent: 10,
      totalChunks: 0,
      completedChunks: 0,
      chunks: [],
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(YOUTUBE_JOBS_COLLECTION, job.jobId, job);
    return job;
  }

  public saveJob(job: OwnerScopedYoutubeJob): OwnerScopedYoutubeJob {
    job.updatedAt = new Date().toISOString();
    this.store.set(YOUTUBE_JOBS_COLLECTION, job.jobId, job);
    return job;
  }

  public getJobForOwner(
    jobId: string,
    requesterUid: string
  ):
    | { ok: true; job: OwnerScopedYoutubeJob }
    | { ok: false; status: 403 | 404; error: string } {
    const job = this.store.get<OwnerScopedYoutubeJob>(YOUTUBE_JOBS_COLLECTION, jobId);
    if (!job) {
      return { ok: false, status: 404, error: 'Lecture processing job not found.' };
    }
    if (job.ownerUid !== requesterUid) {
      return {
        ok: false,
        status: 403,
        error: 'Access denied: you do not own this YouTube lecture job.',
      };
    }
    return { ok: true, job };
  }
}

export function validateYoutubeDurationWithin12Hours(durationSeconds: number): {
  allowed: boolean;
  error?: string;
} {
  if (durationSeconds > MAX_YOUTUBE_LECTURE_DURATION_SECONDS) {
    return {
      allowed: false,
      error: `This lecture is ${(durationSeconds / 3600).toFixed(1)} hours long, exceeding the 12-hour (720-minute) maximum limit.`,
    };
  }
  return { allowed: true };
}

export { validateAndNormalizeYouTubeLectureUrl, MAX_YOUTUBE_LECTURE_DURATION_SECONDS };

let defaultYoutubeJobStore: YoutubeLectureJobStore | null = null;

export function getYoutubeLectureJobStore(): YoutubeLectureJobStore {
  if (!defaultYoutubeJobStore) {
    defaultYoutubeJobStore = new YoutubeLectureJobStore();
  }
  return defaultYoutubeJobStore;
}
