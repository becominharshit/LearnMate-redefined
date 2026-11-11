import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
  Youtube,
} from 'lucide-react';
import { parseYouTubeUrl } from '../utils/quizGrading';

export type AddMaterialMode = 'pdf' | 'photo' | 'youtube' | 'paste';

interface AddMaterialModalProps {
  isOpen: boolean;
  initialMode?: AddMaterialMode;
  initialFile?: File | null;
  isProcessing: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  onClose: () => void;
  onUploadPdf: (file: File) => Promise<void>;
  onUploadPhotoNotes: (imageDataUrl: string, title: string) => Promise<void>;
  onSubmitYouTube: (url: string, transcript?: string, title?: string) => Promise<void>;
  onSubmitTextNotes: (title: string, rawText: string) => Promise<void>;
}

const MODE_TABS: Array<{
  id: AddMaterialMode;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'pdf', label: 'PDF file', shortLabel: 'PDF', icon: FileText },
  { id: 'photo', label: 'Photo of notes', shortLabel: 'Photo', icon: Camera },
  { id: 'youtube', label: 'YouTube link', shortLabel: 'YouTube', icon: Youtube },
  { id: 'paste', label: 'Paste text', shortLabel: 'Paste', icon: ClipboardPaste },
];

export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
  isOpen,
  initialMode = 'pdf',
  initialFile = null,
  isProcessing,
  errorMessage,
  onClearError,
  onClose,
  onUploadPdf,
  onUploadPhotoNotes,
  onSubmitYouTube,
  onSubmitTextNotes,
}) => {
  const [mode, setMode] = useState<AddMaterialMode>(initialMode);
  const [isDragOver, setIsDragOver] = useState(false);

  // Photo of notes state
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // YouTube state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeTranscript, setYoutubeTranscript] = useState('');

  // Paste text state
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setLocalError(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen || !initialFile) return;
    if (initialFile.type.startsWith('image/')) {
      setMode('photo');
      readImageFile(initialFile);
    } else if (
      initialFile.type === 'application/pdf' ||
      initialFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setMode('pdf');
      void onUploadPdf(initialFile);
    }
  }, [isOpen, initialFile]);

  const parsedYouTube = useMemo(() => parseYouTubeUrl(youtubeUrl), [youtubeUrl]);

  if (!isOpen) return null;

  const readImageFile = (file: File) => {
    setLocalError(null);
    onClearError();
    if (!file.type.startsWith('image/')) {
      setLocalError('Please choose a clear JPG, PNG or WebP photo of your notes.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLocalError('This photo is larger than 10 MB. Please use a smaller image.');
      return;
    }
    const defaultName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (defaultName && !photoTitle) {
      setPhotoTitle(defaultName);
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoPreviewUrl(reader.result);
      }
    };
    reader.onerror = () => {
      setLocalError('Could not read the selected photo. Please try another file.');
    };
    reader.readAsDataURL(file);
  };

  const handlePdfDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    setLocalError(null);
    onClearError();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      setMode('photo');
      readImageFile(file);
      return;
    }
    await onUploadPdf(file);
  };

  const handlePhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();
    if (!photoPreviewUrl) {
      setLocalError('Please choose or take a photo of your notes first.');
      return;
    }
    const cleanTitle = photoTitle.trim() || 'Scanned JEE Notes';
    await onUploadPhotoNotes(photoPreviewUrl, cleanTitle);
  };

  const handleYouTubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();
    if (!parsedYouTube.valid) {
      setLocalError(parsedYouTube.error || 'Please enter a valid YouTube link.');
      return;
    }
    await onSubmitYouTube(
      youtubeUrl.trim(),
      youtubeTranscript.trim() || undefined,
      youtubeTitle.trim() || undefined
    );
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();
    const cleanContent = pasteContent.trim();
    if (cleanContent.length < 25) {
      setLocalError('Please paste at least a paragraph of notes or formulas (25+ characters).');
      return;
    }
    const cleanTitle = pasteTitle.trim() || 'Pasted JEE Study Notes';
    await onSubmitTextNotes(cleanTitle, cleanContent);
  };

  const activeError = localError || errorMessage;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-material-modal-title"
      data-testid="add-material-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#121A2E] text-ink border border-line shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line bg-canvas">
          <div>
            <p className="lm-kicker">Add study material</p>
            <h2
              id="add-material-modal-title"
              className="font-display text-lg sm:text-xl font-extrabold text-ink"
            >
              Bring your own chapter or lecture
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close add material dialog"
            data-testid="close-add-material-modal"
            className="w-9 h-9 rounded-full border border-line bg-white dark:bg-[#121A2E] hover:bg-soft flex items-center justify-center text-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode selector tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-2.5 bg-soft/60 border-b border-line" role="tablist">
          {MODE_TABS.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`add-material-tab-${item.id}`}
                onClick={() => {
                  setMode(item.id);
                  setLocalError(null);
                  onClearError();
                }}
                disabled={isProcessing}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 px-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#121A2E] text-brand shadow-2xs border border-brand-200 dark:border-brand/40'
                    : 'text-muted hover:text-ink hover:bg-white/60 dark:hover:bg-[#1A2440]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden text-[11px]">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {activeError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3.5 text-xs text-ink"
            >
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{activeError}</div>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  onClearError();
                }}
                aria-label="Dismiss error"
                className="text-muted hover:text-ink cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 1. PDF TAB */}
          {mode === 'pdf' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handlePdfDrop}
                onClick={() => !isProcessing && pdfInputRef.current?.click()}
                data-testid="pdf-dropzone"
                className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                  isDragOver
                    ? 'border-brand bg-brand-soft/60'
                    : 'border-line bg-canvas hover:border-brand-200 hover:bg-brand-soft/20'
                }`}
              >
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await onUploadPdf(file);
                    }
                    e.target.value = '';
                  }}
                />
                <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mb-3">
                  {isProcessing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <p className="text-sm font-bold text-ink">
                  {isProcessing
                    ? 'Reading pages and extracting JEE topics…'
                    : 'Drop your chapter PDF here, or tap to browse'}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Up to 60 pages per PDF. Stored locally in IndexedDB with smart page-aware retrieval.
                </p>
                {!isProcessing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      pdfInputRef.current?.click();
                    }}
                    className="mt-3 px-4 py-2 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select PDF File</span>
                  </button>
                )}
              </div>

              {/* Or add via alternative pills (matching wanted/LearnMate JEE Add Material Modal-8.png) */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line text-xs">
                <span className="font-semibold text-muted">Or add via:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMode('photo')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-canvas hover:bg-soft text-ink font-semibold cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-brand" />
                    <span>Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('youtube')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-canvas hover:bg-soft text-ink font-semibold cursor-pointer"
                  >
                    <Youtube className="w-3.5 h-3.5 text-danger" />
                    <span>YouTube</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('paste')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-canvas hover:bg-soft text-ink font-semibold cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-brand" />
                    <span>Paste Text</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. PHOTO OF NOTES TAB */}
          {mode === 'photo' && (
            <form onSubmit={handlePhotoSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="photo-notes-title"
                  className="block text-xs font-semibold text-ink mb-1.5"
                >
                  Chapter or topic title
                </label>
                <input
                  id="photo-notes-title"
                  type="text"
                  value={photoTitle}
                  onChange={(e) => setPhotoTitle(e.target.value)}
                  placeholder="e.g. Rotational Motion — Class Notes"
                  className="w-full h-10 rounded-xl border border-line bg-canvas px-3.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
                />
              </div>

              <div
                onClick={() => !isProcessing && photoInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed border-line bg-canvas hover:border-brand-200 p-5 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) readImageFile(file);
                    e.target.value = '';
                  }}
                />
                {photoPreviewUrl ? (
                  <div className="space-y-3">
                    <img
                      src={photoPreviewUrl}
                      alt="Selected notes preview"
                      className="max-h-52 mx-auto rounded-xl border border-line object-contain bg-white dark:bg-[#0B1020]"
                    />
                    <p className="text-xs font-semibold text-brand">
                      Tap to choose a different photo
                    </p>
                  </div>
                ) : (
                  <div className="py-4">
                    <div className="mx-auto w-11 h-11 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mb-2.5">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-ink">
                      Take a photo or upload an image of your notes
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      JPG, PNG or WebP (up to 10 MB). Claude transcribes handwritten equations and headings into study pages.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2.5 rounded-xl border border-line bg-white dark:bg-[#121A2E] text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !photoPreviewUrl}
                  data-testid="submit-photo-notes-btn"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Reading handwritten notes…
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Scan &amp; add to library
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 3. YOUTUBE URL-FIRST LECTURE PROCESSOR TAB (Up to 12 Hours / 720 Mins) */}
          {mode === 'youtube' && (
            <form onSubmit={handleYouTubeSubmit} className="space-y-4" data-testid="youtube-url-first-form">
              <div className="rounded-2xl border border-line bg-canvas p-3.5 sm:p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-ink">
                    URL-First Lecture Analyzer • Supports up to 12-hour (720 min) JEE marathons
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-soft text-brand border border-brand-200">
                    No transcript pasting required
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Paste any YouTube lecture URL below. LearnMate automatically discovers available captions/chapters, chunks multi-hour lectures with timestamp preservation, and builds chapter-wise study notes, formulas, flashcards, and quizzes.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-muted">Try verified marathon:</span>
                  <button
                    type="button"
                    data-testid="preset-youtube-12hr-physics"
                    onClick={() => {
                      setYoutubeUrl('https://www.youtube.com/watch?v=jee12hrphys');
                      setYoutubeTitle('JEE Main Complete Physics 12-Hour Revision Marathon');
                      setLocalError(null);
                      onClearError();
                    }}
                    className="px-2.5 py-1 rounded-lg border border-line bg-white dark:bg-[#121A2E] hover:border-brand text-[11px] font-semibold text-ink cursor-pointer transition-colors"
                  >
                    12-Hr Physics Marathon (720m)
                  </button>
                  <button
                    type="button"
                    data-testid="preset-youtube-6hr-chem"
                    onClick={() => {
                      setYoutubeUrl('https://www.youtube.com/watch?v=jee6hrochem');
                      setYoutubeTitle('Complete Organic Chemistry 6.5-Hour Marathon');
                      setLocalError(null);
                      onClearError();
                    }}
                    className="px-2.5 py-1 rounded-lg border border-line bg-white dark:bg-[#121A2E] hover:border-brand text-[11px] font-semibold text-ink cursor-pointer transition-colors"
                  >
                    6.5-Hr Organic Chem Marathon (390m)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="youtube-url-input"
                    className="block text-xs font-semibold text-ink mb-1"
                  >
                    YouTube lecture URL
                  </label>
                  <input
                    id="youtube-url-input"
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    data-testid="youtube-url-input"
                    className="w-full h-10 rounded-xl border border-line bg-canvas px-3.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label
                    htmlFor="youtube-title-input"
                    className="block text-xs font-semibold text-ink mb-1"
                  >
                    Lecture title (optional — auto-detected)
                  </label>
                  <input
                    id="youtube-title-input"
                    type="text"
                    value={youtubeTitle}
                    onChange={(e) => setYoutubeTitle(e.target.value)}
                    placeholder="Auto-detected from YouTube"
                    data-testid="youtube-title-input"
                    className="w-full h-10 rounded-xl border border-line bg-canvas px-3.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Official YouTube player preview when URL is valid */}
              {parsedYouTube.valid && parsedYouTube.videoId && (
                <div className="rounded-xl overflow-hidden border border-line bg-black aspect-video max-h-48 mx-auto w-full">
                  <iframe
                    title="YouTube lecture preview"
                    src={`https://www.youtube-nocookie.com/embed/${parsedYouTube.videoId}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Optional manual transcript override collapsed by default */}
              <details className="rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-xs">
                <summary className="font-semibold text-muted hover:text-ink cursor-pointer select-none">
                  Advanced / Optional: Provide custom lecture notes or transcript override
                </summary>
                <div className="mt-2.5">
                  <textarea
                    id="youtube-transcript-input"
                    rows={4}
                    value={youtubeTranscript}
                    onChange={(e) => setYoutubeTranscript(e.target.value)}
                    placeholder="Optional: only needed if a restricted video has disabled public captions and you want to supply your own lecture notes..."
                    data-testid="youtube-transcript-input"
                    className="w-full rounded-xl border border-line bg-white dark:bg-[#121A2E] p-3 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-brand font-mono leading-relaxed"
                  />
                </div>
              </details>

              {isProcessing && (
                <div
                  data-testid="youtube-processing-stages"
                  className="rounded-xl border border-brand-200 bg-brand-soft/40 p-3 text-xs text-ink flex items-center gap-2.5"
                >
                  <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
                  <div>
                    <p className="font-bold text-ink">
                      Analyzing YouTube lecture &amp; extracting timestamped chapters…
                    </p>
                    <p className="text-[11px] text-muted">
                      Validating URL → Fetching captions &amp; metadata → Hierarchical chunking (up to 12 hours) → Extracting JEE formulas &amp; study pages
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2.5 rounded-xl border border-line bg-white dark:bg-[#121A2E] text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  data-testid="submit-youtube-btn"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing lecture…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Analyze Lecture &amp; Generate Study Material
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 4. PASTE TEXT TAB */}
          {mode === 'paste' && (
            <form onSubmit={handlePasteSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="paste-notes-title"
                  className="block text-xs font-semibold text-ink mb-1"
                >
                  Chapter or topic title
                </label>
                <input
                  id="paste-notes-title"
                  type="text"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="e.g. Chemical Thermodynamics — Formula & Concept Notes"
                  data-testid="paste-title-input"
                  className="w-full h-10 rounded-xl border border-line bg-canvas px-3.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label
                  htmlFor="paste-notes-content"
                  className="block text-xs font-semibold text-ink mb-1"
                >
                  Your notes, derivations, or coaching material text
                </label>
                <textarea
                  id="paste-notes-content"
                  rows={7}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder="Paste your chapter summary, derivations, or coaching sheet text here…"
                  data-testid="paste-content-input"
                  className="w-full rounded-xl border border-line bg-canvas p-3.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2.5 rounded-xl border border-line bg-white dark:bg-[#121A2E] text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  data-testid="submit-paste-notes-btn"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Organising notes…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save to my materials
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
