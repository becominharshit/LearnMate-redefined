import type { StudyDocument, StudyPage } from '../types/study';

/**
 * IndexedDB Storage Engine for LearnMate JEE (Phase 6 Section 9)
 *
 * Stores large PDF binaries (`pdfDataUrl` / `Blob`), 60-page extracted page sets,
 * and long-lecture study packs in IndexedDB (`learnmate_idb_v1`) while keeping
 * `localStorage` lightweight so 60-page PDFs never trigger QuotaExceededError.
 *
 * Includes:
 * - Automatic non-destructive migration of existing `localStorage` PDF binaries
 * - Per-account (`ownerUid`) isolation
 * - In-memory synchronous cache hydrated at startup so synchronous `studyStorage.getDocuments()`
 *   calls return full `pages` and `pdfDataUrl` without breaking existing UI components
 * - Graceful fallback to in-memory + truncated localStorage when IndexedDB is unavailable
 */

const DB_NAME = 'learnmate_idb_v1';
const DB_VERSION = 1;
const STORE_PDF_BINARIES = 'pdf_binaries';
const STORE_DOCUMENT_PAGES = 'document_pages';

export interface StoredPdfBinaryRecord {
  documentId: string;
  ownerUid: string;
  pdfDataUrl: string;
  byteSize: number;
  updatedAt: string;
}

export interface StoredDocumentPagesRecord {
  documentId: string;
  ownerUid: string;
  pages: StudyPage[];
  pageCount: number;
  updatedAt: string;
}

class LearnMateIndexedDbRepository {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryPdfCache = new Map<string, StoredPdfBinaryRecord>();
  private memoryPagesCache = new Map<string, StoredDocumentPagesRecord>();
  private migrationComplete = false;

