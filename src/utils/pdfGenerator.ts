import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import type {
  FlashcardItem,
  MindMapData,
  OnePageRevisionSheet,
  PdfAnnotationColor,
  PdfAnnotationItem,
  StickyNoteItem,
  StudyDocument,
} from '../types/study';
import type { HandwrittenNoteDocument } from './phase6Engine';

/**
 * Normalizes mathematical and Greek Unicode symbols into clean WinAnsi-compatible
 * mathematical notation so StandardFonts in pdf-lib never fail on special characters
 * while preserving full mathematical clarity.
 */
export function normalizePdfText(input: string): string {
  if (!input) return '';

  // Strip raw LaTeX math delimiters and translate common LaTeX commands into readable ASCII math
  let out = input
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$1')
    .replace(
      /\\begin\{(pmatrix|bmatrix|vmatrix|matrix)\}([\s\S]*?)\\end\{\1\}/g,
      (_m, _env: string, body: string) => {
        const rows = body
          .trim()
          .split(/\\\\/)
          .map((r) =>
            r
              .trim()
              .split(/\s*&\s*/)
              .join(', ')
          )
          .filter(Boolean);
        return `[ ${rows.join(' ; ')} ]`;
      }
    )
    .replace(/\\ce\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:text|mathrm|mathbf|mathit|mathcal)\{([^{}]*)\}/g, '$1')
    .replace(/\\vec\{([^{}]*)\}/g, '$1')
    .replace(/\\hat\{([^{}]*)\}/g, '$1_hat')
    .replace(/\\overline\{([^{}]*)\}/g, '$1_bar')
    .replace(/\\(?:d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\(?:d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\[([^{}\]]*)\]\{([^{}]*)\}/g, 'root($1, $2)')
    .replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)')
    .replace(/\\times\b/g, 'x')
    .replace(/\\cdot\b/g, '*')
    .replace(/\\div\b/g, '/')
    .replace(/\\pm\b/g, '+/-')
    .replace(/\\mp\b/g, '-/+')
    .replace(/\\leq?\b/g, '<=')
    .replace(/\\geq?\b/g, '>=')
    .replace(/\\neq?\b/g, '!=')
    .replace(/\\approx\b/g, '~=')
    .replace(/\\equiv\b/g, '===')
    .replace(/\\propto\b/g, 'prop_to')
    .replace(/\\rightleftharpoons\b|\\leftrightarrow\b|\\Leftrightarrow\b/g, '<=>')
    .replace(/\\rightarrow\b|\\to\b/g, '->')
    .replace(/\\leftarrow\b/g, '<-')
    .replace(/\\Rightarrow\b/g, '=>')
    .replace(/\\Leftarrow\b/g, '<=')
    .replace(/\\infty\b/g, 'infinity')
    .replace(/\\partial\b/g, 'd')
    .replace(/\\nabla\b/g, 'grad')
    .replace(/\\perp\b/g, '_|_')
    .replace(/\\parallel\b/g, '||')
    .replace(/\\angle\b/g, 'angle ')
    .replace(/\\\^\{\\circ\}|\\circ\b/g, ' deg')
    .replace(/\\alpha\b/g, 'alpha')
    .replace(/\\beta\b/g, 'beta')
    .replace(/\\gamma\b/g, 'gamma')
    .replace(/\\delta\b/g, 'delta')
    .replace(/\\Delta\b/g, 'Delta')
    .replace(/\\epsilon\b|\\varepsilon\b/g, 'epsilon')
    .replace(/\\theta\b|\\vartheta\b/g, 'theta')
    .replace(/\\lambda\b/g, 'lambda')
    .replace(/\\Lambda\b/g, 'Lambda')
    .replace(/\\mu\b/g, 'mu')
    .replace(/\\nu\b/g, 'nu')
    .replace(/\\pi\b/g, 'pi')
    .replace(/\\Pi\b/g, 'Pi')
    .replace(/\\rho\b/g, 'rho')
    .replace(/\\sigma\b/g, 'sigma')
    .replace(/\\Sigma\b/g, 'Sigma')
    .replace(/\\tau\b/g, 'tau')
    .replace(/\\phi\b|\\varphi\b/g, 'phi')
    .replace(/\\Phi\b/g, 'Phi')
    .replace(/\\omega\b/g, 'omega')
    .replace(/\\Omega\b/g, 'Omega')
    .replace(/\\oint\b/g, 'ContourIntegral')
    .replace(/\\int\b/g, 'Integral')
    .replace(/\\sum\b/g, 'Sum')
    .replace(/\\prod\b/g, 'Prod')
    .replace(/\\lim\b/g, 'lim')
    .replace(/\\sin\b/g, 'sin')
    .replace(/\\cos\b/g, 'cos')
    .replace(/\\tan\b/g, 'tan')
    .replace(/\\ln\b/g, 'ln')
    .replace(/\\log\b/g, 'log')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\{([^{}]+)\}/g, '($1)');

  const map: Record<string, string> = {
    'Ω': 'Omega',
    'ω': 'omega',
    'Σ': 'Sum',
    '∑': 'Sum',
    'Π': 'Prod',
    '∏': 'Prod',
    'μ': 'mu',
    'σ': 'sigma',
    'λ': 'lambda',
    'Λ': 'Lambda',
    'α': 'alpha',
    'β': 'beta',
    'θ': 'theta',
    'Δ': 'Delta',
    'π': 'pi',
    'τ': 'tau',
    'ρ': 'rho',
    'ε': 'epsilon',
    '∞': 'infinity',
    '≥': '>=',
    '≤': '<=',
    '≠': '!=',
    '≈': '~=',
    '≡': '===',
    '⇔': '<=>',
    '⇒': '=>',
    '→': '->',
    '←': '<-',
    '↔': '<->',
    '►': '->',
    '─': '-',
    '∩': ' intersect ',
    '∪': ' union ',
    '⊂': ' subset ',
    '⊆': ' subset= ',
    '∈': ' in ',
    '∉': ' not-in ',
    '∅': '{}',
    '√': 'sqrt',
    '∫': 'Integral',
    '∂': 'd',
    '×': 'x',
    '·': '*',
    '÷': '/',
    '±': '+/-',
    '⁰': '^0',
    '¹': '^1',
    '²': '^2',
    '³': '^3',
    '⁴': '^4',
    '⁵': '^5',
    '⁶': '^6',
    '⁷': '^7',
    '⁸': '^8',
    '⁹': '^9',
    'ⁿ': '^n',
    'ᵀ': '^T',
    '⁺': '+',
    '⁻': '-',
    'ᶜ': '^c',
    '₀': '_0',
    '₁': '_1',
    '₂': '_2',
    '₃': '_3',
    '₄': '_4',
    '₅': '_5',
    'ᵢ': '_i',
    'ⱼ': '_j',
    'ₖ': '_k',
    'ₙ': '_n',
    'ₓ': '_x',
    '•': '-',
    '⚠': '[!]',
    '✓': '[OK]',
    '✔': '[OK]',
    '✗': '[X]',
    '“': '"',
    '”': '"',
    '‘': "'",
    '’': "'",
    '—': '--',
    '–': '-',
    '…': '...',
  };

  for (const [k, v] of Object.entries(map)) {
    out = out.split(k).join(v);
  }
  out = out.normalize('NFKD');
  for (const [k, v] of Object.entries(map)) {
    out = out.split(k).join(v);
  }
  // Remove combining marks or remaining non-WinAnsi characters outside printable ASCII/Latin-1
  out = out.replace(/[\u0300-\u036f]/g, '');
  out = out.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
  return out;
}

