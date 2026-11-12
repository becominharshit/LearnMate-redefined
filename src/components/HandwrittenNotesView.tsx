import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Bookmark,
  Camera,
  CheckCircle2,
  Download,
  FileText,
  Layers,
  Loader2,
  PenTool,
  Sparkles,
  Trash2,
  Upload,
  Video,
  AlertTriangle,
} from 'lucide-react';
import type { OnePageRevisionSheet, StudyDocument, StudyPage, ThemeMode } from '../types/study';
import { studyStorage } from '../services/storageService';
import { aiStudyClient } from '../services/aiClient';
import { extractPagesFromPdf } from '../utils/pdfExtractor';
import {
  buildHandwrittenNotesDocument,
  type HandwrittenInkColor,
  type HandwrittenNoteDensity,
  type HandwrittenNoteDocument,
  type HandwrittenNotebookStyle,
  type HandwrittenWorkflowSource,
} from '../utils/phase6Engine';
import {
  generateHandwrittenNotesPdfBytes,
  triggerPdfDownload,
} from '../utils/pdfGenerator';
import { MathText } from './MathText';
import { DiagramRenderer } from './DiagramRenderer';

export type HandwritingFontFamily =
  | 'kalam'
  | 'caveat'
  | 'patrick'
  | 'indie'
  | 'shadows';

const HANDWRITING_FONTS: Array<{
  id: HandwritingFontFamily;
  label: string;
  cssClass: string;
}> = [
  { id: 'kalam', label: 'Kalam (Natural Indian Student Pen)', cssClass: 'font-handwriting-kalam' },
  { id: 'caveat', label: 'Caveat (Neat Cursive Exam Script)', cssClass: 'font-handwriting-caveat' },
  { id: 'patrick', label: 'Patrick Hand (Clean Block Print)', cssClass: 'font-handwriting-patrick' },
  { id: 'indie', label: 'Indie Flower (Rounded Study Notes)', cssClass: 'font-handwriting-indie' },
  { id: 'shadows', label: 'Shadows Into Light (Fine Gel Pen)', cssClass: 'font-handwriting-shadows' },
];

interface HandwrittenNotesViewProps {
  document?: StudyDocument;
  activeDocument?: StudyDocument;
  onePageRevision?: OnePageRevisionSheet | null;
  initialWorkflow?: HandwrittenWorkflowSource;
  initialNoteDoc?: HandwrittenNoteDocument | null;
  themeMode?: ThemeMode;
  onNavigateToPage?: (pageNumber: number) => void;
  onNavigateToCitation?: (pageNumber: number, excerpt?: string) => void;
}

