import * as pdfjsLib from 'pdfjs-dist';
import type { StudyPage } from '../types/study';
import { MAX_PDF_PAGES, MAX_PDF_SIZE_BYTES } from './quizGrading';

// Configure PDF.js worker using Vite's asset URL import
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedPdfResult {
  pageCount: number;
  pages: StudyPage[];
  pdfDataUrl: string;
}

export type PdfPageOcrHandler = (
  imageDataUrl: string,
  pageNumber: number
) => Promise<{ title?: string; content?: string } | null>;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read PDF file.'));
    reader.readAsDataURL(file);
  });
}

/** Renders a PDF.js page object onto an offscreen canvas to produce an image data URL for OCR. */
async function renderPageToImageDataUrl(page: pdfjsLib.PDFPageProxy): Promise<string> {
  if (typeof document === 'undefined') return '';
  try {
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(1600, Math.round(viewport.width));
    canvas.height = Math.min(2200, Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return '';
  }
}

/**
 * Extracts page-indexed text from an uploaded PDF file using PDF.js.
 * If a page contains sparse/scanned text (handwritten notes), it automatically
 * renders the page to canvas and runs the provided ocrHandler.
 */
export async function extractPagesFromPdf(
  file: File,
  ocrHandler?: PdfPageOcrHandler
): Promise<ExtractedPdfResult> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please select a valid PDF file (.pdf).');
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error('PDF file exceeds the 20 MB size limit.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;

  if (pdfDoc.numPages < 1) {
    throw new Error('The uploaded PDF has no readable pages.');
  }

  if (pdfDoc.numPages > MAX_PDF_PAGES) {
    throw new Error(
      `This PDF has ${pdfDoc.numPages} pages. Please upload a PDF with up to ${MAX_PDF_PAGES} pages.`
    );
  }

  const pages: StudyPage[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if ('str' in item) {
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = item.str;
        } else {
          currentLine += (currentLine && !currentLine.endsWith(' ') ? ' ' : '') + item.str;
        }
        if (y !== null) lastY = y;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    let pageText = lines.join('\n').trim();
    let firstNonEmpty = lines.find((l) => l.length > 3) || `Page ${pageNum}`;
    let cleanTitle =
      firstNonEmpty.length <= 68 ? firstNonEmpty : `${firstNonEmpty.slice(0, 65)}...`;

    // If digital text is missing or sparse (< 40 characters), this is likely a scanned/handwritten page
    if (pageText.length < 40 && ocrHandler) {
      const pageImage = await renderPageToImageDataUrl(page);
      if (pageImage) {
        try {
          const ocrResult = await ocrHandler(pageImage, pageNum);
          if (ocrResult?.content && ocrResult.content.trim()) {
            pageText = ocrResult.content.trim();
            if (ocrResult.title && ocrResult.title.trim()) {
              cleanTitle = ocrResult.title.trim().slice(0, 68);
            }
          }
        } catch (err) {
          console.warn(`[PDF OCR] Page ${pageNum} OCR transcription failed:`, err);
        }
      }
    }

    pages.push({
      pageNumber: pageNum,
      title: cleanTitle,
      content: pageText || `[Page ${pageNum} contains visual diagrams or handwritten notes]`,
    });
  }

  const totalExtractedChars = pages.reduce((sum, p) => sum + p.content.length, 0);
  if (totalExtractedChars < 20) {
    throw new Error(
      'Could not extract readable text from this PDF. Please ensure handwritten pages are clearly photographed or legible.'
    );
  }

  // Always keep base64 PDF data URL so the authentic PDF can be rendered in PDF View & Annotate Studio
  let pdfDataUrl = '';
  try {
    pdfDataUrl = await readFileAsDataUrl(file);
  } catch {
    // Non-fatal if data URL conversion fails
  }

  return {
    pageCount: pdfDoc.numPages,
    pages,
    pdfDataUrl,
  };
}

/**
 * Renders a specific 1-indexed page from a PDF data URL onto a target HTMLCanvasElement.
 */
export async function renderPdfPageToCanvas(
  pdfDataUrl: string,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.25
): Promise<void> {
  const base64Index = pdfDataUrl.indexOf('base64,');
  const base64 = base64Index >= 0 ? pdfDataUrl.slice(base64Index + 7) : pdfDataUrl;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdfDoc = await loadingTask.promise;
  const clampedPage = Math.max(1, Math.min(pageNumber, pdfDoc.numPages));
  const page = await pdfDoc.getPage(clampedPage);
  const viewport = page.getViewport({ scale });

  const context = canvas.getContext('2d');
  if (!context) return;

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;
}