/**
 * Wraps text into lines that fit within `maxWidth` using the given PDFFont and size.
 */
export function wrapPdfTextLines(
  rawText: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const safeText = normalizePdfText(rawText);
  const paragraphs = safeText.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        // Handle single very long word
        if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            const nextChunk = chunk + ch;
            if (font.widthOfTextAtSize(nextChunk, fontSize) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk = nextChunk;
            }
          }
          currentLine = chunk;
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

export function buildRevisionPdfFilename(title: string, suffix = 'Revision_Notes'): string {
  const cleaned = title
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `LearnMate_${suffix}_${cleaned || 'Study_Material'}.pdf`;
}

export interface GenerateRevisionPdfInput {
  document: StudyDocument;
  onePageRevision?: OnePageRevisionSheet | null;
  stickyNotes?: StickyNoteItem[];
  flashcards?: FlashcardItem[];
  mindMap?: MindMapData | null;
}

/**
 * Generates a real, multi-page formatted PDF document (.pdf binary) for LearnMate Revision Notes.
 * Preserves headings, subheadings, bullet points, numbered lists, formulas & definitions tables,
 * highlighted sticky notes, and active-recall questions with clean pagination and margins.
 */
export async function generateRevisionNotesPdfBytes(
  input: GenerateRevisionPdfInput
): Promise<Uint8Array> {
  const { document: studyDoc, onePageRevision, stickyNotes = [], flashcards = [] } = input;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${studyDoc.title} — LearnMate Revision Notes`);
  pdfDoc.setAuthor('LearnMate AI Study Companion');
  pdfDoc.setSubject(`Revision Sheet & Study Notes for ${studyDoc.title}`);
  pdfDoc.setCreator('LearnMate PDF Engine');

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const PAGE_WIDTH = 595.28; // A4 width in pt
  const PAGE_HEIGHT = 841.89; // A4 height in pt
  const MARGIN_X = 46;
  const MARGIN_TOP = 50;
  const MARGIN_BOTTOM = 54;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

  const pages: PDFPage[] = [];
  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(currentPage);
  let cursorY = PAGE_HEIGHT - MARGIN_TOP;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < MARGIN_BOTTOM) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pages.push(currentPage);
      cursorY = PAGE_HEIGHT - MARGIN_TOP;
    }
  };

  // 1. Top Header Banner
  const bannerHeight = 68;
  currentPage.drawRectangle({
    x: MARGIN_X,
    y: cursorY - bannerHeight,
    width: CONTENT_WIDTH,
    height: bannerHeight,
    color: rgb(0.91, 0.95, 1.0),
    borderColor: rgb(0.26, 0.52, 0.96),
    borderWidth: 1.2,
  });

  currentPage.drawText('LEARNMATE STRUCTURED REVISION NOTES', {
    x: MARGIN_X + 16,
    y: cursorY - 22,
    size: 9,
    font: fontBold,
    color: rgb(0.1, 0.45, 0.91),
  });

  const mainTitle = normalizePdfText(
    onePageRevision?.chapterTitle || studyDoc.title
  ).slice(0, 75);
  currentPage.drawText(mainTitle, {
    x: MARGIN_X + 16,
    y: cursorY - 42,
    size: 15,
    font: fontBold,
    color: rgb(0.09, 0.13, 0.2),
  });

  const metaLine = normalizePdfText(
    `Source: ${studyDoc.title} (${studyDoc.pageCount} ${
      studyDoc.pageCount === 1 ? 'Page' : 'Pages'
    })  |  Generated: ${new Date().toLocaleDateString()}`
  );
  currentPage.drawText(metaLine, {
    x: MARGIN_X + 16,
    y: cursorY - 57,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.39, 0.45, 0.55),
  });

  cursorY -= bannerHeight + 18;

  // Helper to draw a section heading with colored accent bar
  const drawSectionHeading = (
    title: string,
    accentRgb: [number, number, number]
  ) => {
    ensureSpace(36);
    cursorY -= 6;
    currentPage.drawRectangle({
      x: MARGIN_X,
      y: cursorY - 16,
      width: 4,
      height: 18,
      color: rgb(accentRgb[0], accentRgb[1], accentRgb[2]),
    });
    currentPage.drawText(normalizePdfText(title.toUpperCase()), {
      x: MARGIN_X + 12,
      y: cursorY - 12,
      size: 11,
      font: fontBold,
      color: rgb(0.09, 0.13, 0.2),
    });
    cursorY -= 24;
  };

  // Helper to draw wrapped paragraph lines
  const drawWrappedText = (
    text: string,
    options: {
      font?: PDFFont;
      size?: number;
      indent?: number;
      colorRgb?: [number, number, number];
      lineGap?: number;
    } = {}
  ) => {
    const f = options.font || fontRegular;
    const sz = options.size || 10;
    const indent = options.indent || 0;
    const col = options.colorRgb || [0.2, 0.25, 0.33];
    const lineHeight = sz + (options.lineGap ?? 4.5);

    const lines = wrapPdfTextLines(text, f, sz, CONTENT_WIDTH - indent);
    for (const line of lines) {
      ensureSpace(lineHeight + 4);
      if (line) {
        currentPage.drawText(line, {
          x: MARGIN_X + indent,
          y: cursorY - sz,
          size: sz,
          font: f,
          color: rgb(col[0], col[1], col[2]),
        });
      }
      cursorY -= lineHeight;
    }
  };

  // 2. Executive Chapter Overview
  const overviewText =
    onePageRevision?.overview ||
    studyDoc.overview ||
    'Comprehensive revision summary grounded in your uploaded study material.';
  drawSectionHeading('1. Chapter Overview & Summary', [0.26, 0.52, 0.96]);
  drawWrappedText(overviewText, { size: 10, colorRgb: [0.18, 0.23, 0.31] });
  cursorY -= 10;

  // 3. Essential Concepts
  const concepts =
    onePageRevision?.essentialConcepts && onePageRevision.essentialConcepts.length > 0
      ? onePageRevision.essentialConcepts
      : studyDoc.topics.map((t) => ({
          title: t.name,
          summary: t.summary,
          sourceLabel: `Page ${t.sourcePages[0] || 1}`,
          sourcePage: t.sourcePages[0] || 1,
        }));

  if (concepts.length > 0) {
    drawSectionHeading('2. Essential Concepts & Core Takeaways', [0.26, 0.52, 0.96]);
    concepts.forEach((item, idx) => {
      const titleLine = `${idx + 1}. ${item.title} [${item.sourceLabel}]`;
      const summaryLines = wrapPdfTextLines(
        item.summary,
        fontRegular,
        9.5,
        CONTENT_WIDTH - 24
      );
      const boxHeight = 22 + summaryLines.length * 13.5 + 8;
      ensureSpace(boxHeight + 8);

      currentPage.drawRectangle({
        x: MARGIN_X,
        y: cursorY - boxHeight,
        width: CONTENT_WIDTH,
        height: boxHeight,
        color: rgb(0.97, 0.98, 1.0),
        borderColor: rgb(0.86, 0.9, 0.96),
        borderWidth: 0.8,
      });

      currentPage.drawText(normalizePdfText(titleLine), {
        x: MARGIN_X + 10,
        y: cursorY - 15,
        size: 10,
        font: fontBold,
        color: rgb(0.09, 0.13, 0.2),
      });

      let innerY = cursorY - 30;
      for (const line of summaryLines) {
        currentPage.drawText(line, {
          x: MARGIN_X + 14,
          y: innerY,
          size: 9.5,
          font: fontRegular,
          color: rgb(0.24, 0.3, 0.39),
        });
        innerY -= 13.5;
      }

      cursorY -= boxHeight + 7;
    });
    cursorY -= 6;
  }

  // 4. Key Formulas & Definitions (Table Layout)
  const formulas = onePageRevision?.formulasAndDefinitions || [];
  if (formulas.length > 0) {
    drawSectionHeading('3. Key Formulas, Theorems & Definitions', [0.2, 0.66, 0.33]);
    formulas.forEach((f) => {
      const termLines = wrapPdfTextLines(
        `${f.term} (${f.sourceLabel})`,
        fontBold,
        9.5,
        CONTENT_WIDTH * 0.36
      );
      const defLines = wrapPdfTextLines(
        f.formulaOrDef,
        fontMono,
        9,
        CONTENT_WIDTH * 0.58
      );
      const rowLines = Math.max(termLines.length, defLines.length);
      const rowHeight = Math.max(26, rowLines * 13 + 12);
      ensureSpace(rowHeight + 6);

      currentPage.drawRectangle({
        x: MARGIN_X,
        y: cursorY - rowHeight,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: rgb(0.95, 0.99, 0.96),
        borderColor: rgb(0.75, 0.91, 0.8),
        borderWidth: 0.8,
      });

      // Divider between term column and formula column
      const colSplitX = MARGIN_X + CONTENT_WIDTH * 0.39;
      currentPage.drawLine({
        start: { x: colSplitX, y: cursorY },
        end: { x: colSplitX, y: cursorY - rowHeight },
        thickness: 0.7,
        color: rgb(0.75, 0.91, 0.8),
      });

      termLines.forEach((tLine, i) => {
        currentPage.drawText(tLine, {
          x: MARGIN_X + 8,
          y: cursorY - 15 - i * 13,
          size: 9.5,
          font: fontBold,
          color: rgb(0.08, 0.45, 0.2),
        });
      });

      defLines.forEach((dLine, i) => {
        currentPage.drawText(dLine, {
          x: colSplitX + 10,
          y: cursorY - 15 - i * 13,
          size: 9,
          font: fontMono,
          color: rgb(0.1, 0.16, 0.24),
        });
      });

      cursorY -= rowHeight + 5;
    });
    cursorY -= 8;
  }

  // 5. Sticky Notes Highlights (if present)
  if (stickyNotes.length > 0) {
    drawSectionHeading('4. Highlighted Sticky Notes & Quick Takeaways', [0.96, 0.62, 0.04]);
    stickyNotes.forEach((note, idx) => {
      const header = `${idx + 1}. ${note.title} (${note.sourceLabel})`;
      drawWrappedText(header, {
        font: fontBold,
        size: 9.8,
        colorRgb: [0.55, 0.32, 0.02],
      });
      drawWrappedText(note.content, {
        font: fontRegular,
        size: 9.5,
        indent: 12,
        colorRgb: [0.2, 0.25, 0.33],
      });
      if (note.formula) {
        drawWrappedText(`Formula: ${note.formula}`, {
          font: fontMono,
          size: 9,
          indent: 12,
          colorRgb: [0.1, 0.35, 0.75],
        });
      }
      cursorY -= 5;
    });
    cursorY -= 6;
  }

  // 6. Concept Relationships & Common Mistakes to Avoid
  if (onePageRevision?.keyRelationships && onePageRevision.keyRelationships.length > 0) {
    drawSectionHeading('5. Key Concept Relationships', [0.98, 0.74, 0.02]);
    onePageRevision.keyRelationships.forEach((rel) => {
      drawWrappedText(`- ${rel}`, { size: 9.5, indent: 8 });
      cursorY -= 2;
    });
    cursorY -= 6;
  }

  if (
    onePageRevision?.commonMistakesToAvoid &&
    onePageRevision.commonMistakesToAvoid.length > 0
  ) {
    drawSectionHeading('6. Common Exam Pitfalls & Mistakes to Avoid', [0.92, 0.26, 0.21]);
    onePageRevision.commonMistakesToAvoid.forEach((mistake) => {
      drawWrappedText(`[!] ${mistake}`, {
        size: 9.5,
        indent: 8,
        colorRgb: [0.65, 0.12, 0.12],
      });
      cursorY -= 2;
    });
    cursorY -= 6;
  }

  // 7. Quick Recall Self-Check Questions & Active Recall Flashcards
  const recallQuestions = onePageRevision?.quickRecallQuestions || [];
  if (recallQuestions.length > 0) {
    drawSectionHeading('7. Quick Recall Self-Check Questions', [0.26, 0.52, 0.96]);
    recallQuestions.forEach((q, idx) => {
      drawWrappedText(`Q${idx + 1}: ${q.question}`, {
        font: fontBold,
        size: 9.5,
        colorRgb: [0.09, 0.13, 0.2],
      });
      drawWrappedText(`Answer: ${q.shortAnswer}`, {
        font: fontRegular,
        size: 9.5,
        indent: 12,
        colorRgb: [0.08, 0.45, 0.2],
      });
      cursorY -= 5;
    });
  } else if (flashcards.length > 0) {
    drawSectionHeading('7. Active-Recall Flashcards Summary', [0.26, 0.52, 0.96]);
    flashcards.slice(0, 8).forEach((card, idx) => {
      drawWrappedText(`Q${idx + 1} [${card.sourceLabel}]: ${card.frontQuestion}`, {
        font: fontBold,
        size: 9.5,
        colorRgb: [0.09, 0.13, 0.2],
      });
      drawWrappedText(`Answer: ${card.backAnswer}`, {
        font: fontRegular,
        size: 9.5,
        indent: 12,
        colorRgb: [0.08, 0.45, 0.2],
      });
      cursorY -= 5;
    });
  }

  // 8. Stamp page numbers and footer across all generated pages
  const totalPages = pages.length;
  pages.forEach((page, idx) => {
    page.drawLine({
      start: { x: MARGIN_X, y: 38 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: 38 },
      thickness: 0.6,
      color: rgb(0.85, 0.88, 0.93),
    });
    page.drawText(
      normalizePdfText(`LearnMate Revision Sheet • ${studyDoc.title}`),
      {
        x: MARGIN_X,
        y: 24,
        size: 8,
        font: fontRegular,
        color: rgb(0.45, 0.5, 0.58),
      }
    );
    const pageLabel = `Page ${idx + 1} of ${totalPages}`;
    const labelW = fontBold.widthOfTextAtSize(pageLabel, 8.5);
    page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN_X - labelW,
      y: 24,
      size: 8.5,
      font: fontBold,
      color: rgb(0.2, 0.25, 0.33),
    });
  });

  return pdfDoc.save();
}

function annotationColorToRgb(color: PdfAnnotationColor): [number, number, number] {
  switch (color) {
    case 'yellow':
      return [0.98, 0.82, 0.08];
    case 'green':
      return [0.2, 0.72, 0.36];
    case 'blue':
      return [0.26, 0.52, 0.96];
    case 'pink':
      return [0.93, 0.28, 0.6];
    case 'red':
      return [0.92, 0.26, 0.21];
    case 'navy':
    default:
      return [0.09, 0.13, 0.2];
  }
}

function decodeBase64DataUrl(dataUrl: string): Uint8Array | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Generates an actual PDF binary (.pdf) for a StudyDocument in PDF Workspace,
 * optionally flattening all student annotations (highlights, underlines, freehand pen,
 * shapes, and text notes) directly onto the PDF pages.
 */
export async function generateAnnotatedDocumentPdfBytes(
  studyDoc: StudyDocument,
  annotations: PdfAnnotationItem[] = [],
  includeAnnotations = true
): Promise<Uint8Array> {
  let pdfDoc: PDFDocument | null = null;

  if (studyDoc.pdfDataUrl) {
    const rawBytes = decodeBase64DataUrl(studyDoc.pdfDataUrl);
    if (rawBytes && rawBytes.length > 10) {
      try {
        pdfDoc = await PDFDocument.load(rawBytes);
      } catch {
        pdfDoc = null;
      }
    }
  }

  const isCreatedFromPages = !pdfDoc;
  if (!pdfDoc) {
    pdfDoc = await PDFDocument.create();
  }

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (isCreatedFromPages) {
    const PAGE_WIDTH = 595.28;
    const PAGE_HEIGHT = 841.89;
    const MARGIN_X = 48;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

    for (const p of studyDoc.pages) {
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let y = PAGE_HEIGHT - 52;

      page.drawRectangle({
        x: MARGIN_X,
        y: y - 40,
        width: CONTENT_WIDTH,
        height: 40,
        color: rgb(0.95, 0.97, 1.0),
        borderColor: rgb(0.82, 0.88, 0.96),
        borderWidth: 0.8,
      });

      page.drawText(
        normalizePdfText(`${studyDoc.title} — Page ${p.pageNumber} of ${studyDoc.pageCount}`),
        {
          x: MARGIN_X + 12,
          y: y - 16,
          size: 8.5,
          font: fontBold,
          color: rgb(0.1, 0.45, 0.91),
        }
      );

      page.drawText(normalizePdfText(p.title || `Section ${p.pageNumber}`), {
        x: MARGIN_X + 12,
        y: y - 32,
        size: 12,
        font: fontBold,
        color: rgb(0.09, 0.13, 0.2),
      });

      y -= 60;

      const contentLines = wrapPdfTextLines(p.content, fontRegular, 10.5, CONTENT_WIDTH);
      for (const line of contentLines) {
        if (y < 52) break;
        if (line) {
          const isHeading = /^[0-9]+\.\s+/.test(line) || /^[A-Z\s—–-]{8,}$/.test(line);
          page.drawText(line, {
            x: MARGIN_X,
            y,
            size: isHeading ? 11 : 10.5,
            font: isHeading ? fontBold : fontRegular,
            color: isHeading ? rgb(0.09, 0.13, 0.2) : rgb(0.2, 0.25, 0.33),
          });
        }
        y -= 15.5;
      }

      page.drawText(`Page ${p.pageNumber} of ${studyDoc.pageCount}`, {
        x: PAGE_WIDTH - MARGIN_X - 65,
        y: 26,
        size: 8.5,
        font: fontBold,
        color: rgb(0.45, 0.5, 0.58),
      });
    }
  }

  // Draw student annotations if requested
  if (includeAnnotations && annotations.length > 0) {
    const pdfPages = pdfDoc.getPages();
    for (const ann of annotations) {
      const pageIdx = Math.max(0, Math.min(pdfPages.length - 1, ann.pageNumber - 1));
      const page = pdfPages[pageIdx];
      if (!page) continue;

      const { width: pw, height: ph } = page.getSize();
      const [r, g, b] = annotationColorToRgb(ann.color);

      const x = ann.x * pw;
      const w = (ann.width || 0.22) * pw;
      const h = (ann.height || 0.04) * ph;
      // PDF coordinate origin is bottom-left; normalized y is top-down (0 = top, 1 = bottom)
      const yTop = ph - ann.y * ph;
      const yBottom = yTop - h;

      if (ann.tool === 'highlight') {
        page.drawRectangle({
          x,
          y: yBottom,
          width: Math.max(24, w),
          height: Math.max(12, h),
          color: rgb(r, g, b),
          opacity: 0.35,
        });
      } else if (ann.tool === 'underline') {
        page.drawLine({
          start: { x, y: yBottom },
          end: { x: x + Math.max(36, w), y: yBottom },
          thickness: 2,
          color: rgb(r, g, b),
        });
      } else if (ann.tool === 'rectangle') {
        page.drawRectangle({
          x,
          y: yBottom,
          width: Math.max(24, w),
          height: Math.max(18, h),
          borderColor: rgb(r, g, b),
          borderWidth: ann.strokeWidth || 2,
          opacity: 0.9,
        });
      } else if (ann.tool === 'circle') {
        page.drawEllipse({
          x: x + Math.max(16, w) / 2,
          y: yBottom + Math.max(16, h) / 2,
          xScale: Math.max(16, w) / 2,
          yScale: Math.max(16, h) / 2,
          borderColor: rgb(r, g, b),
          borderWidth: ann.strokeWidth || 2,
        });
      } else if (ann.tool === 'arrow') {
        const endX = x + w;
        const endY = yBottom;
        page.drawLine({
          start: { x, y: yTop },
          end: { x: endX, y: endY },
          thickness: ann.strokeWidth || 2.2,
          color: rgb(r, g, b),
        });
        page.drawCircle({
          x: endX,
          y: endY,
          size: 3.5,
          color: rgb(r, g, b),
        });
      } else if (ann.tool === 'pen' && ann.points && ann.points.length > 1) {
        for (let i = 0; i < ann.points.length - 1; i++) {
          const p1 = ann.points[i];
          const p2 = ann.points[i + 1];
          page.drawLine({
            start: { x: p1.x * pw, y: ph - p1.y * ph },
            end: { x: p2.x * pw, y: ph - p2.y * ph },
            thickness: ann.strokeWidth || 2.2,
            color: rgb(r, g, b),
          });
        }
      } else if (ann.tool === 'text_note' && ann.text) {
        const noteLines = wrapPdfTextLines(ann.text, fontRegular, 8.5, 155);
        const boxW = 168;
        const boxH = Math.max(28, noteLines.length * 11 + 14);
        const clampedX = Math.min(pw - boxW - 12, Math.max(12, x));
        const clampedY = Math.min(ph - boxH - 12, Math.max(12, yTop - boxH));

        page.drawRectangle({
          x: clampedX,
          y: clampedY,
          width: boxW,
          height: boxH,
          color: rgb(1, 0.98, 0.86),
          borderColor: rgb(r, g, b),
          borderWidth: 1.2,
        });

        noteLines.forEach((nl, idx) => {
          page.drawText(nl, {
            x: clampedX + 6,
            y: clampedY + boxH - 12 - idx * 11,
            size: 8.5,
            font: fontRegular,
            color: rgb(0.1, 0.14, 0.2),
          });
        });
      }
    }
  }

  return pdfDoc.save();
}

/**
 * Generates an AI-generated handwritten-style study notebook PDF (.pdf binary)
 * with ruled/grid/cornell paper background lines, margin callouts, boxed formulas,
 * and an explicit "AI-GENERATED HANDWRITTEN-STYLE STUDY NOTES" disclosure badge.
 */
export async function generateHandwrittenNotesPdfBytes(
  noteDoc: HandwrittenNoteDocument
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${noteDoc.title} — AI-Generated Handwritten-Style Study Notes`);
  pdfDoc.setAuthor('LearnMate JEE Study Companion');
  pdfDoc.setSubject(`AI-Generated Handwritten-Style Notes (${noteDoc.subject})`);

  const fontInk = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const fontHeading = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const fontFormula = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const fontBadge = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = noteDoc.notebookStyle === 'cornell' ? 140 : 68;
  const MARGIN_RIGHT = 42;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  const inkRgb: [number, number, number] =
    noteDoc.inkColor === 'emerald_notes'
      ? [0.06, 0.35, 0.22]
      : noteDoc.inkColor === 'navy_pen'
        ? [0.08, 0.16, 0.36]
        : [0.16, 0.14, 0.52];

  const drawNotebookSheetBackground = (page: PDFPage, pageNum: number, totalPages: number) => {
    // Warm cream notebook paper fill
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: rgb(0.995, 0.99, 0.968),
    });

    // Horizontal ruled or grid lines
    if (noteDoc.notebookStyle === 'ruled' || noteDoc.notebookStyle === 'cornell') {
      for (let y = 56; y < PAGE_HEIGHT - 84; y += 20) {
        page.drawLine({
          start: { x: 32, y },
          end: { x: PAGE_WIDTH - 32, y },
          thickness: 0.45,
          color: rgb(0.84, 0.89, 0.95),
        });
      }
    } else if (noteDoc.notebookStyle === 'grid') {
      for (let y = 56; y < PAGE_HEIGHT - 84; y += 18) {
        page.drawLine({
          start: { x: 32, y },
          end: { x: PAGE_WIDTH - 32, y },
          thickness: 0.35,
          color: rgb(0.87, 0.91, 0.95),
        });
      }
      for (let x = 32; x < PAGE_WIDTH - 32; x += 18) {
        page.drawLine({
          start: { x, y: 56 },
          end: { x, y: PAGE_HEIGHT - 84 },
          thickness: 0.35,
          color: rgb(0.87, 0.91, 0.95),
        });
      }
    }

    // Left vertical red/coral margin line
    page.drawLine({
      start: { x: MARGIN_LEFT - 12, y: 44 },
      end: { x: MARGIN_LEFT - 12, y: PAGE_HEIGHT - 44 },
      thickness: 1.1,
      color: rgb(0.91, 0.42, 0.45),
    });

    // Top Header Disclosure Banner
    page.drawText('AI-GENERATED HANDWRITTEN-STYLE STUDY NOTES • LEARNMATE JEE', {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 34,
      size: 8,
      font: fontBadge,
      color: rgb(0.32, 0.36, 0.48),
    });

    page.drawText(normalizePdfText(noteDoc.title).slice(0, 74), {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 52,
      size: 13.5,
      font: fontHeading,
      color: rgb(inkRgb[0], inkRgb[1], inkRgb[2]),
    });

    // Underline main title
    page.drawLine({
      start: { x: MARGIN_LEFT, y: PAGE_HEIGHT - 56 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: PAGE_HEIGHT - 56 },
      thickness: 1.2,
      color: rgb(inkRgb[0], inkRgb[1], inkRgb[2]),
    });

    // Footer
    page.drawText(
      normalizePdfText(
        `AI-Generated Handwritten-Style Notes • Source: ${noteDoc.documentTitle} • Page ${pageNum} of ${totalPages}`
      ),
      {
        x: MARGIN_LEFT,
        y: 26,
        size: 8,
        font: fontBadge,
        color: rgb(0.42, 0.46, 0.54),
      }
    );
  };

  const pdfPages: PDFPage[] = [];
  for (let pIdx = 0; pIdx < noteDoc.pages.length; pIdx++) {
    const hwPage = noteDoc.pages[pIdx];
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pdfPages.push(page);
    let cursorY = PAGE_HEIGHT - 82;

    const ensureSpace = (needed: number) => {
      if (cursorY - needed < 62) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pdfPages.push(page);
        cursorY = PAGE_HEIGHT - 82;
      }
    };

    for (const sec of hwPage.sections) {
      ensureSpace(64);
      // Section Heading + Source Badge
      const secHeader = normalizePdfText(`${sec.heading}  [${sec.sourceLabel}]`);
      page.drawText(secHeader.slice(0, 82), {
        x: MARGIN_LEFT,
        y: cursorY,
        size: 12,
        font: fontHeading,
        color: rgb(inkRgb[0], inkRgb[1], inkRgb[2]),
      });
      page.drawLine({
        start: { x: MARGIN_LEFT, y: cursorY - 3 },
        end: { x: MARGIN_LEFT + Math.min(CONTENT_WIDTH, secHeader.length * 5.8), y: cursorY - 3 },
        thickness: 0.9,
        color: rgb(0.88, 0.58, 0.08),
      });
      cursorY -= 20;

      // Cornell Margin Callout (if cornell style)
      if (noteDoc.notebookStyle === 'cornell' && sec.marginCallout) {
        const cueLines = wrapPdfTextLines(sec.marginCallout, fontHeading, 8.5, 86);
        cueLines.slice(0, 4).forEach((cl, cIdx) => {
          page.drawText(cl, {
            x: 36,
            y: cursorY + 12 - cIdx * 11,
            size: 8.5,
            font: fontHeading,
            color: rgb(0.68, 0.18, 0.24),
          });
        });
      }

      // Highlighted Key Terms Pill Strip
      if (sec.highlightedTerms.length > 0) {
        const termsLine = normalizePdfText(`Key Terms: ${sec.highlightedTerms.join('  •  ')}`);
        ensureSpace(22);
        page.drawRectangle({
          x: MARGIN_LEFT,
          y: cursorY - 4,
          width: Math.min(CONTENT_WIDTH, termsLine.length * 5.1 + 12),
          height: 15,
          color: rgb(0.99, 0.94, 0.62),
          opacity: 0.65,
        });
        page.drawText(termsLine.slice(0, 86), {
          x: MARGIN_LEFT + 5,
          y: cursorY,
          size: 9.5,
          font: fontHeading,
          color: rgb(0.24, 0.18, 0.04),
        });
        cursorY -= 20;
      }

      // Bullet Points
      for (const bullet of sec.bulletPoints) {
        const lines = wrapPdfTextLines(`• ${bullet}`, fontInk, 10.5, CONTENT_WIDTH - 8);
        for (const line of lines) {
          ensureSpace(18);
          page.drawText(line, {
            x: MARGIN_LEFT + 4,
            y: cursorY,
            size: 10.5,
            font: fontInk,
            color: rgb(inkRgb[0], inkRgb[1], inkRgb[2]),
          });
          cursorY -= 17;
        }
      }

      // Boxed Formulas
      if (sec.formulas.length > 0) {
        for (const f of sec.formulas) {
          const fText = normalizePdfText(`${f.label}:  ${f.latex}`);
          const fLines = wrapPdfTextLines(fText, fontFormula, 9.5, CONTENT_WIDTH - 24);
          const boxH = fLines.length * 14 + 12;
          ensureSpace(boxH + 8);
          page.drawRectangle({
            x: MARGIN_LEFT + 6,
            y: cursorY - boxH + 10,
            width: CONTENT_WIDTH - 12,
            height: boxH,
            color: rgb(0.95, 0.97, 1.0),
            borderColor: rgb(0.25, 0.38, 0.82),
            borderWidth: 1,
          });
          fLines.forEach((fl, flIdx) => {
            page.drawText(fl, {
              x: MARGIN_LEFT + 14,
              y: cursorY - 2 - flIdx * 14,
              size: 9.5,
              font: fontFormula,
              color: rgb(0.08, 0.16, 0.42),
            });
          });
          cursorY -= boxH + 8;
        }
      }

      // Exam Trap Warning
      if (sec.examTrapWarning) {
        const trapLines = wrapPdfTextLines(
          `[JEE Exam Caution] ${sec.examTrapWarning}`,
          fontHeading,
          9.5,
          CONTENT_WIDTH - 16
        );
        for (const tl of trapLines) {
          ensureSpace(16);
          page.drawText(tl, {
            x: MARGIN_LEFT + 6,
            y: cursorY,
            size: 9.5,
            font: fontHeading,
            color: rgb(0.72, 0.14, 0.18),
          });
          cursorY -= 15;
        }
      }

      cursorY -= 12;
    }
  }

  // Draw backgrounds/headers/footers on all pages (since we draw text over background, let's stamp header/footer lines)
  const allPages = pdfDoc.getPages();
  allPages.forEach((p, idx) => {
    p.drawText('AI-GENERATED HANDWRITTEN-STYLE STUDY NOTES • LEARNMATE JEE', {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 34,
      size: 8,
      font: fontBadge,
      color: rgb(0.32, 0.36, 0.48),
    });
    p.drawText(normalizePdfText(noteDoc.title).slice(0, 74), {
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - 52,
      size: 13.5,
      font: fontHeading,
      color: rgb(inkRgb[0], inkRgb[1], inkRgb[2]),
    });
    p.drawLine({
      start: { x: MARGIN_LEFT - 12, y: 44 },
      end: { x: MARGIN_LEFT - 12, y: PAGE_HEIGHT - 44 },
      thickness: 1,
      color: rgb(0.91, 0.42, 0.45),
    });
    p.drawText(
      normalizePdfText(
        `AI-Generated Handwritten-Style Notes • Source: ${noteDoc.documentTitle} • Page ${idx + 1} of ${allPages.length}`
      ),
      {
        x: MARGIN_LEFT,
        y: 26,
        size: 8,
        font: fontBadge,
        color: rgb(0.42, 0.46, 0.54),
      }
    );
  });
  void drawNotebookSheetBackground;

  return pdfDoc.save();
}