export const HandwrittenNotesView: React.FC<HandwrittenNotesViewProps> = ({
  document: docProp,
  activeDocument,
  onePageRevision,
  initialWorkflow,
  initialNoteDoc,
  themeMode = 'light',
  onNavigateToPage: onNavigateToPageProp,
  onNavigateToCitation,
}) => {
  const [localScannedDoc, setLocalScannedDoc] = useState<StudyDocument | null>(null);
  const studyDoc = (localScannedDoc || docProp || activeDocument) as StudyDocument;
  const onNavigateToPage =
    onNavigateToPageProp ||
    (onNavigateToCitation ? (pageNum: number) => onNavigateToCitation(pageNum) : undefined);
  const isDark = themeMode === 'dark';

  const defaultWorkflow: HandwrittenWorkflowSource =
    initialWorkflow ||
    (studyDoc.sourceType === 'youtube'
      ? 'youtube_lecture'
      : onePageRevision
        ? 'revision_sheet'
        : 'study_material');

  const [workflowSource, setWorkflowSource] = useState<HandwrittenWorkflowSource>(defaultWorkflow);
  const [notebookStyle, setNotebookStyle] = useState<HandwrittenNotebookStyle>('ruled');
  const [density, setDensity] = useState<HandwrittenNoteDensity>('full');
  const [inkColor, setInkColor] = useState<HandwrittenInkColor>('indigo_ink');
  const [handwritingFont, setHandwritingFont] = useState<HandwritingFontFamily>('kalam');
  const [selectedTopic, setSelectedTopic] = useState<string>(
    studyDoc.topics[0]?.name || studyDoc.title
  );
  const [pageRangeStart, setPageRangeStart] = useState<number>(1);
  const [pageRangeEnd, setPageRangeEnd] = useState<number>(Math.min(12, studyDoc.pageCount));

  // Direct OCR Upload (Handwritten Photo / Scanned PDF -> Digital KaTeX + Handwritten Notebook)
  const [isScanningUpload, setIsScanningUpload] = useState(false);
  const [scannedDigitalPreview, setScannedDigitalPreview] = useState<string | null>(null);
  const ocrInputRef = useRef<HTMLInputElement | null>(null);

  const [savedNotes, setSavedNotes] = useState<HandwrittenNoteDocument[]>(() =>
    studyStorage.getHandwrittenNotes(studyDoc.id)
  );
  const [activeNoteDoc, setActiveNoteDoc] = useState<HandwrittenNoteDocument>(() => {
    if (initialNoteDoc) return initialNoteDoc;
    const existing = studyStorage.getHandwrittenNotes(studyDoc.id);
    if (existing.length > 0 && !initialWorkflow) return existing[0];
    return buildHandwrittenNotesDocument({
      document: studyDoc,
      workflowSource: defaultWorkflow,
      onePageRevision,
      notebookStyle: 'ruled',
      density: 'full',
      inkColor: 'indigo_ink',
    });
  });

  const [activeNotebookPageIndex, setActiveNotebookPageIndex] = useState<number>(0);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialNoteDoc) {
      setActiveNoteDoc(initialNoteDoc);
      setWorkflowSource(initialNoteDoc.workflowSource);
      setNotebookStyle(initialNoteDoc.notebookStyle);
      setDensity(initialNoteDoc.density);
      setInkColor(initialNoteDoc.inkColor);
      setActiveNotebookPageIndex(0);
    }
  }, [initialNoteDoc]);

  useEffect(() => {
    setSavedNotes(studyStorage.getHandwrittenNotes(studyDoc.id));
    setPageRangeStart(1);
    setPageRangeEnd(Math.min(12, studyDoc.pageCount));
    setSelectedTopic(studyDoc.topics[0]?.name || studyDoc.title);
  }, [studyDoc.id, studyDoc.pageCount, studyDoc.title, studyDoc.topics]);

  const handleGenerateNotes = (
    overrideWorkflow?: HandwrittenWorkflowSource,
    overrideDoc?: StudyDocument
  ) => {
    const targetDoc = overrideDoc || studyDoc;
    const targetWorkflow = overrideWorkflow || workflowSource;
    const startP = Math.max(1, Math.min(targetDoc.pageCount, pageRangeStart));
    const endP = Math.max(startP, Math.min(targetDoc.pageCount, pageRangeEnd));
    const selectedPageNumbers: number[] = [];
    for (let p = startP; p <= endP; p++) {
      selectedPageNumbers.push(p);
    }

    const generated = buildHandwrittenNotesDocument({
      document: targetDoc,
      workflowSource: targetWorkflow,
      onePageRevision,
      selectedPageNumbers,
      selectedTopic,
      notebookStyle,
      density,
      inkColor,
    });
    setActiveNoteDoc(generated);
    setActiveNotebookPageIndex(0);
    setToastMessage('Generated handwritten-style notebook pages with KaTeX math & bold/italic highlights!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleScanHandwrittenFile = async (file: File) => {
    setIsScanningUpload(true);
    setToastMessage(null);
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const extracted = await extractPagesFromPdf(file, async (pageImageDataUrl, pageNum) => {
          try {
            const res = await aiStudyClient.scanNotes({
              imageDataUrl: pageImageDataUrl,
              title: `${file.name.replace(/\.pdf$/i, '')} — Page ${pageNum}`,
            });
            return {
              title: res.title,
              content: res.cleanContent,
            };
          } catch {
            return null;
          }
        });
        const cleanTitle = file.name.replace(/\.pdf$/i, '');
        const doc: StudyDocument = {
          id: `doc-hw-pdf-${Date.now()}`,
          title: cleanTitle,
          sourceType: 'pdf',
          pageCount: extracted.pageCount,
          pages: extracted.pages,
          pdfDataUrl: extracted.pdfDataUrl,
          createdAt: new Date().toISOString(),
          lastStudiedAt: new Date().toISOString(),
          topics: [{ id: 't-1', name: cleanTitle, summary: cleanTitle, keyConcepts: [cleanTitle], sourcePages: [1] }],
          overview: `Scanned handwritten PDF (${extracted.pageCount} pages).`,
        };
        studyStorage.saveDocument(doc);
        setLocalScannedDoc(doc);
        setScannedDigitalPreview(
          extracted.pages
            .slice(0, 3)
            .map((p: StudyPage) => `### **${p.title || `Page ${p.pageNumber}`}**\n${p.content}`)
            .join('\n\n')
        );
        handleGenerateNotes('study_material', doc);
      } else if (file.type.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(file);
        });
        const cleanTitle =
          file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() ||
          'Scanned Handwritten Notes';
        const ocr = await aiStudyClient.scanNotes({
          imageDataUrl: dataUrl,
          title: cleanTitle,
        });
        const pages: StudyPage[] = [
          {
            pageNumber: 1,
            title: ocr.title || cleanTitle,
            content: ocr.cleanContent || ocr.summary || cleanTitle,
          },
        ];
        const doc: StudyDocument = {
          id: `doc-hw-img-${Date.now()}`,
          title: ocr.title || cleanTitle,
          sourceType: 'scanned_notes',
          scannedImageDataUrl: dataUrl,
          pageCount: 1,
          pages,
          createdAt: new Date().toISOString(),
          lastStudiedAt: new Date().toISOString(),
          topics: (ocr.keyConcepts || [cleanTitle]).slice(0, 4).map((c, idx) => ({
            id: `t-hw-${idx}`,
            name: c,
            summary: c,
            keyConcepts: [c],
            sourcePages: [1],
          })),
          overview: ocr.summary || cleanTitle,
        };
        studyStorage.saveDocument(doc);
        setLocalScannedDoc(doc);
        setScannedDigitalPreview(
          doc.pages
            .map((p: StudyPage) => `### **${p.title || `Section ${p.pageNumber}`}**\n${p.content}`)
            .join('\n\n')
        );
        handleGenerateNotes('study_material', doc);
      }
    } catch (err) {
      setToastMessage(
        err instanceof Error
          ? err.message
          : 'Could not extract handwritten material. Please try another photo or PDF.'
      );
    } finally {
      setIsScanningUpload(false);
    }
  };

  const handleSaveToLibrary = () => {
    studyStorage.saveHandwrittenNote(activeNoteDoc);
    setSavedNotes(studyStorage.getHandwrittenNotes(studyDoc.id));
    setToastMessage(`Saved "${activeNoteDoc.title}" to your Handwritten Notes Library!`);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const pdfBytes = await generateHandwrittenNotesPdfBytes(activeNoteDoc);
      const safeTitle = activeNoteDoc.title
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48);
      triggerPdfDownload(pdfBytes, `LearnMate_Handwritten_Notes_${safeTitle || 'Study_Pack'}.pdf`);
      setToastMessage('Exported Handwritten-Style Notes PDF!');
      setTimeout(() => setToastMessage(null), 3200);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const [sheetSurfaceMode, setSheetSurfaceMode] = useState<'warm_paper' | 'night_slate'>('warm_paper');
  const useDarkSheet = isDark && sheetSurfaceMode === 'night_slate';

  const currentNotebookPage =
    activeNoteDoc.pages[
      Math.min(activeNotebookPageIndex, Math.max(0, activeNoteDoc.pages.length - 1))
    ] || activeNoteDoc.pages[0];

  const activeFontClass =
    HANDWRITING_FONTS.find((f) => f.id === handwritingFont)?.cssClass ||
    'font-handwriting-kalam';

  const inkTextClass = useDarkSheet
    ? inkColor === 'emerald_notes'
      ? 'text-emerald-200'
      : inkColor === 'navy_pen'
        ? 'text-slate-100'
        : 'text-indigo-100'
    : inkColor === 'emerald_notes'
      ? 'text-[#064E3B]'
      : inkColor === 'navy_pen'
        ? 'text-[#0F172A]'
        : 'text-[#1E1B4B]';

  const paperBackgroundStyle =
    notebookStyle === 'ruled' || notebookStyle === 'cornell'
      ? useDarkSheet
        ? 'bg-[linear-gradient(to_bottom,transparent_31px,rgba(99,102,241,0.16)_32px)] bg-[size:100%_32px] bg-[#121A2E]'
        : 'bg-[linear-gradient(to_bottom,transparent_31px,rgba(59,130,246,0.18)_32px)] bg-[size:100%_32px] bg-[#FEFDF8] keep-white'
      : notebookStyle === 'grid'
        ? useDarkSheet
          ? 'bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:24px_24px] bg-[#121A2E]'
          : 'bg-[linear-gradient(to_right,rgba(59,130,246,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,0.12)_1px,transparent_1px)] bg-[size:24px_24px] bg-[#FEFDF8] keep-white'
        : useDarkSheet
          ? 'bg-[#121A2E]'
          : 'bg-[#FEFDF8] keep-white';

  return (
    <div data-testid="handwritten-notes-view" className="space-y-6">
      {/* Top Disclosure & Dual Workflow Controls */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="handwritten-disclosure-badge"
                className="px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] font-bold uppercase tracking-wider"
              >
                AI Handwritten Notes &amp; OCR Studio
              </span>
              <span className="text-xs text-muted dark:text-slate-400">
                5 Realistic Handwriting Fonts · KaTeX Math · Bold/Italic Highlights · Scan Photo/PDF
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-ink dark:text-slate-100 flex items-center gap-2">
              <PenTool className="w-5 h-5 text-brand dark:text-indigo-400" />
              <span>Handwritten Notebook &amp; OCR Studio</span>
            </h2>
            <p className="text-xs text-muted dark:text-slate-400">
              Upload any handwritten photo or PDF to extract KaTeX digital notes, or convert your Sticky Notes, Revision Sheets, and Lectures into realistic student handwriting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={ocrInputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleScanHandwrittenFile(file);
                }
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={isScanningUpload}
              data-testid="upload-handwritten-ocr-btn"
              onClick={() => ocrInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-brand/40 bg-brand-soft/60 hover:bg-brand hover:text-white text-xs font-bold text-brand transition-colors cursor-pointer disabled:opacity-60"
            >
              {isScanningUpload ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning Handwritten Material…</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan Handwritten Photo / PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="save-handwritten-note-btn"
              onClick={handleSaveToLibrary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-ink dark:text-slate-100 cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 text-brand dark:text-indigo-400" />
              <span>Save to Library</span>
            </button>

            <button
              type="button"
              data-testid="export-handwritten-pdf-btn"
              disabled={isExportingPdf}
              onClick={() => void handleExportPdf()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Exporting PDF...' : 'Export Handwritten PDF'}</span>
            </button>
          </div>
        </div>

        {/* Extracted Digital KaTeX Preview when a student scans a handwritten photo/PDF */}
        {scannedDigitalPreview && (
          <div
            data-testid="scanned-handwritten-digital-preview"
            className="p-4 rounded-2xl border border-brand-200 bg-brand-soft/30 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Extracted Digital Notes from Uploaded Handwritten Material (KaTeX + Highlights)</span>
              </span>
              <button
                type="button"
                onClick={() => setScannedDigitalPreview(null)}
                className="text-xs font-semibold text-muted hover:text-ink cursor-pointer"
              >
                Hide Digital Preview
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-line text-xs sm:text-sm text-ink max-h-56 overflow-y-auto leading-relaxed">
              <MathText text={scannedDigitalPreview} />
            </div>
          </div>
        )}

        {/* 3 Supported Workflows Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Workflow A */}
          <button
            type="button"
            data-testid="hw-workflow-youtube"
            onClick={() => {
              setWorkflowSource('youtube_lecture');
              handleGenerateNotes('youtube_lecture');
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              workflowSource === 'youtube_lecture'
                ? 'border-brand bg-brand-soft/50 dark:bg-indigo-950/60'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-brand/40'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-ink dark:text-slate-100">
              <Video className="w-4 h-4 text-rose-500" />
              <span>Workflow A: Lecture to Handwritten</span>
            </div>
            <p className="text-[11px] text-muted dark:text-slate-400 mt-1">
              Timestamped lecture sections, derivations &amp; boxed KaTeX equations.
            </p>
          </button>

          {/* Workflow B */}
          <button
            type="button"
            data-testid="hw-workflow-revision-sheet"
            onClick={() => {
              setWorkflowSource('revision_sheet');
              handleGenerateNotes('revision_sheet');
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              workflowSource === 'revision_sheet'
                ? 'border-brand bg-brand-soft/50 dark:bg-indigo-950/60'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-brand/40'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-ink dark:text-slate-100">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Workflow B: Revision &amp; Sticky Notes to Handwritten</span>
            </div>
            <p className="text-[11px] text-muted dark:text-slate-400 mt-1">
              One-click conversion from your Quick Revision Sheet &amp; Sticky Notes.
            </p>
          </button>

          {/* Workflow C */}
          <button
            type="button"
            data-testid="hw-workflow-study-material"
            onClick={() => {
              setWorkflowSource('study_material');
              handleGenerateNotes('study_material');
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              workflowSource === 'study_material'
                ? 'border-brand bg-brand-soft/50 dark:bg-indigo-950/60'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-brand/40'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-ink dark:text-slate-100">
              <FileText className="w-4 h-4 text-brand dark:text-indigo-400" />
              <span>Workflow C: PDF / Scanned Material to Handwritten</span>
            </div>
            <p className="text-[11px] text-muted dark:text-slate-400 mt-1">
              Select page range (up to 60 pages), topic, and concise vs. full depth.
            </p>
          </button>
        </div>

        {/* Customization Controls Bar (Including 5 Handwriting Fonts) */}
        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted dark:text-slate-400 mb-1">
              Handwriting Font Style
            </label>
            <select
              aria-label="Handwriting font style"
              data-testid="hw-font-style-select"
              value={handwritingFont}
              onChange={(e) => setHandwritingFont(e.target.value as HandwritingFontFamily)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100"
            >
              {HANDWRITING_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted dark:text-slate-400 mb-1">
              Paper Style
            </label>
            <select
              aria-label="Handwritten notebook paper style"
              data-testid="hw-paper-style-select"
              value={notebookStyle}
              onChange={(e) => setNotebookStyle(e.target.value as HandwrittenNotebookStyle)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100"
            >
              <option value="ruled">Ruled Notebook Lines</option>
              <option value="cornell">Cornell Margin Cue Sheet</option>
              <option value="grid">Engineering Graph Grid</option>
              <option value="plain">Plain Exam Sheet</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted dark:text-slate-400 mb-1">
              Note Density
            </label>
            <select
              aria-label="Handwritten note density"
              data-testid="hw-density-select"
              value={density}
              onChange={(e) => setDensity(e.target.value as HandwrittenNoteDensity)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100"
            >
              <option value="full">Full Detailed Notes</option>
              <option value="concise">Concise Quick-Recall Notes</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted dark:text-slate-400 mb-1">
              Pen Ink
            </label>
            <select
              aria-label="Handwritten pen ink color"
              value={inkColor}
              onChange={(e) => setInkColor(e.target.value as HandwrittenInkColor)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100"
            >
              <option value="indigo_ink">Royal Indigo Fountain Ink</option>
              <option value="navy_pen">Dark Navy Ballpoint</option>
              <option value="emerald_notes">Emerald Revision Ink</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted dark:text-slate-400 mb-1">
              Sheet Surface
            </label>
            <select
              aria-label="Notebook sheet surface color"
              data-testid="hw-sheet-surface-select"
              value={sheetSurfaceMode}
              onChange={(e) =>
                setSheetSurfaceMode(e.target.value as 'warm_paper' | 'night_slate')
              }
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100"
            >
              <option value="warm_paper">Warm Ivory Paper (#FEFDF8)</option>
              <option value="night_slate">Night Owl Slate Sheet</option>
            </select>
          </div>

          {workflowSource !== 'revision_sheet' && (
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted dark:text-slate-400 mb-1">
                  Start Page
                </label>
                <input
                  type="number"
                  min={1}
                  max={studyDoc.pageCount}
                  value={pageRangeStart}
                  onChange={(e) => setPageRangeStart(Number(e.target.value) || 1)}
                  className="w-16 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted dark:text-slate-400 mb-1">
                  End Page (/{studyDoc.pageCount})
                </label>
                <input
                  type="number"
                  min={1}
                  max={studyDoc.pageCount}
                  value={pageRangeEnd}
                  onChange={(e) => setPageRangeEnd(Number(e.target.value) || studyDoc.pageCount)}
                  className="w-16 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            data-testid="regenerate-handwritten-notes-btn"
            onClick={() => handleGenerateNotes()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Notebook Sheets</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div
          data-testid="handwritten-toast"
          className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Notebook Sheet Pagination Strip */}
      {activeNoteDoc.pages.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {activeNoteDoc.pages.map((p, idx) => (
              <button
                key={p.pageNumber}
                type="button"
                data-testid={`hw-page-btn-${idx}`}
                onClick={() => setActiveNotebookPageIndex(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                  activeNotebookPageIndex === idx
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-ink dark:text-slate-200'
                }`}
              >
                Sheet {p.pageNumber} of {activeNoteDoc.pages.length}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted dark:text-slate-400">
            {activeNoteDoc.keyFormulasCount} Boxed Formulas · {activeNoteDoc.diagramsCount} Labeled
            Sketches
          </span>
        </div>
      )}

      {/* Main Handwritten Notebook Canvas */}
      {currentNotebookPage && (
        <div
          data-testid="handwritten-notebook-canvas"
          className={`relative rounded-3xl border-2 ${
            useDarkSheet ? 'border-slate-700' : 'border-amber-200/80'
          } shadow-md overflow-hidden ${paperBackgroundStyle} ${activeFontClass}`}
        >
          {/* Left Vertical Red Margin Rule */}
          <div
            className={`hidden sm:block absolute top-0 bottom-0 w-[2px] ${
              useDarkSheet ? 'bg-rose-500/40' : 'bg-rose-400/60'
            } ${notebookStyle === 'cornell' ? 'left-44' : 'left-14'}`}
          />

          {/* Notebook Top Header */}
          <div
            className={`px-5 sm:px-8 pt-6 pb-4 border-b-2 ${
              useDarkSheet ? 'border-slate-700' : 'border-indigo-900/20'
            } flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              notebookStyle === 'cornell' ? 'sm:pl-48' : 'sm:pl-20'
            }`}
          >
            <div>
              <div
                className={`text-[10px] font-sans font-bold uppercase tracking-widest ${
                  useDarkSheet ? 'text-rose-400' : 'text-rose-600'
                }`}
              >
                Handwritten Study Notebook · {activeNoteDoc.subject}
              </div>
              <h3
                className={`text-2xl sm:text-3xl font-bold tracking-tight ${inkTextClass}`}
              >
                {activeNoteDoc.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  useDarkSheet
                    ? 'bg-slate-800 text-amber-300'
                    : 'bg-amber-100/90 text-amber-950'
                }`}
              >
                Sheet {currentNotebookPage.pageNumber}/{activeNoteDoc.pages.length}
              </span>
            </div>
          </div>

          {/* Sections inside Active Sheet */}
          <div className="p-5 sm:p-8 space-y-8">
            {currentNotebookPage.sections.map((sec) => (
              <div
                key={sec.id}
                data-testid={`hw-section-${sec.id}`}
                className={`grid grid-cols-1 ${
                  notebookStyle === 'cornell' ? 'sm:grid-cols-12 gap-4' : 'sm:pl-12 gap-3'
                }`}
              >
                {/* Cornell Left Cue Column */}
                {notebookStyle === 'cornell' && (
                  <div className="sm:col-span-3 pr-3 space-y-2 border-b sm:border-b-0 border-rose-200/60 pb-2 sm:pb-0">
                    <div
                      className={`text-[11px] font-sans font-bold uppercase tracking-wider ${
                        useDarkSheet ? 'text-rose-300' : 'text-rose-700'
                      }`}
                    >
                      Cue / Recall Margin
                    </div>
                    {sec.marginCallout && (
                      <div
                        className={`p-2.5 rounded-xl border text-sm ${
                          useDarkSheet
                            ? 'bg-amber-950/50 border-amber-800 text-amber-200'
                            : 'bg-amber-100/85 border-amber-300/80 text-amber-950'
                        }`}
                      >
                        <MathText text={sec.marginCallout} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigateToPage?.(sec.sourcePage)}
                      className={`inline-flex items-center gap-1 text-[11px] font-sans font-bold hover:underline cursor-pointer ${
                        useDarkSheet ? 'text-indigo-400' : 'text-indigo-700'
                      }`}
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>{sec.sourceLabel}</span>
                    </button>
                  </div>
                )}

                {/* Main Handwritten Section Body */}
                <div className={notebookStyle === 'cornell' ? 'sm:col-span-9 space-y-3.5' : 'space-y-3.5'}>
                  {/* Underlined Heading + Citation */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 border-b-2 pb-1 ${
                      useDarkSheet ? 'border-amber-500/40' : 'border-amber-400/70'
                    }`}
                  >
                    <h4 className={`text-xl font-bold ${inkTextClass}`}>
                      <MathText text={sec.heading} variant="inline" />
                    </h4>
                    <button
                      type="button"
                      onClick={() => onNavigateToPage?.(sec.sourcePage)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border font-sans text-[11px] font-semibold cursor-pointer ${
                        useDarkSheet
                          ? 'bg-indigo-950/70 border-indigo-800 text-indigo-300'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      }`}
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>{sec.sourceLabel}</span>
                    </button>
                  </div>

                  {/* Highlighted Key Terms Strip */}
                  {sec.highlightedTerms.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[11px] font-sans font-bold uppercase tracking-wider ${
                          useDarkSheet ? 'text-amber-300' : 'text-amber-900'
                        }`}
                      >
                        Highlighted Terms:
                      </span>
                      {sec.highlightedTerms.map((term, tIdx) => (
                        <span
                          key={tIdx}
                          className={`px-2.5 py-0.5 rounded-md text-sm font-bold shadow-2xs ${
                            useDarkSheet
                              ? 'bg-yellow-500/20 text-yellow-100'
                              : 'bg-yellow-200/90 text-[#0F172A]'
                          }`}
                        >
                          <MathText text={term} variant="inline" />
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Handwritten-Style Bullet Points */}
                  <ul className={`space-y-2.5 text-base sm:text-lg leading-relaxed ${inkTextClass}`}>
                    {sec.bulletPoints.map((bp, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2.5">
                        <span
                          className={`font-bold mt-0.5 ${
                            useDarkSheet ? 'text-indigo-400' : 'text-indigo-700'
                          }`}
                        >
                          ✎
                        </span>
                        <div className="flex-1">
                          <MathText text={bp} />
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Boxed Formulas & Equations */}
                  {sec.formulas.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {sec.formulas.map((f, fIdx) => (
                        <div
                          key={fIdx}
                          data-testid={`hw-formula-box-${fIdx}`}
                          className={`p-3.5 rounded-2xl border-2 space-y-1 shadow-2xs ${
                            useDarkSheet
                              ? 'border-indigo-400/50 bg-indigo-950/40 text-slate-100'
                              : 'border-indigo-600/50 bg-indigo-50/85 text-[#0F172A]'
                          }`}
                        >
                          <div
                            className={`text-[10px] font-sans font-bold uppercase tracking-wider ${
                              useDarkSheet ? 'text-indigo-300' : 'text-indigo-700'
                            }`}
                          >
                            ★ Boxed Formula · {f.label}
                          </div>
                          <div
                            className={`text-sm sm:text-base font-semibold overflow-x-auto ${
                              useDarkSheet ? 'text-slate-100' : 'text-[#0F172A]'
                            }`}
                          >
                            <MathText text={f.latex} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Exam Trap Warning Callout */}
                  {sec.examTrapWarning && (
                    <div
                      className={`p-3 rounded-2xl border flex items-start gap-2.5 text-sm ${
                        useDarkSheet
                          ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                          : 'bg-rose-50/95 border-rose-300 text-rose-950'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          useDarkSheet ? 'text-rose-400' : 'text-rose-600'
                        }`}
                      />
                      <div>
                        <span className="font-sans text-xs font-bold uppercase tracking-wider">JEE Exam Trap Caution: </span>
                        <MathText text={sec.examTrapWarning} variant="inline" />
                      </div>
                    </div>
                  )}

                  {/* Labeled Diagram Sketch */}
                  {sec.diagramSpec && (
                    <div className="pt-2">
                      <div
                        className={`text-[11px] font-sans font-bold uppercase tracking-wider mb-1.5 ${
                          useDarkSheet ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        Notebook Diagram Sketch ({sec.diagramSpec.title})
                      </div>
                      <DiagramRenderer
                        spec={sec.diagramSpec}
                        isDarkTheme={useDarkSheet}
                        onNavigateToPage={onNavigateToPage}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Handwritten Notes Library */}
      {savedNotes.length > 0 && (
        <div
          data-testid="saved-handwritten-notes-library"
          className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand dark:text-indigo-400" />
              <span>Saved Handwritten Note Packs ({savedNotes.length})</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedNotes.map((saved) => (
              <div
                key={saved.id}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-ink dark:text-slate-100 truncate">
                    {saved.title}
                  </div>
                  <div className="text-[11px] text-muted dark:text-slate-400">
                    {saved.pages.length} Sheets · {saved.notebookStyle} · {saved.density}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-testid={`open-saved-hw-${saved.id}`}
                    onClick={() => {
                      setActiveNoteDoc(saved);
                      setActiveNotebookPageIndex(0);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-brand text-white text-xs font-semibold cursor-pointer"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      studyStorage.deleteHandwrittenNote(saved.id);
                      setSavedNotes(studyStorage.getHandwrittenNotes(studyDoc.id));
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                    title="Delete saved handwritten notes"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
