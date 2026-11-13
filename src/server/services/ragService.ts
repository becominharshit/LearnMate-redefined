import crypto from 'crypto';
import type { StudyPage } from '../../types/study.ts';
import {
  indexDocumentChunksForRag,
  retrieveTopRagChunks,
  type RagDocumentChunk,
  type RagRetrievalResult,
} from '../../utils/commercialScaleEngine.ts';
import { DurableCollectionStore, getDurableStore } from '../persistence/durableStore.ts';

export interface TenantRagDocumentRecord {
  scopedKey: string;
  ownerUid: string;
  documentId: string;
  docVersion: string;
  contentHash: string;
  chunks: RagDocumentChunk[];
  updatedAt: string;
}

export interface CitationValidationOutcome {
  totalCited: number;
  validCitedPages: number[];
  invalidCitedPages: number[];
  allCitationsValid: boolean;
}

const RAG_COLLECTION = 'tenant_rag_indexes';

export class TenantRagService {
  private readonly store: DurableCollectionStore;

  constructor(store?: DurableCollectionStore) {
    this.store = store || getDurableStore();
  }

  private buildKey(ownerUid: string, documentId: string): string {
    return `${ownerUid}::${documentId}`;
  }

  public indexStudentDocument(params: {
    ownerUid: string;
    documentId: string;
    pages: StudyPage[];
    docVersion?: string;
  }): { deduplicated: boolean; record: TenantRagDocumentRecord } {
    const key = this.buildKey(params.ownerUid, params.documentId);
    const contentHash = crypto
      .createHash('sha256')
      .update(
        (params.pages || [])
          .map((p) => `${p.pageNumber}:${p.title || ''}:${p.content || ''}`)
          .join('\n')
      )
      .digest('hex');

    const existing = this.store.get<TenantRagDocumentRecord>(RAG_COLLECTION, key);
    if (existing && existing.contentHash === contentHash) {
      return { deduplicated: true, record: existing };
    }

    const chunks = indexDocumentChunksForRag(params.documentId, params.pages);
    const record: TenantRagDocumentRecord = {
      scopedKey: key,
      ownerUid: params.ownerUid,
      documentId: params.documentId,
      docVersion: params.docVersion || 'v1',
      contentHash,
      chunks,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(RAG_COLLECTION, key, record);
    return { deduplicated: false, record };
  }

  public retrieveForStudent(params: {
    ownerUid: string;
    documentId: string;
    pages?: StudyPage[];
    query: string;
    topK?: number;
  }): RagRetrievalResult & { ownerUid: string } {
    const key = this.buildKey(params.ownerUid, params.documentId);
    const existing = this.store.get<TenantRagDocumentRecord>(RAG_COLLECTION, key);

    // Ensure strict cross-tenant isolation: never read another uid's indexed pages
    const sourcePages: StudyPage[] =
      Array.isArray(params.pages) && params.pages.length > 0
        ? params.pages
        : existing && existing.ownerUid === params.ownerUid
        ? existing.chunks.map((c) => ({
            pageNumber: c.pageNumber,
            title: c.sectionTitle,
            content: c.content,
          }))
        : [];

    if (Array.isArray(params.pages) && params.pages.length > 0) {
      this.indexStudentDocument({
        ownerUid: params.ownerUid,
        documentId: params.documentId,
        pages: params.pages,
      });
    }

    const result = retrieveTopRagChunks({
      documentId: params.documentId,
      pages: sourcePages,
      query: params.query,
      topK: params.topK ?? 5,
    });

    return {
      ...result,
      ownerUid: params.ownerUid,
    };
  }

  public getIndexedDocumentForOwner(
    ownerUid: string,
    documentId: string
  ): TenantRagDocumentRecord | null {
    const key = this.buildKey(ownerUid, documentId);
    const record = this.store.get<TenantRagDocumentRecord>(RAG_COLLECTION, key);
    if (!record || record.ownerUid !== ownerUid) return null;
    return record;
  }

  public deleteAllForOwner(ownerUid: string): number {
    return this.store.deleteWhere<TenantRagDocumentRecord>(
      RAG_COLLECTION,
      (_key, rec) => rec?.ownerUid === ownerUid
    );
  }
}

export function validateRagCitations(
  citedPages: number[],
  validPageNumbers: number[]
): CitationValidationOutcome {
  const validSet = new Set(validPageNumbers);
  const uniqueCited = Array.from(new Set(citedPages.map(Number).filter(Number.isFinite)));
  const validCitedPages = uniqueCited.filter((p) => validSet.has(p));
  const invalidCitedPages = uniqueCited.filter((p) => !validSet.has(p));
  return {
    totalCited: uniqueCited.length,
    validCitedPages,
    invalidCitedPages,
    allCitationsValid: invalidCitedPages.length === 0,
  };
}

let defaultRagService: TenantRagService | null = null;

export function getTenantRagService(): TenantRagService {
  if (!defaultRagService) {
    defaultRagService = new TenantRagService();
  }
  return defaultRagService;
}