/**
 * Generates an accessible PDF summary report of a student's exported academic data
 * (Section 10 Student Data Control).
 */
export async function generateStudentDataExportPdfBytes(archive: {
  exportedAt: string;
  studentProfile: {
    fullName: string;
    schoolClass?: string;
    targetExam?: string;
    preferredLanguage?: string;
    weakAreas?: string[];
  };
  documents: Array<{ id: string; title: string; sourceType: string; pageCount: number }>;
  quizAttempts: Array<{ documentTitle: string; mode: string; score: number; totalQuestions: number; percentage: number; completedAt: string }>;
  handwrittenNotesCount?: number;
  creativeAssetsCount?: number;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('LearnMate JEE — Student Academic Data Export Summary');
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]);
  let y = 785;

  page.drawText('LEARNMATE JEE — STUDENT DATA EXPORT SUMMARY', {
    x: 48,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.25, 0.65),
  });
  y -= 22;

  page.drawText(normalizePdfText(`Exported At: ${archive.exportedAt}`), {
    x: 48,
    y,
    size: 9.5,
    font: fontRegular,
    color: rgb(0.35, 0.4, 0.48),
  });
  y -= 28;

  const profileLines = [
    `Student Name: ${archive.studentProfile.fullName || 'Not set'}`,
    `Class / Stage: ${archive.studentProfile.schoolClass || 'Not set'}`,
    `Target Exam: ${archive.studentProfile.targetExam || 'jee_main'}`,
    `Preferred Language: ${archive.studentProfile.preferredLanguage || 'English'}`,
    `Tracked Weak Areas: ${(archive.studentProfile.weakAreas || []).join(', ') || 'None recorded'}`,
    `Uploaded Study Materials: ${archive.documents.length}`,
    `Completed Practice & Mock Attempts: ${archive.quizAttempts.length}`,
    `Saved Handwritten Note Packs: ${archive.handwrittenNotesCount ?? 0}`,
    `Saved Creative Visual Assets: ${archive.creativeAssetsCount ?? 0}`,
  ];

  for (const line of profileLines) {
    page.drawText(normalizePdfText(line).slice(0, 95), {
      x: 48,
      y,
      size: 10.5,
      font: fontRegular,
      color: rgb(0.12, 0.16, 0.24),
    });
    y -= 18;
  }

  y -= 14;
  page.drawText('STUDY MATERIALS IN ARCHIVE:', {
    x: 48,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.25, 0.65),
  });
  y -= 18;

  for (const docItem of archive.documents.slice(0, 15)) {
    if (y < 70) break;
    page.drawText(
      normalizePdfText(`• ${docItem.title} (${docItem.sourceType}, ${docItem.pageCount} pages)`).slice(0, 92),
      {
        x: 56,
        y,
        size: 9.5,
        font: fontRegular,
        color: rgb(0.2, 0.24, 0.32),
      }
    );
    y -= 15;
  }

  return pdfDoc.save();
}

/**
 * Triggers a browser download of a real PDF Uint8Array with `application/pdf` MIME type.
 */
export function triggerPdfDownload(pdfBytes: Uint8Array, filename: string): void {
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