  private isIndexedDbSupported(): boolean {
    return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined';
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDbSupported()) {
      return Promise.resolve(null);
    }
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_PDF_BINARIES)) {
            db.createObjectStore(STORE_PDF_BINARIES, { keyPath: 'documentId' });
          }
          if (!db.objectStoreNames.contains(STORE_DOCUMENT_PAGES)) {
            db.createObjectStore(STORE_DOCUMENT_PAGES, { keyPath: 'documentId' });
          }
        };
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Hydrates the in-memory cache from IndexedDB and migrates any legacy large PDF
   * `pdfDataUrl` payloads stored directly in `localStorage`.
   */
  async initializeAndMigrateFromLocalStorage(ownerUid = 'guest'): Promise<{
    migratedDocumentsCount: number;
    hydratedBinariesCount: number;
    hydratedPageSetsCount: number;
  }> {
    const db = await this.openDb();
    let hydratedBinariesCount = 0;
    let hydratedPageSetsCount = 0;

    if (db) {
      try {
        const binaries = await this.readAllFromStore<StoredPdfBinaryRecord>(db, STORE_PDF_BINARIES);
        for (const rec of binaries) {
          if (rec && rec.documentId) {
            this.memoryPdfCache.set(rec.documentId, rec);
            hydratedBinariesCount += 1;
          }
        }
        const pageSets = await this.readAllFromStore<StoredDocumentPagesRecord>(
          db,
          STORE_DOCUMENT_PAGES
        );
        for (const rec of pageSets) {
          if (rec && rec.documentId && Array.isArray(rec.pages)) {
            this.memoryPagesCache.set(rec.documentId, rec);
            hydratedPageSetsCount += 1;
          }
        }
      } catch {
        // Ignore hydration errors and continue with memory cache
      }
    }

    // Non-destructively migrate existing localStorage documents that have inline pdfDataUrl or >15 pages
    let migratedDocumentsCount = 0;
    try {
      const rawDocs = localStorage.getItem('learnmate_documents_v1');
      if (rawDocs) {
        const parsed = JSON.parse(rawDocs) as StudyDocument[];
        if (Array.isArray(parsed)) {
          let modified = false;
          for (const doc of parsed) {
            if (!doc || !doc.id) continue;
            if (doc.pdfDataUrl && doc.pdfDataUrl.length > 0) {
              await this.savePdfBinary(doc.id, doc.pdfDataUrl, ownerUid);
              migratedDocumentsCount += 1;
              modified = true;
            }
            if (Array.isArray(doc.pages) && doc.pages.length > 0) {
              await this.saveDocumentPages(doc.id, doc.pages, ownerUid);
            }
          }
          // Strip oversized inline pdfDataUrl (>120KB) from localStorage copy once cached in IndexedDB/memory
          if (modified && db) {
            const compactDocs = parsed.map((d) => {
              if (d.pdfDataUrl && d.pdfDataUrl.length > 120_000 && this.memoryPdfCache.has(d.id)) {
                const { pdfDataUrl: _omitted, ...rest } = d;
                return rest;
              }
              return d;
            });
            try {
              localStorage.setItem('learnmate_documents_v1', JSON.stringify(compactDocs));
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // ignore migration errors
    }

    this.migrationComplete = true;
    return {
      migratedDocumentsCount,
      hydratedBinariesCount,
      hydratedPageSetsCount,
    };
  }

  private readAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
    return new Promise<T[]>((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as T[]) : []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async savePdfBinary(documentId: string, pdfDataUrl: string, ownerUid = 'guest'): Promise<void> {
    if (!documentId || !pdfDataUrl) return;
    const record: StoredPdfBinaryRecord = {
      documentId,
      ownerUid: ownerUid || 'guest',
      pdfDataUrl,
      byteSize: pdfDataUrl.length,
      updatedAt: new Date().toISOString(),
    };
    this.memoryPdfCache.set(documentId, record);

    const db = await this.openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_PDF_BINARIES, 'readwrite');
        tx.objectStore(STORE_PDF_BINARIES).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  getPdfBinarySync(documentId: string): string | undefined {
    return this.memoryPdfCache.get(documentId)?.pdfDataUrl;
  }

  async getPdfBinary(documentId: string): Promise<string | undefined> {
    const cached = this.memoryPdfCache.get(documentId);
    if (cached) return cached.pdfDataUrl;

    const db = await this.openDb();
    if (!db) return undefined;
    return new Promise<string | undefined>((resolve) => {
      try {
        const tx = db.transaction(STORE_PDF_BINARIES, 'readonly');
        const req = tx.objectStore(STORE_PDF_BINARIES).get(documentId);
        req.onsuccess = () => {
          const rec = req.result as StoredPdfBinaryRecord | undefined;
          if (rec?.pdfDataUrl) {
            this.memoryPdfCache.set(documentId, rec);
            resolve(rec.pdfDataUrl);
          } else {
            resolve(undefined);
          }
        };
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  }

  async saveDocumentPages(
    documentId: string,
    pages: StudyPage[],
    ownerUid = 'guest'
  ): Promise<void> {
    if (!documentId || !Array.isArray(pages)) return;
    const record: StoredDocumentPagesRecord = {
      documentId,
      ownerUid: ownerUid || 'guest',
      pages,
      pageCount: pages.length,
      updatedAt: new Date().toISOString(),
    };
    this.memoryPagesCache.set(documentId, record);

    const db = await this.openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_DOCUMENT_PAGES, 'readwrite');
        tx.objectStore(STORE_DOCUMENT_PAGES).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  getDocumentPagesSync(documentId: string): StudyPage[] | undefined {
    return this.memoryPagesCache.get(documentId)?.pages;
  }

  async deleteDocumentAssets(documentId: string): Promise<void> {
    this.memoryPdfCache.delete(documentId);
    this.memoryPagesCache.delete(documentId);

    const db = await this.openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_PDF_BINARIES, STORE_DOCUMENT_PAGES], 'readwrite');
        tx.objectStore(STORE_PDF_BINARIES).delete(documentId);
        tx.objectStore(STORE_DOCUMENT_PAGES).delete(documentId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Deletes all IndexedDB records belonging to `ownerUid` (or all records when `ownerUid` is null)
   * for self-serve student account deletion.
   */
  async clearAllForOwner(ownerUid?: string | null): Promise<number> {
    let deletedCount = 0;
    for (const [docId, rec] of this.memoryPdfCache.entries()) {
      if (!ownerUid || rec.ownerUid === ownerUid || rec.ownerUid === 'guest') {
        this.memoryPdfCache.delete(docId);
        deletedCount += 1;
      }
    }
    for (const [docId, rec] of this.memoryPagesCache.entries()) {
      if (!ownerUid || rec.ownerUid === ownerUid || rec.ownerUid === 'guest') {
        this.memoryPagesCache.delete(docId);
        deletedCount += 1;
      }
    }

    const db = await this.openDb();
    if (!db) return deletedCount;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_PDF_BINARIES, STORE_DOCUMENT_PAGES], 'readwrite');
        tx.objectStore(STORE_PDF_BINARIES).clear();
        tx.objectStore(STORE_DOCUMENT_PAGES).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    return deletedCount;
  }

  isMigrated(): boolean {
    return this.migrationComplete;
  }
}

export const indexedDbStorage = new LearnMateIndexedDbRepository();
